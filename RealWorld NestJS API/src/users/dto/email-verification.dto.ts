import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MaxUtf8Bytes } from './max-utf8-bytes.validator';

function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class EmailDto {
  @ApiProperty({ example: 'jane@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyEmailDto extends EmailDto {
  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}

export class ResetPasswordDto extends VerifyEmailDto {
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxUtf8Bytes(72)
  newPassword!: string;
}
