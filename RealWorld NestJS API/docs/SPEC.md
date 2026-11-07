# SPEC — RealWorld NestJS Backend (Mentor-aligned v2)

## Authority and scope
Trainer/mentor's latest instructions override older planning; RealWorld API is the default contract where not explicitly overridden. Backend only; NestJS + TypeScript strict + MySQL + TypeORM + JWT + Redis for token blacklist. Sunlint mandatory. Six PRs are the review milestones, not necessarily six independent calendar days. Target ~10 days is an estimate, review approval gates take precedence.

## Mandatory features
- PR1: NestJS bootstrap, Hello World API, i18n, Swagger, config, Sunlint.
- PR2: manual database migration workflow (add/create, apply, revert, reset), auth register/login/logout using Redis token blacklist, Get Current User.
- PR3: Update User, Get Profile, Follow/Unfollow, avatar upload locally (public or private), polymorphic attachments table.
- PR4: Article create/list/feed/detail/update/delete/favorite/unfavorite; filtering, search, pagination, serialization.
- PR5: Comment create/list/delete, tags support as required by RealWorld.
- PR6: isolated database e2e tests, seed/fake data before each test, clean/reset between tests, C2 coverage for one controller.

## Additional learning goals (separate stretch tasks; no unspecified business APIs)
- Unit tests, file handling with Multer (local mandatory for avatar; Cloudinary optional alternative only if approved).
- Mail queue using @nestjs/bull + Redis and scheduling using @nestjs/schedule: learn/configure via explicit follow-on task only after mentor clarifies the email/scheduled job use case.

## Acceptance
Correct RealWorld endpoint contracts except documented mentor deviations; validation DTO, serializer, filtering/search/pagination; authorization, no plaintext password; zero Sunlint errors; Copilot review/comments fixed, self-review, then mentor review; evidence attached to PR. Do not merge without required approval.

## Conflicts with old spec
- Client-only logout is obsolete: Redis blacklist is mandatory. JWT revocation must be enforced in guards.
- Follow/favorite/feed are mandatory under mentor PR plan, not optional.
- Avatar upload and attachments are mandatory.
- API-only remains; do not build login/signup pages.
- 'Each API separate PR' from old spec is superseded by mentor's six grouped PR milestones. Keep commits and task steps small within each PR.
