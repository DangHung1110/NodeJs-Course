# TASK-06 — Redis blacklist logout + current user

**PR:** 02 | **Depends on:** preceding tasks and approved earlier PRs.

## Goal and scope
Redis service, protected logout, JWT denylist check, GET /api/user; tests for reuse of revoked token.

## Steps
1. Read global docs, this PR README, official NestJS/RealWorld/Sunlint references relevant to task.
2. Inspect existing code and identify minimal changes.
3. Implement only the stated scope using thin controllers, services, strict DTO validation, serializer and migration when applicable.
4. Add unit/e2e tests for success, validation, auth/ownership, and error cases relevant to this task.
5. Run build, relevant tests and verified Sunlint command; resolve every error-level finding.

## Acceptance criteria
- [ ] Redis service, protected logout, JWT denylist check, GET /api/user; tests for reuse of revoked token.
- [ ] Matches `docs/API_CONTRACT.md` and mentor additions; deviations documented.
- [ ] No unrelated endpoints or future tasks implemented.
- [ ] Relevant success and failure tests pass; actual command output recorded.
- [ ] Zero Sunlint error-level violations in changed code; screenshot prepared.
- [ ] PR checklist and Copilot/self/mentor review sequence respected.

## Stop condition
After completing this task, summarize changed files, test commands/results, lint results, remaining risks and next task. Do not auto-commit or merge.
