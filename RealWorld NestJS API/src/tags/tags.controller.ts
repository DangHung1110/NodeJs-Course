import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import type { TagsEnvelopeResponse } from './tags.service';

@ApiTags('Tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'List all tags alphabetically', security: [] })
  @ApiOkResponse({
    description:
      'Unique stored tags, including tags preserved after article deletion.',
    schema: { example: { tags: ['nestjs', 'typescript'] } },
  })
  list(): Promise<TagsEnvelopeResponse> {
    return this.tagsService.list();
  }
}
