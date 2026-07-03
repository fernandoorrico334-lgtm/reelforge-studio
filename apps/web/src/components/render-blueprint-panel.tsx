import type {
  AudioMasteringPreview,
  DataSource,
  RenderBlueprintResponse
} from "../lib/studio-types";

interface RenderBlueprintPanelProps {
  blueprint: RenderBlueprintResponse | null;
  source: DataSource | null;
  loading: boolean;
  onLoad: () => void;
  audioMasteringPreview?: AudioMasteringPreview | null;
}

function renderSourceLabel(source: DataSource | null) {
  if (!source) {
    return "Ainda nao carregado";
  }

  return source === "api" ? "API local" : "Fallback local";
}

function renderEffectiveAssetSourceLabel(
  source:
    | "library"
    | "generated"
    | "none"
    | "asset"
    | "fallback_generated"
    | "placeholder"
    | "project_asset"
    | "generated_asset"
    | "missing"
) {
  switch (source) {
    case "generated":
    case "generated_asset":
      return "generated";
    case "fallback_generated":
      return "fallback";
    case "library":
    case "asset":
    case "project_asset":
      return "base";
    default:
      return "missing";
  }
}

function renderNarrationSourceLabel(source: "generated" | "manual" | "missing") {
  switch (source) {
    case "generated":
      return "generated";
    case "manual":
      return "manual";
    default:
      return "missing";
  }
}

function formatDuration(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "n/a";
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}s`;
}

export function RenderBlueprintPanel({
  blueprint,
  source,
  loading,
  onLoad,
  audioMasteringPreview = null
}: RenderBlueprintPanelProps) {
  const narrationReadyCount =
    blueprint?.scenes.filter((scene) => scene.narrationReady).length ?? 0;
  const generatedNarrationCount =
    blueprint?.scenes.filter(
      (scene) =>
        (scene.effectiveNarrationSource ?? scene.narrationSource) === "generated"
    ).length ?? 0;
  const manualNarrationCount =
    blueprint?.scenes.filter(
      (scene) =>
        (scene.effectiveNarrationSource ?? scene.narrationSource) === "manual"
    ).length ?? 0;
  const missingNarrationCount = blueprint
    ? Math.max(blueprint.sceneCount - narrationReadyCount, 0)
    : 0;

  return (
    <article className="rounded-[1.9rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,158,102,0.12),transparent_32%),rgba(255,255,255,0.04)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Render Blueprint
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            JSON pronto para a futura renderizacao
          </h2>
          <p className="mt-3 text-sm leading-7 text-mist/68">
            Combina projeto, template, preset, legenda, story role e output
            vertical sem acionar FFmpeg ainda.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.24em] text-mist/65">
            {renderSourceLabel(source)}
          </span>
          <button
            type="button"
            onClick={onLoad}
            className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
          >
            {loading ? "Carregando..." : "Carregar blueprint"}
          </button>
        </div>
      </div>

      {blueprint ? (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Duracao total
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {blueprint.summary.durationTotal}s
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Cenas prontas
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {blueprint.summary.readyScenes}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Com problemas
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {blueprint.summary.scenesWithProblems}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Narracao pronta
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {narrationReadyCount}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Editorial microclips
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {blueprint.microclipCount}
              </p>
              <p className="mt-2 text-xs text-mist/55">
                total {formatDuration(blueprint.totalMicroclipDurationSeconds)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-4">
            <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Template
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {blueprint.template.template.name}
              </p>
              <p className="mt-2 text-sm leading-7 text-mist/68">
                {blueprint.template.template.description}
              </p>
              <p className="mt-3 text-sm text-white">
                legenda padrao {blueprint.defaultCaptionStyle.name}
              </p>
            </div>

            <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Output
              </p>
              <p className="mt-2 text-sm text-white">
                {blueprint.resolution.width}x{blueprint.resolution.height} -{" "}
                {blueprint.fps} fps - {blueprint.format}
              </p>
              <p className="mt-2 text-sm text-mist/68">
                source format {blueprint.sourceFormat}
              </p>
              <p className="mt-3 text-sm text-mist/68">
                subtitle preview pronto em SRT e ASS para a etapa de render.
              </p>
            </div>

            <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Editing style
              </p>
              <p className="mt-2 text-sm text-white">
                {blueprint.editingReferencePresetName ?? "Sem preset editorial aplicado"}
              </p>
              <p className="mt-2 text-xs text-mist/55">
                presetId {blueprint.editingReferencePresetId ?? "n/a"} / pace{" "}
                {formatDuration(blueprint.editingStyleSummary?.cutPace)}
              </p>
              <p className="mt-2 text-xs text-mist/55">
                transition {blueprint.editingStyleSummary?.transitionStyle ?? "n/a"} / caption{" "}
                {blueprint.editingStyleSummary?.captionStyle ?? "n/a"}
              </p>
              <p className="mt-2 text-xs text-mist/55">
                music {blueprint.editingStyleSummary?.musicStyle ?? "n/a"} / microclip{" "}
                {blueprint.editingStyleSummary?.microclipPlacement ?? "n/a"}
              </p>
            </div>

            <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Audio plan
              </p>
              <p className="mt-2 text-sm text-white">
                {blueprint.audio.summary}
              </p>
              <p className="mt-3 text-sm text-mist/68">
                Este render usara narracao gerada em {generatedNarrationCount} cena(s),
                fallback manual em {manualNarrationCount} e {missingNarrationCount} sem
                narracao.
              </p>
              <p className="mt-3 text-xs text-mist/55">
                scene narrations {blueprint.audio.sceneNarrations.length} / scene sfx{" "}
                {blueprint.audio.sceneSfx.length} / music{" "}
                {blueprint.audio.backgroundMusic ? "on" : "off"} / voiceover{" "}
                {blueprint.audio.voiceover ? "on" : "off"}
              </p>
              <p className="mt-2 text-xs text-mist/55">
                selectedMusicAssetId {blueprint.selectedMusicAssetId ?? "n/a"} / preset{" "}
                {blueprint.musicPresetId ?? "n/a"} / license{" "}
                {blueprint.musicLicenseStatus ?? "n/a"}
              </p>
              <p className="mt-2 text-xs text-mist/55">
                beat sync {blueprint.beatSyncPlan?.confidence?.toFixed(2) ?? "0.00"} / cut
                times {blueprint.beatSyncPlan?.suggestedCutTimes.length ?? 0} / cues{" "}
                {blueprint.sfxCueCount}
              </p>
              <p className="mt-2 text-xs text-mist/55">
                editorial microclips {blueprint.microclipCount} / hasEditorialMicroclips{" "}
                {blueprint.hasEditorialMicroclips ? "yes" : "no"}
              </p>
              {audioMasteringPreview ? (
                <div className="mt-4 rounded-[1.05rem] border border-white/10 bg-white/[0.03] p-3 text-sm text-mist/68">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Audio Quality Report
                  </p>
                  <p className="mt-2 text-white">
                    {audioMasteringPreview.masteringPresetName} - target{" "}
                    {audioMasteringPreview.targetLufs} LUFS - ducking{" "}
                    {audioMasteringPreview.duckingMode}
                  </p>
                  <p className="mt-2 text-xs text-mist/60">
                    loudnorm {audioMasteringPreview.loudnormApplied ? "on" : "off"} / limiter{" "}
                    {audioMasteringPreview.limiterApplied ? "on" : "off"} / narration{" "}
                    {audioMasteringPreview.narrationIncluded ? "on" : "off"} / codec previsto aac
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {(blueprint.musicWarnings?.length ?? 0) > 0 ? (
            <div className="mt-4 rounded-[1.2rem] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              {blueprint.musicWarnings?.join(" ")}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 xl:grid-cols-2">
            {blueprint.scenes.slice(0, 4).map((scene) => (
              <div
                key={scene.sceneId}
                className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    Cena {scene.order} - {scene.title}
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-mist/68">
                    {scene.visualSourceMode ?? "asset_only"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-white">
                  Visual efetivo: {scene.effectiveAsset?.filename ?? "sem visual"}
                </p>
                <p className="mt-2 text-xs text-mist/60">
                  origem {renderEffectiveAssetSourceLabel(scene.effectiveAssetSource)} -{" "}
                  {(scene.renderReadyVisual ?? Boolean(scene.effectiveAsset))
                    ? "render-ready"
                    : "precisa raster"}
                </p>
                <p className="mt-2 text-xs text-mist/55">
                  effectiveAssetId {scene.effectiveAssetId ?? "n/a"}
                </p>
                <p className="mt-2 text-xs text-mist/55">
                  effectiveAssetPath {scene.effectiveAssetPath ?? "n/a"}
                </p>
                <p className="mt-3 text-sm text-white">
                  Narracao efetiva:{" "}
                  {scene.effectiveNarrationAsset?.filename ?? "sem narracao"}
                </p>
                <p className="mt-2 text-xs text-mist/60">
                  narration{" "}
                  {renderNarrationSourceLabel(
                    scene.effectiveNarrationSource ?? scene.narrationSource
                  )}{" "}
                  /{" "}
                  {scene.narrationProvider ?? "provider n/a"} /{" "}
                  {scene.narrationVoicePackId ?? "voice pack n/a"}
                </p>
                <p className="mt-2 text-xs text-mist/55">
                  {scene.narrationReady ? "narration-ready" : "narration-missing"} /{" "}
                  duration {formatDuration(scene.narrationDurationSeconds)}
                </p>
                <p className="mt-2 text-xs text-mist/55">
                  effectiveNarrationAssetId {scene.effectiveNarrationAssetId ?? "n/a"}
                </p>
                <p className="mt-2 text-xs text-mist/55">
                  effectiveNarrationAssetPath {scene.effectiveNarrationAssetPath ?? "n/a"}
                </p>
                <p className="mt-2 text-xs text-mist/55">
                  scene narration track{" "}
                  {blueprint.audio.sceneNarrations.some(
                    (entry) => entry.sceneId === scene.sceneId
                  )
                    ? "yes"
                    : "no"}
                </p>
                <p className="mt-2 text-xs text-mist/55">
                  {scene.effectiveAssetReason ??
                    "Motivo do asset efetivo indisponivel nesta fonte."}
                </p>
                <p className="mt-2 text-xs text-mist/55">
                  editorial shot {formatDuration(scene.suggestedShotDurationSeconds)} / placement{" "}
                  {scene.suggestedMicroclipPlacement ?? "n/a"} / intensity{" "}
                  {scene.suggestedIntensity ?? "n/a"}
                </p>
                <p className="mt-2 text-xs text-mist/55">
                  resolucao {scene.effectiveAsset?.width ?? "?"}x
                  {scene.effectiveAsset?.height ?? "?"}
                </p>
                {scene.editorialMicroclips.length > 0 ? (
                  <div className="mt-4 rounded-[1.05rem] border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                      Editorial Microclips
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {scene.editorialMicroclips.length} insert(s) / total{" "}
                      {formatDuration(
                        scene.editorialMicroclips.reduce(
                          (total, microclip) =>
                            total + microclip.durationSeconds,
                          0
                        )
                      )}
                    </p>
                    <div className="mt-3 space-y-2">
                      {scene.editorialMicroclips.map((microclip) => (
                        <div
                          key={microclip.microclipId}
                          className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-mist/68"
                        >
                          <p className="text-white">
                            {microclip.label} - {microclip.usageMode}
                          </p>
                          <p className="mt-1">
                            clip {formatDuration(microclip.startTimeSeconds)} →{" "}
                            {formatDuration(microclip.endTimeSeconds)} / insert{" "}
                            {formatDuration(microclip.insertStartSeconds)} →{" "}
                            {formatDuration(microclip.insertEndSeconds)}
                          </p>
                          <p className="mt-1">
                            volume {microclip.volumeMode} / transitions{" "}
                            {microclip.transitionIn} → {microclip.transitionOut}
                          </p>
                          <p className="mt-1">
                            assetPath {microclip.assetPath ?? "n/a"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <details className="mt-6 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-white">
              Abrir JSON do blueprint
            </summary>
            <pre className="mt-4 max-h-[480px] overflow-auto rounded-[1rem] border border-white/10 bg-[#05070b] p-4 text-xs leading-6 text-mist/75">
              {JSON.stringify(blueprint, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <div className="mt-6 rounded-[1.3rem] border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-mist/68">
          Carregue o blueprint para ver o resumo tecnico e o JSON pronto para
          a futura renderizacao local.
        </div>
      )}
    </article>
  );
}

