import { Module } from '@nestjs/common';
import { TablesController } from './tables/tables.controller';
import { TablesService } from './tables/tables.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';

@Module({
  controllers: [TablesController, OrdersController, PaymentsController, ProductsController],
  providers: [TablesService, OrdersService, PaymentsService, ProductsService],
  exports: [OrdersService],
})
export class PosModule {}
