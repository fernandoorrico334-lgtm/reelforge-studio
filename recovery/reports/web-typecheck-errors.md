# Web Typecheck Recovery

- Date: `2026-06-29`
- Workspace: `C:\Users\Pichau\Documents\New project\reelforge-studio-recovered`
- Scope: `apps/web` contract layer only

## Initial error clusters

1. `apps/web/src/lib/studio-types.ts`
   - missing response contracts:
     - `ProjectMissingAssetCollectionsResponse`
     - `ResearchDossierCollectionsCreateResponse`
     - `ResearchRequirementCollectionCreateResponse`
   - shared contracts were too rigid for the recovered Stage 10.x UI:
     - `StudioAsset`
     - `ProjectPayload`
     - `ProjectScene`
     - `ScenePayload`
     - `StudioProject`
     - `ResearchAssetRequirement`
     - `RenderBlueprintScene`

2. `apps/web/src/lib/studio-api.ts`
   - imported types that did not exist yet in `studio-types.ts`
   - depended on richer blueprint/caption/story contracts than the restored file exported

3. Web pages/components
   - `src/app/channels/page.tsx`
     - invalid template predicate
     - missing `initialAssets` prop for `ChannelsManager`
   - `src/components/prompt-lab-studio.tsx`
     - wrong `getTemplates` import
     - prompt pack ids too wide for prompt-engine input contracts
     - `exactOptionalPropertyTypes` failures from `undefined`
   - `src/components/research-dossier-studio.tsx`
     - wrong `getCinematicPresetById` import
   - `src/components/render-blueprint-panel.tsx`
     - expected richer effective-asset fields than the recovered blueprint type exposed

4. Blueprint normalization
   - `src/lib/project-video-blueprint.ts`
     - cast from package `RenderBlueprint` to web `RenderBlueprintResponse` was too weak
     - nullable/optional scene audio fields leaked `undefined`

## Corrections applied

1. `apps/web/src/lib/studio-types.ts`
   - restored missing response types for media-collection creation flows
   - added compatibility aliases for prompt/comfy/visual contracts
   - relaxed recovered contracts with optional/null fields where Stage 10.x UI already uses partial objects
   - expanded `RenderBlueprintScene` to accept both older package output and richer recovered UI expectations

2. `apps/web/src/app/channels/page.tsx`
   - now loads channel and asset snapshots together
   - passes `initialAssets` to `ChannelsManager`
   - replaced the broken template predicate with a safe `flatMap` set build

3. `apps/web/src/components/prompt-lab-studio.tsx`
   - moved `getTemplates` import to `@reelforge/templates`
   - narrowed prompt pack ids to prompt-engine id unions
   - normalized optional values to `null` before calling `buildVisualPrompt`

4. `apps/web/src/components/research-dossier-studio.tsx`
   - moved `getCinematicPresetById` import to `@reelforge/cinematic-engine`

5. `apps/web/src/components/render-blueprint-panel.tsx`
   - broadened effective-source label handling
   - added safe fallbacks for `renderReadyVisual` and `effectiveAssetReason`

6. `apps/web/src/lib/project-video-blueprint.ts`
   - normalized nullable project/scene audio fields before package calls
   - replaced the fragile render-blueprint cast with a local normalization step for recovered Web expectations

7. `apps/web/tsconfig.json`
   - already aligned earlier in recovery to use package `src` instead of stale `dist` declarations

## Current Web status

- `npm run typecheck --workspace @reelforge/web`: passed
- `npm run build --workspace @reelforge/web`: passed

## Residual build note

- `next build` finished successfully, but emitted a residual warning:
  - `SyntaxError: Expected double-quoted property name in JSON at position 20000 (line 659 column 6)`
- This did not fail the Web build.
- Because the Web typecheck and build both passed, this warning is most likely coming from another recovered artifact inspected during the broader toolchain, not from the core Web contract layer itself.

## Remaining errors after Web recovery

- None inside `apps/web` typecheck.
- `npm run typecheck` still fails outside the Web scope in:
  - `apps/worker`
  - `packages/story-engine`
  - `packages/templates`
  - `packages/video-engine`
- The remaining failures are package/project-reference recovery issues, mainly:
  - `dist/*.d.ts` expected but not rebuilt from source
  - source imports crossing package `rootDir`
  - one `unknown` error narrowing issue in `apps/worker/src/services/render-worker.ts`

## Recommended next step

Continue with package/worker recovery, not frontend reconstruction:

1. align package `tsconfig`/workspace typing strategy away from stale `dist` assumptions
2. repair `story-engine`, `templates`, `video-engine`, and `worker` project references
3. rerun `npm run typecheck` for the monorepo after package-level stabilization
