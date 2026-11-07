# Technical decisions — TASK-01 stabilization

Checked on 2026-11-07 with Node.js 22.13.1, npm 10.9.2 and Windows.

## Runtime and framework versions

| Component | Version | Decision |
|---|---|---|
| Node.js | 22.13.1 | Keep current version; satisfies NestJS 11 and Nest CLI 11. |
| NestJS | 11.2.8 | Keep; no project requirement needs NestJS 12. |
| Nest CLI | 11.0.24 | Keep; requires Node.js `>=20.11`. |
| TypeScript | 5.9.3 | Keep; compatible with the NestJS 11 toolchain. |
| `@types/node` | 22.20.5 | Aligned with the Node.js 22 runtime (was `^24`, which is a newer runtime). |
| `@nestjs/swagger` | 11.4.8 | NestJS 11-compatible line (`12.x` requires NestJS 12). |
| `nestjs-i18n` | 10.8.5 | Stable release; peer dependencies accept NestJS 11. |
| Sunlint | 1.3.56 | Project devDependency; pinned through `package-lock.json`. |

`package.json` declares `engines.node: ">=20.11.0"` to match the actual Nest CLI 11
requirement. The NestJS 11 packages require Node.js `>=20`; Nest CLI 11 requires
`>=20.11`; Node.js 22.13.1 satisfies both.

Nest CLI 12 (`@nestjs/cli@12.0.12`) is **not** compatible with the current
runtime. Its `@nestjs/schematics@12.x` and `@angular-devkit/*@22.2.6`
dependencies declare:

```text
node: ^22.22.3 || ^24.15.0 || >=26.0.0
```

Node.js 22.13.1 does not satisfy that range. Decision: stay on NestJS 11 and
Node.js 22.13.1. Do not upgrade major versions without mentor approval.

## Dependency security

`npm audit` summary after stabilization:

| Severity | Count | Scope |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Moderate | 28 | development only |
| Low | 2 | development only |
| **Total** | **30** | production: **0** |

- `npm audit --omit=dev` reports **0 vulnerabilities**. All 30 findings are in
  development dependencies of the Nest CLI, Sunlint, Jest, ESLint and TypeScript
  ESLint toolchains.
- Direct development dependencies flagged: `@nestjs/cli` (moderate, via
  `glob`/`fork-ts-checker-webpack-plugin`), `@sun-asterisk/sunlint` (moderate,
  via `ts-morph`), `jest` (moderate, via `@jest/core`) and `typescript-eslint`
  (moderate, via `minimatch`).
- Root advisories:
  - `deepmerge` (low, GHSA-gcqx-w48m-w2h4) via
    `fork-ts-checker-webpack-plugin` and `jest-config`.
  - `glob` (moderate, GHSA-3g3m-2fjr-6pw4) via Jest and Nest CLI.
  - `minimatch` (moderate, GHSA-g3hv-75wg-m249) via `glob`,
    `test-exclude`, `@typescript-eslint/typescript-estree`, `ts-morph` and
    `@ts-morph/common`.
- No safe non-breaking fix is available:
  - Latest `@nestjs/cli` 11.x, `jest` 30.5.2, `@sun-asterisk/sunlint` 1.3.56 and
    `typescript-eslint` 8.72.1 still depend on vulnerable
    `glob@^13.0.6` / `minimatch@^10.2.2` ranges.
  - The patched `glob` (14.0.2+) and `minimatch` (11.0.1+) are outside those
    dependency ranges. Forcing them would require cross-major `overrides` that
    are not verified against Jest/Nest CLI/ESLint.
  - `npm audit fix --force` would install `@nestjs/cli@12`, which is
    incompatible with Node.js 22.13.1.
  - Plain `npm audit fix --dry-run` only upgrades `babel-plugin-istanbul`
    8.0.0 → 8.0.2 and adds optional platform packages; the audit result stays at
    30 findings, so it is not applied.
  - All findings are development-only. Sunlint remains a project
    devDependency as required by the training workflow.
- `multer@2.5.0` is pinned with an npm `overrides` entry.
  `@nestjs/platform-express@11.2.8` pins `multer@2.4.0`, which is affected by
  GHSA-q7qp-rjg7-q26m (High, denial of service). `multer@2.5.0` is the patched
  release and remains API-compatible within the same major. This keeps the
  production audit at 0 vulnerabilities.
- `npm audit fix --force` is not used, and no major versions are upgraded
  automatically. Remove the `multer` override when NestJS 11 publishes a
  `platform-express` release that depends on `multer >=2.5.0`.

## Sunlint on Windows

Installed/verified CLI: `@sun-asterisk/sunlint@1.3.56`, which is the latest
version published on npm at the time of this check. No newer release fixes the
issue below.

### Observed behaviour

| Command | Exit code | Result |
|---|---|---|
| `sunlint --all --input=src --engine=auto` | `0` | Heuristic engine passes; ESLint engine fails on all batches with the `c:` protocol error. Wrapper still prints `All checks passed`. |
| `sunlint --all --input=src --engine=heuristic` | `0` | 64 heuristic rules pass, 0 errors / 0 warnings. Rule `C032` is not run. |
| `sunlint --all --input=src --engine=eslint` | `0` | 52 ESLint-engine rules cannot run; all batches fail with the same error. Wrapper still prints `All checks passed`. |

The `auto` engine runs 66 rules (heuristic 65 + ESLint `C032`). The ESLint
portion fails with:

```text
Only URLs with a scheme in: file, data, and node are supported by the default
ESM loader. On Windows, absolute paths must be valid file:// URLs.
Received protocol 'c:'
```

Important: the process **exits 0** and prints `All checks passed` even though
the ESLint engine failed. The default engine therefore produces a false green
result on Windows and must not be treated as compliance evidence.

### Root cause

This is an upstream Sunlint defect, not an ESLint/TypeScript configuration
problem and not a Node.js runtime problem.

Sunlint writes a temporary flat ESLint config and inserts a Windows absolute
path directly into an ESM import specifier. In
`node_modules/@sun-asterisk/sunlint/engines/eslint-engine.js` (v1.3.56) the
generated config contains:

```js
import customPlugin from '${path.resolve(__dirname, '../integrations/eslint/plugin/index.js')}';
```

On Windows this produces a specifier such as
`C:\...\integrations\eslint\plugin\index.js`. The ESM loader interprets `c:` as
a URL scheme instead of a filesystem path. The upstream fix would need to emit
`pathToFileURL(...).href` or a relative specifier. This project does not patch
`node_modules`.

### Workarounds

Full Sunlint run (all engines, including `C032` and the ESLint-engine rules):

- Run the same command on Linux/macOS, in WSL with Node.js installed, or in the
  CI job (`ubuntu-latest` with Node.js 22), where absolute paths are valid ESM
  paths:

  ```bash
  npx @sun-asterisk/sunlint@1.3.56 --all --input=src --engine=auto
  ```

Local Windows check (partial, heuristic engine only):

```bash
npx @sun-asterisk/sunlint@1.3.56 --all --input=src --engine=heuristic
```

The heuristic result (0 errors / 0 warnings) is **not** full Sunlint
compliance because `C032` and the ESLint-engine rules were not executed. Do not
report Sunlint compliance from the Windows `auto` output until it is verified on
Linux/CI. Do not patch `node_modules`, disable lint rules, or commit the
generated `.sunlint-eslint.config.js` file.

### Ubuntu CI gate

`.github/workflows/sunlint.yml` runs on `ubuntu-latest` with Node.js 22 and
`npm ci`. It runs the full `auto` engine and explicitly fails when:

- either the heuristic or ESLint engine line is missing;
- any `analysis failed` message appears in the log (Sunlint exits 0 even when an
  engine fails, so the exit code alone is not trusted);
- the expected `65` heuristic rules or the `1` ESLint rule (`C032`) did not run;
- the generated summary reports any error-level violation.

The workflow uploads `sunlint.log`, `sunlint-report.json` and
`sunlint-summary.json` as artifacts on every run.

## PR-01 implementation

| Requirement | Implementation |
|---|---|
| Hello World API | `GET /api/hello` → `200 { "message": "..." }` via `HelloController` + `HelloService`. |
| i18n | `nestjs-i18n` with `en`/`vi` resources under `src/i18n`, `Accept-Language` resolution, `en` fallback. |
| Build assets | `nest-cli.json` copies `i18n/**/*.json` to `dist/i18n`. |
| Swagger | `@nestjs/swagger` at `/api/docs` (non-production), title/description/version configured; OpenAPI JSON at `/api/docs-json`. |
| Tests | Service/controller unit tests plus e2e coverage for English, Vietnamese, `vi-VN`, fallback, Swagger UI and OpenAPI document. |

## PR-01 verification commands

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm audit --omit=dev
npx sunlint --all --input=src --engine=heuristic
npx sunlint --all --input=src --engine=auto
```

The `auto` command only completes on Linux/CI (see the Windows limitation
above).
