import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { normalizeEmailValue } from '../auth/auth.constants';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'jane_doe', minLength: 1, maxLength: 50 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username?: string;

  @ApiPropertyOptional({ example: 'jane@example.com', maxLength: 254 })
  @IsOptional()
  @Transform(normalizeEmailValue)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ minLength: 8, maxLength: 72 })
  @IsOptional()
  @IsString()
  @Length(8, 72)
  password?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string | null;
}

export class UpdateUserEnvelope {
  @ApiProperty({ type: UpdateUserDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateUserDto)
  user!: UpdateUserDto;
}
