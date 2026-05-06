import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stock/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Get()
  findAll(@CurrentUser('tenantId') t: string, @CurrentUser('branchId') b: string) {
    return this.service.findAll(t, b);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  create(@Body() dto: any, @CurrentUser('tenantId') t: string, @CurrentUser('branchId') b: string) {
    return this.service.create(dto, t, b);
  }

  @Post(':id/receive')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  receive(
    @Param('id') id: string,
    @CurrentUser('tenantId') t: string,
    @CurrentUser('branchId') b: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.receive(id, t, b, userId);
  }
}
