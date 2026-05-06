import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { StockMoveType } from '@prisma/client';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async getStockItems(branchId: string, query: any) {
    const where: any = {
      branchId,
      ...(query.search && {
        product: { name: { contains: query.search, mode: 'insensitive' } },
      }),
      ...(query.lowStock && { quantity: { lte: this.prisma.stockItem.fields.minQuantity } }),
    };

    const items = await this.prisma.stockItem.findMany({
      where,
      include: {
        product: { select: { name: true, imageUrl: true, unit: true, category: { select: { name: true } } } },
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { product: { name: 'asc' } },
    });

    // Add low stock flag
    return items.map((item) => ({
      ...item,
      isLow: item.quantity <= item.minQuantity,
      isOut: item.quantity <= 0,
    }));
  }

  async getLowStockAlerts(branchId: string) {
    return this.prisma.stockItem.findMany({
      where: { branchId, quantity: { lte: this.prisma.stockItem.fields.minQuantity } },
      include: { product: { select: { name: true, unit: true } } },
    });
  }

  async adjustStock(
    branchId: string,
    tenantId: string,
    productId: string,
    quantity: number,
    type: StockMoveType,
    note?: string,
    userId?: string,
  ) {
    let stockItem = await this.prisma.stockItem.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });

    if (!stockItem) {
      // Auto-create stock item
      const product = await this.prisma.product.findFirst({
        where: { id: productId, tenantId },
      });
      if (!product) throw new NotFoundException('Ürün bulunamadı');

      stockItem = await this.prisma.stockItem.create({
        data: { branchId, productId, quantity: 0, unit: product.unit },
      });
    }

    const before = stockItem.quantity;
    let after: number;

    switch (type) {
      case 'IN':
      case 'TRANSFER_IN':
        after = before + Math.abs(quantity);
        break;
      case 'OUT':
      case 'TRANSFER_OUT':
      case 'RECIPE_USAGE':
      case 'WASTE':
        after = before - Math.abs(quantity);
        if (after < 0) after = 0;
        break;
      case 'ADJUSTMENT':
        after = quantity; // absolute value
        break;
      default:
        after = before + quantity;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.stockItem.update({
        where: { id: stockItem.id },
        data: { quantity: after },
      });

      await tx.stockMovement.create({
        data: {
          stockItemId: stockItem.id,
          type,
          quantity: Math.abs(quantity),
          before,
          after,
          note,
          createdBy: userId,
        },
      });
    });

    return { productId, before, after, change: after - before };
  }

  async processRecipeUsage(orderId: string, branchId: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: {
        items: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            product: {
              include: {
                recipe: { include: { ingredient: true } },
              },
            },
          },
        },
      },
    });

    if (!order) return;

    for (const item of order.items) {
      if (!item.product.recipe || item.product.recipe.length === 0) continue;

      for (const recipeItem of item.product.recipe) {
        const usageQty = recipeItem.quantity * item.quantity;
        await this.adjustStock(
          branchId,
          tenantId,
          recipeItem.ingredientId,
          usageQty,
          'RECIPE_USAGE',
          `Sipariş #${order.orderNumber} - ${item.product.name}`,
        ).catch(() => {}); // Silent fail — don't block payment
      }
    }
  }

  async transferStock(
    fromBranchId: string,
    toBranchId: string,
    productId: string,
    quantity: number,
    tenantId: string,
    userId: string,
    note?: string,
  ) {
    const fromStock = await this.prisma.stockItem.findUnique({
      where: { branchId_productId: { branchId: fromBranchId, productId } },
    });

    if (!fromStock || fromStock.quantity < quantity) {
      throw new BadRequestException('Yetersiz stok');
    }

    const transfer = await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          fromBranchId,
          toBranchId,
          productId,
          quantity,
          note,
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });

      // Deduct from source
      await this.adjustStock(fromBranchId, tenantId, productId, quantity, 'TRANSFER_OUT', note, userId);
      // Add to destination
      await this.adjustStock(toBranchId, tenantId, productId, quantity, 'TRANSFER_IN', note, userId);

      return transfer;
    });

    return transfer;
  }

  async getMovementHistory(branchId: string, productId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stockItem = await this.prisma.stockItem.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });
    if (!stockItem) return [];

    return this.prisma.stockMovement.findMany({
      where: { stockItemId: stockItem.id, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async bulkAdjust(
    branchId: string,
    tenantId: string,
    items: { productId: string; quantity: number; note?: string }[],
    userId: string,
  ) {
    const results = await Promise.all(
      items.map((item) =>
        this.adjustStock(branchId, tenantId, item.productId, item.quantity, 'ADJUSTMENT', item.note, userId),
      ),
    );
    return results;
  }
}
