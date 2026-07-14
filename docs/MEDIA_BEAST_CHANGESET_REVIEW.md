# Media Beast Changeset Review

This note classifies the current local Media Beast changes before a future commit.

## Current Status

- Latest committed checkpoint reviewed: `4e50b50 feat(media-beast): ampliar assets do remix e melhorar narração contextual`.
- Current workspace has a large uncommitted Media Beast expansion focused on remix, comics assets, narration retention, and timeline materialization.
- `npm run typecheck --workspace @reelforge/media-beast` passes.

## Safe To Treat As Product Code

These files look like real Media Beast engine additions and should be reviewed as product code, not discarded as artifacts:

- `packages/media-beast/src/pipeline/comics-*.ts`
- `packages/media-beast/src/pipeline/*comics-discovery.ts`
- `packages/media-beast/src/pipeline/remix-materialization.ts`
- `packages/media-beast/src/pipeline/remix-timeline-ffmpeg.ts`
- `packages/media-beast/src/pipeline/remix-fast-cut-materializer.ts`
- `packages/media-beast/src/pipeline/remix-audio-mix.ts`
- `packages/media-beast/src/pipeline/remix-asset-rotation.ts`
- `packages/media-beast/src/pipeline/remix-visual-asset-selector.ts`
- `packages/media-beast/src/pipeline/source-footprint-guard.ts`
- `packages/media-beast/src/pipeline/narration-retention-*.ts`
- `packages/media-beast/src/pipeline/narration-truth-guard.ts`
- `packages/media-beast/src/pipeline/speech-timing-optimizer.ts`
- `packages/media-beast/src/pipeline/caption-direction-engine.ts`
- `packages/media-beast/src/pipeline/narration-upgrades-pipeline.ts`

## Remix Improvements Observed

- Asset discovery now includes stronger comics-specific queries and domain-aware scoring.
- Homonym and low-quality asset filtering were added to reduce false matches such as band, cosplay, merch, toys, and unrelated image results.
- Asset candidates are deduplicated by normalized title and preview URL.
- Remix variations now rotate asset pools and reduce repeated asset selections between variations.
- Scene structure now changes by target style, with different pacing and source segment bias for comics, documentary, horror, anime, true crime, and hype sports.
- Narration now has retention metadata, overlap reduction across variations, PT-BR oralization, speech timing, truth guard, and caption direction hooks.

## Scripts Classification

Likely useful validation scripts:

- `scripts/test-remix-youtube-short.mjs`
- `scripts/run-remix-full-test.mjs`
- `scripts/test-remix-asset-rotation.mjs`
- `scripts/test-remix-materialization-guard.mjs`
- `scripts/test-remix-visual-timeline-guard.mjs`
- `scripts/test-narration-retention-engine.mjs`
- `scripts/test-narration-retention-integration.mjs`
- `scripts/test-narration-retention-premium-reel.mjs`
- `scripts/test-comics-*.mjs`
- `scripts/test-panel-*.mjs`
- `scripts/test-variation-b-*.mjs`
- `scripts/validate-variation-b-beat-assignments.mjs`

Likely manual/probe scripts to review before committing:

- `scripts/probe-soquadrinhoss-lancamentos.mjs`
- `scripts/probe-sq-apresenta-feed.mjs`
- `scripts/render-remix-variation.mjs`
- `scripts/render-variation-b-focused.mjs`
- `scripts/render-variation-b-release.mjs`
- `scripts/render-variation-b-user-assets.mjs`
- `scripts/reimport-diverse-panels.mjs`
- `scripts/record-comics-selection-feedback.mjs`
- `scripts/report-comics-selection-feedback.mjs`

## Local Data And Tool Artifacts

These should not be versioned as product source:

- `mcps/`
- `storage/editorial/*`
- generated MP4/WAV/PNG files
- imported user assets
- local feedback JSON unless explicitly promoted to a fixture

## Recommended Commit Strategy

1. Commit code modules and package changes separately from probe scripts.
2. Commit official test/smoke scripts only after confirming they do not require private/local media.
3. Keep `storage/editorial/*` ignored unless a tiny sanitized fixture is intentionally added.
4. Run at least:
   - `npm run typecheck --workspace @reelforge/media-beast`
   - `npm run build --workspace @reelforge/media-beast`
   - a selected remix/comics smoke that does not depend on private assets.

## Caution

The remix pipeline now has many specialized paths for comics and Variation B. This is powerful, but the next stabilization pass should focus on reducing hidden coupling between discovery, asset validation, materialization, and render scripts.