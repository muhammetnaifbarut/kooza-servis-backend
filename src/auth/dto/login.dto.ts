import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'ahmet@cafe.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Str0ng@Pass' })
  @IsString()
  @MinLength(6)
  password: string;
}
