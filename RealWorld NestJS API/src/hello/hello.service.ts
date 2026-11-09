import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { HelloResponseDto } from './dto/hello-response.dto';

@Injectable()
export class HelloService {
  constructor(private readonly i18n: I18nService) {}

  getHello(language: string): HelloResponseDto {
    return {
      message: this.i18n.translate('hello.HELLO', { lang: language }),
    };
  }
}
