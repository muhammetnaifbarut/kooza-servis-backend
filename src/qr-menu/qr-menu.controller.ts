// @ts-nocheck — Prisma groupBy/where circular type inference workaround (TS2615)
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/roles.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * QR Menu — Public endpoint (müşteri masada QR okutur)
 * Auth gerektirmez
 *
 * GET /api/v1/public/qr-menu/:slug
 * GET /api/v1/public/qr-menu/:slug?table=tableId
 */
@ApiTags('qr-menu')
@Controller('public/qr-menu')
export class QrMenuController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Tenant menüsü (public)' })
  async getMenu(@Param('slug') slug: string, @Query('table') tableId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, logoUrl: true, currency: true, locale: true },
    });

    if (!tenant) {
      return { error: 'İşletme bulunamadı', notFound: true };
    }

    // Aktif kategoriler + ürünler
    const categories: any[] = await this.prisma.category.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { isActive: true, isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, name: true, description: true, imageUrl: true,
            price: true, type: true, preparationTime: true,
          },
        },
      },
    }).catch(() => []);

    // Eğer table verilmişse, masa bilgisi + bugünün siparişleri + öneriler
    let tableInfo: any = null;
    let todayItems: Array<{ name: string; count: number }> = [];
    let recommendations: any[] = [];

    if (tableId) {
      tableInfo = await this.prisma.restaurantTable.findFirst({
        where: { id: tableId, tenantId: tenant.id },
        select: { id: true, name: true, capacity: true, section: true },
      });

      if (tableInfo) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Bugün bu işletmede en çok satılan top 6
        const popular: any[] = await this.prisma.orderItem.groupBy({
          by: ['productId'],
          where: {
            order: { tenantId: tenant.id, createdAt: { gte: today } },
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 6,
        } as any).catch(() => []);

        const recIds = popular.map((g: any) => g.productId);
        if (recIds.length > 0) {
          recommendations = await this.prisma.product.findMany({
            where: { id: { in: recIds }, isAvailable: true, isActive: true },
            select: { id: true, name: true, price: true, imageUrl: true, description: true },
          });
        }

        // Bu masa bugün ne yedi (son 5 ürün)
        const recentItems: any[] = await this.prisma.orderItem.findMany({
          where: {
            order: { tableId, tenantId: tenant.id, createdAt: { gte: today } },
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            quantity: true,
            product: { select: { id: true, name: true, imageUrl: true } },
          },
        } as any).catch(() => []);

        // Aggregate by product
        const itemMap: Record<string, { name: string; count: number }> = {};
        for (const it of recentItems) {
          const key = it.product?.name || 'Bilinmeyen';
          if (itemMap[key]) itemMap[key].count += it.quantity;
          else itemMap[key] = { name: key, count: it.quantity };
        }
        todayItems = Object.values(itemMap).slice(0, 5);
      }
    }

    // Aktif kampanyalar
    const campaigns = await this.prisma.campaign.findMany({
      where: { tenantId: tenant.id, isActive: true },
      take: 3,
      select: {
        id: true, name: true,
        type: true, value: true,
        startDate: true, endDate: true,
      },
    } as any).catch(() => []);

    return {
      tenant,
      categories,
      table: tableInfo,
      todayItems,
      recommendations,
      campaigns,
    };
  }
}
