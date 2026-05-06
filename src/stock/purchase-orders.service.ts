import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { StockService } from './stock.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async findAll(tenantId: string, branchId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId, branchId },
      include: {
        supplier: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: any, tenantId: string, branchId: string) {
    const total = dto.items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);

    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        branchId,
        supplierId: dto.supplierId,
        total,
        note: dto.note,
        deliveryDate: dto.deliveryDate,
        items: {
          create: dto.items.map((i: any) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.quantity * i.unitPrice,
          })),
        },
      },
      include: { items: true, supplier: true },
    });
  }

  async receive(id: string, tenantId: string, branchId: string, userId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Satın alma siparişi bulunamadı');

    await this.prisma.$transaction(async (tx) => {
      for (const item of po.items) {
        await this.stockService.adjustStock(
          branchId, tenantId, item.productId, item.quantity, 'IN',
          `Satın alma #${po.id}`, userId,
        );
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'DELIVERED', deliveryDate: new Date() },
      });

      // Update supplier balance
      await tx.supplier.update({
        where: { id: po.supplierId },
        data: { balance: { decrement: po.total } },
      });
    });

    return { message: 'Teslimat alındı, stok güncellendi' };
  }
}
