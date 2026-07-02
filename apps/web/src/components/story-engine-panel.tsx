import type { ProjectStoryAnalysisResponse } from "../lib/studio-types";

interface StoryEnginePanelProps {
  analysis: ProjectStoryAnalysisResponse;
}

function formatDuration(value: number) {
  if (!value || value <= 0) {
    return "n/d";
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}s`;
}

function formatRoleLabel(value: string) {
  return value.toUpperCase();
}

function renderStateLabel(value: boolean) {
  return value ? "Detectado" : "Ausente";
}

function normalizeNarrativeNotice(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase();
}

export function StoryEnginePanel({ analysis }: StoryEnginePanelProps) {
  const combinedNotices = [
    ...analysis.analysis.alerts,
    ...analysis.analysis.pacingWarnings
  ].filter((notice) => {
    const normalized = normalizeNarrativeNotice(notice);

    if (analysis.analysis.climaxDetected && normalized.includes("nenhum cl")) {
      return false;
    }

    if (analysis.analysis.ctaDetected && normalized.includes("nenhum cta")) {
      return false;
    }

    return true;
  });

  return (
    <article className="rounded-[1.9rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,255,225,0.08),transparent_30%),rgba(255,255,255,0.04)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Story Engine
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Analise narrativa local
          </h2>
          <p className="mt-3 text-sm leading-7 text-mist/68">
            Leitura deterministica da timeline para ritmo, hook, climax, CTA e
            distribuicao de papeis entre as cenas.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.24em] text-mist/65">
          {analysis.analysis.analysisMode}
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
            Duracao total
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatDuration(analysis.analysis.totalDuration)}
          </p>
        </div>
        <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
            Forca da abertura
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {analysis.analysis.openingStrength}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-mist/55">
            {analysis.analysis.openingStrengthLabel}
          </p>
        </div>
        <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
            Ritmo
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {analysis.analysis.rhythmLabel}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-mist/55">
            media {formatDuration(analysis.analysis.averageSceneDuration)}
          </p>
        </div>
        <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
            Estrutura
          </p>
          <p className="mt-2 text-sm font-medium text-white">
            Climax: {renderStateLabel(analysis.analysis.climaxDetected)}
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            CTA: {renderStateLabel(analysis.analysis.ctaDetected)}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {combinedNotices.length > 0 ? (
          combinedNotices.map((notice) => (
            <div
              key={notice}
              className="rounded-[1.2rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
            >
              {notice}
            </div>
          ))
        ) : (
          <div className="rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            O arco atual ja apresenta sinais saudaveis de progressao narrativa.
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {analysis.sceneInsights.map((scene) => (
          <div
            key={scene.sceneId}
            className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-signal">
                    Cena {scene.order}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-mist/70">
                    {formatRoleLabel(scene.role)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-mist/70">
                    energia {scene.energyScore}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-white">
                  {scene.title}
                </h3>
              </div>
              <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Preset efetivo
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {scene.effectivePreset.name}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-mist/68">{scene.reason}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
