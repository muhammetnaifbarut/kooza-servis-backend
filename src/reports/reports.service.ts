import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(tenantId: string, branchId: string, startDate: string, endDate: string) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');

    const [orders, paymentStats] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          tenantId,
          ...(branchId && { branchId }),
          status: 'CLOSED',
          createdAt: { gte: start, lte: end },
        },
        include: {
          items: { include: { product: { select: { name: true, categoryId: true } } } },
          payments: { where: { status: 'COMPLETED' } },
        },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          order: {
            tenantId,
            ...(branchId && { branchId }),
            status: 'CLOSED',
            createdAt: { gte: start, lte: end },
          },
          status: 'COMPLETED',
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalOrders = orders.length;
    const avgCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Product analysis
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId;
        const existing = productMap.get(key);
        if (existing) {
          existing.qty += item.quantity;
          existing.revenue += item.total;
        } else {
          productMap.set(key, {
            name: item.name,
            qty: item.quantity,
            revenue: item.total,
          });
        }
      }
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    // Hourly distribution
    const hourlyMap = new Array(24).fill(0).map((_, h) => ({ hour: h, orders: 0, revenue: 0 }));
    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours();
      hourlyMap[hour].orders++;
      hourlyMap[hour].revenue += order.total;
    }

    // Daily totals for chart
    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
    for (const order of orders) {
      const date = order.createdAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(date);
      if (existing) {
        existing.revenue += order.total;
        existing.orders++;
      } else {
        dailyMap.set(date, { date, revenue: order.total, orders: 1 });
      }
    }

    return {
      summary: {
        totalRevenue,
        totalOrders,
        avgCheck,
        totalItems: orders.reduce((s, o) => s + o.items.length, 0),
      },
      paymentBreakdown: paymentStats,
      topProducts,
      hourlyDistribution: hourlyMap,
      dailyChart: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async getBranchComparison(tenantId: string, startDate: string, endDate: string) {
    const branches = await this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
    });

    const stats = await Promise.all(
      branches.map(async (branch) => {
        const result = await this.prisma.order.aggregate({
          where: {
            tenantId,
            branchId: branch.id,
            status: 'CLOSED',
            createdAt: {
              gte: new Date(startDate + 'T00:00:00'),
              lte: new Date(endDate + 'T23:59:59'),
            },
          },
          _sum: { total: true },
          _count: { id: true },
          _avg: { total: true },
        });

        return {
          branch: { id: branch.id, name: branch.name },
          revenue: result._sum.total || 0,
          orders: result._count.id || 0,
          avgCheck: result._avg.total || 0,
        };
      }),
    );

    return stats.sort((a, b) => b.revenue - a.revenue);
  }

  async getDashboardStats(tenantId: string, branchId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(today + 'T00:00:00');
    const todayEnd = new Date(today + 'T23:59:59');

    const [
      todayOrders,
      todayRevenue,
      openOrders,
      openTables,
      lowStockCount,
      pendingKitchen,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { tenantId, branchId, status: 'CLOSED', createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.order.aggregate({
        where: { tenantId, branchId, status: 'CLOSED', createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { tenantId, branchId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } },
      }),
      this.prisma.restaurantTable.count({
        where: { branchId, status: 'OCCUPIED' },
      }),
      this.prisma.stockItem.count({
        where: { branchId, quantity: { lte: 0 } },
      }),
      this.prisma.orderItem.count({
        where: {
          order: { branchId },
          sentToKitchen: true,
          status: 'WAITING',
        },
      }),
    ]);

    return {
      today: {
        orders: todayOrders,
        revenue: todayRevenue._sum.total || 0,
      },
      realtime: {
        openOrders,
        openTables,
        lowStockCount,
        pendingKitchen,
      },
    };
  }

  async getPersonnelPerformance(branchId: string, startDate: string, endDate: string) {
    const orders = await this.prisma.order.groupBy({
      by: ['userId'],
      where: {
        branchId,
        status: 'CLOSED',
        createdAt: {
          gte: new Date(startDate + 'T00:00:00'),
          lte: new Date(endDate + 'T23:59:59'),
        },
      },
      _sum: { total: true },
      _count: { id: true },
      _avg: { total: true },
    });

    const userIds = orders.map((o) => o.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return orders
      .map((o) => ({
        user: userMap.get(o.userId),
        revenue: o._sum.total || 0,
        orders: o._count.id,
        avgCheck: o._avg.total || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  // ── Scheduled: Generate daily report at midnight ──────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyReports() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
    });

    for (const branch of branches) {
      try {
        const stats = await this.getSalesReport(
          branch.tenantId, branch.id, dateStr, dateStr,
        );

        await this.prisma.dailyReport.upsert({
          where: { branchId_date: { branchId: branch.id, date: yesterday } },
          create: {
            tenantId: branch.tenantId,
            branchId: branch.id,
            date: yesterday,
            totalOrders: stats.summary.totalOrders,
            totalRevenue: stats.summary.totalRevenue,
            averageCheck: stats.summary.avgCheck,
            paymentBreakdown: stats.paymentBreakdown,
            hourlyData: stats.hourlyDistribution,
            topProducts: stats.topProducts,
          },
          update: {
            totalOrders: stats.summary.totalOrders,
            totalRevenue: stats.summary.totalRevenue,
            averageCheck: stats.summary.avgCheck,
          },
        });
      } catch (err) {
        // Log but continue for other branches
      }
    }
  }
}
