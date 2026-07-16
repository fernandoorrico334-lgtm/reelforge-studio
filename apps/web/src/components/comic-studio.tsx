"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  runComicStudioCreateProjectsRequest,
  runComicStudioCreateArcProjectsRequest,
  runComicStudioPlanRequest,
  getComicPanelPreviewUrl
} from "../lib/studio-api";
import type {
  ComicStudioCreateProjectsResponse,
  ComicStudioCreateArcProjectsResponse,
  ComicStudioFactoryPlanResponse,
  ComicStudioShortPlan,
  StudioChannel
} from "../lib/studio-types";

type PanelReviewStatus = "pending" | "approved" | "rejected";

type PanelReviewMap = Record<string, PanelReviewStatus>;

type PanelReplacementMap = Record<string, string>;

function panelReviewKey(arcId: string, panelId: string, index: number) {
  return `${arcId}:${panelId}:${index}`;
}

function getApprovedArcReview(
  plan: ComicStudioFactoryPlanResponse | null,
  panelReview: PanelReviewMap,
  panelReplacement: PanelReplacementMap
) {
  const approvedArcIds: string[] = [];
  const approvedPanelIdsByArcId: Record<string, string[]> = {};
  const selectedPanelReplacementsByArcId: Record<string, Record<string, string>> = {};
  const arcs = plan?.arcStudio?.recommendedShorts ?? [];

  for (const arc of arcs) {
    const previews = arc.panelPreviews ?? [];
    if (previews.length === 0) continue;
    const allApproved = previews.every((panel, index) => panelReview[panelReviewKey(arc.id, panel.panelId, index)] === "approved");
    if (!allApproved) continue;
    approvedArcIds.push(arc.id);
    approvedPanelIdsByArcId[arc.id] = previews.map((panel, index) => {
      const key = panelReviewKey(arc.id, panel.panelId, index);
      return panelReplacement[key] ?? panel.panelId;
    });
    const replacements: Record<string, string> = {};
    previews.forEach((panel, index) => {
      const key = panelReviewKey(arc.id, panel.panelId, index);
      const replacementPanelId = panelReplacement[key];
      if (replacementPanelId && replacementPanelId !== panel.panelId) {
        replacements[panel.panelId] = replacementPanelId;
      }
    });
    if (Object.keys(replacements).length > 0) {
      selectedPanelReplacementsByArcId[arc.id] = replacements;
    }
  }

  return { approvedArcIds, approvedPanelIdsByArcId, selectedPanelReplacementsByArcId };
}
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

function ArcStudioPanel({
  plan,
  onCreateArcProjects,
  disabled,
  panelReview,
  panelReplacement,
  onSetPanelReview,
  onSelectPanelReplacement,
  onApproveArc
}: {
  plan: ComicStudioFactoryPlanResponse;
  onCreateArcProjects: () => void;
  disabled: boolean;
  panelReview: PanelReviewMap;
  panelReplacement: PanelReplacementMap;
  onSetPanelReview: (key: string, status: PanelReviewStatus) => void;
  onSelectPanelReplacement: (key: string, replacementPanelId: string) => void;
  onApproveArc: (arcId: string) => void;
}) {
  const arcStudio = plan.arcStudio;
  if (!arcStudio || arcStudio.recommendedShorts.length === 0) return null;
  const scriptByArcId = new Map(arcStudio.recommendedScripts.map((script) => [script.arcId, script]));
  const review = getApprovedArcReview(plan, panelReview, panelReplacement);
  const approvedArcCount = review.approvedArcIds.length;

  return (
    <section className="space-y-5 rounded-[2rem] border border-signal/20 bg-[radial-gradient(circle_at_top_right,rgba(99,255,225,0.12),transparent_30%),rgba(255,255,255,0.035)] p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-signal/70">Arcos narrativos premium</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Historias que o sistema entendeu dentro da HQ</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-mist/65">
            Este fluxo usa o Story Arc Miner V2 + Script Doctor V2 para criar projetos com hook, contexto, tensao, climax e payoff. E o caminho mais indicado para shorts com historia de verdade.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateArcProjects}
          disabled={disabled || approvedArcCount === 0}
          className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-black shadow-[0_0_35px_rgba(99,255,225,0.18)] disabled:opacity-50"
        >
          Criar projetos premium por arco ({approvedArcCount})
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Arcos</p>
          <p className="mt-3 text-3xl font-semibold text-white">{arcStudio.totalArcs}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Prontos</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-200">{arcStudio.readyArcCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Score medio</p>
          <p className="mt-3 text-3xl font-semibold text-white">{arcStudio.averageScore}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Scripts</p>
          <p className="mt-3 text-3xl font-semibold text-white">{arcStudio.recommendedScripts.length}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {arcStudio.recommendedShorts.slice(0, 6).map((arc) => {
          const script = scriptByArcId.get(arc.id);
          const previews = arc.panelPreviews ?? [];
          const approvedPanelCount = previews.filter((panel, index) => panelReview[panelReviewKey(arc.id, panel.panelId, index)] === "approved").length;
          const rejectedPanelCount = previews.filter((panel, index) => panelReview[panelReviewKey(arc.id, panel.panelId, index)] === "rejected").length;
          const arcReviewReady = previews.length > 0 && approvedPanelCount === previews.length;
          return (
            <article key={arc.id} className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                    {arc.type.replace(/_/g, " ")} / score {arc.overallScore}
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-white">{arc.title}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${arc.readyForShort ? "bg-emerald-300 text-black" : "bg-amber-300/15 text-amber-100"}`}>
                  {arc.readyForShort ? "Pronto" : "Revisar"}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-mist/70">{arc.viewerPromise}</p>
              <p className="mt-3 text-sm leading-6 text-signal/80">Hook: {script?.hookLine ?? arc.retentionHook}</p>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-mist/68">
                {script?.fullNarration ?? arc.payoff}
              </p>

              <div className="mt-4 grid gap-3 text-xs text-mist/65 md:grid-cols-3">
                <span>{arc.recommendedDurationSeconds}s recomendados</span>
                <span>{arc.beats.length} beats narrativos</span>
                <span>pags. {formatPages(arc.pages)}</span>
              </div>

              {arc.panelPreviews?.length ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Contact sheet do arco</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-mist/45">{approvedPanelCount}/{arc.panelPreviews.length} aprovados</span>
                      <button
                        type="button"
                        onClick={() => onApproveArc(arc.id)}
                        className="rounded-full border border-signal/30 px-3 py-1 text-[11px] font-semibold text-signal hover:bg-signal/10"
                      >
                        Aprovar todos
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {arc.panelPreviews.map((panel, index) => {
                      const reviewKey = panelReviewKey(arc.id, panel.panelId, index);
                      const status = panelReview[reviewKey] ?? "pending";
                      const replacementPanelId = panelReplacement[reviewKey];
                      const selectedAlternative = panel.alternatives.find((alternative) => alternative.panelId === replacementPanelId);
                      const displayPanel = selectedAlternative ?? panel;
                      const hasReplacement = Boolean(selectedAlternative);
                      return (
                        <div
                          key={`${arc.id}-${panel.panelId}-${index}`}
                          className={`overflow-hidden rounded-2xl border bg-black/35 transition ${
                            status === "approved"
                              ? "border-emerald-300/55 shadow-[0_0_28px_rgba(110,231,183,0.12)]"
                              : status === "rejected"
                                ? "border-rose-300/45 opacity-65"
                                : "border-white/10"
                          }`}
                        >
                          <div className="aspect-[9/13] bg-gradient-to-br from-white/10 to-black/40">
                            {displayPanel.previewUrl ? (
                              <img
                                src={getComicPanelPreviewUrl(displayPanel.previewUrl)}
                                alt={`Painel ${displayPanel.panelId}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center px-3 text-center text-[11px] text-mist/45">
                                Preview indisponivel
                              </div>
                            )}
                          </div>
                          <div className="space-y-2 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">{panel.role ?? "beat"}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                                status === "approved"
                                  ? "bg-emerald-300 text-black"
                                  : status === "rejected"
                                    ? "bg-rose-300/20 text-rose-100"
                                    : "bg-white/10 text-mist/55"
                              }`}>
                                {status === "approved" ? "OK" : status === "rejected" ? "Fora" : "Pendente"}
                              </span>
                            </div>
                            <p className="text-[11px] text-mist/50">pag. {displayPanel.pageNumber ?? "?"} / {displayPanel.panelId} / score {displayPanel.score}</p>
                            {hasReplacement ? (
                              <p className="rounded-xl border border-signal/20 bg-signal/10 px-2 py-1 text-[10px] text-signal">
                                Substituido manualmente por painel melhor.
                              </p>
                            ) : null}
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => onSetPanelReview(reviewKey, "approved")}
                                className="rounded-full bg-emerald-300/90 px-2 py-1 text-[10px] font-semibold text-black"
                              >
                                Aprovar
                              </button>
                              <button
                                type="button"
                                onClick={() => onSetPanelReview(reviewKey, "rejected")}
                                className="rounded-full border border-rose-300/30 px-2 py-1 text-[10px] font-semibold text-rose-100"
                              >
                                Rejeitar
                              </button>
                            </div>
                            {status === "rejected" && panel.alternatives.length > 0 ? (
                              <div className="space-y-2 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-2">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/80">Alternativas melhores</p>
                                {panel.alternatives.map((alternative) => (
                                  <button
                                    type="button"
                                    key={alternative.panelId}
                                    onClick={() => onSelectPanelReplacement(reviewKey, alternative.panelId)}
                                    className="grid w-full grid-cols-[3rem_1fr] gap-2 rounded-xl border border-white/10 bg-black/35 p-1 text-left hover:border-signal/40"
                                  >
                                    <span className="aspect-[9/13] overflow-hidden rounded-lg bg-white/10">
                                      {alternative.previewUrl ? (
                                        <img src={getComicPanelPreviewUrl(alternative.previewUrl)} alt={`Alternativa ${alternative.panelId}`} className="h-full w-full object-cover" loading="lazy" />
                                      ) : null}
                                    </span>
                                    <span className="min-w-0 py-1">
                                      <span className="block truncate text-[10px] font-semibold text-white">{alternative.panelId}</span>
                                      <span className="block text-[10px] text-mist/55">pag. {alternative.pageNumber ?? "?"} / score {alternative.score}</span>
                                      <span className="block truncate text-[10px] text-amber-100/70">{alternative.storyFunction ?? alternative.reasons[0]}</span>
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {arc.characters.slice(0, 4).map((character) => (
                  <span key={character} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/65">
                    {character}
                  </span>
                ))}
                {arc.themes.slice(0, 4).map((theme) => (
                  <span key={theme} className="rounded-full border border-signal/15 bg-signal/[0.06] px-3 py-1 text-xs text-signal/70">
                    {theme.replace(/_/g, " ")}
                  </span>
                ))}
              </div>

              <div className="mt-5 space-y-2">
                {(script?.beats ?? []).slice(0, 5).map((beat, index) => (
                  <div key={`${beat.panelId}-${beat.role}`} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-mist/50">
                      <span>{index + 1}. {beat.role}</span>
                      <span>painel {beat.panelId} / pag. {beat.pageNumber}</span>
                    </div>
                    <p className="mt-2 text-sm text-white/82">{beat.captionText}</p>
                    <p className="mt-1 text-xs leading-5 text-mist/58">{beat.narrationText}</p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CreatedArcProjects({ result }: { result: ComicStudioCreateArcProjectsResponse | null }) {
  if (!result) return null;

  return (
    <section className="rounded-[2rem] border border-signal/25 bg-signal/[0.055] p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-signal/80">Projetos por arco criados</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">
        {result.createdCount} projetos premium criados com historia completa
      </h2>
      <p className="mt-2 text-sm text-mist/65">
        {result.arcSummary.readyArcCount} arcos prontos / {result.arcSummary.recommendedScriptCount} scripts recomendados. Render e importacao continuam bloqueados ate revisao manual.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {result.createdProjects.map((project) => (
          <div key={project.projectId} className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-semibold text-white">{project.title}</p>
            <p className="mt-2 text-xs text-mist/55">
              {project.scenesCreated} cenas / {project.panelAssetManifest.length} paineis / {project.renderBlueprintHints.targetDurationSeconds}s
            </p>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-mist/68">
              {project.renderBlueprintHints.script.fullNarration}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/projects/${project.projectId}`} className="rounded-full bg-signal px-4 py-2 text-xs font-semibold text-black">
                Abrir projeto
              </Link>
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-mist/65">
                score {project.renderBlueprintHints.script.overallScore}
              </span>
            </div>
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
  const [createdArcProjects, setCreatedArcProjects] = useState<ComicStudioCreateArcProjectsResponse | null>(null);
  const [panelReview, setPanelReview] = useState<PanelReviewMap>({});
  const [panelReplacement, setPanelReplacement] = useState<PanelReplacementMap>({});
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
    setCreatedArcProjects(null);
    setPanelReview({});
    setPanelReplacement({});
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

  function setPanelReviewStatus(key: string, status: PanelReviewStatus) {
    setPanelReview((current) => ({ ...current, [key]: status }));
  }

  function selectPanelReplacement(key: string, replacementPanelId: string) {
    setPanelReplacement((current) => ({ ...current, [key]: replacementPanelId }));
    setPanelReview((current) => ({ ...current, [key]: "approved" }));
  }
  function approveAllPanelsForArc(arcId: string) {
    const arc = plan?.arcStudio?.recommendedShorts.find((item) => item.id === arcId);
    if (!arc?.panelPreviews?.length) return;
    setPanelReview((current) => {
      const next = { ...current };
      arc.panelPreviews?.forEach((panel, index) => {
        next[panelReviewKey(arc.id, panel.panelId, index)] = "approved";
      });
      return next;
    });
  }

  function createArcProjects() {
    if (!channelId) {
      setError("Crie ou selecione um canal antes de criar projetos por arco.");
      return;
    }
    const review = getApprovedArcReview(plan, panelReview, panelReplacement);
    if (review.approvedArcIds.length === 0) {
      setError("Aprove todos os paineis de pelo menos um arco antes de criar projetos premium.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const response = await runComicStudioCreateArcProjectsRequest({
          assetDirectory,
          channelId,
          targetCount,
          maxProjects,
          minScore,
          titlePrefix: "Comic Arc",
          editingReferencePresetId: "builtin-comic-viral-reference-antman",
          templateId: "comic_story_premium",
          approvedArcIds: review.approvedArcIds,
          approvedPanelIdsByArcId: review.approvedPanelIdsByArcId,
          selectedPanelReplacementsByArcId: review.selectedPanelReplacementsByArcId
        });
        setCreatedArcProjects(response);
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
          titlePrefix: "Comic Studio",
          editingReferencePresetId: "builtin-comic-viral-reference-antman",
          templateId: "comic_drama"
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
        <ArcStudioPanel
          plan={plan}
          onCreateArcProjects={createArcProjects}
          disabled={isPending || !channelId}
          panelReview={panelReview}
          panelReplacement={panelReplacement}
          onSetPanelReview={setPanelReviewStatus}
          onSelectPanelReplacement={selectPanelReplacement}
          onApproveArc={approveAllPanelsForArc}
        />
      ) : null}

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

      <CreatedArcProjects result={createdArcProjects} />
      <CreatedProjects result={created} />
    </div>
  );
}











