import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class AddOrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.1)
  quantity: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsOptional()
  modifiers?: Record<string, any>;
}
