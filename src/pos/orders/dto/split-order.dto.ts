import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class SplitItemDto {
  @IsString()
  label: string;

  @IsNumber()
  amount: number;
}

export class SplitOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitItemDto)
  splits: SplitItemDto[];
}
