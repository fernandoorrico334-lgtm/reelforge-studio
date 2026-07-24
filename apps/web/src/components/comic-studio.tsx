"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  runComicStudioCreateProjectsRequest,
  runComicStudioCreateArcProjectsRequest,
  runComicStudioPlanRequest,
  runComicOneClickAssistedPlanRequest,
  runComicAutoBibleFromIssuesRequest,
  runComicAutoBibleCreateProjectsRequest,
  getComicPanelPreviewUrl
} from "../lib/studio-api";
import type {
  ComicStudioCreateProjectsResponse,
  ComicStudioCreateArcProjectsResponse,
  ComicStudioFactoryPlanResponse,
  ComicOneClickAssistedPlanResponse,
  ComicAutoBibleFromIssuesResponse,
  ComicAutoBibleCreateProjectsResponse,
  ComicAutoBibleIssueInput,
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
              <span className={`rounded-full border px-4 py-2 text-xs ${project.renderBlueprintHints.finalQualityGate.status === "passed" ? "border-emerald-300/30 text-emerald-200" : project.renderBlueprintHints.finalQualityGate.status === "rejected" ? "border-rose-300/30 text-rose-100" : "border-amber-300/30 text-amber-100"}`}>
                Final QA {project.renderBlueprintHints.finalQualityGate.score}/{project.renderBlueprintHints.finalQualityGate.minimumScore}
              </span>
              <span className="rounded-full border border-cyan-300/25 px-4 py-2 text-xs text-cyan-100">
                Visual match {project.renderBlueprintHints.arcVisualPlan.averagePanelNarrationAlignmentScore}/100
              </span>
              <span className="rounded-full border border-fuchsia-300/25 px-4 py-2 text-xs text-fuchsia-100">
                Battle-Test {project.renderBlueprintHints.panelBattleTest.averageSelectedScore}/100
              </span>
              <span className="rounded-full border border-amber-300/25 px-4 py-2 text-xs text-amber-100">
                Timing {project.renderBlueprintHints.beatTimingPlan.averagePacingScore}/100
              </span>
              <span className="rounded-full border border-emerald-300/25 px-4 py-2 text-xs text-emerald-100">
                Narra??o {project.renderBlueprintHints.narrationHumanizerGate.score}/100
              </span>
              <span className="rounded-full border border-orange-300/25 px-4 py-2 text-xs text-orange-100">
                Legenda {project.renderBlueprintHints.captionImpactPlan.averageImpactScore}/100
              </span>
              <span className="rounded-full border border-sky-300/25 px-4 py-2 text-xs text-sky-100">
                Continuidade {project.renderBlueprintHints.panelContinuityReport.score}/100
              </span>
              <span className="rounded-full border border-lime-300/25 px-4 py-2 text-xs text-lime-100">
                Crop QA {project.renderBlueprintHints.postRenderCropQa.score}/100
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-cyan-100/65">
              Evidence map: {project.renderBlueprintHints.arcVisualPlan.scenes[0]?.selectedEvidenceRegion?.type ?? "fallback"} / {project.renderBlueprintHints.arcVisualPlan.scenes[0]?.selectedEvidenceRegion?.confidence ?? 0}% na abertura / legenda {project.renderBlueprintHints.arcVisualPlan.scenes[0]?.visualEvidenceMap?.layoutMap.preferredCaptionZone ?? "safe"}
              {" "}| OCR {project.renderBlueprintHints.arcVisualPlan.scenes[0]?.visualEvidenceMap?.ocrIntelligence?.confidence ?? 0}% / {project.renderBlueprintHints.arcVisualPlan.scenes[0]?.visualEvidenceMap?.ocrIntelligence?.textDensity ?? "none"} / protegidas {project.renderBlueprintHints.arcVisualPlan.scenes[0]?.visualEvidenceMap?.layoutMap.ocrProtectedRegionCount ?? 0}
              {" "}| foco {project.renderBlueprintHints.arcVisualPlan.scenes[0]?.visualEvidenceMap?.visualFocus?.primaryFocus?.type ?? "fallback"} {project.renderBlueprintHints.arcVisualPlan.scenes[0]?.visualEvidenceMap?.visualFocus?.focusScore ?? 0}/100
              {" "}| caption {project.renderBlueprintHints.captionImpactPlan.cues[0]?.animation ?? "impact"}/{project.renderBlueprintHints.captionImpactPlan.cues[0]?.safeZone ?? "safe"}
            </p>
            {project.renderBlueprintHints.finalQualityGate.blockers.length > 0 || project.renderBlueprintHints.finalQualityGate.warnings.length > 0 ? (
              <p className="mt-3 text-xs leading-5 text-mist/58">
                QA: {[...project.renderBlueprintHints.finalQualityGate.blockers, ...project.renderBlueprintHints.finalQualityGate.warnings].slice(0, 3).join(", ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm text-mist/65">{result.riskPolicyGate.note}</p>
    </section>
  );
}
const defaultAutoBibleIssues = [
  "1|Issue 1|storage/assets/comics/batman-white-knight/issue-01",
  "2|Issue 2|storage/assets/comics/batman-white-knight/issue-02"
].join("\n");

function parseAutoBibleIssueLines(value: string): ComicAutoBibleIssueInput[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length >= 3) {
        const issueNumber = Number(parts[0]);
        if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
          throw new Error(`Linha ${index + 1}: numero da edicao invalido.`);
        }
        return {
          issueNumber,
          title: parts[1] || `Issue ${issueNumber}`,
          assetDirectory: parts[2] ?? "",
          ...(parts[3] ? { sourcePath: parts[3] } : {})
        };
      }
      if (parts.length === 2) {
        const issueNumber = Number(parts[0]);
        if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
          throw new Error(`Linha ${index + 1}: numero da edicao invalido.`);
        }
        return {
          issueNumber,
          title: `Issue ${issueNumber}`,
          assetDirectory: parts[1] ?? ""
        };
      }
      return {
        issueNumber: index + 1,
        title: `Issue ${index + 1}`,
        assetDirectory: parts[0] ?? ""
      };
    })
    .map((issue, index) => {
      if (!issue.assetDirectory.trim()) {
        throw new Error(`Linha ${index + 1}: assetDirectory e obrigatorio.`);
      }
      return issue;
    });
}

function AutoBibleBuilderPanel({ channels }: { channels: StudioChannel[] }) {
  const [title, setTitle] = useState("HQ Story Series - biblia automatica");
  const [issuesText, setIssuesText] = useState(defaultAutoBibleIssues);
  const [mode, setMode] = useState<"full_story_series" | "best_story_short" | "curiosity_batch">("full_story_series");
  const [targetEventCount, setTargetEventCount] = useState(32);
  const [maximumEpisodeDurationSeconds, setMaximumEpisodeDurationSeconds] = useState(180);
  const [targetWordsPerMinute, setTargetWordsPerMinute] = useState(160);
  const [forceRebuildIndex, setForceRebuildIndex] = useState(false);
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [plan, setPlan] = useState<ComicAutoBibleFromIssuesResponse | null>(null);
  const [created, setCreated] = useState<ComicAutoBibleCreateProjectsResponse | null>(null);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [titlePrefix, setTitlePrefix] = useState("HQ Story");
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generateAutoBible() {
    setError(null);
    startTransition(async () => {
      try {
        const issues = parseAutoBibleIssueLines(issuesText);
        const response = await runComicAutoBibleFromIssuesRequest({
          title,
          issues,
          mode,
          targetEventCount,
          maximumEpisodeDurationSeconds,
          targetWordsPerMinute,
          forceRebuildIndex,
          ocrEnabled
        });
        setPlan(response);
        setCreated(null);
        setSelectedEpisodeIds(response.productionGates.filter((gate) => gate.renderAllowed).map((gate) => gate.episodeId));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function toggleEpisode(episodeId: string) {
    setSelectedEpisodeIds((current) =>
      current.includes(episodeId)
        ? current.filter((id) => id !== episodeId)
        : [...current, episodeId]
    );
  }

  function createSeriesProjects() {
    if (!plan) return;
    if (!channelId) {
      setError("Selecione um canal antes de criar projetos da serie.");
      return;
    }
    if (selectedEpisodeIds.length === 0) {
      setError("Selecione pelo menos um episodio aprovado.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const issues = parseAutoBibleIssueLines(issuesText);
        const response = await runComicAutoBibleCreateProjectsRequest({
          channelId,
          titlePrefix,
          issues,
          narrativeBibleInput: plan.narrativeBibleInput,
          episodeDefinitions: plan.episodeDefinitions,
          approvedEpisodeIds: selectedEpisodeIds,
          maxProjects: selectedEpisodeIds.length,
          maximumEpisodeDurationSeconds,
          targetWordsPerMinute
        });
        setCreated(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }
  return (
    <section className="rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.14),transparent_30%),rgba(255,255,255,0.035)] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/55">Auto Bible Builder</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">HQ inteira entra, biblia narrativa e episodios saem</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-mist/68">
            Use este fluxo para o sistema ler edicoes locais, entender a progressao da historia, separar eventos importantes e preparar episodios de ate 3 minutos. Ele continua candidate-first: nada e renderizado sem aprovacao humana.
          </p>
        </div>
        <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-4 py-2 text-xs font-semibold text-cyan-100">
          bible &gt; episodios &gt; gates
        </span>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.35fr_0.25fr_0.25fr_0.25fr]">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Titulo da saga</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-cyan-200/70" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Modo</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-cyan-200/70">
            <option value="full_story_series">historia completa</option>
            <option value="best_story_short">melhor short</option>
            <option value="curiosity_batch">curiosidades</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Eventos</span>
          <input type="number" min={4} max={80} value={targetEventCount} onChange={(event) => setTargetEventCount(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-cyan-200/70" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Max s</span>
          <input type="number" min={60} max={180} value={maximumEpisodeDurationSeconds} onChange={(event) => setMaximumEpisodeDurationSeconds(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-cyan-200/70" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">WPM</span>
          <input type="number" min={120} max={190} value={targetWordsPerMinute} onChange={(event) => setTargetWordsPerMinute(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-cyan-200/70" />
        </label>
      </div>

      <label className="mt-5 block">
        <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Edicoes locais</span>
        <textarea value={issuesText} onChange={(event) => setIssuesText(event.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-xs leading-5 text-white outline-none focus:border-cyan-200/70" />
        <span className="mt-2 block text-xs text-mist/50">Formato por linha: numero|titulo|assetDirectory|sourcePath opcional. Se sourcePath vier, o sistema ingere o CBR/CBZ local antes de minerar.</span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-mist/70">
          <input type="checkbox" checked={forceRebuildIndex} onChange={(event) => setForceRebuildIndex(event.target.checked)} />
          reconstruir indice
        </label>
        <label className="flex items-center gap-2 text-sm text-mist/70">
          <input type="checkbox" checked={ocrEnabled} onChange={(event) => setOcrEnabled(event.target.checked)} />
          OCR local se disponivel
        </label>
        <button type="button" onClick={generateAutoBible} disabled={isPending} className="rounded-full bg-cyan-200 px-6 py-3 text-sm font-semibold text-black disabled:opacity-50">
          {isPending ? "Lendo HQ e montando biblia..." : "Gerar biblia automatica"}
        </button>
      </div>

      {error ? <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</p> : null}

      {plan ? (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Status</p>
              <p className="mt-2 text-lg font-semibold text-white">{plan.status}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Eventos</p>
              <p className="mt-2 text-lg font-semibold text-white">{plan.whatItUnderstands.generatedEventCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Episodios</p>
              <p className="mt-2 text-lg font-semibold text-white">{plan.whatItUnderstands.generatedEpisodeCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Prontos</p>
              <p className="mt-2 text-lg font-semibold text-white">{plan.qualityGates.productionReadyEpisodes}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Paginas</p>
              <p className="mt-2 text-lg font-semibold text-white">{plan.sagaMapSummary.totalPages}</p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-mist/45">O que o sistema entendeu</p>
            <h3 className="mt-3 text-xl font-semibold text-white">{plan.whatItUnderstands.centralQuestion}</h3>
            <p className="mt-3 text-sm leading-6 text-mist/75">{plan.whatItUnderstands.premise}</p>
            <div className="mt-4 grid gap-3 text-sm text-mist/68 md:grid-cols-3">
              <span>Comeco: {plan.whatItUnderstands.beginning}</span>
              <span>Meio: {plan.whatItUnderstands.middle}</span>
              <span>Fim: {plan.whatItUnderstands.ending}</span>
            </div>
          </div>

          {plan.qualityGates.blockers.length > 0 ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
              Bloqueios: {plan.qualityGates.blockers.slice(0, 6).join("; ")}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {plan.productionGates.map((gate) => (
              <article key={gate.episodeId} className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-mist/45">Episodio {gate.episodeNumber}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{gate.title}</h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${gate.renderAllowed ? "bg-emerald-300 text-black" : "bg-amber-300/15 text-amber-100"}`}>
                    {gate.renderAllowed ? "Render ready" : "Revisar"}
                  </span>
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm text-mist/75">
                  <input type="checkbox" checked={selectedEpisodeIds.includes(gate.episodeId)} disabled={!gate.renderAllowed} onChange={() => toggleEpisode(gate.episodeId)} />
                  Aprovar episodio para criar projeto
                </label>
                <p className="mt-3 text-sm text-mist/70">Score {gate.score}/100 - {gate.status}</p>
                {gate.blockers.length > 0 || gate.warnings.length > 0 ? (
                  <p className="mt-3 text-xs leading-5 text-amber-100/75">QA: {[...gate.blockers, ...gate.warnings].slice(0, 5).join("; ")}</p>
                ) : null}
              </article>
            ))}
          </div>
          <div className="rounded-[1.5rem] border border-cyan-200/15 bg-cyan-200/[0.04] p-5">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Canal</span>
                <select value={channelId} onChange={(event) => setChannelId(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-cyan-200/70">
                  {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Prefixo dos projetos</span>
                <input value={titlePrefix} onChange={(event) => setTitlePrefix(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-cyan-200/70" />
              </label>
              <button type="button" onClick={createSeriesProjects} disabled={isPending || selectedEpisodeIds.length === 0} className="mt-6 rounded-full bg-emerald-300 px-6 py-3 text-sm font-semibold text-black disabled:opacity-50">
                {isPending ? "Criando projetos..." : `Criar ${selectedEpisodeIds.length} projeto(s)`}
              </button>
            </div>
            <p className="mt-3 text-xs text-mist/55">Cria VideoProjects editaveis com cenas por evento. Ainda nao importa paineis nem renderiza automaticamente.</p>
          </div>

          {created ? (
            <div className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/[0.06] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-100/70">Projetos criados</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {created.createdProjects.map((project) => (
                  <Link key={project.projectId} href={`/projects/${project.projectId}`} className="rounded-2xl border border-white/10 bg-black/25 p-4 hover:border-emerald-200/50">
                    <p className="text-sm font-semibold text-white">{project.title}</p>
                    <p className="mt-2 text-xs text-mist/60">Episodio {project.episodeNumber} - {project.scenesCreated} cenas - score {project.productionGate.score}/100</p>
                    {project.godModeGate ? (
                      <div className={`mt-3 rounded-xl border p-3 text-xs ${project.godModeGate.status === "god_ready" ? "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-50" : project.godModeGate.status === "blocked" ? "border-rose-300/25 bg-rose-300/[0.07] text-rose-50" : "border-amber-300/25 bg-amber-300/[0.07] text-amber-50"}`}>
                        <p className="font-semibold">God Mode Gate: {project.godModeGate.status} - {project.godModeGate.score}/100</p>
                        <p className="mt-1">{project.godModeGate.directorNotes.slice(0, 2).join(" ")}</p>
                      </div>
                    ) : null}
                    {project.panelMatchSummary ? (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-mist/68">
                        <p className="font-semibold text-cyan-100">Painel x narra??o: {project.panelMatchSummary.matchedCount}/{project.panelMatchSummary.beatCount} cenas - score m?dio {project.panelMatchSummary.averageScore}</p>
                        <p className="mt-1">Alta confian?a: {project.panelMatchSummary.highConfidenceCount} - repetidos: {project.panelMatchSummary.repeatedPanelCount}</p>
                        {project.panelMatchSummary.warnings.length > 0 ? (
                          <p className="mt-1 text-amber-100/75">Avisos: {project.panelMatchSummary.warnings.slice(0, 2).join("; ")}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-amber-100/70">Sem ?ndice local de pain?is para autofill visual.</p>
                    )}
                    <p className="mt-2 text-xs text-emerald-100/75">Abrir projeto</p>
                  </Link>
                ))}
              </div>
              {created.panelIndexWarnings && created.panelIndexWarnings.length > 0 ? (
                <p className="mt-4 text-xs text-amber-100/75">?ndice visual: {created.panelIndexWarnings.slice(0, 3).join("; ")}</p>
              ) : null}
              <p className="mt-4 text-xs text-mist/50">{created.riskPolicyGate.note}</p>
            </div>
          ) : null}
          <p className="text-sm text-mist/65">{plan.outputContract.recommendedNextStep}</p>
          <p className="text-xs text-mist/45">{plan.riskPolicyGate.note}</p>
        </div>
      ) : null}
    </section>
  );
}
function OneClickAssistedPanel() {
  const [episodes, setEpisodes] = useState("all");
  const [title, setTitle] = useState("Batman White Knight - saga assistida");
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(180);
  const [targetWordsPerMinute, setTargetWordsPerMinute] = useState(160);
  const [narrationProvider, setNarrationProvider] = useState("voicebox-qwen");
  const [narrationSessionMode, setNarrationSessionMode] = useState<"single" | "act" | "phrase">("single");
  const [plan, setPlan] = useState<ComicOneClickAssistedPlanResponse | null>(null);
  const [copiedEpisode, setCopiedEpisode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generatePlan() {
    setError(null);
    setCopiedEpisode(null);
    startTransition(async () => {
      try {
        const response = await runComicOneClickAssistedPlanRequest({
          title,
          episodes,
          maxDurationSeconds,
          targetWordsPerMinute,
          narrationProvider,
          narrationSessionMode
        });
        setPlan(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function copyCommand(episodeNumber: number, command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedEpisode(episodeNumber);
    } catch {
      setError("Nao consegui copiar automaticamente. Selecione e copie o comando manualmente.");
    }
  }

  return (
    <section className="rounded-[2rem] border border-amber-300/20 bg-[radial-gradient(circle_at_top_left,rgba(255,207,112,0.16),transparent_30%),rgba(255,255,255,0.035)] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-100/55">One-Click Assistido</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Plano completo por episodio, com revisao humana antes do render</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-mist/68">
            Este fluxo usa a biblia narrativa da HQ para preparar episodios de ate 3 minutos. Ele nao renderiza sozinho: mostra o que sera contado, valida os bloqueios e entrega o comando de render somente para episodio aprovado.
          </p>
        </div>
        <span className="rounded-full border border-amber-200/25 bg-amber-200/10 px-4 py-2 text-xs font-semibold text-amber-100">
          candidate-first / 0 auto-render
        </span>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.38fr_0.32fr_0.32fr_0.35fr]">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Titulo do plano</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-amber-200/70" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Episodios</span>
          <input value={episodes} onChange={(event) => setEpisodes(event.target.value)} placeholder="all ou 1,2" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-amber-200/70" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Max s</span>
          <input type="number" min={60} max={180} value={maxDurationSeconds} onChange={(event) => setMaxDurationSeconds(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-amber-200/70" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">WPM</span>
          <input type="number" min={120} max={190} value={targetWordsPerMinute} onChange={(event) => setTargetWordsPerMinute(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-amber-200/70" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Sessao voz</span>
          <select value={narrationSessionMode} onChange={(event) => setNarrationSessionMode(event.target.value as "single" | "act" | "phrase")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-amber-200/70">
            <option value="single">single</option>
            <option value="act">act</option>
            <option value="phrase">phrase</option>
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Provider de narracao</span>
          <input value={narrationProvider} onChange={(event) => setNarrationProvider(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-amber-200/70" />
        </label>
        <button type="button" onClick={generatePlan} disabled={isPending} className="mt-6 rounded-full bg-amber-200 px-6 py-3 text-sm font-semibold text-black disabled:opacity-50">
          {isPending ? "Montando plano..." : "Gerar plano assistido"}
        </button>
      </div>
      {error ? <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</p> : null}

      {plan ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Status</p>
              <p className="mt-2 text-lg font-semibold text-white">{plan.status}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Episodios</p>
              <p className="mt-2 text-lg font-semibold text-white">{plan.selectedEpisodeCount}/{plan.episodeCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Biblia</p>
              <p className="mt-2 text-lg font-semibold text-white">{plan.bibleStatus}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Narracao</p>
              <p className="mt-2 text-lg font-semibold text-white">{plan.narrationSessionMode}</p>
            </div>
          </div>

          {plan.plannerBlockers.length > 0 ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
              Bloqueios: {plan.plannerBlockers.slice(0, 5).join("; ")}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {plan.selectedEpisodes.map((episode) => (
              <article key={episode.episodeId} className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-mist/45">Episodio {episode.episodeNumber}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{episode.title}</h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${episode.gateStatus === "passed" ? "bg-emerald-300 text-black" : "bg-rose-300/15 text-rose-100"}`}>
                    {episode.gateStatus === "passed" ? "Pronto" : "Revisar"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-mist/68 md:grid-cols-3">
                  <span>{episode.estimatedDurationSeconds}s</span>
                  <span>{episode.wordCount} palavras</span>
                  <span>{episode.eventCount} eventos</span>
                </div>
                <p className="mt-3 text-xs text-mist/55">Edicoes: {episode.issueNumbers.join(", ")} | fatos criticos: {episode.criticalFactCount}</p>
                <p className="mt-4 line-clamp-5 text-sm leading-6 text-mist/76">{episode.narrationPreview}</p>
                {episode.warnings.length > 0 || episode.blockers.length > 0 ? (
                  <p className="mt-4 text-xs leading-5 text-amber-100/75">
                    QA: {[...episode.blockers, ...episode.warnings].slice(0, 4).join("; ")}
                  </p>
                ) : null}
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Comando aprovado</p>
                  <code className="mt-2 block break-words text-xs leading-5 text-amber-100/80">{episode.renderCommand}</code>
                </div>
                <button type="button" onClick={() => copyCommand(episode.episodeNumber, episode.renderCommand)} className="mt-4 rounded-full border border-amber-200/40 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-200/10">
                  {copiedEpisode === episode.episodeNumber ? "Comando copiado" : "Copiar comando de render"}
                </button>
              </article>
            ))}
          </div>
          <p className="text-sm text-mist/65">{plan.riskPolicyGate.note}</p>
        </div>
      ) : null}
    </section>
  );
}

function ComicPatchWorkflowPanel() {
  const [retryPlanPath, setRetryPlanPath] = useState("tmp/comic-post-render-qa/comic-post-render-retry-plan.json");
  const [panelCatalogPath, setPanelCatalogPath] = useState("tmp/comic-panel-catalog.json");
  const [outputDir, setOutputDir] = useState("tmp/comic-assisted-patch-workflow");
  const [patchSourcesPath, setPatchSourcesPath] = useState("tmp/comic-assisted-patch-workflow/patch-sources-draft.json");
  const [copied, setCopied] = useState<string | null>(null);

  const manifestPath = `${outputDir.replace(/[\\/]$/u, "")}/scene-patch-manifest.json`;
  const workflowCommand = `npm run comic:assisted-patch-workflow -- --retry-plan "${retryPlanPath}" --panel-catalog "${panelCatalogPath}" --output-dir "${outputDir}" --approved-request`;
  const planExecutionCommand = `npm run comic:approved-patch-execution -- --manifest "${manifestPath}" --patch-sources "${patchSourcesPath}" --output-dir "${outputDir}"`;
  const executeCommand = `npm run comic:approved-patch-execution -- --manifest "${manifestPath}" --patch-sources "${patchSourcesPath}" --output-dir "${outputDir}" --mode execute --approved --fail-on-missing-source --fail-on-missing-patches`;

  async function copyCommand(id: string, command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-sky-300/20 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.14),transparent_32%),rgba(255,255,255,0.035)] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-100/60">Correção pós-render</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Patch assistido de cenas ruins, sem refazer o vídeo inteiro</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-mist/68">
            Use depois do QA pós-render detectar cortes repetidos, zoom errado, legenda desalinhada ou cena que não combina com a narração. O fluxo gera sugestões de painéis, exige aprovação manual e só então cria patches para montar um MP4 corrigido.
          </p>
        </div>
        <span className="rounded-full border border-sky-200/25 bg-sky-200/10 px-4 py-2 text-xs font-semibold text-sky-100">
          scene-only / original intacto
        </span>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Retry plan do QA</span>
          <input
            value={retryPlanPath}
            onChange={(event) => setRetryPlanPath(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-sky-200/70"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Catálogo local de painéis</span>
          <input
            value={panelCatalogPath}
            onChange={(event) => setPanelCatalogPath(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-sky-200/70"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Pasta de saída</span>
          <input
            value={outputDir}
            onChange={(event) => setOutputDir(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-sky-200/70"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.24em] text-mist/45">Patch sources aprovado</span>
          <input
            value={patchSourcesPath}
            onChange={(event) => setPatchSourcesPath(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-sky-200/70"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-100/50">1. Encontrar patches</p>
          <p className="mt-2 text-sm leading-6 text-mist/68">Cria pedido de correção, slots de cena e sugestões de painéis/crops locais.</p>
          <code className="mt-4 block break-words rounded-xl bg-black/40 p-3 text-xs leading-5 text-sky-100/80">{workflowCommand}</code>
          <button type="button" onClick={() => copyCommand("workflow", workflowCommand)} className="mt-3 rounded-full border border-sky-200/35 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-200/10">
            {copied === "workflow" ? "Copiado" : "Copiar comando"}
          </button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-100/50">2. Revisar aprovação</p>
          <p className="mt-2 text-sm leading-6 text-mist/68">Abra o `patch-sources-draft.json`, confira se o painel sugerido está certo e troque `approved` para `true` só nas fontes corretas.</p>
          <ul className="mt-4 space-y-2 text-xs text-mist/60">
            <li>• fonte deve ser local/autorizada</li>
            <li>• não voltar páginas sem necessidade narrativa</li>
            <li>• foco deve bater com narração e legenda</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-100/50">3. Gerar MP4 corrigido</p>
          <p className="mt-2 text-sm leading-6 text-mist/68">Depois da aprovação, gera os patch clips e monta `output-patched.mp4` sem sobrescrever o vídeo original.</p>
          <code className="mt-4 block break-words rounded-xl bg-black/40 p-3 text-xs leading-5 text-sky-100/80">{executeCommand}</code>
          <button type="button" onClick={() => copyCommand("execute", executeCommand)} className="mt-3 rounded-full border border-sky-200/35 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-200/10">
            {copied === "execute" ? "Copiado" : "Copiar execução"}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-mist/45">Validação antes de executar</p>
            <p className="mt-2 text-sm text-mist/68">Use este comando para checar se todas as fontes estão aprovadas antes de gerar os patches.</p>
          </div>
          <button type="button" onClick={() => copyCommand("plan-exec", planExecutionCommand)} className="rounded-full bg-sky-200 px-4 py-2 text-xs font-semibold text-black">
            {copied === "plan-exec" ? "Comando copiado" : "Copiar validação"}
          </button>
        </div>
        <code className="mt-4 block break-words rounded-xl bg-black/40 p-3 text-xs leading-5 text-sky-100/75">{planExecutionCommand}</code>
      </div>
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
          templateId: "comic_story_premium_v1",
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
          templateId: "comic_story_premium_v1"
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

      <AutoBibleBuilderPanel channels={channels} />

      <OneClickAssistedPanel />

      <ComicPatchWorkflowPanel />

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






















