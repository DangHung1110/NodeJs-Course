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
  Put,
  Query,
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
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OptionalJwtAuthGuard } from '../profiles/optional-jwt-auth.guard';
import type { OptionalAuthenticatedRequest } from '../profiles/profiles.types';
import {
  ArticlePaginationQueryDto,
  ArticleSlugParamDto,
  CreateArticleEnvelope,
  ListArticlesQueryDto,
  UpdateArticleEnvelope,
} from './article.dto';
import type {
  ArticleEnvelopeResponse,
  ArticlesEnvelopeResponse,
} from './article-response';
import { ArticlesService } from './articles.service';

const ARTICLE_RESPONSE_EXAMPLE = {
  article: {
    slug: 'how-to-train-your-dragon-a1b2c3d4e5f6',
    title: 'How to train your dragon',
    description: 'Ever wonder how?',
    body: 'You have to believe.',
    tagList: ['nestjs', 'typescript'],
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
    favorited: false,
    favoritesCount: 0,
    author: {
      username: 'author',
      bio: null,
      image: null,
      following: false,
    },
  },
};

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Create an article' })
  @ApiCreatedResponse({
    description: 'Created article with author and tags.',
    schema: { example: ARTICLE_RESPONSE_EXAMPLE },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid article payload.' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateArticleEnvelope,
  ): Promise<ArticleEnvelopeResponse> {
    return this.articlesService.create(request.user.sub, body.article);
  }

  @Get('feed')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'List articles from followed authors' })
  @ApiOkResponse({
    description: 'Paginated personal article feed.',
    schema: {
      example: {
        articles: [ARTICLE_RESPONSE_EXAMPLE.article],
        articlesCount: 1,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid pagination.' })
  feed(
    @Req() request: AuthenticatedRequest,
    @Query() query: ArticlePaginationQueryDto,
  ): Promise<ArticlesEnvelopeResponse> {
    return this.articlesService.feed(query, request.user.sub);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List, filter and search articles' })
  @ApiOkResponse({
    description: 'Filtered articles and total match count.',
    schema: {
      example: {
        articles: [ARTICLE_RESPONSE_EXAMPLE.article],
        articlesCount: 1,
      },
    },
  })
  @ApiUnprocessableEntityResponse({ description: 'Invalid filters.' })
  list(
    @Req() request: OptionalAuthenticatedRequest,
    @Query() query: ListArticlesQueryDto,
  ): Promise<ArticlesEnvelopeResponse> {
    return this.articlesService.list(query, request.user?.sub);
  }

  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get an article by slug' })
  @ApiOkResponse({
    description: 'Article details.',
    schema: { example: ARTICLE_RESPONSE_EXAMPLE },
  })
  @ApiNotFoundResponse({ description: 'Article not found.' })
  getBySlug(
    @Req() request: OptionalAuthenticatedRequest,
    @Param() params: ArticleSlugParamDto,
  ): Promise<ArticleEnvelopeResponse> {
    return this.articlesService.getBySlug(params.slug, request.user?.sub);
  }

  @Put(':slug')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Update an owned article' })
  @ApiOkResponse({
    description: 'Updated article.',
    schema: { example: ARTICLE_RESPONSE_EXAMPLE },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({ description: 'Only the author may update it.' })
  @ApiNotFoundResponse({ description: 'Article not found.' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid article payload.' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param() params: ArticleSlugParamDto,
    @Body() body: UpdateArticleEnvelope,
  ): Promise<ArticleEnvelopeResponse> {
    return this.articlesService.update(
      params.slug,
      request.user.sub,
      body.article,
    );
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Delete an owned article' })
  @ApiNoContentResponse({ description: 'Article deleted.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({ description: 'Only the author may delete it.' })
  @ApiNotFoundResponse({ description: 'Article not found.' })
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param() params: ArticleSlugParamDto,
  ): Promise<void> {
    await this.articlesService.delete(params.slug, request.user.sub);
  }

  @Post(':slug/favorite')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Favorite an article' })
  @ApiOkResponse({
    description: 'Favorited article.',
    schema: { example: ARTICLE_RESPONSE_EXAMPLE },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiNotFoundResponse({ description: 'Article not found.' })
  favorite(
    @Req() request: AuthenticatedRequest,
    @Param() params: ArticleSlugParamDto,
  ): Promise<ArticleEnvelopeResponse> {
    return this.articlesService.favorite(params.slug, request.user.sub);
  }

  @Delete(':slug/favorite')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Unfavorite an article' })
  @ApiOkResponse({
    description: 'Unfavorited article.',
    schema: { example: ARTICLE_RESPONSE_EXAMPLE },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiNotFoundResponse({ description: 'Article not found.' })
  unfavorite(
    @Req() request: AuthenticatedRequest,
    @Param() params: ArticleSlugParamDto,
  ): Promise<ArticleEnvelopeResponse> {
    return this.articlesService.unfavorite(params.slug, request.user.sub);
  }
}
