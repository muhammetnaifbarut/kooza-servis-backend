import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if tenant slug is available
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existingTenant) {
      throw new ConflictException('Bu işletme adı kullanılıyor');
    }

    // Check if email is available
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Bu e-posta adresi zaten kullanılıyor');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Find starter plan
    const starterPlan = await this.prisma.subscriptionPlan.findFirst({
      where: { slug: 'starter', isActive: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.businessName,
          slug: dto.slug,
          email: dto.email,
          phone: dto.phone,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          settings: { create: {} },
        },
      });

      // Create subscription (trial)
      if (starterPlan) {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: starterPlan.id,
            status: 'TRIALING',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        });
      }

      // Create owner user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          phone: dto.phone,
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
          role: 'OWNER',
        },
      });

      // Create main branch
      await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Merkez Şube',
          code: 'MERKEZ',
        },
      });

      return { tenant, user };
    });

    const tokens = await this.generateTokens(result.user);

    return {
      message: 'Kayıt başarılı! 14 günlük deneme süreniz başladı.',
      user: this.sanitizeUser(result.user),
      tenant: result.tenant,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }

    if (!user.tenant.isActive) {
      throw new UnauthorizedException('İşletme hesabı aktif değil');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tenant: user.tenant,
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('jwt.refreshSecret'),
      });

      const stored = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: { include: { tenant: true } } },
      });

      if (!stored || stored.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token geçersiz');
      }

      // Rotate refresh token
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      const tokens = await this.generateTokens(stored.user);

      return tokens;
    } catch {
      throw new UnauthorizedException('Refresh token geçersiz');
    }
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { userId, token: refreshToken },
      });
    } else {
      // Logout all sessions
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }
    return { message: 'Çıkış yapıldı' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new BadRequestException('Mevcut şifre hatalı');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Invalidate all refresh tokens
    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    return { message: 'Şifre güncellendi' };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({ where: { email } });
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      return user;
    }
    return null;
  }

  private async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('jwt.secret'),
        expiresIn: this.config.get('jwt.expiresIn'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpiresIn'),
      }),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
