import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @ApiOperation({ summary: 'Stok listesi' })
  getStock(@CurrentUser('branchId') branchId: string, @Query() query: any) {
    return this.stockService.getStockItems(branchId, query);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Düşük stok uyarıları' })
  getAlerts(@CurrentUser('branchId') branchId: string) {
    return this.stockService.getLowStockAlerts(branchId);
  }

  @Get(':productId/history')
  @ApiOperation({ summary: 'Stok hareket geçmişi' })
  getHistory(
    @Param('productId') productId: string,
    @CurrentUser('branchId') branchId: string,
    @Query('days') days: number,
  ) {
    return this.stockService.getMovementHistory(branchId, productId, days);
  }

  @Post('adjust')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Stok düzeltme' })
  adjust(
    @Body() body: { productId: string; quantity: number; type: any; note?: string },
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.stockService.adjustStock(
      branchId, tenantId, body.productId, body.quantity, body.type, body.note, userId,
    );
  }

  @Post('bulk-adjust')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Toplu stok sayımı' })
  bulkAdjust(
    @Body() body: { items: { productId: string; quantity: number; note?: string }[] },
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.stockService.bulkAdjust(branchId, tenantId, body.items, userId);
  }

  @Post('transfer')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Şubeler arası stok transferi' })
  transfer(
    @Body() body: { toBranchId: string; productId: string; quantity: number; note?: string },
    @CurrentUser('branchId') fromBranchId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.stockService.transferStock(
      fromBranchId, body.toBranchId, body.productId, body.quantity, tenantId, userId, body.note,
    );
  }
}
