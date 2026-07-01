"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { AssetMediaPreview } from "./asset-media-preview";
import {
  getSceneGeneratedImagesRequest,
  markVisualGenerationJobReviewedRequest,
  regenerateVisualGenerationJobRequest,
  useGeneratedImageForSceneRequest
} from "../lib/studio-api";
import type {
  DataSource,
  GeneratedImageGalleryItem,
  VisualReviewStatus
} from "../lib/studio-types";

interface GeneratedImagesManagerProps {
  initialItems: GeneratedImageGalleryItem[];
  initialSource: DataSource;
}

function formatSourceLabel(value: DataSource) {
  return value === "api" ? "API local ativa" : "Mock local";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Operacao falhou na API local.";
}

function readMetadataString(
  item: GeneratedImageGalleryItem | null | undefined,
  key: string
) {
  const value = item?.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPromptQualityScore(item: GeneratedImageGalleryItem | null | undefined) {
  const qualityAnalysis = item?.metadata?.qualityAnalysis;

  if (
    qualityAnalysis &&
    typeof qualityAnalysis === "object" &&
    !Array.isArray(qualityAnalysis)
  ) {
    const overallScore = (qualityAnalysis as { overallScore?: unknown }).overallScore;

    if (typeof overallScore === "number") {
      return overallScore;
    }
  }

  return null;
}

function sortGalleryItems(items: GeneratedImageGalleryItem[]) {
  return [...items].sort((left, right) =>
    right.job.createdAt.localeCompare(left.job.createdAt)
  );
}

function mergeSceneGeneratedItems(
  currentItems: GeneratedImageGalleryItem[],
  sceneId: string,
  nextItems: GeneratedImageGalleryItem[]
) {
  return sortGalleryItems([
    ...currentItems.filter((item) => item.scene?.id !== sceneId),
    ...nextItems
  ]);
}

function updateReviewedItem(
  currentItems: GeneratedImageGalleryItem[],
  jobId: string,
  reviewStatus: VisualReviewStatus,
  notes: string | null
) {
  return currentItems.map((item) =>
    item.job.id === jobId
      ? {
          ...item,
          job: {
            ...item.job,
            metadata: {
              ...(item.job.metadata ?? {}),
              reviewStatus,
              reviewNotes: notes,
              reviewedAt: new Date().toISOString()
            }
          },
          metadata: {
            ...(item.metadata ?? {}),
            reviewStatus,
            reviewNotes: notes,
            reviewedAt: new Date().toISOString()
          },
          reviewStatus,
          reviewNotes: notes,
          isFavorite: reviewStatus === "favorite"
        }
      : item
  );
}

export function GeneratedImagesManager({
  initialItems,
  initialSource
}: GeneratedImagesManagerProps) {
  const [items, setItems] = useState(sortGalleryItems(initialItems));
  const [source, setSource] = useState<DataSource>(initialSource);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [workflowPackFilter, setWorkflowPackFilter] = useState("ALL");
  const [qualityFilter, setQualityFilter] = useState("ALL");
  const [selectedItemId, setSelectedItemId] = useState(initialItems[0]?.job.id ?? "");
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Galeria conectada a API local."
      : "Galeria em modo mock ate a API ficar disponivel."
  );
  const deferredProjectFilter = useDeferredValue(projectFilter);
  const deferredWorkflowPackFilter = useDeferredValue(workflowPackFilter);
  const deferredQualityFilter = useDeferredValue(qualityFilter);
  const deferredStatusFilter = useDeferredValue(statusFilter);

  const visibleItems = items.filter((item) => {
    const workflowPackId = readMetadataString(item, "workflowPackId") ?? "n/a";
    const qualityPresetId = readMetadataString(item, "qualityPresetId") ?? "n/a";

    if (deferredProjectFilter !== "ALL" && item.project?.id !== deferredProjectFilter) {
      return false;
    }

    if (deferredWorkflowPackFilter !== "ALL" && workflowPackId !== deferredWorkflowPackFilter) {
      return false;
    }

    if (deferredQualityFilter !== "ALL" && qualityPresetId !== deferredQualityFilter) {
      return false;
    }

    if (deferredStatusFilter !== "ALL" && item.job.status !== deferredStatusFilter) {
      return false;
    }

    return true;
  });
  const selectedItem =
    visibleItems.find((item) => item.job.id === selectedItemId) ??
    items.find((item) => item.job.id === selectedItemId) ??
    visibleItems[0] ??
    items[0] ??
    null;
  const projectOptions = [...new Map(items
    .filter((item) => item.project)
    .map((item) => [item.project!.id, item.project!])
  ).values()];
  const workflowPackOptions = [
    ...new Set(
      items
        .map((item) => readMetadataString(item, "workflowPackId"))
        .filter((value): value is string => Boolean(value))
    )
  ];
  const qualityOptions = [
    ...new Set(
      items
        .map((item) => readMetadataString(item, "qualityPresetId"))
        .filter((value): value is string => Boolean(value))
    )
  ];
  const statusOptions = [
    ...new Set(items.map((item) => item.job.status))
  ];

  useEffect(() => {
    if (!selectedItemId && items[0]) {
      setSelectedItemId(items[0].job.id);
      return;
    }

    if (selectedItemId && !items.some((item) => item.job.id === selectedItemId) && items[0]) {
      setSelectedItemId(items[0].job.id);
    }
  }, [items, selectedItemId]);

  async function refreshScene(sceneId: string) {
    const nextItems = await getSceneGeneratedImagesRequest(sceneId);
    setItems((current) => mergeSceneGeneratedItems(current, sceneId, nextItems));
    setSource("api");
    return nextItems;
  }

  async function handleReview(
    item: GeneratedImageGalleryItem,
    reviewStatus: VisualReviewStatus
  ) {
    try {
      await markVisualGenerationJobReviewedRequest(item.job.id, reviewStatus, null);
      setItems((current) =>
        updateReviewedItem(current, item.job.id, reviewStatus, null)
      );
      setSource("api");
      setStatusMessage(`Job ${item.job.id} marcado como ${reviewStatus}.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleUseInScene(item: GeneratedImageGalleryItem) {
    if (!item.scene?.id || !item.asset?.id) {
      setStatusMessage("Apenas imagens com cena e asset podem ser aplicadas.");
      return;
    }

    try {
      await useGeneratedImageForSceneRequest(item.scene.id, item.asset.id);
      await refreshScene(item.scene.id);
      setStatusMessage(`Cena ${item.scene.order} agora usa o asset ${item.asset.id}.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleRegenerate(
    item: GeneratedImageGalleryItem,
    seedMode: "reuse" | "random"
  ) {
    try {
      const result = await regenerateVisualGenerationJobRequest(item.job.id, {
        seedMode,
        workflowPackId: readMetadataString(item, "workflowPackId"),
        qualityPresetId: readMetadataString(item, "qualityPresetId")
      });

      if (item.scene?.id) {
        const nextItems = await refreshScene(item.scene.id);
        const regeneratedItem = nextItems.find((entry) => entry.job.id === result.job.id);

        if (regeneratedItem) {
          setSelectedItemId(regeneratedItem.job.id);
        }
      }

      setStatusMessage(
        `Regeneracao concluida. Novo job ${result.job.id} com provider ${result.job.provider}.`
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[1.95rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(126,247,216,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(146,167,255,0.14),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Generated Image Review
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Galeria de geracoes para revisar, aprovar e promover antes do render
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Compare variacoes, marque favoritas, troque a imagem ativa da cena
              e regenere com novo seed sem perder o historico do projeto.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Itens
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{items.length}</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Favoritos
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {items.filter((item) => item.isFavorite).length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Fonte
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(source)}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
          {statusMessage}
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[1.85rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Preview Desk
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {selectedItem?.scene?.title ??
                  selectedItem?.project?.title ??
                  "Selecione uma geracao"}
              </h2>
            </div>
            {selectedItem?.job ? (
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/65">
                {selectedItem.job.status}
              </span>
            ) : null}
          </div>

          {selectedItem?.asset ? (
            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
              <AssetMediaPreview asset={selectedItem.asset} source={source} />
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-10 text-sm text-mist/55">
              Nenhuma imagem selecionada. Jobs com falha ou ainda sem asset aparecem aqui
              para diagnostico.
            </div>
          )}

          {selectedItem ? (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                {selectedItem.isCurrentSceneGeneratedAsset ? (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                    current
                  </span>
                ) : null}
                {selectedItem.isFavorite ? (
                  <span className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-3 py-1 text-xs text-[#fff0cb]">
                    favorite
                  </span>
                ) : null}
                {readMetadataString(selectedItem, "workflowPackId") ? (
                  <span className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-3 py-1 text-xs text-[#e2e8ff]">
                    pack {readMetadataString(selectedItem, "workflowPackId")}
                  </span>
                ) : null}
                {readMetadataString(selectedItem, "qualityPresetId") ? (
                  <span className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-3 py-1 text-xs text-[#d8f8ff]">
                    quality {readMetadataString(selectedItem, "qualityPresetId")}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                    Metadata
                  </p>
                  <p className="mt-3 text-sm leading-7 text-mist/72">
                    provider {selectedItem.job.provider}
                    <br />
                    seed {String(selectedItem.job.seed ?? selectedItem.metadata?.seed ?? "n/a")}
                    <br />
                    score {String(readPromptQualityScore(selectedItem) ?? "n/a")}
                    <br />
                    criado em {formatDate(selectedItem.job.createdAt)}
                  </p>
                </div>
                <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                    Contexto
                  </p>
                  <p className="mt-3 text-sm leading-7 text-mist/72">
                    projeto {selectedItem.project?.title ?? "n/a"}
                    <br />
                    cena {selectedItem.scene ? `${selectedItem.scene.order}. ${selectedItem.scene.title}` : "n/a"}
                    <br />
                    workflowOrigin {String(selectedItem.metadata?.workflowOrigin ?? "n/a")}
                    <br />
                    review {selectedItem.reviewStatus ?? "pendente"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleReview(selectedItem, "approved");
                  }}
                  className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100"
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleReview(selectedItem, "rejected");
                  }}
                  className="rounded-full border border-red-400/25 bg-red-400/10 px-4 py-2 text-sm text-red-100"
                >
                  Rejeitar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleReview(selectedItem, "favorite");
                  }}
                  className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-4 py-2 text-sm text-[#fff0cb]"
                >
                  Favorito
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleUseInScene(selectedItem);
                  }}
                  disabled={!selectedItem.scene?.id || !selectedItem.asset?.id}
                  className="rounded-full border border-signal/30 bg-signal/12 px-4 py-2 text-sm text-signal disabled:opacity-45"
                >
                  Usar na cena
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleRegenerate(selectedItem, "random");
                  }}
                  className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-4 py-2 text-sm text-[#e2e8ff]"
                >
                  Regenerar seed novo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleRegenerate(selectedItem, "reuse");
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/75"
                >
                  Regenerar mesmo seed
                </button>
                {selectedItem.project?.id ? (
                  <Link
                    href={`/projects/${selectedItem.project.id}`}
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/75"
                  >
                    Abrir projeto
                  </Link>
                ) : null}
                {selectedItem.asset?.id ? (
                  <Link
                    href={`/assets#asset-${selectedItem.asset.id}`}
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/75"
                  >
                    Abrir asset
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </article>

        <article className="rounded-[1.85rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Gallery Grid
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {visibleItems.length} imagens no recorte atual
              </h2>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">Todos os projetos</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <select
              value={workflowPackFilter}
              onChange={(event) => setWorkflowPackFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">Todos os packs</option>
              {workflowPackOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">Todas as qualidades</option>
              {qualityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">Todos os status</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {visibleItems.map((item) => (
              <button
                key={item.job.id}
                type="button"
                onClick={() => setSelectedItemId(item.job.id)}
                className={`overflow-hidden rounded-[1.5rem] border text-left transition ${
                  selectedItemId === item.job.id
                    ? "border-signal/40 bg-signal/8"
                    : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                {item.asset ? (
                  <AssetMediaPreview asset={item.asset} source={source} />
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center bg-black/30 px-5 text-sm text-mist/55">
                    Sem imagem disponivel para preview
                  </div>
                )}

                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-mist/70">
                      {item.job.status}
                    </span>
                    {item.isCurrentSceneGeneratedAsset ? (
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
                        current
                      </span>
                    ) : null}
                    {item.isFavorite ? (
                      <span className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-3 py-1 text-[11px] text-[#fff0cb]">
                        favorite
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-white">
                    {item.scene?.title ?? item.project?.title ?? item.asset?.filename ?? item.job.id}
                  </h3>
              <p className="mt-2 text-sm leading-7 text-mist/68">
                    {item.project ? `${item.project.title} / ${item.project.channelName}` : "Job sem projeto associado"}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {readMetadataString(item, "workflowPackId") ? (
                      <span className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-3 py-1 text-[11px] text-[#e2e8ff]">
                        {readMetadataString(item, "workflowPackId")}
                      </span>
                    ) : null}
                    {readMetadataString(item, "qualityPresetId") ? (
                      <span className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-3 py-1 text-[11px] text-[#d8f8ff]">
                        {readMetadataString(item, "qualityPresetId")}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-4 text-xs text-mist/45">
                    {item.asset?.id ?? "sem asset"} / {formatDate(item.job.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
