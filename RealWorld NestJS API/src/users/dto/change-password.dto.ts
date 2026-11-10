import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { MaxUtf8Bytes } from './max-utf8-bytes.validator';

export class ChangePasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxUtf8Bytes(72)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxUtf8Bytes(72)
  newPassword!: string;
}
