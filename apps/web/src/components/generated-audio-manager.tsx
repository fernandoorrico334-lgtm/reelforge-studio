"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { AssetMediaPreview } from "./asset-media-preview";
import {
  getSceneNarrationsRequest,
  useSceneNarrationRequest
} from "../lib/studio-api";
import type {
  DataSource,
  GeneratedAudioGalleryItem
} from "../lib/studio-types";

interface GeneratedAudioManagerProps {
  initialItems: GeneratedAudioGalleryItem[];
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

function formatDuration(value: number | null) {
  if (!value || value <= 0) {
    return "n/d";
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}s`;
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Operacao falhou na API local.";
}

function sortAudioItems(items: GeneratedAudioGalleryItem[]) {
  return [...items].sort((left, right) =>
    right.job.createdAt.localeCompare(left.job.createdAt)
  );
}

function mergeSceneNarrations(
  currentItems: GeneratedAudioGalleryItem[],
  sceneId: string,
  nextItems: GeneratedAudioGalleryItem[]
) {
  return sortAudioItems([
    ...currentItems.filter((item) => item.scene?.id !== sceneId),
    ...nextItems
  ]);
}

export function GeneratedAudioManager({
  initialItems,
  initialSource
}: GeneratedAudioManagerProps) {
  const [items, setItems] = useState(sortAudioItems(initialItems));
  const [source, setSource] = useState<DataSource>(initialSource);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [providerFilter, setProviderFilter] = useState("ALL");
  const [voicePackFilter, setVoicePackFilter] = useState("ALL");
  const [selectedJobId, setSelectedJobId] = useState(initialItems[0]?.job.id ?? "");
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Galeria de narrações conectada a API local."
      : "Galeria em modo mock ate a API ficar disponivel."
  );
  const deferredProjectFilter = useDeferredValue(projectFilter);
  const deferredProviderFilter = useDeferredValue(providerFilter);
  const deferredVoicePackFilter = useDeferredValue(voicePackFilter);
  const deferredStatusFilter = useDeferredValue(statusFilter);

  const visibleItems = items.filter((item) => {
    if (deferredProjectFilter !== "ALL" && item.project?.id !== deferredProjectFilter) {
      return false;
    }

    if (deferredProviderFilter !== "ALL" && item.job.provider !== deferredProviderFilter) {
      return false;
    }

    if (deferredVoicePackFilter !== "ALL" && item.job.voicePackId !== deferredVoicePackFilter) {
      return false;
    }

    if (deferredStatusFilter !== "ALL" && item.job.status !== deferredStatusFilter) {
      return false;
    }

    return true;
  });

  const selectedItem =
    visibleItems.find((item) => item.job.id === selectedJobId) ??
    items.find((item) => item.job.id === selectedJobId) ??
    visibleItems[0] ??
    items[0] ??
    null;

  const projectOptions = [...new Map(
    items
      .filter((item) => item.project)
      .map((item) => [item.project!.id, item.project!] as const)
  ).values()];
  const providerOptions = [...new Set(items.map((item) => item.job.provider))];
  const voicePackOptions = [
    ...new Set(
      items
        .map((item) => item.job.voicePackId)
        .filter((value): value is string => Boolean(value))
    )
  ];
  const statusOptions = [...new Set(items.map((item) => item.job.status))];

  useEffect(() => {
    if (!selectedJobId && items[0]) {
      setSelectedJobId(items[0].job.id);
      return;
    }

    if (selectedJobId && !items.some((item) => item.job.id === selectedJobId) && items[0]) {
      setSelectedJobId(items[0].job.id);
    }
  }, [items, selectedJobId]);

  async function refreshScene(sceneId: string) {
    const nextItems = await getSceneNarrationsRequest(sceneId);
    setItems((current) => mergeSceneNarrations(current, sceneId, nextItems));
    setSource("api");
    return nextItems;
  }

  async function handleUseNarration(item: GeneratedAudioGalleryItem) {
    if (!item.scene?.id || !item.asset?.id) {
      setStatusMessage("Apenas narrações com cena e asset podem ser aplicadas.");
      return;
    }

    try {
      await useSceneNarrationRequest(item.scene.id, item.asset.id);
      await refreshScene(item.scene.id);
      setStatusMessage(
        `Cena ${item.scene.order} agora usa a narracao ${item.asset.id}.`
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[1.95rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(126,247,216,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,158,102,0.14),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Generated Narration Review
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Galeria de WAVs gerados para revisar, ouvir e aplicar na timeline
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Acompanhe narracoes geradas localmente por cena, compare voice packs
              e promova o audio certo antes da etapa de render.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Jobs
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{items.length}</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Ativas
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {items.filter((item) => item.isCurrentSceneNarration).length}
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

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="rounded-[1.85rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Preview Desk
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {selectedItem?.scene?.title ??
                  selectedItem?.project?.title ??
                  "Selecione uma narracao"}
              </h2>
            </div>
            {selectedItem ? (
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
              Nenhuma narracao selecionada. Jobs sem asset ou com falha aparecem aqui
              para diagnostico.
            </div>
          )}

          {selectedItem ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {selectedItem.isCurrentSceneNarration ? (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                    em uso
                  </span>
                ) : null}
                <span className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-3 py-1 text-xs text-[#e2e8ff]">
                  {selectedItem.job.provider}
                </span>
                {selectedItem.job.voicePackId ? (
                  <span className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-3 py-1 text-xs text-[#fff0cb]">
                    {selectedItem.job.voicePackId}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Cena
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {selectedItem.scene
                      ? `${selectedItem.scene.order}. ${selectedItem.scene.title}`
                      : "Sem cena vinculada"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Duracao
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {formatDuration(selectedItem.job.durationSeconds)}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Texto de narracao
                </p>
                <p className="mt-3 text-sm leading-7 text-mist/72">
                  {selectedItem.job.text}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 text-sm text-mist/70">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Asset
                  </p>
                  <p className="mt-2 text-white">
                    {selectedItem.asset?.id ?? selectedItem.job.generatedAssetId ?? "n/a"}
                  </p>
                  <p className="mt-2 break-all text-xs">
                    {selectedItem.asset?.path ?? selectedItem.job.outputPath ?? "n/a"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 text-sm text-mist/70">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Metadata
                  </p>
                  <p className="mt-2 text-white">
                    sampleRate {selectedItem.job.sampleRate ?? "n/a"}
                  </p>
                  <p className="mt-2 text-xs">
                    criado {formatDate(selectedItem.job.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {selectedItem.scene?.id && selectedItem.asset?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleUseNarration(selectedItem);
                    }}
                    className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
                  >
                    Usar na cena
                  </button>
                ) : null}
                {selectedItem.project?.id ? (
                  <Link
                    href={`/projects/${selectedItem.project.id}`}
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/75 transition hover:border-signal/35 hover:text-white"
                  >
                    Abrir projeto
                  </Link>
                ) : null}
                {selectedItem.project?.id && selectedItem.scene?.id ? (
                  <Link
                    href={`/projects/${selectedItem.project.id}#scene-${selectedItem.scene.id}`}
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/75 transition hover:border-signal/35 hover:text-white"
                  >
                    Abrir cena
                  </Link>
                ) : null}
                {selectedItem.asset?.id ? (
                  <Link
                    href="/assets"
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/75 transition hover:border-signal/35 hover:text-white"
                  >
                    Abrir asset
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </article>

        <article className="rounded-[1.85rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Library Feed
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Narrações geradas por projeto, provider e voice pack
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/65">
              {visibleItems.length} visiveis
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Projeto</span>
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="ALL">Todos</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Provider</span>
              <select
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="ALL">Todos</option>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Voice pack</span>
              <select
                value={voicePackFilter}
                onChange={(event) => setVoicePackFilter(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="ALL">Todos</option>
                {voicePackOptions.map((voicePackId) => (
                  <option key={voicePackId} value={voicePackId}>
                    {voicePackId}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="ALL">Todos</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 grid gap-4">
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => (
                <button
                  key={item.job.id}
                  type="button"
                  onClick={() => setSelectedJobId(item.job.id)}
                  className={`rounded-[1.45rem] border p-4 text-left transition ${
                    selectedItem?.job.id === item.job.id
                      ? "border-signal/35 bg-signal/10"
                      : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      {item.scene
                        ? `${item.scene.order}. ${item.scene.title}`
                        : item.project?.title ?? item.job.id}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.isCurrentSceneNarration ? (
                        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-100">
                          em uso
                        </span>
                      ) : null}
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-mist/68">
                        {item.job.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-7 text-mist/68">
                    {item.job.text}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-mist/55">
                    <span>{item.job.provider}</span>
                    <span>{item.job.voicePackId ?? "sem pack"}</span>
                    <span>{formatDuration(item.job.durationSeconds)}</span>
                    <span>{formatDate(item.job.createdAt)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-mist/68">
                Nenhuma narracao encontrada com os filtros atuais.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
