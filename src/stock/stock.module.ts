import { Module } from '@nestjs/common';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';

@Module({
  controllers: [StockController, SuppliersController, PurchaseOrdersController],
  providers: [StockService, SuppliersService, PurchaseOrdersService],
  exports: [StockService],
})
export class StockModule {}
