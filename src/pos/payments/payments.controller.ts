import { Controller, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('pos')
@ApiBearerAuth()
@Controller('pos/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':orderId')
  @ApiOperation({ summary: 'Ödeme al' })
  processPayment(
    @Param('orderId') orderId: string,
    @Body() dto: ProcessPaymentDto,
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.processPayment(orderId, dto, branchId, userId);
  }

  @Post(':orderId/intent')
  @ApiOperation({ summary: 'Stripe PaymentIntent oluştur' })
  createIntent(
    @Param('orderId') orderId: string,
    @Body('amount') amount: number,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.paymentsService.createStripePaymentIntent(amount, tenantId);
  }

  @Post('refund/:paymentId')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'İade yap' })
  refund(
    @Param('paymentId') paymentId: string,
    @Body('amount') amount: number,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.paymentsService.refund(paymentId, amount, branchId);
  }
}
