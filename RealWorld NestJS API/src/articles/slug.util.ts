import { randomUUID } from 'node:crypto';

const MAX_SLUG_BASE_LENGTH = 230;

export function createArticleSlug(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/đ/gi, 'd')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SLUG_BASE_LENGTH)
    .replace(/-$/g, '');
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  return `${base || 'article'}-${suffix}`;
}
