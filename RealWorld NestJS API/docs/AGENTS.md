# AGENTS.md — Codex operating rules

Read `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DATABASE.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `docs/ROADMAP.md` and the current `docs/sprints/PR-XX-*/TASK-*.md` before coding. Mentor's newer instructions supersede old optional scope. One task at a time; stop after task and report verification. Do not implement later PRs. Do not auto commit, push, create or merge PR.

NestJS strict TypeScript, DI, thin controllers, DTO validation, explicit response serializers, migrations only (`synchronize: false`), Jest/Supertest, Swagger, i18n, JWT `Token` header, Redis logout blacklist, avatar Multer + polymorphic attachments. No secrets, unsafe uploads or logging tokens. Use Google TypeScript Style Guide and mandatory Sunlint: https://coding-standards.sun-asterisk.vn/docs/installation/. Verify CLI syntax against installed version and official docs; never invent commands. Fix 100% Sunlint errors; warning fixes encouraged. Attach screenshot to PR comment manually. Request Copilot review, fix comments, self-review, then mentor review. Do not skip gates.

Do not assume email queue/scheduler business APIs; those are later learning tasks pending a concrete use case. Clarify conflicts rather than silently redefining RealWorld contracts. Do not report checks as passed unless actually run.
