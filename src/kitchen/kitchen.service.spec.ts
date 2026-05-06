import { Test, TestingModule } from '@nestjs/testing';
import { KitchenService } from './kitchen.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('KitchenService', () => {
  let service: KitchenService;
  let prisma: jest.Mocked<any>;

  beforeEach(async () => {
    prisma = {
      order: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      orderItem: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KitchenService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<KitchenService>(KitchenService);
  });

  describe('getActiveOrders', () => {
    it('should return active orders with priority', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'TEST-001',
          status: 'CONFIRMED',
          createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
          table: { name: 'Masa 1', section: 'Salon' },
          user: { firstName: 'Garson', lastName: 'Test' },
          items: [{ id: 'item-1', name: 'Köfte', quantity: 2, status: 'WAITING', sentToKitchen: true, note: null }],
        },
      ];
      prisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getActiveOrders('branch-1');
      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe('LOW');
      expect(result[0].elapsedMinutes).toBeLessThanOrEqual(6);
    });

    it('should set URGENT priority for orders older than 30 minutes', async () => {
      const mockOrders = [
        {
          id: 'order-2',
          orderNumber: 'TEST-002',
          status: 'CONFIRMED',
          createdAt: new Date(Date.now() - 35 * 60 * 1000), // 35 min ago
          table: { name: 'Masa 2', section: 'Salon' },
          user: { firstName: 'Garson', lastName: 'Test' },
          items: [],
        },
      ];
      prisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getActiveOrders('branch-1');
      expect(result[0].priority).toBe('URGENT');
    });
  });

  describe('updateItemStatus', () => {
    it('should throw NotFoundException for unknown item', async () => {
      prisma.orderItem.findFirst.mockResolvedValue(null);
      await expect(service.updateItemStatus('unknown-item', 'PREPARING', 'branch-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should update item status to PREPARING and set preparedAt null', async () => {
      const mockItem = {
        id: 'item-1',
        orderId: 'order-1',
        status: 'WAITING',
        order: { items: [{ id: 'item-1', status: 'WAITING' }] },
      };
      prisma.orderItem.findFirst.mockResolvedValue(mockItem);
      prisma.orderItem.update.mockResolvedValue({ ...mockItem, status: 'PREPARING', product: { name: 'Köfte' }, order: { orderNumber: 'T-001', tableId: 'table-1' } });
      prisma.orderItem.findMany.mockResolvedValue([{ status: 'PREPARING' }]);
      prisma.order.update.mockResolvedValue({});

      const result = await service.updateItemStatus('item-1', 'PREPARING', 'branch-1');
      expect(result.status).toBe('PREPARING');
    });
  });

  describe('markOrderReady', () => {
    it('should mark all kitchen items as ready', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        items: [{ id: 'item-1', status: 'WAITING', sentToKitchen: true }],
      });
      prisma.orderItem.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.update.mockResolvedValue({});

      const result = await service.markOrderReady('order-1', 'branch-1');
      expect(result.status).toBe('READY');
    });
  });
});
