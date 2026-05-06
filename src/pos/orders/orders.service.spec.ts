import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: jest.Mocked<any>;

  const mockBranch = { id: 'branch-1', code: 'MERKEZ', tenantId: 'tenant-1' };
  const mockOrder = {
    id: 'order-1',
    branchId: 'branch-1',
    tenantId: 'tenant-1',
    tableId: 'table-1',
    orderNumber: 'MERKEZ-240406-12345',
    status: 'PENDING',
    total: 0,
    subtotal: 0,
    taxAmount: 0,
    serviceCharge: 0,
    items: [],
    payments: [],
    splits: [],
    table: { name: 'Masa 1', section: 'Salon' },
    user: { firstName: 'Test', lastName: 'Waiter' },
    customer: null,
  };

  beforeEach(async () => {
    prisma = {
      branch: { findUnique: jest.fn() },
      restaurantTable: { findFirst: jest.fn(), update: jest.fn() },
      order: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      product: { findMany: jest.fn() },
      tenantSettings: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  // ── Create Order ──────────────────────────────────────────

  describe('create', () => {
    it('should throw NotFoundException if branch not found', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.create({}, 'user-1', 'branch-1', 'tenant-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if table has open order', async () => {
      prisma.branch.findUnique.mockResolvedValue(mockBranch);
      prisma.restaurantTable.findFirst.mockResolvedValue({ id: 'table-1' });
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(service.create({ tableId: 'table-1' }, 'user-1', 'branch-1', 'tenant-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should create order successfully', async () => {
      prisma.branch.findUnique.mockResolvedValue(mockBranch);
      prisma.restaurantTable.findFirst.mockResolvedValue(null);
      prisma.order.findFirst
        .mockResolvedValueOnce(null)  // no existing order
        .mockResolvedValueOnce(mockOrder); // findOne after create
      prisma.$transaction.mockImplementation(async (fn) => {
        return fn({
          order: { create: jest.fn().mockResolvedValue(mockOrder) },
          orderItem: { createMany: jest.fn() },
          restaurantTable: { update: jest.fn() },
          product: { findMany: jest.fn().mockResolvedValue([]) },
          tenantSettings: { findUnique: jest.fn().mockResolvedValue({ taxRate: 18, serviceCharge: 0 }) },
        });
      });
      prisma.order.findFirst.mockResolvedValue({ ...mockOrder, items: [], payments: [], splits: [] });

      const result = await service.create({ tableId: 'table-1' }, 'user-1', 'branch-1', 'tenant-1');
      expect(result).toBeDefined();
    });
  });

  // ── Find Orders ───────────────────────────────────────────

  describe('findAll', () => {
    it('should return orders list with total count', async () => {
      prisma.order.findMany.mockResolvedValue([mockOrder]);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.findAll('branch-1', {});
      expect(result.orders).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ── Send to Kitchen ───────────────────────────────────────

  describe('sendToKitchen', () => {
    it('should throw if no unsent items', async () => {
      prisma.order.findFirst.mockResolvedValue({
        ...mockOrder,
        items: [{ id: 'item-1', sentToKitchen: true, status: 'WAITING' }],
        payments: [], splits: [],
      });
      await expect(service.sendToKitchen('order-1', [], 'branch-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should update items and order status', async () => {
      prisma.order.findFirst.mockResolvedValue({
        ...mockOrder,
        items: [{ id: 'item-1', sentToKitchen: false, status: 'WAITING' }],
        payments: [], splits: [],
      });
      prisma.orderItem.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.order.update.mockResolvedValue({ ...mockOrder, status: 'CONFIRMED' });

      const result = await service.sendToKitchen('order-1', [], 'branch-1');
      expect(result.message).toContain('1 ürün mutfağa gönderildi');
    });
  });

  // ── Cancel Order ──────────────────────────────────────────

  describe('cancelOrder', () => {
    it('should throw BadRequestException for closed order', async () => {
      prisma.order.findFirst.mockResolvedValue({
        ...mockOrder, status: 'CLOSED', items: [], payments: [], splits: [],
      });
      await expect(service.cancelOrder('order-1', 'branch-1'))
        .rejects.toThrow(BadRequestException);
    });
  });
});
