# API CONTRACT — RealWorld with mentor extensions

Base `/api`. JWT header `Authorization: Token <jwt>`. Keep wrappers `user`, `profile`, `article`, `articles` + `articlesCount`, `comment`, `comments`, `tags`; serializer strips password hashes/internal fields. Use ValidationPipe + class-validator nested DTOs; consistent 401/403/404/422 errors.

## PR1
`GET /api/hello` → 200 hello message (mentor training-only endpoint; may support locale).

## PR2
`POST /api/users` register; `POST /api/users/login` login; `GET /api/user` current user; `POST /api/users/logout` **mentor extension**, authenticated, blacklist JWT `jti` in Redis; subsequent use returns 401. Document status/body for logout in Swagger.

## PR3
`PUT /api/user` update fields and optional avatar upload; `GET /api/profiles/:username`; `POST /api/profiles/:username/follow`; `DELETE /api/profiles/:username/follow`. Upload approach: `POST /api/user/avatar` multipart/form-data, authenticated (mentor extension; decide exact route in PR3 and document). Return user/profile with image URL. Do not accept arbitrary path/extension.

## PR4
`POST /api/articles`; `GET /api/articles` with `limit`, `offset`, `tag`, `author`, `favorited` and project-specific `search` (clearly documented extension); `GET /api/articles/feed`; `GET /api/articles/:slug`; `PUT /api/articles/:slug`; `DELETE /api/articles/:slug`; `POST /api/articles/:slug/favorite`; `DELETE /api/articles/:slug/favorite`. Ensure static `/feed` route is registered before `/:slug`.

## PR5
`POST /api/articles/:slug/comments`; `GET /api/articles/:slug/comments`; `DELETE /api/articles/:slug/comments/:id`; `GET /api/tags`.

## Pagination / serialization
Default limit=20, offset=0, deterministic newest-first; `articlesCount` counts matches before pagination. `favorited`, `following`, `favoritesCount` are computed from relationships. Query search matches article title/description (case-insensitive) unless mentor clarifies otherwise. Public endpoints accept optional authentication for personalized flags.

Official contract: https://realworld-docs.netlify.app/specifications/backend/endpoints/
