import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ArticleSlugParamDto } from '../articles/article.dto';
import { trimString } from '../common/trim-string.transform';
import { COMMENT_BODY_MAX_LENGTH } from './comments.constants';

export class CreateCommentDto {
  @ApiProperty({
    example: 'A useful article!',
    maxLength: COMMENT_BODY_MAX_LENGTH,
  })
  // Preserve JSON types instead of implicitly converting numbers to strings.
  @Type(() => Object)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_BODY_MAX_LENGTH)
  body!: string;
}

export class CreateCommentEnvelope {
  @ApiProperty({ type: CreateCommentDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateCommentDto)
  comment!: CreateCommentDto;
}

export class CommentParamDto extends ArticleSlugParamDto {
  @ApiProperty({
    format: 'uuid',
    example: '3acb544c-7b01-4b53-8c2b-e9ba78f0266f',
  })
  @IsUUID()
  id!: string;
}
