import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Customers ──────────────────────────────────────────────

  async findAllCustomers(tenantId: string, query: any) {
    const where: any = {
      tenantId,
      isActive: true,
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: {
          id: true, firstName: true, lastName: true,
          phone: true, email: true, loyaltyPoints: true,
          totalSpent: true, visitCount: true, createdAt: true,
        },
        orderBy: { totalSpent: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { customers, total };
  }

  async findOneCustomer(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        orders: {
          where: { status: 'CLOSED' },
          select: { id: true, orderNumber: true, total: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        loyaltyLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı');
    return customer;
  }

  async createCustomer(dto: any, tenantId: string) {
    return this.prisma.customer.create({ data: { ...dto, tenantId } });
  }

  async updateCustomer(id: string, dto: any, tenantId: string) {
    await this.findOneCustomer(id, tenantId);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  // ── Loyalty ─────────────────────────────────────────────────

  async earnPoints(customerId: string, orderId: string, tenantId: string) {
    const [customer, settings, order] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: customerId, tenantId } }),
      this.prisma.tenantSettings.findUnique({ where: { tenantId } }),
      this.prisma.order.findUnique({ where: { id: orderId } }),
    ]);

    if (!customer || !order) return;

    const rate = settings?.loyaltyRate || 1;
    const points = Math.floor(order.total * rate);

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { increment: points } },
      });

      await tx.loyaltyLog.create({
        data: {
          customerId,
          type: 'EARN',
          points,
          reference: orderId,
        },
      });
    });

    return { customerId, pointsEarned: points };
  }

  async redeemPoints(customerId: string, points: number, orderId: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı');
    if (customer.loyaltyPoints < points) {
      throw new Error('Yetersiz puan');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { decrement: points } },
      });

      await tx.loyaltyLog.create({
        data: { customerId, type: 'REDEEM', points: -points, reference: orderId },
      });
    });

    return { customerId, pointsRedeemed: points, remaining: customer.loyaltyPoints - points };
  }

  // ── Campaigns ───────────────────────────────────────────────

  async findCampaigns(tenantId: string) {
    return this.prisma.campaign.findMany({
      where: { tenantId },
      include: { _count: { select: { logs: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(dto: any, tenantId: string) {
    return this.prisma.campaign.create({ data: { ...dto, tenantId } });
  }

  async updateCampaign(id: string, dto: any, tenantId: string) {
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }

  async getActiveCampaigns(tenantId: string, orderAmount: number) {
    const now = new Date();
    return this.prisma.campaign.findMany({
      where: {
        tenantId,
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
        ...(orderAmount > 0 && { minAmount: { lte: orderAmount } }),
      },
    });
  }

  // ── Analytics ───────────────────────────────────────────────

  async getCustomerStats(tenantId: string) {
    const [total, newThisMonth, topSpenders] = await Promise.all([
      this.prisma.customer.count({ where: { tenantId, isActive: true } }),
      this.prisma.customer.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(new Date().setDate(1)) },
        },
      }),
      this.prisma.customer.findMany({
        where: { tenantId, isActive: true },
        select: {
          id: true, firstName: true, lastName: true,
          totalSpent: true, visitCount: true, loyaltyPoints: true,
        },
        orderBy: { totalSpent: 'desc' },
        take: 10,
      }),
    ]);

    return { total, newThisMonth, topSpenders };
  }
}
