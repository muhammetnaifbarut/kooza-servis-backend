import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { KitchenService } from './kitchen.service';
import { KitchenGateway } from './kitchen.gateway';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('kitchen')
@ApiBearerAuth()
@Controller('kitchen')
export class KitchenController {
  constructor(
    private readonly kitchenService: KitchenService,
    private readonly kitchenGateway: KitchenGateway,
  ) {}

  @Get('orders')
  @ApiOperation({ summary: 'Aktif mutfak siparişleri' })
  getOrders(@CurrentUser('branchId') branchId: string) {
    return this.kitchenService.getActiveOrders(branchId);
  }

  @Patch('items/:id/status')
  @ApiOperation({ summary: 'Kalem durumu güncelle' })
  updateItem(
    @Param('id') id: string,
    @Body('status') status: any,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.kitchenService.updateItemStatus(id, status, branchId);
  }

  @Patch('orders/:id/ready')
  @ApiOperation({ summary: 'Sipariş hazır' })
  markReady(@Param('id') id: string, @CurrentUser('branchId') branchId: string) {
    return this.kitchenService.markOrderReady(id, branchId);
  }

  @Patch('orders/:id/served')
  @ApiOperation({ summary: 'Sipariş servis edildi' })
  markServed(@Param('id') id: string, @CurrentUser('branchId') branchId: string) {
    return this.kitchenService.markServed(id, branchId);
  }
}
