import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PersonnelService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Vardiya Yönetimi ───────────────────────────────────────

  async openShift(branchId: string, userId: string, openingCash: number, note?: string) {
    // Açık vardiya var mı?
    const existing = await this.prisma.shift.findFirst({
      where: { branchId, userId, status: 'OPEN' },
    });
    if (existing) throw new BadRequestException('Açık vardiya zaten mevcut');

    const shift = await this.prisma.shift.create({
      data: {
        branchId,
        userId,
        startTime: new Date(),
        openingCash,
        note,
        status: 'OPEN',
      },
    });

    // Giriş kaydı
    await this.prisma.shiftEntry.create({
      data: { shiftId: shift.id, userId, checkIn: new Date(), type: 'REGULAR' },
    });

    return shift;
  }

  async closeShift(shiftId: string, branchId: string, closingCash: number) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, branchId, status: 'OPEN' },
    });
    if (!shift) throw new NotFoundException('Açık vardiya bulunamadı');

    // Toplam satış hesapla
    const orders = await this.prisma.order.aggregate({
      where: {
        branchId,
        createdAt: { gte: shift.startTime },
        status: 'CLOSED',
      },
      _sum: { total: true },
    });

    const totalSales = orders._sum.total ?? 0;

    // Çıkış kaydı
    await this.prisma.shiftEntry.updateMany({
      where: { shiftId, checkOut: null },
      data: { checkOut: new Date() },
    });

    return this.prisma.shift.update({
      where: { id: shiftId },
      data: {
        endTime: new Date(),
        closingCash,
        totalSales,
        status: 'CLOSED',
      },
    });
  }

  async getShifts(branchId: string, opts?: { date?: string; userId?: string }) {
    const where: any = { branchId };
    if (opts?.userId) where.userId = opts.userId;
    if (opts?.date) {
      const d = new Date(opts.date);
      const end = new Date(d);
      end.setDate(end.getDate() + 1);
      where.startTime = { gte: d, lt: end };
    }

    return this.prisma.shift.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
        entries: true,
        _count: true,
      },
      orderBy: { startTime: 'desc' },
      take: 50,
    });
  }

  async getCurrentShift(branchId: string, userId: string) {
    return this.prisma.shift.findFirst({
      where: { branchId, userId, status: 'OPEN' },
      include: {
        entries: { orderBy: { checkIn: 'desc' }, take: 1 },
      },
    });
  }

  // ── Personel Listesi ───────────────────────────────────────

  async getPersonnel(tenantId: string, branchId?: string) {
    const where: any = { tenantId, isActive: true };
    if (branchId) where.branchId = branchId;

    return this.prisma.user.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, role: true,
        branchId: true, lastLoginAt: true, createdAt: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { firstName: 'asc' },
    });
  }

  // ── Çalışma Saati Raporu ───────────────────────────────────

  async getWorkHoursReport(branchId: string, startDate: string, endDate: string) {
    const shifts = await this.prisma.shift.findMany({
      where: {
        branchId,
        startTime: { gte: new Date(startDate) },
        endTime: { lte: new Date(endDate) },
        status: 'CLOSED',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Kullanıcı bazlı grupla
    const report: Record<string, any> = {};
    for (const shift of shifts) {
      const uid = shift.userId;
      if (!report[uid]) {
        report[uid] = {
          user: shift.user,
          totalHours: 0,
          totalShifts: 0,
          totalSales: 0,
        };
      }
      if (shift.endTime) {
        const hours = (shift.endTime.getTime() - shift.startTime.getTime()) / 3600000;
        report[uid].totalHours += hours;
      }
      report[uid].totalShifts += 1;
      report[uid].totalSales += shift.totalSales;
    }

    return Object.values(report);
  }

  // ── Mola Yönetimi ──────────────────────────────────────────

  async startBreak(shiftId: string, userId: string) {
    return this.prisma.shiftEntry.create({
      data: { shiftId, userId, checkIn: new Date(), type: 'BREAK' },
    });
  }

  async endBreak(entryId: string) {
    return this.prisma.shiftEntry.update({
      where: { id: entryId },
      data: { checkOut: new Date() },
    });
  }
}
