import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(branchId: string, tenantId: string) {
    const tables = await this.prisma.restaurantTable.findMany({
      where: { branchId, isActive: true },
      include: {
        orders: {
          where: { status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] } },
          select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ section: 'asc' }, { name: 'asc' }],
    });

    // Group by section
    const sections = tables.reduce((acc: any, table) => {
      const section = table.section || 'Genel';
      if (!acc[section]) acc[section] = [];
      acc[section].push({
        ...table,
        activeOrder: table.orders[0] || null,
        orders: undefined,
      });
      return acc;
    }, {});

    return { tables, sections };
  }

  async findOne(id: string, branchId: string) {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id, branchId },
      include: {
        orders: {
          where: { status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] } },
          include: {
            items: { include: { product: true } },
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!table) throw new NotFoundException('Masa bulunamadı');
    return table;
  }

  async create(dto: CreateTableDto, branchId: string) {
    const qrToken = uuidv4();
    const qrCode = `${process.env.FRONTEND_URL}/qr/${qrToken}`;

    return this.prisma.restaurantTable.create({
      data: {
        ...dto,
        branchId,
        qrCode: qrToken,
      },
    });
  }

  async update(id: string, dto: UpdateTableDto, branchId: string) {
    await this.findOne(id, branchId);
    return this.prisma.restaurantTable.update({
      where: { id },
      data: dto,
    });
  }

  async updateStatus(id: string, status: any, branchId: string) {
    await this.findOne(id, branchId);
    return this.prisma.restaurantTable.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string, branchId: string) {
    await this.findOne(id, branchId);
    return this.prisma.restaurantTable.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async generateQr(id: string, branchId: string) {
    const table = await this.findOne(id, branchId);
    const url = `${process.env.FRONTEND_URL}/qr/${table.qrCode}`;
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
    return { qrDataUrl, url };
  }

  async updateLayout(branchId: string, tables: { id: string; posX: number; posY: number }[]) {
    await Promise.all(
      tables.map((t) =>
        this.prisma.restaurantTable.update({
          where: { id: t.id, branchId },
          data: { posX: t.posX, posY: t.posY },
        }),
      ),
    );
    return { message: 'Masa düzeni güncellendi' };
  }
}
