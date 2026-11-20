import { createArticleSlug } from '../../src/articles/slug.util';

describe('createArticleSlug', () => {
  it('normalizes Vietnamese titles and appends a collision-resistant suffix', () => {
    const slug = createArticleSlug('  Học NestJS: Từ đầu đến cuối!  ');

    expect(slug).toMatch(/^hoc-nestjs-tu-dau-den-cuoi-[a-f0-9]{12}$/);
  });

  it('uses article as the fallback for punctuation-only titles', () => {
    expect(createArticleSlug('***')).toMatch(/^article-[a-f0-9]{12}$/);
  });
});
