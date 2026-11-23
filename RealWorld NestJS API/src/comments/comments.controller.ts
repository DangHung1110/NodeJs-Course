import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ArticleSlugParamDto } from '../articles/article.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OptionalJwtAuthGuard } from '../profiles/optional-jwt-auth.guard';
import type { OptionalAuthenticatedRequest } from '../profiles/profiles.types';
import { CommentParamDto, CreateCommentEnvelope } from './comment.dto';
import type {
  CommentEnvelopeResponse,
  CommentsEnvelopeResponse,
} from './comment-response';
import { CommentsService } from './comments.service';
import { COMMENT_BODY_MAX_LENGTH } from './comments.constants';

const COMMENT_EXAMPLE = {
  id: '3acb544c-7b01-4b53-8c2b-e9ba78f0266f',
  body: 'A useful article!',
  createdAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z',
  author: { username: 'author', bio: null, image: null, following: false },
};

@ApiTags('Comments')
@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Add a comment to an article' })
  @ApiCreatedResponse({
    description: 'Comment created.',
    schema: { example: { comment: COMMENT_EXAMPLE } },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiNotFoundResponse({ description: 'Article not found.' })
  @ApiUnprocessableEntityResponse({
    description: `Invalid slug or comment; body must contain 1–${COMMENT_BODY_MAX_LENGTH} characters after trimming.`,
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Param() params: ArticleSlugParamDto,
    @Body() body: CreateCommentEnvelope,
  ): Promise<CommentEnvelopeResponse> {
    return this.commentsService.create(
      params.slug,
      request.user.sub,
      body.comment,
    );
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'List article comments, newest first with UUID tie-breaker',
    security: [{ TokenAuth: [] }, {}],
  })
  @ApiOkResponse({
    description: 'Comments with public author profiles; no pagination.',
    schema: { example: { comments: [COMMENT_EXAMPLE] } },
  })
  @ApiNotFoundResponse({ description: 'Article not found.' })
  @ApiUnauthorizedResponse({
    description: 'Supplied token is invalid or expired.',
  })
  @ApiUnprocessableEntityResponse({ description: 'Invalid slug.' })
  list(
    @Req() request: OptionalAuthenticatedRequest,
    @Param() params: ArticleSlugParamDto,
  ): Promise<CommentsEnvelopeResponse> {
    return this.commentsService.list(params.slug, request.user?.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Delete a comment written by the current user' })
  @ApiNoContentResponse({ description: 'Comment deleted.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description:
      'Only the comment author may delete it; article ownership grants no extra permission.',
  })
  @ApiNotFoundResponse({
    description:
      'Article or comment not found, already deleted, or comment belongs to another article.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid slug or comment UUID.',
  })
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param() params: CommentParamDto,
  ): Promise<void> {
    await this.commentsService.delete(params.slug, params.id, request.user.sub);
  }
}
