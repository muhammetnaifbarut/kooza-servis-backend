import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { KitchenStatus } from '@prisma/client';

@Injectable()
export class KitchenService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveOrders(branchId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        status: { in: ['CONFIRMED', 'PREPARING', 'READY'] },
        items: {
          some: {
            sentToKitchen: true,
            status: { in: ['WAITING', 'PREPARING', 'READY'] },
          },
        },
      },
      include: {
        table: { select: { name: true, section: true } },
        user: { select: { firstName: true, lastName: true } },
        items: {
          where: {
            sentToKitchen: true,
            status: { not: 'CANCELLED' },
          },
          include: {
            product: {
              select: { name: true, preparationTime: true, imageUrl: true },
            },
          },
          orderBy: { sentAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate elapsed time and priority
    return orders.map((order) => ({
      ...order,
      elapsedMinutes: Math.floor(
        (Date.now() - new Date(order.createdAt).getTime()) / 60000,
      ),
      priority: this.calculatePriority(order),
    }));
  }

  async updateItemStatus(itemId: string, status: KitchenStatus, branchId: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, order: { branchId } },
      include: { order: { include: { items: true } } },
    });

    if (!item) throw new NotFoundException('Sipariş kalemi bulunamadı');

    const updateData: any = { status };
    if (status === 'PREPARING') updateData.preparedAt = null;
    if (status === 'READY') updateData.preparedAt = new Date();
    if (status === 'SERVED') updateData.servedAt = new Date();

    const updatedItem = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        product: { select: { name: true } },
        order: { select: { orderNumber: true, tableId: true } },
      },
    });

    // Check if all items are ready — update order status
    await this.syncOrderStatus(item.orderId);

    return updatedItem;
  }

  async markOrderReady(orderId: string, branchId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Adisyon bulunamadı');

    // Mark all kitchen items as ready
    await this.prisma.orderItem.updateMany({
      where: {
        orderId,
        sentToKitchen: true,
        status: { in: ['WAITING', 'PREPARING'] },
      },
      data: { status: 'READY', preparedAt: new Date() },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'READY' },
    });

    return { orderId, status: 'READY' };
  }

  async markServed(orderId: string, branchId: string) {
    await this.prisma.orderItem.updateMany({
      where: { orderId, status: 'READY' },
      data: { status: 'SERVED', servedAt: new Date() },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'SERVED' },
    });

    return { orderId, status: 'SERVED' };
  }

  private async syncOrderStatus(orderId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId, sentToKitchen: true, status: { not: 'CANCELLED' } },
    });

    if (items.length === 0) return;

    const allReady = items.every((i) => ['READY', 'SERVED'].includes(i.status));
    const anyPreparing = items.some((i) => i.status === 'PREPARING');

    if (allReady) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'READY' },
      });
    } else if (anyPreparing) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'PREPARING' },
      });
    }
  }

  private calculatePriority(order: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    const elapsed = Math.floor(
      (Date.now() - new Date(order.createdAt).getTime()) / 60000,
    );
    if (elapsed > 30) return 'URGENT';
    if (elapsed > 20) return 'HIGH';
    if (elapsed > 10) return 'MEDIUM';
    return 'LOW';
  }
}
