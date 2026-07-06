# One-Click Runtime Audit

## Current status

The One-Click Production flow already connects Reels Factory projects, local
narration, generated visuals, music selection, beat sync, render blueprint and
RenderJob creation. The API exposes:

- `GET /reel-production/projects/:projectId/checklist`
- `POST /reel-production/projects/:projectId/run`
- `GET /reel-production/projects/:projectId/runs`
- `GET /reel-production/runs/:id`
- `POST /reel-production/runs/:id/cancel`

`ReelProductionRun` persists mode, status, steps, optional `renderJobId`,
optional `outputPath`, timestamps and metadata.

## What works

- `dry_run` analyzes the project without creating narration, visuals or render
  jobs.
- `prepare_only` generates missing mock/local narration and visuals, selects
  music when a compatible local asset exists, builds beat sync and validates the
  render blueprint.
- `render` creates a queued `RenderJob`.
- The Project Studio panel can run dry run, prepare assets and produce reel.
- The worker can process queued RenderJobs when started separately.
- Candidate-first media is not imported automatically.

## Hardening added

- Standard step IDs now match runtime expectations:
  `validate_project`, `generate_narration`, `generate_visuals`, `select_music`,
  `build_beat_sync`, `validate_microclips`, `build_blueprint`,
  `create_render_job`, `process_render_job`, `finalize_output`.
- Checklist now reports missing narration, visuals, music, pending candidates
  and unconfirmed candidates.
- One-Click adds warning and `review_media_candidates` next action when
  candidate-first media is still pending or unconfirmed.
- `runWorkerOnce=true` can run the worker once from the API runtime. If FFmpeg
  or child process execution fails, the run returns `failed` or `partial` with a
  clear message instead of pretending success.
- The UI exposes a "processar worker agora" option and shows all run steps,
  render job id, output path and error message.

## RenderJob lifecycle

The RenderJob is created in `runOneClickReelProduction` through
`createRenderJobForProject`. In normal render mode without `runWorkerOnce`, it
stays queued and waits for `@reelforge/worker`.

With `runWorkerOnce=true`, the API starts:

```bash
npm run once --workspace @reelforge/worker
```

After the worker exits, the service reloads the RenderJob and records
`outputPath` when completed.

## Output path and UI

`outputPath` is written on `RenderJob` by the worker. One-Click copies it to the
`ReelProductionRun` response and stored run when inline processing completes.
The Project Studio panel shows the latest `renderJobId`, `outputPath`, status
and step messages.

## Current risks

- FFmpeg/child process may still be blocked inside sandboxed Codex sessions.
  Real render validation should be done in a normal Windows terminal.
- `runWorkerOnce=true` processes the next queued job; smokes ensure the queue is
  controlled, but production usage should avoid unrelated queued jobs.
- Candidate scoring and licensing remain advisory. Unknown or restricted media
  must still be reviewed manually before import/use.
- Music selection depends on local library metadata; missing music is a warning,
  not a fatal error.
