# Build Warning Analysis

- Date: `2026-06-29`
- Recovery target: `C:\Users\Pichau\Documents\New project\reelforge-studio-recovered`

## Log file

- Captured build log: `recovery/reports/build-warning-log.txt`

## Initial warning state

The recovered monorepo build originally passed, but emitted repeated warnings like:

- `SyntaxError: Expected double-quoted property name in JSON at position 20000 (line 659 column 6)`

The warning appeared during the root build while `next build` was running for `@reelforge/web`.

## Diagnostic method

All workspace `.json` and `.tsbuildinfo` files were checked with strict `JSON.parse` outside ignored artifact directories.

Two invalid JSON files were found:

1. `package-lock.json`
2. `apps/api/tsconfig.dev.json`

## Root causes found

### 1. `package-lock.json`

- The file contained a truncation artifact around line `659`, including text equivalent to a token-truncation marker.
- That invalid JSON matches the warning location printed during build.
- This was the direct cause of the repeated JSON parse warning.

### 2. `apps/api/tsconfig.dev.json`

- The file contained a recovery artifact with a concatenated second JSON document after a `---SPLIT---` marker.
- This did not appear to be the build warning source, but it was still invalid and needed repair.

## Fixes applied

### `apps/api/tsconfig.dev.json`

- Removed the appended split marker and the second JSON payload.
- The file now contains only the intended API dev tsconfig object.

### `package-lock.json`

- Preserved the corrupted file as evidence in:
  - `recovery/backups/build-warning/package-lock.json.bak`
- Regenerated the lockfile safely offline with:
  - `npm install --package-lock-only --ignore-scripts --offline`

## Follow-up build behavior

After regenerating `package-lock.json`, the first build still reported:

- `Found lockfile missing swc dependencies, patching...`
- `Lockfile was successfully patched, please run "npm install" to ensure @next/swc dependencies are downloaded`

That warning came from Next.js patching the lockfile metadata, not from broken recovery JSON.

After rerunning the build one more time, those SWC patch warnings disappeared.

## Final remaining warning

The final captured build log now only contains:

- `TypeScript project references are not fully supported. Attempting to build in incremental mode.`

## Final classification

### JSON parse warning

- Source: **project file corruption**
- Files involved:
  - `package-lock.json`
  - `apps/api/tsconfig.dev.json`
- Status: **fixed**

### Remaining TypeScript project-reference warning

- Source: **Next.js / tooling limitation**
- Category: **non-fatal tooling warning**
- Status: **documented, no code fix required**

## Conclusion

The residual JSON parse warning is resolved. The build is now clean with respect to malformed project JSON, and only a known non-blocking Next.js warning remains.
