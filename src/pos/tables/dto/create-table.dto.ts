import { IsString, IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TableShape } from '@prisma/client';

export class CreateTableDto {
  @ApiProperty({ example: 'Masa 1' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Salon', required: false })
  @IsString()
  @IsOptional()
  section?: string;

  @ApiProperty({ example: 4 })
  @IsNumber()
  @Min(1)
  @Max(50)
  capacity: number;

  @ApiProperty({ enum: TableShape, default: TableShape.SQUARE })
  @IsEnum(TableShape)
  @IsOptional()
  shape?: TableShape;

  @IsNumber()
  @IsOptional()
  posX?: number;

  @IsNumber()
  @IsOptional()
  posY?: number;
}
