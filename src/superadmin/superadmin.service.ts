import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      totalTenants,
      activeTenants,
      totalUsers,
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { status: 'TRIALING' } }),
      this.prisma.subscription.count({ where: { status: { in: ['EXPIRED', 'CANCELED'] } } }),
      this.prisma.subscriptionPlan.findMany({ select: { price: true, subscriptions: { select: { status: true } } } }),
    ]);

    // Aylık gelir tahmini (aktif abonelik * plan fiyatı)
    const monthlyRevenue = totalRevenue.reduce((sum, plan) => {
      const activeSubs = plan.subscriptions.filter((s) => s.status === 'ACTIVE').length;
      return sum + activeSubs * plan.price;
    }, 0);

    // Son 7 gün yeni kayıt
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const newTenantsThisWeek = await this.prisma.tenant.count({
      where: { createdAt: { gte: weekAgo } },
    });

    return {
      tenants: { total: totalTenants, active: activeTenants, newThisWeek: newTenantsThisWeek },
      users: { total: totalUsers },
      subscriptions: { active: activeSubscriptions, trial: trialSubscriptions, expired: expiredSubscriptions },
      revenue: { monthly: monthlyRevenue },
    };
  }

  async listTenants(opts: { page: number; limit: number; search?: string; status?: string }) {
    const { page, limit, search, status } = opts;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { include: { plan: true } },
          _count: { select: { users: true, branches: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data: tenants, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getTenantDetail(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        branches: { include: { _count: { select: { users: true, orders: true } } } },
        settings: true,
        _count: { select: { users: true, products: true, customers: true, branches: true } },
      },
    });
    if (!tenant) throw new NotFoundException('İşletme bulunamadı');

    // Son 30 gün sipariş sayısı
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const recentOrders = await this.prisma.order.count({
      where: { tenantId: id, createdAt: { gte: monthAgo } },
    });

    return { ...tenant, recentOrders };
  }

  async setTenantActive(id: string, isActive: boolean) {
    return this.prisma.tenant.update({ where: { id }, data: { isActive } });
  }

  async deleteTenant(id: string) {
    await this.prisma.tenant.delete({ where: { id } });
  }

  async listSubscriptions(status?: string) {
    const where: any = {};
    if (status) where.status = status.toUpperCase();

    return this.prisma.subscription.findMany({
      where,
      orderBy: { currentPeriodEnd: 'asc' },
      include: {
        tenant: { select: { id: true, name: true, slug: true, email: true } },
        plan: true,
      },
    });
  }

  async updateSubscription(tenantId: string, dto: { planId?: string; status?: string; expiresAt?: string }) {
    const data: any = {};
    if (dto.planId) data.planId = dto.planId;
    if (dto.status) data.status = dto.status;
    if (dto.expiresAt) data.currentPeriodEnd = new Date(dto.expiresAt);

    return this.prisma.subscription.update({ where: { tenantId }, data });
  }

  async listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async updatePlan(id: string, dto: any) {
    return this.prisma.subscriptionPlan.update({ where: { id }, data: dto });
  }

  async getRevenue(period: 'week' | 'month' | 'year') {
    const plans = await this.prisma.subscriptionPlan.findMany({
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { tenant: { select: { name: true } } },
        },
      },
    });

    return plans.map((plan) => ({
      plan: plan.name,
      price: plan.price,
      activeCount: plan.subscriptions.length,
      revenue: plan.subscriptions.length * plan.price,
    }));
  }

  async listAllUsers(opts: { page: number; limit: number; role?: string }) {
    const { page, limit, role } = opts;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, firstName: true, lastName: true,
          email: true, role: true, isActive: true,
          lastLoginAt: true, createdAt: true,
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, total, page, limit };
  }
}
