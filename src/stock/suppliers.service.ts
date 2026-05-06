import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { purchaseOrders: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Tedarikçi bulunamadı');
    return s;
  }

  async create(dto: any, tenantId: string) {
    return this.prisma.supplier.create({ data: { ...dto, tenantId } });
  }

  async update(id: string, dto: any, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.supplier.update({ where: { id }, data: { isActive: false } });
  }
}
