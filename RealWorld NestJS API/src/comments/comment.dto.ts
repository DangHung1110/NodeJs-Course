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

export class CreateCommentDto {
  @ApiProperty({ example: 'A useful article!', maxLength: 10000 })
  @Transform(({ obj }: { obj: Record<string, unknown> }) =>
    typeof obj.body === 'string' ? obj.body.trim() : obj.body,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
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
