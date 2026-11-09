# ARCHITECTURE — Mentor-aligned

NestJS modular layered backend: middleware → guard (JWT verification + Redis denylist) → interceptor → pipes → controller → service → TypeORM repository → MySQL; exception filters handle errors. Keep thin controllers, DTO validation and explicit response serializers; no entities leaked directly.

## Modules
App, Config, I18n, Database, Auth, Users, Profiles, Attachments, Articles, Tags, Favorites, Comments, Follows, Common. Redis connection for auth blacklist (and optionally queue later). Swagger in development. Use `@nestjs/platform-express` + Multer for local avatar upload.

## Auth
JWT includes `sub`, `jti`, `exp`. On logout blacklist `jti` in Redis with TTL = remaining token lifetime. Guard checks blacklist on every protected request. Redis failure policy: fail closed for protected requests when blacklist status cannot be verified; do not silently accept revoked tokens. Login/register returns RealWorld `user` wrapper. Client header `Authorization: Token <jwt>`.

## Attachments
`attachments`: UUID id, `attachable_type`, `attachable_id`, `url`, `file_name`, `file_type`, `file_size`, timestamps. Polymorphic ownership validated in service, not enforced by a generic FK. For training choose **public** local folder under `/uploads` by default; document public exposure, allow only images, enforce MIME/signature, size cap, randomized filenames, avoid path traversal. Private serving is alternative only if chosen explicitly.

## Database and migration
TypeORM migrations with `synchronize: false`. Explicit scripts for create/add, run/apply, revert, and reset (reset restricted to local/test and requires confirmation). Never auto-reset shared DB. Test DB must be isolated from dev DB.

## Testing
Jest unit + Supertest e2e. Dedicated test database; seed per test; truncate/cleanup with FK-safe order or rollback between tests. C2 means branch/decision coverage for one controller; agree on measurement with mentor and document report.
