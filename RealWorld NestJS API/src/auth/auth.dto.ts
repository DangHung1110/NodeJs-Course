import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { normalizeEmailValue } from './auth.constants';

export class RegisterUserDto {
  @ApiProperty({ example: 'jane_doe', minLength: 1, maxLength: 50 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username!: string;

  @ApiProperty({ example: 'jane@example.com', maxLength: 254 })
  @Transform(normalizeEmailValue)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  password!: string;
}

export class LoginUserDto {
  @ApiProperty({ example: 'jane@example.com', maxLength: 254 })
  @Transform(normalizeEmailValue)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  password!: string;
}

export class EmailDto {
  @ApiProperty({ example: 'jane@example.com', maxLength: 254 })
  @Transform(normalizeEmailValue)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyEmailDto extends EmailDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}

export class ResetPasswordDto extends VerifyEmailDto {
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  newPassword!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4096)
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  newPassword!: string;
}

export class RegisterEnvelope {
  @ApiProperty({ type: RegisterUserDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RegisterUserDto)
  user!: RegisterUserDto;
}

export class LoginEnvelope {
  @ApiProperty({ type: LoginUserDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LoginUserDto)
  user!: LoginUserDto;
}

export class ChangePasswordEnvelope {
  @ApiProperty({ type: ChangePasswordDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => ChangePasswordDto)
  user!: ChangePasswordDto;
}
