import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import type { OtpPurpose } from '../auth/otp.service';

const OTP_MAIL = {
  'email-verification': {
    subject: 'Verify your email address',
    label: 'email verification',
  },
  'password-reset': {
    subject: 'Reset your password',
    label: 'password reset',
  },
} as const;

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(configService: ConfigService) {
    this.from = configService.getOrThrow<string>('MAIL_FROM');
    this.transporter = nodemailer.createTransport({
      host: configService.getOrThrow<string>('MAIL_HOST'),
      port: configService.getOrThrow<number>('MAIL_PORT'),
      secure: configService.getOrThrow<boolean>('MAIL_SECURE'),
      auth: {
        user: configService.getOrThrow<string>('MAIL_USER'),
        pass: configService.getOrThrow<string>('MAIL_PASSWORD'),
      },
    });
  }

  async sendOtp(
    recipient: string,
    purpose: OtpPurpose,
    otp: string,
    expiresInSeconds: number,
  ): Promise<void> {
    const mail = OTP_MAIL[purpose];
    const expiresInMinutes = Math.ceil(expiresInSeconds / 60);
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: recipient,
        subject: mail.subject,
        text: `Your ${mail.label} code is ${otp}. It expires in ${String(expiresInMinutes)} minutes.`,
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        'Email delivery is temporarily unavailable.',
        { cause: error },
      );
    }
  }
}
