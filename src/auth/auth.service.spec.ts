import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwt: jest.Mocked<JwtService>;

  const mockTenant = {
    id: 'tenant-1',
    name: 'Test Cafe',
    slug: 'test-cafe',
    isActive: true,
    currency: 'TRY',
  };

  const mockUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'test@cafe.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'OWNER',
    isActive: true,
    passwordHash: '$2b$12$hashedpassword',
    tenant: mockTenant,
  };

  beforeEach(async () => {
    const prismaMock = {
      tenant: { findUnique: jest.fn(), create: jest.fn() },
      user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      subscription: { create: jest.fn() },
      subscriptionPlan: { findFirst: jest.fn() },
      branch: { create: jest.fn() },
      refreshToken: { create: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn() },
      tenantSettings: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
  });

  // ── Register ─────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      businessName: 'Test Cafe',
      slug: 'test-cafe',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@cafe.com',
      phone: '+905551234567',
      password: 'StrongPass1!',
    };

    it('should throw ConflictException if slug exists', async () => {
      prisma.tenant.findUnique = jest.fn().mockResolvedValue(mockTenant);
      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if email exists', async () => {
      prisma.tenant.findUnique = jest.fn().mockResolvedValue(null);
      prisma.user.findFirst = jest.fn().mockResolvedValue(mockUser);
      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should create tenant, user, and branch on success', async () => {
      prisma.tenant.findUnique = jest.fn().mockResolvedValue(null);
      prisma.user.findFirst = jest.fn().mockResolvedValue(null);
      prisma.subscriptionPlan.findFirst = jest.fn().mockResolvedValue(null);
      prisma.$transaction = jest.fn().mockImplementation(async (fn) => {
        return fn({
          tenant: { create: jest.fn().mockResolvedValue(mockTenant) },
          subscription: { create: jest.fn() },
          user: { create: jest.fn().mockResolvedValue(mockUser) },
          branch: { create: jest.fn() },
        });
      });
      prisma.refreshToken.create = jest.fn().mockResolvedValue({});

      const result = await service.register(registerDto);
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
    });
  });

  // ── Login ─────────────────────────────────────────────────

  describe('login', () => {
    it('should throw UnauthorizedException for invalid email', async () => {
      prisma.user.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.login({ email: 'wrong@x.com', password: 'pass' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      prisma.user.findFirst = jest.fn().mockResolvedValue({
        ...mockUser,
        passwordHash: await bcrypt.hash('correct', 1),
      });
      await expect(service.login({ email: mockUser.email, password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens on success', async () => {
      const hash = await bcrypt.hash('StrongPass1!', 1);
      prisma.user.findFirst = jest.fn().mockResolvedValue({ ...mockUser, passwordHash: hash });
      prisma.user.update = jest.fn().mockResolvedValue(mockUser);
      prisma.refreshToken.create = jest.fn().mockResolvedValue({});

      const result = await service.login({ email: mockUser.email, password: 'StrongPass1!' });
      expect(result.accessToken).toBe('token');
      expect(result.user).toBeDefined();
    });
  });

  // ── Logout ─────────────────────────────────────────────────

  describe('logout', () => {
    it('should delete refresh tokens', async () => {
      prisma.refreshToken.deleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const result = await service.logout('user-1');
      expect(result.message).toBeDefined();
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });
});
