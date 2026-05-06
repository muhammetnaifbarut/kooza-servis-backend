import { IsString, IsOptional, IsNumber } from 'class-validator';
export class CreateCategoryDto {
  @IsString() name: string;
  @IsString() @IsOptional() parentId?: string;
  @IsString() @IsOptional() imageUrl?: string;
  @IsString() @IsOptional() color?: string;
  @IsNumber() @IsOptional() sortOrder?: number;
}
