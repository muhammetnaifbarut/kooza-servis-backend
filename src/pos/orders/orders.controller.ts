import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { SplitOrderDto } from './dto/split-order.dto';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('pos')
@ApiBearerAuth()
@Controller('pos/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Adisyon listesi' })
  findAll(@CurrentUser('branchId') branchId: string, @Query() query: any) {
    return this.ordersService.findAll(branchId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('branchId') branchId: string) {
    return this.ordersService.findOne(id, branchId);
  }

  @Post()
  @ApiOperation({ summary: 'Yeni adisyon aç' })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.ordersService.create(dto, userId, branchId, tenantId);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Adisyona ürün ekle' })
  addItems(
    @Param('id') id: string,
    @Body() body: { items: AddOrderItemDto[] },
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.ordersService.addItems(id, body.items, branchId, tenantId);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Adisyondan ürün sil' })
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.ordersService.removeItem(id, itemId, branchId);
  }

  @Post(':id/send-kitchen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mutfağa gönder' })
  sendToKitchen(
    @Param('id') id: string,
    @Body('itemIds') itemIds: string[],
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.ordersService.sendToKitchen(id, itemIds || [], branchId);
  }

  @Post(':id/split')
  @ApiOperation({ summary: 'Adisyon böl' })
  splitOrder(
    @Param('id') id: string,
    @Body() dto: SplitOrderDto,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.ordersService.splitOrder(id, dto, branchId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Adisyon iptal' })
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.ordersService.cancelOrder(id, branchId, reason);
  }
}
