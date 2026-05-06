import { IsString, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType } from '@prisma/client';
import { AddOrderItemDto } from './add-order-item.dto';

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  tableId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsEnum(OrderType)
  @IsOptional()
  type?: OrderType;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOrderItemDto)
  @IsOptional()
  items?: AddOrderItemDto[];
}
