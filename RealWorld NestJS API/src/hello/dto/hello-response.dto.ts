import { ApiProperty } from '@nestjs/swagger';

export class HelloResponseDto {
  @ApiProperty({
    description: 'Localized hello message.',
    example: 'Hello World!',
  })
  message!: string;
}
