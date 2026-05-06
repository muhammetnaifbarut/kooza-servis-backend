import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccounts(tenantId: string) {
    return this.prisma.financialAccount.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: { select: { transactions: true } },
      },
    });
  }

  async createAccount(dto: any, tenantId: string) {
    return this.prisma.financialAccount.create({ data: { ...dto, tenantId } });
  }

  async getTransactions(tenantId: string, branchId: string, query: any) {
    const where: any = {
      account: { tenantId },
      branchId,
      ...(query.type && { type: query.type }),
      ...(query.startDate && {
        date: {
          gte: new Date(query.startDate + 'T00:00:00'),
          lte: new Date((query.endDate || query.startDate) + 'T23:59:59'),
        },
      }),
    };

    const [transactions, stats] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where,
        include: { account: { select: { name: true, type: true } } },
        orderBy: { date: 'desc' },
        take: query.limit || 100,
        skip: query.offset || 0,
      }),
      this.prisma.financialTransaction.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const income = stats.find((s) => s.type === 'INCOME')?._sum.amount || 0;
    const expense = stats.find((s) => s.type === 'EXPENSE')?._sum.amount || 0;

    return {
      transactions,
      summary: { income, expense, profit: income - expense },
    };
  }

  async addTransaction(dto: any, tenantId: string, branchId: string, userId: string) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.accountId, tenantId },
    });
    if (!account) throw new NotFoundException('Hesap bulunamadı');

    const balanceChange = dto.type === 'INCOME' ? dto.amount : -dto.amount;

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.financialTransaction.create({
        data: {
          accountId: dto.accountId,
          branchId,
          type: dto.type,
          category: dto.category,
          amount: dto.amount,
          description: dto.description,
          reference: dto.reference,
          date: dto.date ? new Date(dto.date) : new Date(),
          createdBy: userId,
        },
      });

      await tx.financialAccount.update({
        where: { id: dto.accountId },
        data: { balance: { increment: balanceChange } },
      });

      return transaction;
    });
  }

  async getCashRegisterSummary(branchId: string, date?: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const start = new Date(targetDate + 'T00:00:00');
    const end = new Date(targetDate + 'T23:59:59');

    const [payments, expenses] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          order: { branchId, status: 'CLOSED', createdAt: { gte: start, lte: end } },
          status: 'COMPLETED',
        },
        _sum: { amount: true, tip: true },
        _count: true,
      }),
      this.prisma.financialTransaction.aggregate({
        where: {
          branchId,
          type: 'EXPENSE',
          date: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = payments.reduce((s, p) => s + (p._sum.amount || 0), 0);
    const totalTips = payments.reduce((s, p) => s + (p._sum.tip || 0), 0);
    const totalExpense = expenses._sum.amount || 0;

    return {
      date: targetDate,
      income: totalIncome,
      tips: totalTips,
      expenses: totalExpense,
      net: totalIncome - totalExpense,
      breakdown: payments,
    };
  }
}
