import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

describe('MailService', () => {
  interface TestMessage {
    to: string;
    subject: string;
    text: string;
  }

  const sendMail = jest.fn<(message: TestMessage) => Promise<unknown>>();
  const createTransport = nodemailer.createTransport as jest.MockedFunction<
    typeof nodemailer.createTransport
  >;
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string | number | boolean> = {
        MAIL_HOST: 'smtp.example.com',
        MAIL_PORT: 465,
        MAIL_SECURE: true,
        MAIL_USER: 'mailer@example.com',
        MAIL_PASSWORD: 'mail-password',
        MAIL_FROM: 'RealWorld <mailer@example.com>',
      };
      return values[key];
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createTransport.mockReturnValue({ sendMail } as never);
  });

  it('uses the configured SMTP transport and sends a verification OTP', async () => {
    sendMail.mockResolvedValue({});
    const service = new MailService(configService as unknown as ConfigService);

    await service.sendVerificationOtp('jane@example.com', '123456', 600);

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: {
        user: 'mailer@example.com',
        pass: 'mail-password',
      },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'RealWorld <mailer@example.com>',
      to: 'jane@example.com',
      subject: 'Verify your email address',
      text: 'Your email verification code is 123456. It expires in 10 minutes.',
    });
  });

  it('returns a generic 503 when SMTP fails', async () => {
    sendMail.mockRejectedValue(new Error('SMTP credentials rejected'));
    const service = new MailService(configService as unknown as ConfigService);

    await expect(
      service.sendPasswordResetOtp('jane@example.com', '123456', 600),
    ).rejects.toMatchObject({
      status: 503,
      message: 'Email delivery is temporarily unavailable.',
    });
  });
});
