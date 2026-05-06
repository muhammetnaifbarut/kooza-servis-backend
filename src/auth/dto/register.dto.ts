import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Cafe Bosphorus' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  businessName: string;

  @ApiProperty({ example: 'cafe-bosphorus' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug yalnızca küçük harf, rakam ve - içerebilir' })
  slug: string;

  @ApiProperty({ example: 'Ahmet' })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ example: 'Yılmaz' })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({ example: 'ahmet@cafe.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+905551234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Str0ng@Pass' })
  @IsString()
  @MinLength(8)
  password: string;
}
