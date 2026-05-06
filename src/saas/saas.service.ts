import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SaasService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async getSubscription(tenantId: string) {
    return this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
  }

  async checkLicense(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    const now = new Date();
    const isActive = sub &&
      ['ACTIVE', 'TRIALING'].includes(sub.status) &&
      sub.currentPeriodEnd > now;
    return {
      isActive,
      status: sub?.status,
      plan: sub?.plan?.name,
      expiresAt: sub?.currentPeriodEnd,
    };
  }

  async seedPlans() {
    const plans = [
      { name: 'Starter', slug: 'starter', price: 0, maxBranches: 1, maxUsers: 3, maxProducts: 50, features: ['pos', 'kitchen'] },
      { name: 'Business', slug: 'business', price: 299, maxBranches: 3, maxUsers: 15, maxProducts: 500, features: ['pos', 'kitchen', 'stock', 'crm', 'reports'] },
      { name: 'Enterprise', slug: 'enterprise', price: 799, maxBranches: 999, maxUsers: 999, maxProducts: 9999, features: ['pos', 'kitchen', 'stock', 'crm', 'reports', 'ai', 'online-orders', 'franchise'] },
    ];
    for (const plan of plans) {
      await this.prisma.subscriptionPlan.upsert({
        where: { slug: plan.slug },
        create: { ...plan, features: plan.features },
        update: {},
      });
    }
    return plans;
  }
}
