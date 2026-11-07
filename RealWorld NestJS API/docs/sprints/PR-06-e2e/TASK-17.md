# TASK-17 — Full-flow e2e and C2 controller

**PR:** 06 | **Depends on:** preceding tasks and approved earlier PRs.

## Goal and scope
Auth/user/article/comment flows, unauthorized cases, branch/decision coverage report for one controller.

## Steps
1. Read global docs, this PR README, official NestJS/RealWorld/Sunlint references relevant to task.
2. Inspect existing code and identify minimal changes.
3. Implement only the stated scope using thin controllers, services, strict DTO validation, serializer and migration when applicable.
4. Add unit/e2e tests for success, validation, auth/ownership, and error cases relevant to this task.
5. Run build, relevant tests and verified Sunlint command; resolve every error-level finding.

## Acceptance criteria
- [ ] Auth/user/article/comment flows, unauthorized cases, branch/decision coverage report for one controller.
- [ ] Matches `docs/API_CONTRACT.md` and mentor additions; deviations documented.
- [ ] No unrelated endpoints or future tasks implemented.
- [ ] Relevant success and failure tests pass; actual command output recorded.
- [ ] Zero Sunlint error-level violations in changed code; screenshot prepared.
- [ ] PR checklist and Copilot/self/mentor review sequence respected.

## Stop condition
After completing this task, summarize changed files, test commands/results, lint results, remaining risks and next task. Do not auto-commit or merge.
