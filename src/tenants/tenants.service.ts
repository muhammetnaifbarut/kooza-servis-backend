import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { subscription: { include: { plan: true } }, settings: true },
    });
    if (!tenant) throw new NotFoundException('İşletme bulunamadı');
    return tenant;
  }

  async update(id: string, dto: any) {
    return this.prisma.tenant.update({ where: { id }, data: dto });
  }

  async updateSettings(tenantId: string, dto: any) {
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });
  }

  async getBranches(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: { select: { users: true, tables: true, orders: true } },
      },
    });
  }

  async createBranch(tenantId: string, dto: any) {
    return this.prisma.branch.create({ data: { tenantId, ...dto } });
  }

  async getUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, role: true, branchId: true,
        lastLoginAt: true, createdAt: true,
      },
    });
  }

  async createUser(tenantId: string, dto: any) {
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(dto.password || 'changeme123', 12);
    return this.prisma.user.create({
      data: { tenantId, ...dto, passwordHash, password: undefined },
    });
  }

  async updateUser(id: string, tenantId: string, dto: any) {
    return this.prisma.user.update({
      where: { id },
      data: { ...dto, passwordHash: undefined, password: undefined },
    });
  }
}
