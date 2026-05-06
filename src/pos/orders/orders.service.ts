import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { SplitOrderDto } from './dto/split-order.dto';
import { OrderStatus, TableStatus, KitchenStatus } from '@prisma/client';
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private generateOrderNumber(branchCode: string): string {
    const now = new Date();
    const date = now.toISOString().slice(2, 10).replace(/-/g, '');
    const time = now.getTime().toString().slice(-5);
    return `${branchCode}-${date}-${time}`;
  }

  async create(dto: CreateOrderDto, userId: string, branchId: string, tenantId: string) {
    // Get branch info for order number
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Şube bulunamadı');

    // Validate table if provided
    if (dto.tableId) {
      const table = await this.prisma.restaurantTable.findFirst({
        where: { id: dto.tableId, branchId },
      });
      if (!table) throw new NotFoundException('Masa bulunamadı');

      // Check for existing open order on table
      const existingOrder = await this.prisma.order.findFirst({
        where: {
          tableId: dto.tableId,
          status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] },
        },
      });
      if (existingOrder) {
        throw new BadRequestException('Bu masada zaten açık bir adisyon var');
      }
    }

    const orderNumber = this.generateOrderNumber(branch.code);

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId,
          branchId,
          tableId: dto.tableId,
          userId,
          customerId: dto.customerId,
          orderNumber,
          type: dto.type || 'DINE_IN',
          note: dto.note,
          status: 'PENDING',
        },
      });

      // Add initial items if provided
      if (dto.items && dto.items.length > 0) {
        await this.addItemsToOrder(tx, newOrder.id, dto.items, tenantId);
      }

      // Update table status
      if (dto.tableId) {
        await tx.restaurantTable.update({
          where: { id: dto.tableId },
          data: { status: 'OCCUPIED' },
        });
      }

      return newOrder;
    });

    return this.findOne(order.id, branchId);
  }

  async findAll(branchId: string, query: any) {
    const where: any = {
      branchId,
      ...(query.status && { status: query.status }),
      ...(query.tableId && { tableId: query.tableId }),
      ...(query.date && {
        createdAt: {
          gte: new Date(query.date + 'T00:00:00'),
          lte: new Date(query.date + 'T23:59:59'),
        },
      }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          table: { select: { name: true, section: true } },
          user: { select: { firstName: true, lastName: true } },
          items: { where: { status: { not: 'CANCELLED' } } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  async findOne(id: string, branchId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, branchId },
      include: {
        table: { select: { name: true, section: true } },
        user: { select: { firstName: true, lastName: true } },
        customer: true,
        items: {
          include: { product: { select: { name: true, imageUrl: true, category: true } } },
          orderBy: { id: 'asc' },
        },
        payments: true,
        splits: { include: { payments: true } },
      },
    });
    if (!order) throw new NotFoundException('Adisyon bulunamadı');
    return order;
  }

  async addItems(orderId: string, items: AddOrderItemDto[], branchId: string, tenantId: string) {
    const order = await this.findOne(orderId, branchId);
    if (['CLOSED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Kapalı adisyona ürün eklenemez');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.addItemsToOrder(tx, orderId, items, tenantId);
      await this.recalculateOrder(tx, orderId, tenantId);
    });

    return this.findOne(orderId, branchId);
  }

  async removeItem(orderId: string, itemId: string, branchId: string) {
    const order = await this.findOne(orderId, branchId);
    if (['CLOSED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Kapalı adisyondan ürün silinemez');
    }

    const item = order.items.find((i: any) => i.id === itemId);
    if (!item) throw new NotFoundException('Ürün bulunamadı');
    if (item.sentToKitchen && item.status !== 'WAITING') {
      throw new BadRequestException('Hazırlanmaya başlanan ürün silinemez');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: itemId },
        data: { status: 'CANCELLED' },
      });
      await this.recalculateOrder(tx, orderId, order.tenantId);
    });

    return this.findOne(orderId, branchId);
  }

  async sendToKitchen(orderId: string, itemIds: string[], branchId: string) {
    const order = await this.findOne(orderId, branchId);

    const items = itemIds.length > 0
      ? order.items.filter((i: any) => itemIds.includes(i.id) && !i.sentToKitchen)
      : order.items.filter((i: any) => !i.sentToKitchen);

    if (items.length === 0) {
      throw new BadRequestException('Mutfağa gönderilecek ürün yok');
    }

    await this.prisma.orderItem.updateMany({
      where: { id: { in: items.map((i: any) => i.id) } },
      data: {
        sentToKitchen: true,
        sentAt: new Date(),
        status: 'WAITING',
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
    });

    return { message: `${items.length} ürün mutfağa gönderildi` };
  }

  async splitOrder(orderId: string, dto: SplitOrderDto, branchId: string) {
    const order = await this.findOne(orderId, branchId);

    await this.prisma.orderSplit.createMany({
      data: dto.splits.map((s) => ({
        orderId,
        label: s.label,
        amount: s.amount,
      })),
    });

    return this.findOne(orderId, branchId);
  }

  async cancelOrder(orderId: string, branchId: string, reason?: string) {
    const order = await this.findOne(orderId, branchId);
    if (order.status === 'CLOSED') {
      throw new BadRequestException('Kapalı adisyon iptal edilemez');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', note: reason },
      });

      if (order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: 'EMPTY' },
        });
      }
    });

    return { message: 'Adisyon iptal edildi' };
  }

  private async addItemsToOrder(tx: any, orderId: string, items: any[], tenantId: string) {
    const productIds = items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId },
    });

    const productMap = new Map(products.map((p: any) => [p.id, p]));

    const itemData = items.map((item) => {
      const product = productMap.get(item.productId) as any;
      if (!product) throw new NotFoundException(`Ürün bulunamadı: ${item.productId}`);

      const price = product.price;
      const quantity = item.quantity || 1;
      const total = price * quantity - (item.discount || 0);

      return {
        orderId,
        productId: item.productId,
        name: product.name,
        price,
        quantity,
        discount: item.discount || 0,
        total,
        note: item.note,
        modifiers: item.modifiers,
      };
    });

    await tx.orderItem.createMany({ data: itemData });
    await this.recalculateOrder(tx, orderId, tenantId);
  }

  private async recalculateOrder(tx: any, orderId: string, tenantId: string) {
    const items = await tx.orderItem.findMany({
      where: { orderId, status: { not: 'CANCELLED' } },
    });

    const settings = await tx.tenantSettings.findUnique({ where: { tenantId } });
    const taxRate = settings?.taxRate || 18;
    const serviceChargeRate = settings?.serviceCharge || 0;

    const subtotal = items.reduce((sum: number, i: any) => sum + i.total, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const serviceCharge = subtotal * (serviceChargeRate / 100);
    const total = subtotal + taxAmount + serviceCharge;

    await tx.order.update({
      where: { id: orderId },
      data: { subtotal, taxAmount, serviceCharge, total },
    });
  }
}
