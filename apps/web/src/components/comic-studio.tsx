"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  runComicStudioCreateProjectsRequest,
  runComicStudioPlanRequest
} from "../lib/studio-api";
import type {
  ComicStudioCreateProjectsResponse,
  ComicStudioFactoryPlanResponse,
  ComicStudioShortPlan,
  StudioChannel
} from "../lib/studio-types";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatPages(pages: number[]) {
  return pages.length ? pages.join(", ") : "?";
}

function statusColor(status: string) {
  if (status === "ready") return "text-emerald-300";
  if (status === "blocked") return "text-rose-300";
  return "text-amber-200";
}

function ShortCard({ short, selected, onToggle }: {
  short: ComicStudioShortPlan;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left rounded-[1.5rem] border p-5 transition ${
        selected
          ? "border-signal/60 bg-signal/10 shadow-[0_20px_60px_rgba(99,255,225,0.08)]"
          : "border-white/10 bg-white/[0.035] hover:border-white/20"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-mist/45">
            #{short.productionRank} ? {short.category} ? score {short.score}
          </p>
          <h3 className="mt-3 text-lg font-semibold text-white">{short.title}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs ${selected ? "bg-signal text-black" : "bg-white/10 text-mist/65"}`}>
          {selected ? "Aprovado" : "Selecionar"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-mist/65 md:grid-cols-3">
        <span>{short.scenes.length} cenas</span>
        <span>{short.estimatedDurationSeconds}s estimados</span>
        <span>pags. {formatPages(short.sourcePages)}</span>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-mist/72">
        {short.narrationScript}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-mist/60">
          caption {short.captionStyleId}
        </span>
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-mist/60">
          visual {short.cinematicPresetId}
        </span>
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-mist/60">
          audio {short.audioMasteringPresetId}
        </span>
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-mist/60">
          paineis {formatPercent(short.qualityReport.panelCoverage)}
        </span>
      </div>
    </button>
  );
}

function PlanSummary({ plan }: { plan: ComicStudioFactoryPlanResponse }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/25 p-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Shorts</p>
          <p className="mt-3 text-3xl font-semibold text-white">{plan.selectedCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Potencial</p>
          <p className="mt-3 text-3xl font-semibold text-white">{plan.productionOverview.estimatedShortsAvailable}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Readiness</p>
          <p className="mt-3 text-3xl font-semibold text-white">{plan.productionOverview.readinessScore}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Melhores pags.</p>
          <p className="mt-3 text-lg font-semibold text-white">{formatPages(plan.productionOverview.bestPages.slice(0, 6))}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Personagens fortes</p>
          <p className="mt-2 text-sm text-mist/70">{plan.productionOverview.strongestCharacters.join(", ") || "Ainda sem leitura forte"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Temas fortes</p>
          <p className="mt-2 text-sm text-mist/70">{plan.productionOverview.strongestThemes.join(", ") || "Ainda sem leitura forte"}</p>
        </div>
      </div>
    </section>
  );
}

function CreatedProjects({ result }: { result: ComicStudioCreateProjectsResponse | null }) {
  if (!result) return null;

  return (
    <section className="rounded-[2rem] border border-emerald-300/20 bg-emerald-300/[0.05] p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Projetos criados</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">
        {result.createdCount} projetos prontos para revisar no Studio
      </h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {result.createdProjects.map((project) => (
          <div key={project.projectId} className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-semibold text-white">{project.title}</p>
            <p className="mt-2 text-xs text-mist/55">
              {project.scenesCreated} cenas ? {project.panelAssetManifest.length} paineis pendentes ? render bloqueado ate aprovacao
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/projects/${project.projectId}`}
                className="rounded-full bg-signal px-4 py-2 text-xs font-semibold text-black"
              >
                Abrir projeto
              </Link>
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-mist/65">
                {project.renderBlueprintHints.cinematicPresetId} / {project.renderBlueprintHints.musicPresetId}
              </span>
            </div>
            <ul className="mt-4 space-y-1 text-xs text-mist/60">
              {project.qualityChecklist.slice(0, 3).map((item) => (
                <li key={item.id} className={statusColor(item.status)}>
                  {item.label}: {item.status.replace("_", " ")}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm text-mist/65">{result.riskPolicyGate.note}</p>
    </section>
  );
}

export function ComicStudio({ channels }: { channels: StudioChannel[] }) {
  const [assetDirectory, setAssetDirectory] = useState("storage/assets/comics/justice-league-vs-godzilla-vs-kong/issue-01");
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [targetCount, setTargetCount] = useState(10);
  const [maxProjects, setMaxProjects] = useState(3);
  const [minScore, setMinScore] = useState(65);
  const [selectedShortIds, setSelectedShortIds] = useState<string[]>([]);
  const [plan, setPlan] = useState<ComicStudioFactoryPlanResponse | null>(null);
  const [created, setCreated] = useState<ComicStudioCreateProjectsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCount = selectedShortIds.length;
  const effectiveMaxProjects = useMemo(() => {
    if (selectedCount > 0) return Math.min(selectedCount, maxProjects);
    return maxProjects;
  }, [maxProjects, selectedCount]);

  function toggleShort(shortId: string) {
    setSelectedShortIds((current) =>
      current.includes(shortId)
        ? current.filter((id) => id !== shortId)
        : [...current, shortId]
    );
  }

  function runPlan() {
    setError(null);
    setCreated(null);
    startTransition(async () => {
      try {
        const next = await runComicStudioPlanRequest({
          assetDirectory,
          targetCount,
          minScore
        });
        setPlan(next);
        setSelectedShortIds(next.shorts.slice(0, Math.min(maxProjects, next.shorts.length)).map((short) => short.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function createProjects() {
    if (!channelId) {
      setError("Crie ou selecione um canal antes de criar projetos.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const response = await runComicStudioCreateProjectsRequest({
          assetDirectory,
          channelId,
          targetCount,
          maxProjects: effectiveMaxProjects,
          minScore,
          titlePrefix: "Comic Studio"
        });
        setCreated(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,207,112,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,255,225,0.14),transparent_28%),rgba(255,255,255,0.04)] p-6 shadow-studio md:p-8">
        <p className="text-sm uppercase tracking-[0.34em] text-mist/55">Comic Studio</p>
        <div className="mt-4 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Transforme uma HQ local em uma lista de shorts prontos para revisar.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-mist/72">
              Aponte para uma pasta ja indexada, gere a leitura narrativa, aprove os melhores cortes e crie projetos reais no ReelForge. O sistema nao renderiza nem importa paineis sem revisao.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-mist/45">Fluxo seguro</p>
            <ol className="mt-4 space-y-3 text-sm text-mist/70">
              <li>1. HQ local autorizada e indexada.</li>
              <li>2. Mineracao de historias, lutas e revelacoes.</li>
              <li>3. Criacao de projetos editaveis.</li>
              <li>4. Importacao/render somente apos aprovacao.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.4fr_0.4fr_0.4fr]">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Pasta da HQ indexada</span>
            <input
              value={assetDirectory}
              onChange={(event) => setAssetDirectory(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-signal/70"
              placeholder="storage/assets/comics/minha-hq/issue-01"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Canal</span>
            <select
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-signal/70"
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Shorts</span>
            <input type="number" min={1} max={20} value={targetCount} onChange={(e) => setTargetCount(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-signal/70" />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Projetos</span>
            <input type="number" min={1} max={20} value={maxProjects} onChange={(e) => setMaxProjects(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-signal/70" />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Score</span>
            <input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-signal/70" />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={runPlan} disabled={isPending || !assetDirectory} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">
            {isPending ? "Lendo HQ..." : "Gerar shorts da HQ"}
          </button>
          <button onClick={createProjects} disabled={isPending || !plan || !channelId} className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">
            Criar projetos aprovados ({effectiveMaxProjects})
          </button>
        </div>
        {error ? <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</p> : null}
      </section>

      {plan ? <PlanSummary plan={plan} /> : null}

      {plan ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-mist/45">Shorts sugeridos</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Selecione os cortes que quer transformar em projetos</h2>
            </div>
            <p className="text-sm text-mist/60">{selectedCount} selecionados</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {plan.shorts.map((short) => (
              <ShortCard key={short.id} short={short} selected={selectedShortIds.includes(short.id)} onToggle={() => toggleShort(short.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <CreatedProjects result={created} />
    </div>
  );
}
