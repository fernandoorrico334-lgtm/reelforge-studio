# Package And Worker Typecheck Errors

- Date: `2026-06-29`
- Recovery target: `C:\Users\Pichau\Documents\New project\reelforge-studio-recovered`
- Scope: `packages/story-engine`, `packages/templates`, `packages/video-engine`, `apps/worker`, and the smoke scripts that depend on their build output

## Commands used for diagnosis

- `npm run typecheck --workspace @reelforge/story-engine`
- `npm run typecheck --workspace @reelforge/templates`
- `npm run typecheck --workspace @reelforge/video-engine`
- `npm run typecheck --workspace @reelforge/worker`
- `npm run typecheck`

## Error groups found before recovery

### Import and project-reference errors

- `@reelforge/story-engine` was resolving `@reelforge/cinematic-engine` into sibling source files without a matching project reference.
- Result: `TS6059` and `TS6307` style failures caused by files outside the workspace `rootDir`.

### `dist/*.d.ts` and materialized output errors

- `@reelforge/templates`, `@reelforge/video-engine`, and `@reelforge/worker` were typechecking against declaration outputs that were not materialized yet.
- Result: `TS6305` and missing-declaration failures for referenced packages such as `@reelforge/caption-engine`.

### `rootDir` crossover errors

- The recovered workspaces mixed direct source visibility with composite-package expectations.
- API composite build output also landed under `apps/api/dist/apps/api/src`, while several smoke scripts still assumed the older `apps/api/dist/...` layout.

### `unknown` narrowing errors

- `apps/worker/src/services/render-worker.ts` still had a direct `unknown` error handling path in the cancellation branch.
- Result: `TS18046`-style narrowing failures.

### Real domain typing errors

- `packages/video-engine/src/index.ts` still had an implicit `any` in the story-role map callback.
- The worker also had a real contract mismatch between engine pipeline steps and persisted Prisma render-job step values after audio-stage additions.

## Runtime contract issues discovered while validating smokes

These were not pure typecheck failures, but they blocked the package/worker validation loop:

- The API compiled `config/paths` module resolved `projectRoot` correctly in source, but incorrectly in `dist/apps/api/src/...`.
- The same runtime root-resolution problem existed in the worker build.
- Several smoke scripts depended on the old API `dist` structure and had to be updated to discover the actual compiled root first.
- `prisma/dev.db` in the recovered workspace existed but was empty (`0` bytes), so Prisma-based smokes failed with `P2021`.
- `prisma migrate deploy` could not be used as-is because multiple restored migration directories were missing `migration.sql`.

## Final status

All four target workspaces now pass their own `typecheck` and `build` commands, and the monorepo root `npm run typecheck` now passes.
