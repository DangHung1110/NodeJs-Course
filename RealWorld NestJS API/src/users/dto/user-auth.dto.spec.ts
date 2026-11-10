import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginUserDto } from './login-user.dto';
import { RegisterUserDto } from './register-user.dto';
import { ChangePasswordDto } from './change-password.dto';
import { ResetPasswordDto, VerifyEmailDto } from './email-verification.dto';

describe('authentication DTOs', () => {
  it.each([LoginUserDto, RegisterUserDto])(
    'rejects passwords longer than 72 UTF-8 bytes for %p',
    async (Dto) => {
      const input =
        Dto === RegisterUserDto
          ? {
              username: 'jane',
              email: 'jane@example.com',
              password: '😀'.repeat(19),
            }
          : {
              email: 'jane@example.com',
              password: '😀'.repeat(19),
            };
      const errors = await validate(plainToInstance(Dto, input));

      expect(errors.some((error) => error.property === 'password')).toBe(true);
    },
  );

  it('rejects an overlong UTF-8 password change', async () => {
    const errors = await validate(
      plainToInstance(ChangePasswordDto, {
        currentPassword: 'password123',
        newPassword: '😀'.repeat(19),
      }),
    );

    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });

  it.each([LoginUserDto, RegisterUserDto])('normalizes email for %p', (Dto) => {
    const input =
      Dto === RegisterUserDto
        ? {
            username: 'jane',
            email: '  JANE@EXAMPLE.COM  ',
            password: 'password123',
          }
        : {
            email: '  JANE@EXAMPLE.COM  ',
            password: 'password123',
          };

    expect(plainToInstance(Dto, input).email).toBe('jane@example.com');
  });

  it('accepts only six numeric OTP digits', async () => {
    const errors = await validate(
      plainToInstance(VerifyEmailDto, {
        email: 'jane@example.com',
        otp: '12a456',
      }),
    );

    expect(errors.some((error) => error.property === 'otp')).toBe(true);
  });

  it('rejects an overlong UTF-8 reset password', async () => {
    const errors = await validate(
      plainToInstance(ResetPasswordDto, {
        email: 'jane@example.com',
        otp: '123456',
        newPassword: '😀'.repeat(19),
      }),
    );

    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });
});
