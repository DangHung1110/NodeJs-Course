# DATABASE — Tables and migrations

Tables: `users` (UUID, username unique, email unique, password_hash, bio, image, timestamps); `articles` (UUID, slug unique, title, description, body, author_id, timestamps); `comments` (UUID, body, author_id, article_id, timestamps); `tags`, `article_tags`; `favorites` (unique user_id/article_id); `follows` (unique follower_id/following_id; prevent self-follow); `attachments` (UUID id, attachable_type, attachable_id, url, file_name, file_type, file_size, timestamps).

Relationships: users 1:N articles/comments; articles 1:N comments; articles N:M tags; users N:M articles through favorites; users self N:M through follows. Polymorphic attachments use type/id discriminator and service-level ownership checks; index `(attachable_type, attachable_id)`.

## Manual migration commands
Implement and document verified npm scripts: `migration:create` (manual empty migration), `migration:generate` (optional), `migration:run`, `migration:revert`, `migration:reset` (local/test only, explicit destructive warning). TypeORM CLI invocation must use the actual compiled/TS DataSource. Validate add → apply → revert → re-apply; do not use synchronize.

## Test data isolation
Use separate database name and credentials. Before each e2e case, clear all dependent rows safely and insert deterministic fixtures; do not touch development data. Ensure teardown closes DB and Redis connections.
