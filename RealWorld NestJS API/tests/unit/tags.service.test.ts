import { Repository } from 'typeorm';
import { TagEntity } from '../../src/database/entities/tag.entity';
import { TagsService } from '../../src/tags/tags.service';

describe('TagsService', () => {
  it('selects sorted names and omits internal IDs', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([
        { id: 'private-id', name: 'nestjs' },
        { id: 'another-id', name: 'typescript' },
      ]),
    };
    const service = new TagsService(
      repository as unknown as Repository<TagEntity>,
    );
    await expect(service.list()).resolves.toEqual({
      tags: ['nestjs', 'typescript'],
    });
    expect(repository.find).toHaveBeenCalledWith({
      select: { name: true },
      order: { name: 'ASC' },
    });
  });

  it('returns an empty tags wrapper', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) };
    await expect(
      new TagsService(repository as unknown as Repository<TagEntity>).list(),
    ).resolves.toEqual({ tags: [] });
  });
});
