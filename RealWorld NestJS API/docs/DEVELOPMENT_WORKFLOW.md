# DEVELOPMENT WORKFLOW — Mentor review gates

## PR sequence
PR1 init NestJS + Hello World + i18n + Swagger; PR2 migrations + auth register/login/logout + current user; PR3 user/profile/follow/avatar/attachments; PR4 articles/feed/favorites; PR5 comments/tags; PR6 e2e testing. One PR/day is a **suggestion**, not permission to skip checks. Use branch names `chore/pr-01-init`, `feat/pr-02-auth-migrations`, etc.

## For every PR
1. Complete only tasks in active PR; make focused commits.
2. Run build, tests, Sunlint; fix **100% error rules**, address warnings where practical.
3. Request GitHub Copilot review; resolve every actionable comment; rerun checks.
4. Self-review diff against spec, security, API contract and test cases.
5. Only then request mentor review.
6. Add Sunlint screenshot in PR comments, plus test output/evidence.
7. Merge only after required mentor/team approval; do not auto-commit/push/merge unless asked.

## PR description
Summary, endpoints, migration notes, test cases, commands/results, Sunlint screenshot, Copilot review resolution, self-review checklist, mentor approval status.
