import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(config.get('stripe.secretKey'), {
      apiVersion: '2023-08-16',
    });
  }

  async processPayment(orderId: string, dto: ProcessPaymentDto, branchId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: { payments: true, table: true },
    });

    if (!order) throw new NotFoundException('Adisyon bulunamadı');
    if (order.status === 'CLOSED') throw new BadRequestException('Bu adisyon zaten kapatılmış');

    const totalPaid = order.payments
      .filter((p: any) => p.status === 'COMPLETED')
      .reduce((sum: number, p: any) => sum + p.amount, 0);
    const remaining = order.total - totalPaid;

    if (dto.amount > remaining + 0.01) {
      throw new BadRequestException(`Fazla ödeme. Kalan: ${remaining.toFixed(2)}`);
    }

    let stripePaymentIntentId: string | undefined;

    // Handle card payments via Stripe
    if (dto.method === 'CREDIT_CARD' || dto.method === 'DEBIT_CARD') {
      if (dto.stripePaymentMethodId) {
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(dto.amount * 100),
          currency: 'try',
          payment_method: dto.stripePaymentMethodId,
          confirm: true,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          metadata: { orderId, branchId },
        });
        stripePaymentIntentId = paymentIntent.id;
      }
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          orderId,
          splitId: dto.splitId,
          method: dto.method,
          amount: dto.amount,
          tip: dto.tip || 0,
          reference: stripePaymentIntentId,
          status: 'COMPLETED',
        },
      });

      const newTotalPaid = totalPaid + dto.amount;
      const changeAmount = Math.max(0, newTotalPaid - order.total);

      if (newTotalPaid >= order.total - 0.01) {
        // Close order
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'CLOSED',
            paidAmount: newTotalPaid,
            changeAmount,
            closedAt: new Date(),
          },
        });

        // Free the table
        if (order.tableId) {
          await tx.restaurantTable.update({
            where: { id: order.tableId },
            data: { status: 'EMPTY' },
          });
        }

        // Update customer stats
        if (order.customerId) {
          await tx.customer.update({
            where: { id: order.customerId },
            data: {
              totalSpent: { increment: order.total },
              visitCount: { increment: 1 },
            },
          });
        }

        // Record in financial account (cash register)
        const cashAccount = await tx.financialAccount.findFirst({
          where: { tenantId: order.tenantId, type: 'CASH' },
        });
        if (cashAccount) {
          await tx.financialTransaction.create({
            data: {
              accountId: cashAccount.id,
              branchId,
              type: 'INCOME',
              category: 'SALE',
              amount: order.total,
              description: `Adisyon #${order.orderNumber}`,
              reference: order.id,
              createdBy: userId,
            },
          });
          await tx.financialAccount.update({
            where: { id: cashAccount.id },
            data: { balance: { increment: order.total } },
          });
        }
      } else {
        await tx.order.update({
          where: { id: orderId },
          data: { paidAmount: newTotalPaid },
        });
      }

      return newPayment;
    });

    return { payment, changeAmount: Math.max(0, dto.amount - remaining) };
  }

  async refund(paymentId: string, amount: number, branchId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, order: { branchId } },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Ödeme bulunamadı');

    if (payment.reference) {
      await this.stripe.refunds.create({
        payment_intent: payment.reference,
        amount: Math.round(amount * 100),
      });
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED' },
    });

    return { message: 'İade işlemi tamamlandı' };
  }

  async createStripePaymentIntent(amount: number, tenantId: string) {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'try',
      ...(settings?.stripeAccountId && {
        transfer_data: { destination: settings.stripeAccountId },
      }),
    });

    return { clientSecret: paymentIntent.client_secret };
  }
}
