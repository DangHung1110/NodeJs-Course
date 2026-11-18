import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'article_tags' })
@Index('IDX_article_tags_tag_article', ['tagId', 'articleId'])
export class ArticleTagEntity {
  @PrimaryColumn({ name: 'article_id', type: 'char', length: 36 })
  articleId!: string;

  @PrimaryColumn({ name: 'tag_id', type: 'char', length: 36 })
  tagId!: string;
}
