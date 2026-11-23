import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DEFAULT_ARTICLE_LIMIT,
  MAX_ARTICLE_LIMIT,
  MAX_TAGS_PER_ARTICLE,
} from './article.constants';
import { trimString } from '../common/trim-string.transform';

function normalizeTags({ value }: { value: unknown }): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((tag: unknown) =>
    typeof tag === 'string' ? tag.trim().toLowerCase() : tag,
  );
}

export class CreateArticleDto {
  @ApiProperty({ example: 'How to train your dragon', maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Ever wonder how?', maxLength: 2000 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ example: 'You have to believe.', maxLength: 50000 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  body!: string;

  @ApiPropertyOptional({ type: [String], example: ['nestjs', 'typescript'] })
  @IsOptional()
  @Transform(normalizeTags)
  @IsArray()
  @ArrayMaxSize(MAX_TAGS_PER_ARTICLE)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(50, { each: true })
  tagList?: string[];
}

export class CreateArticleEnvelope {
  @ApiProperty({ type: CreateArticleDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateArticleDto)
  article!: CreateArticleDto;
}

export class UpdateArticleDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 50000 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  body?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(normalizeTags)
  @IsArray()
  @ArrayMaxSize(MAX_TAGS_PER_ARTICLE)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(50, { each: true })
  tagList?: string[];
}

export class UpdateArticleEnvelope {
  @ApiProperty({ type: UpdateArticleDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateArticleDto)
  article!: UpdateArticleDto;
}

export class ArticlePaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_ARTICLE_LIMIT, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ARTICLE_LIMIT)
  limit: number = DEFAULT_ARTICLE_LIMIT;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class ListArticlesQueryDto extends ArticlePaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tag?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  author?: string;

  @ApiPropertyOptional({
    description: 'Username whose favorites are filtered.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  favorited?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive title/description search.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  search?: string;
}

export class ArticleSlugParamDto {
  @ApiProperty({ example: 'how-to-train-your-dragon-a1b2c3d4' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(255)
  slug!: string;
}
