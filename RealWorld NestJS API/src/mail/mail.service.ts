import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

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

  sendVerificationOtp(
    recipient: string,
    otp: string,
    expiresInSeconds: number,
  ): Promise<void> {
    return this.sendOtp(
      recipient,
      'Verify your email address',
      'email verification',
      otp,
      expiresInSeconds,
    );
  }

  sendPasswordResetOtp(
    recipient: string,
    otp: string,
    expiresInSeconds: number,
  ): Promise<void> {
    return this.sendOtp(
      recipient,
      'Reset your password',
      'password reset',
      otp,
      expiresInSeconds,
    );
  }

  private async sendOtp(
    recipient: string,
    subject: string,
    purpose: string,
    otp: string,
    expiresInSeconds: number,
  ): Promise<void> {
    const expiresInMinutes = Math.ceil(expiresInSeconds / 60);
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: recipient,
        subject,
        text: [
          'Your ',
          purpose,
          ' code is ',
          otp,
          '. It expires in ',
          String(expiresInMinutes),
          ' minutes.',
        ].join(''),
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        'Email delivery is temporarily unavailable.',
        { cause: error },
      );
    }
  }
}
