export interface ArticleAuthorResponse {
  readonly username: string;
  readonly bio: string | null;
  readonly image: string | null;
  readonly following: boolean;
}

export interface ArticleResponse {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly tagList: string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly favorited: boolean;
  readonly favoritesCount: number;
  readonly author: ArticleAuthorResponse;
}

export interface ArticleEnvelopeResponse {
  readonly article: ArticleResponse;
}

export interface ArticlesEnvelopeResponse {
  readonly articles: ArticleResponse[];
  readonly articlesCount: number;
}
