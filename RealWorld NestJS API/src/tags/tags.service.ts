import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TagEntity } from '../database/entities/tag.entity';

export interface TagsEnvelopeResponse {
  readonly tags: string[];
}

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(TagEntity)
    private readonly tagsRepository: Repository<TagEntity>,
  ) {}

  async list(): Promise<TagsEnvelopeResponse> {
    const tags = await this.tagsRepository.find({
      select: { name: true },
      order: { name: 'ASC' },
    });
    return { tags: tags.map((tag) => tag.name) };
  }
}
