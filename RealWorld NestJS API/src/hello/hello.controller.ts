import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { I18n, I18nContext } from 'nestjs-i18n';
import { HelloResponseDto } from './dto/hello-response.dto';
import { HelloService } from './hello.service';

@ApiTags('Hello')
@Controller('hello')
export class HelloController {
  constructor(private readonly helloService: HelloService) {}

  @Get()
  @ApiOperation({ summary: 'Get a localized hello message.' })
  @ApiOkResponse({
    description: 'Localized hello message.',
    type: HelloResponseDto,
  })
  getHello(@I18n() i18n: I18nContext): HelloResponseDto {
    return this.helloService.getHello(i18n.lang);
  }
}
