import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class ProcessPaymentDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsNumber()
  @IsOptional()
  tip?: number;

  @IsString()
  @IsOptional()
  splitId?: string;

  @IsString()
  @IsOptional()
  stripePaymentMethodId?: string;
}
