import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// Rol öncelik sıralaması (yüksek = daha öncelikli)
const ROLE_PRIORITY: Record<string, number> = {
  SUPER_ADMIN: 100,
  OWNER: 90,
  MANAGER: 70,
  CASHIER: 50,
  WAITER: 40,
  KITCHEN: 30,
  DELIVERY: 20,
  ACCOUNTANT: 10,
};

// Kanal türleri
export type VoiceChannel = 'all' | 'waiter' | 'kitchen' | 'manager';

// Kanal izinleri — hangi roller hangi kanalları kullanabilir
const CHANNEL_ROLES: Record<VoiceChannel, string[]> = {
  all: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER', 'DELIVERY'],
  waiter: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'WAITER', 'CASHIER'],
  kitchen: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'KITCHEN'],
  manager: ['SUPER_ADMIN', 'OWNER', 'MANAGER'],
};

interface ChannelLock {
  socketId: string;
  userId: string;
  userName: string;
  role: string;
  priority: number;
  lockedAt: Date;
}

interface VoiceUser {
  socketId: string;
  userId: string;
  userName: string;
  role: string;
  priority: number;
  tenantId: string;
  branchId: string;
  channels: Set<VoiceChannel>;
}

// tenantId:branchId:channel → lock
const channelLocks = new Map<string, ChannelLock>();
// socketId → VoiceUser
const connectedUsers = new Map<string, VoiceUser>();

function channelKey(tenantId: string, branchId: string, channel: VoiceChannel) {
  return `${tenantId}:${branchId}:${channel}`;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/voice',
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6, // 1MB for audio chunks
})
export class VoiceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Voice WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify(token, {
        secret: this.config.get('jwt.secret'),
      });

      const voiceUser: VoiceUser = {
        socketId: client.id,
        userId: payload.sub,
        userName: `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || payload.email,
        role: payload.role,
        priority: ROLE_PRIORITY[payload.role] ?? 0,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
        channels: new Set(),
      };

      connectedUsers.set(client.id, voiceUser);
      client.data.voice = voiceUser;

      // Tenant/branch room'una katıl
      client.join(`tenant:${payload.tenantId}`);
      client.join(`branch:${payload.tenantId}:${payload.branchId}`);

      this.logger.log(`Voice connected: ${voiceUser.userName} (${voiceUser.role})`);

      // Bağlı kullanıcıları bildir
      this.broadcastUsers(voiceUser.tenantId, voiceUser.branchId);
    } catch {
      this.logger.warn(`Unauthorized voice connection: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const voiceUser = connectedUsers.get(client.id);
    if (voiceUser) {
      // Tüm kanal kilitlerini serbest bırak
      for (const channel of voiceUser.channels) {
        this.releaseLock(voiceUser.tenantId, voiceUser.branchId, channel, client.id);
      }
      connectedUsers.delete(client.id);
      this.broadcastUsers(voiceUser.tenantId, voiceUser.branchId);
    }
    this.logger.log(`Voice disconnected: ${client.id}`);
  }

  // ── Kanal Yönetimi ─────────────────────────────────────────

  @SubscribeMessage('voice:join_channel')
  handleJoinChannel(
    @MessageBody() data: { channel: VoiceChannel },
    @ConnectedSocket() client: Socket,
  ) {
    const voiceUser: VoiceUser = client.data.voice;
    if (!voiceUser) return { ok: false, error: 'not authenticated' };

    const allowed = CHANNEL_ROLES[data.channel];
    if (!allowed?.includes(voiceUser.role)) {
      return { ok: false, error: 'permission denied' };
    }

    voiceUser.channels.add(data.channel);
    client.join(`channel:${voiceUser.tenantId}:${voiceUser.branchId}:${data.channel}`);

    this.logger.log(`${voiceUser.userName} joined channel: ${data.channel}`);

    // Kanal durumunu gönder
    const lockKey = channelKey(voiceUser.tenantId, voiceUser.branchId, data.channel);
    const lock = channelLocks.get(lockKey);

    return {
      ok: true,
      channel: data.channel,
      activeSpeaker: lock ? { userId: lock.userId, userName: lock.userName } : null,
    };
  }

  @SubscribeMessage('voice:leave_channel')
  handleLeaveChannel(
    @MessageBody() data: { channel: VoiceChannel },
    @ConnectedSocket() client: Socket,
  ) {
    const voiceUser: VoiceUser = client.data.voice;
    if (!voiceUser) return;

    voiceUser.channels.delete(data.channel);
    client.leave(`channel:${voiceUser.tenantId}:${voiceUser.branchId}:${data.channel}`);
    this.releaseLock(voiceUser.tenantId, voiceUser.branchId, data.channel, client.id);

    return { ok: true };
  }

  // ── Push-to-Talk ────────────────────────────────────────────

  @SubscribeMessage('voice:ptt_start')
  handlePttStart(
    @MessageBody() data: { channel: VoiceChannel },
    @ConnectedSocket() client: Socket,
  ) {
    const voiceUser: VoiceUser = client.data.voice;
    if (!voiceUser) return { ok: false, error: 'not authenticated' };

    if (!voiceUser.channels.has(data.channel)) {
      return { ok: false, error: 'not in channel' };
    }

    const lockKey = channelKey(voiceUser.tenantId, voiceUser.branchId, data.channel);
    const existingLock = channelLocks.get(lockKey);

    if (existingLock && existingLock.socketId !== client.id) {
      // Öncelik kontrolü — daha yüksek öncelikli kullanıcı konuşmayı alabilir
      if (voiceUser.priority > existingLock.priority) {
        // Mevcut konuşmacıyı sustur
        this.server.to(existingLock.socketId).emit('voice:ptt_revoked', {
          channel: data.channel,
          revokedBy: voiceUser.userName,
        });
        this.logger.log(
          `${voiceUser.userName} preempted ${existingLock.userName} on channel ${data.channel}`,
        );
      } else {
        return {
          ok: false,
          error: 'channel busy',
          activeSpeaker: {
            userId: existingLock.userId,
            userName: existingLock.userName,
          },
        };
      }
    }

    const lock: ChannelLock = {
      socketId: client.id,
      userId: voiceUser.userId,
      userName: voiceUser.userName,
      role: voiceUser.role,
      priority: voiceUser.priority,
      lockedAt: new Date(),
    };
    channelLocks.set(lockKey, lock);

    // Kanal üyelerine bildir
    const channelRoom = `channel:${voiceUser.tenantId}:${voiceUser.branchId}:${data.channel}`;
    this.server.to(channelRoom).emit('voice:speaker_change', {
      channel: data.channel,
      activeSpeaker: { userId: voiceUser.userId, userName: voiceUser.userName, role: voiceUser.role },
    });

    this.logger.log(`PTT start: ${voiceUser.userName} on ${data.channel}`);
    return { ok: true };
  }

  @SubscribeMessage('voice:ptt_stop')
  handlePttStop(
    @MessageBody() data: { channel: VoiceChannel },
    @ConnectedSocket() client: Socket,
  ) {
    const voiceUser: VoiceUser = client.data.voice;
    if (!voiceUser) return;

    this.releaseLock(voiceUser.tenantId, voiceUser.branchId, data.channel, client.id);
    return { ok: true };
  }

  // ── Ses Veri Aktarımı ───────────────────────────────────────

  @SubscribeMessage('voice:audio_chunk')
  handleAudioChunk(
    @MessageBody() data: { channel: VoiceChannel; chunk: ArrayBuffer },
    @ConnectedSocket() client: Socket,
  ) {
    const voiceUser: VoiceUser = client.data.voice;
    if (!voiceUser) return;

    // Kilidin bu kullanıcıya ait olduğunu doğrula
    const lockKey = channelKey(voiceUser.tenantId, voiceUser.branchId, data.channel);
    const lock = channelLocks.get(lockKey);
    if (!lock || lock.socketId !== client.id) return;

    // Ses verisini kanaldaki diğer kullanıcılara ilet (göndericinin kendisi hariç)
    const channelRoom = `channel:${voiceUser.tenantId}:${voiceUser.branchId}:${data.channel}`;
    client.to(channelRoom).emit('voice:audio_chunk', {
      channel: data.channel,
      chunk: data.chunk,
      userId: voiceUser.userId,
      userName: voiceUser.userName,
    });
  }

  // ── WebRTC Sinyalizasyon (peer-to-peer ses için opsiyonel) ──

  @SubscribeMessage('voice:rtc_offer')
  handleRtcOffer(
    @MessageBody() data: { targetSocketId: string; offer: any },
    @ConnectedSocket() client: Socket,
  ) {
    const voiceUser: VoiceUser = client.data.voice;
    this.server.to(data.targetSocketId).emit('voice:rtc_offer', {
      fromSocketId: client.id,
      fromUserId: voiceUser?.userId,
      fromUserName: voiceUser?.userName,
      offer: data.offer,
    });
  }

  @SubscribeMessage('voice:rtc_answer')
  handleRtcAnswer(
    @MessageBody() data: { targetSocketId: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.targetSocketId).emit('voice:rtc_answer', {
      fromSocketId: client.id,
      answer: data.answer,
    });
  }

  @SubscribeMessage('voice:rtc_ice')
  handleRtcIce(
    @MessageBody() data: { targetSocketId: string; candidate: any },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.targetSocketId).emit('voice:rtc_ice', {
      fromSocketId: client.id,
      candidate: data.candidate,
    });
  }

  // ── Yardımcı Metotlar ───────────────────────────────────────

  private releaseLock(
    tenantId: string,
    branchId: string,
    channel: VoiceChannel,
    socketId: string,
  ) {
    const lockKey = channelKey(tenantId, branchId, channel);
    const lock = channelLocks.get(lockKey);
    if (lock && lock.socketId === socketId) {
      channelLocks.delete(lockKey);
      const channelRoom = `channel:${tenantId}:${branchId}:${channel}`;
      this.server.to(channelRoom).emit('voice:speaker_change', {
        channel,
        activeSpeaker: null,
      });
      this.logger.log(`PTT released on channel ${channel}`);
    }
  }

  private broadcastUsers(tenantId: string, branchId: string) {
    const branchRoom = `branch:${tenantId}:${branchId}`;
    const users = Array.from(connectedUsers.values())
      .filter((u) => u.tenantId === tenantId && u.branchId === branchId)
      .map((u) => ({
        socketId: u.socketId,
        userId: u.userId,
        userName: u.userName,
        role: u.role,
        channels: Array.from(u.channels),
      }));
    this.server.to(branchRoom).emit('voice:users_update', { users });
  }

  // Tüm kanallardaki durum bilgisi
  @SubscribeMessage('voice:get_status')
  handleGetStatus(@ConnectedSocket() client: Socket) {
    const voiceUser: VoiceUser = client.data.voice;
    if (!voiceUser) return;

    const channels: VoiceChannel[] = ['all', 'waiter', 'kitchen', 'manager'];
    const status: Record<string, any> = {};

    for (const channel of channels) {
      const lockKey = channelKey(voiceUser.tenantId, voiceUser.branchId, channel);
      const lock = channelLocks.get(lockKey);
      status[channel] = lock
        ? { activeSpeaker: { userId: lock.userId, userName: lock.userName } }
        : { activeSpeaker: null };
    }

    const users = Array.from(connectedUsers.values())
      .filter((u) => u.tenantId === voiceUser.tenantId && u.branchId === voiceUser.branchId)
      .map((u) => ({
        socketId: u.socketId,
        userId: u.userId,
        userName: u.userName,
        role: u.role,
        channels: Array.from(u.channels),
      }));

    return { status, users };
  }
}
