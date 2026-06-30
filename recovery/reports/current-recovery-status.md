# Current Recovery Status

- Date: `2026-06-29`
- Recovery target: `C:\Users\Pichau\Documents\New project\reelforge-studio-recovered`
- Original evidence kept frozen: `C:\Users\Pichau\Documents\New project\reelforge-studio`

## Recovery layers completed

### Workspace recovery baseline

- Original inventory generated.
- Codex log extraction generated.
- Materialization from extracted logs generated.
- `npm install` completed in the recovered workspace.
- `npm run db:generate` completed after pinning Prisma to `6.16.0`.

### Web contract recovery

- `apps/web/src/lib/studio-types.ts` restored.
- `apps/web/src/lib/studio-api.ts` kept compatible with the recovered UI.
- `npm run typecheck --workspace @reelforge/web` passes.
- `npm run build --workspace @reelforge/web` passes.

### Package and worker recovery

- `npm run typecheck --workspace @reelforge/story-engine` passes.
- `npm run typecheck --workspace @reelforge/templates` passes.
- `npm run typecheck --workspace @reelforge/video-engine` passes.
- `npm run typecheck --workspace @reelforge/worker` passes.
- `npm run build --workspace @reelforge/story-engine` passes.
- `npm run build --workspace @reelforge/templates` passes.
- `npm run build --workspace @reelforge/video-engine` passes.
- `npm run build --workspace @reelforge/worker` passes.

### Monorepo validation

- `npm run typecheck` passes across the monorepo.
- `npm run build` passes across the monorepo.

### Prisma migration recovery

- The incomplete historical migration chain was archived safely.
- A new active baseline migration was generated:
  - `prisma/migrations/20260630015437_recovery_baseline/`
- `npm run db:generate` passes.
- `npx prisma migrate deploy --schema prisma/schema.prisma` passes.
- `node prisma/seed.mjs` passes.
- `npx prisma migrate status --schema prisma/schema.prisma` passes.

## Logical smoke status

- `smoke:research` completed.
- `smoke:intake` completed.
- `smoke:media-collector` completed.
- `smoke:hybrid-visual` completed.
- `smoke:hybrid-visual:render-ready` completed.
- `smoke:comfy-provider:contract` completed.
- `smoke:comfy-provider:mock-status` completed.
- `smoke:prompt-engine` completed.
- `smoke:production:logic` is environment-skipped when FFmpeg or `child_process.spawn` is unavailable.

## Important recovery notes

- The recovered API and worker needed a runtime-safe `projectRoot` resolver because the compiled composite build lands under nested `dist/apps/.../src` paths.
- The smoke layer now resolves the actual compiled API root dynamically instead of assuming the legacy `apps/api/dist/...` layout.
- Prisma Migrate in this Windows session returned generic schema-engine errors when `prisma/dev.db` was absent; recreating the empty SQLite file restored normal diagnostics.
- The final working Prisma path uses a fresh recovery baseline, not the lost historical chain.
- The JSON parse build warning was traced to corrupted local JSON files and is now fixed.

## Real pending issues

- Exact historical Prisma migration fidelity is still not recoverable from disk alone.
- `npm run db:seed` via Prisma's wrapper still hits environment `spawn EPERM`; direct `node prisma/seed.mjs` works and is the documented fallback.
- `next build` still prints the known non-fatal warning:
  - `TypeScript project references are not fully supported. Attempting to build in incremental mode.`

## Recommended next move

The recovered workspace is now stable enough for a safe Git checkpoint decision.

Recommended next steps:

1. initialize Git in the recovered workspace when you want to start versioning from the recovery baseline
2. keep `recovery/archived-migrations/` as evidence of the lost original chain
3. only revisit historical migration reconstruction if exact chronology becomes necessary later
