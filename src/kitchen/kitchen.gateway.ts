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
import { KitchenService } from './kitchen.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/kitchen',
  transports: ['websocket', 'polling'],
})
export class KitchenGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(KitchenGateway.name);

  constructor(
    private readonly kitchenService: KitchenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Kitchen WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify(token, { secret: this.config.get('jwt.secret') });
      client.data.user = payload;
      client.data.branchId = payload.branchId;
      client.data.tenantId = payload.tenantId;

      // Join branch room
      client.join(`branch:${payload.branchId}`);
      client.join(`tenant:${payload.tenantId}`);

      this.logger.log(`Client connected: ${client.id} (${payload.email})`);
    } catch (err) {
      this.logger.warn(`Unauthorized WS connection: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── POS → Kitchen ──────────────────────────────────────────

  // Emit new order to kitchen
  emitNewOrder(branchId: string, orderData: any) {
    this.server.to(`branch:${branchId}`).emit('kitchen:new_order', orderData);
  }

  // Emit order update
  emitOrderUpdate(branchId: string, orderData: any) {
    this.server.to(`branch:${branchId}`).emit('kitchen:order_updated', orderData);
  }

  // Emit item update
  emitItemUpdate(branchId: string, itemData: any) {
    this.server.to(`branch:${branchId}`).emit('kitchen:item_updated', itemData);
  }

  // ── Kitchen → Server ───────────────────────────────────────

  @SubscribeMessage('kitchen:update_item')
  async handleItemUpdate(
    @MessageBody() data: { itemId: string; status: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { branchId, tenantId } = client.data;
    const result = await this.kitchenService.updateItemStatus(
      data.itemId,
      data.status as any,
      branchId,
    );

    // Broadcast to all in branch
    this.server.to(`branch:${branchId}`).emit('kitchen:item_updated', result);
    // Notify POS
    this.server.to(`branch:${branchId}`).emit('pos:item_updated', result);

    return result;
  }

  @SubscribeMessage('kitchen:order_ready')
  async handleOrderReady(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { branchId } = client.data;
    const result = await this.kitchenService.markOrderReady(data.orderId, branchId);

    this.server.to(`branch:${branchId}`).emit('kitchen:order_ready', result);
    this.server.to(`branch:${branchId}`).emit('pos:order_ready', result);

    return result;
  }

  @SubscribeMessage('kitchen:get_orders')
  async handleGetOrders(@ConnectedSocket() client: Socket) {
    const { branchId } = client.data;
    return this.kitchenService.getActiveOrders(branchId);
  }

  @SubscribeMessage('pos:call_waiter')
  async handleCallWaiter(
    @MessageBody() data: { tableId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { branchId } = client.data;
    this.server.to(`branch:${branchId}`).emit('pos:waiter_called', {
      tableId: data.tableId,
      message: data.message,
      timestamp: new Date(),
    });
  }
}
