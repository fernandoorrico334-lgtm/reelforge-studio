import type {
  DataSource,
  ProjectCaptionAnalysisResponse
} from "../lib/studio-types";

interface CaptionEnginePanelProps {
  analysis: ProjectCaptionAnalysisResponse;
  source: DataSource;
}

function renderSourceLabel(source: DataSource) {
  return source === "api" ? "API local" : "Fallback local";
}

export function CaptionEnginePanel({
  analysis,
  source
}: CaptionEnginePanelProps) {
  return (
    <article className="rounded-[1.9rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,230,120,0.08),transparent_34%),rgba(255,255,255,0.04)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Caption Engine
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Leitura e impacto das legendas
          </h2>
          <p className="mt-3 text-sm leading-7 text-mist/68">
            Analise deterministica de velocidade de leitura, quebras de linha e
            punch visual por cena.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.24em] text-mist/65">
          {renderSourceLabel(source)}
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
            Cenas com legenda
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {analysis.summary.scenesWithCaptions}
          </p>
        </div>
        <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
            Sem legenda
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {analysis.summary.scenesWithoutCaptions}
          </p>
        </div>
        <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
            Muito rapidas
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {analysis.summary.tooFastScenes}
          </p>
        </div>
        <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
            Impacto medio
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {analysis.summary.averageImpactScore}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {analysis.summary.alerts.length > 0 ? (
          analysis.summary.alerts.map((alert) => (
            <div
              key={alert}
              className="rounded-[1.2rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
            >
              {alert}
            </div>
          ))
        ) : (
          <div className="rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            Nenhum gargalo relevante de legenda foi detectado nesta leitura.
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {analysis.scenes.map((scene) => (
          <article
            key={scene.sceneId}
            className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-signal">
                    Cena {scene.order}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-mist/70">
                    {scene.resolvedStyle.style.name}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-mist/70">
                    impacto {scene.quality.impactScore}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  {scene.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-mist/68">
                  {scene.captionText ?? "Legenda ainda nao definida."}
                </p>
              </div>

              <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Velocidade
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {scene.quality.readingSpeedStatus} -{" "}
                  {scene.quality.estimatedCharactersPerSecond} cps
                </p>
                <p className="mt-1 text-xs text-mist/55">
                  template {scene.suggestedByTemplate.id} - emocao{" "}
                  {scene.suggestedByEmotion.id}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Quebra de linhas
                </p>
                <div className="mt-2 space-y-2 text-sm text-white">
                  {scene.splitLines.length > 0 ? (
                    scene.splitLines.map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    ))
                  ) : (
                    <p className="text-mist/55">Sem texto para dividir.</p>
                  )}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Alertas
                </p>
                <div className="mt-2 space-y-2 text-sm text-mist/68">
                  {[...scene.quality.lineWarnings, ...scene.quality.durationWarnings]
                    .length > 0 ? (
                    [...scene.quality.lineWarnings, ...scene.quality.durationWarnings].map(
                      (warning) => <p key={warning}>{warning}</p>
                    )
                  ) : (
                    <p className="text-emerald-200">Nenhum alerta especifico.</p>
                  )}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Sugestoes
                </p>
                <div className="mt-2 space-y-2 text-sm text-mist/68">
                  {scene.quality.suggestions.length > 0 ? (
                    scene.quality.suggestions.map((suggestion) => (
                      <p key={suggestion}>{suggestion}</p>
                    ))
                  ) : (
                    <p className="text-emerald-200">
                      Legenda ja esta bem calibrada.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}