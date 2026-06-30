"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { IntakeCandidatePreview } from "./intake-candidate-preview";
import {
  approveMediaCandidateRequest,
  createManualUrlCandidateRequest,
  createMediaCollectionRequest,
  getMediaCollectionCandidatesSnapshot,
  getMediaCollectionDetailSnapshot,
  getMediaCollectionsSnapshot,
  getMediaCollectorProvidersSnapshot,
  importApprovedMediaCollectionRequest,
  rejectMediaCandidateRequest,
  searchMediaCollectionRequest,
  updateMediaCandidateRequest
} from "../lib/studio-api";
import type {
  AssetCategory,
  CopyrightRisk,
  DataSource,
  EmotionTag,
  ImportApprovedResponse,
  IntakeCandidatePayload,
  IntakeMediaType,
  ManualUrlCandidatePayload,
  MediaCandidate,
  MediaCollection,
  MediaCollectionPayload,
  MediaCollectorProviderDescriptor,
  ResearchDossier,
  StudioChannel
} from "../lib/studio-types";
import {
  assetCategories,
  copyrightRisks,
  emotionTags,
  intakeMediaTypes
} from "../lib/studio-types";

interface MediaCollectorStudioProps {
  channels: StudioChannel[];
  dossiers: ResearchDossier[];
  initialProviders: MediaCollectorProviderDescriptor[];
  initialCollections: MediaCollection[];
  initialCandidates: MediaCandidate[];
  initialCollectionId: string | null;
  initialSource: DataSource;
}

interface CollectionFormState {
  name: string;
  provider: MediaCollectionPayload["provider"];
  query: string;
  mediaType: IntakeMediaType | "";
  channelId: string;
  dossierId: string;
  targetCount: string;
  notes: string;
}

interface ManualCandidateFormState {
  collectionId: string;
  name: string;
  channelId: string;
  dossierId: string;
  title: string;
  sourceUrl: string;
  mediaType: IntakeMediaType;
  category: AssetCategory | "";
  franchise: string;
  character: string;
  emotion: EmotionTag | "";
  tags: string;
  copyrightRisk: CopyrightRisk | "";
  recommendedUse: string;
  sourceAuthor: string;
  sourceLicense: string;
  sourceLicenseUrl: string;
  usageNotes: string;
}

interface CandidateDraft {
  mediaType: IntakeMediaType;
  category: AssetCategory | "";
  franchise: string;
  character: string;
  emotion: EmotionTag | "";
  tags: string;
  copyrightRisk: CopyrightRisk | "";
  recommendedUse: string;
  sourceAuthor: string;
  sourceLicense: string;
  sourceLicenseUrl: string;
  usageNotes: string;
}

function toNullableString(value: string) {
  return value.trim() || null;
}

function toNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value || value <= 0) {
    return "n/d";
  }

  const units = ["B", "KB", "MB", "GB"];
  let currentValue = value;
  let unitIndex = 0;

  while (currentValue >= 1024 && unitIndex < units.length - 1) {
    currentValue /= 1024;
    unitIndex += 1;
  }

  return `${currentValue.toFixed(currentValue >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Operacao falhou na API local.";
}

function createCollectionFormState(
  channels: StudioChannel[],
  dossiers: ResearchDossier[]
): CollectionFormState {
  return {
    name: "",
    provider: "wikimedia-commons",
    query: "",
    mediaType: "image",
    channelId: channels[0]?.id ?? "",
    dossierId: dossiers[0]?.id ?? "",
    targetCount: "8",
    notes: ""
  };
}

function createManualCandidateFormState(
  collections: MediaCollection[],
  channels: StudioChannel[],
  dossiers: ResearchDossier[]
): ManualCandidateFormState {
  return {
    collectionId: collections[0]?.id ?? "",
    name: "",
    channelId: channels[0]?.id ?? "",
    dossierId: dossiers[0]?.id ?? "",
    title: "",
    sourceUrl: "",
    mediaType: "image",
    category: "REFERENCE",
    franchise: "",
    character: "",
    emotion: "",
    tags: "",
    copyrightRisk: "",
    recommendedUse: "",
    sourceAuthor: "",
    sourceLicense: "",
    sourceLicenseUrl: "",
    usageNotes: ""
  };
}

function toDraft(candidate: MediaCandidate): CandidateDraft {
  return {
    mediaType: candidate.mediaType,
    category: candidate.category ?? candidate.suggestedCategory ?? "",
    franchise: candidate.franchise ?? "",
    character: candidate.character ?? candidate.suggestedCharacter ?? "",
    emotion: candidate.emotion ?? "",
    tags: (candidate.tags.length > 0 ? candidate.tags : candidate.suggestedTags).join(", "),
    copyrightRisk: candidate.copyrightRisk ?? "",
    recommendedUse: candidate.recommendedUse ?? "",
    sourceAuthor: candidate.sourceAuthor ?? "",
    sourceLicense: candidate.sourceLicense ?? "",
    sourceLicenseUrl: candidate.sourceLicenseUrl ?? "",
    usageNotes: candidate.usageNotes ?? ""
  };
}

function buildCandidatePayload(draft: CandidateDraft): IntakeCandidatePayload {
  return {
    mediaType: draft.mediaType,
    category: draft.category || null,
    franchise: toNullableString(draft.franchise),
    character: toNullableString(draft.character),
    emotion: draft.emotion || null,
    tags: parseCommaList(draft.tags),
    copyrightRisk: draft.copyrightRisk || null,
    recommendedUse: toNullableString(draft.recommendedUse),
    sourceAuthor: toNullableString(draft.sourceAuthor),
    sourceLicense: toNullableString(draft.sourceLicense),
    usageNotes: toNullableString(draft.usageNotes)
  };
}

export function MediaCollectorStudio({
  channels,
  dossiers,
  initialProviders,
  initialCollections,
  initialCandidates,
  initialCollectionId,
  initialSource
}: MediaCollectorStudioProps) {
  const [providers, setProviders] = useState(initialProviders);
  const [collections, setCollections] = useState(initialCollections);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    initialCollectionId ?? initialCollections[0]?.id ?? null
  );
  const [candidates, setCandidates] = useState(initialCandidates);
  const [source, setSource] = useState<DataSource>(initialSource);
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Media Collector conectado a API local."
      : "Media Collector em modo mock ate a API local ficar disponivel."
  );
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<ImportApprovedResponse | null>(null);
  const [collectionForm, setCollectionForm] = useState<CollectionFormState>(
    createCollectionFormState(channels, dossiers)
  );
  const [manualForm, setManualForm] = useState<ManualCandidateFormState>(
    createManualCandidateFormState(initialCollections, channels, dossiers)
  );
  const [candidateSearch, setCandidateSearch] = useState("");
  const deferredCandidateSearch = useDeferredValue(candidateSearch);
  const [drafts, setDrafts] = useState<Record<string, CandidateDraft>>(
    Object.fromEntries(initialCandidates.map((candidate) => [candidate.id, toDraft(candidate)]))
  );

  const selectedCollection =
    collections.find((collection) => collection.id === selectedCollectionId) ?? null;
  const visibleCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      if (!deferredCandidateSearch.trim()) {
        return true;
      }

      const haystack = [
        candidate.title,
        candidate.provider,
        candidate.sourceAuthor ?? "",
        candidate.sourceLicense ?? "",
        candidate.tags.join(" "),
        candidate.suggestedTags.join(" "),
        candidate.character ?? "",
        candidate.suggestedCharacter ?? ""
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredCandidateSearch.trim().toLowerCase());
    });
  }, [candidates, deferredCandidateSearch]);

  async function refreshState(nextCollectionId?: string | null, message?: string) {
    const collectionId = nextCollectionId ?? selectedCollectionId;
    const [providersSnapshot, collectionsSnapshot, candidatesSnapshot] =
      await Promise.all([
        getMediaCollectorProvidersSnapshot(),
        getMediaCollectionsSnapshot(),
        collectionId
          ? getMediaCollectionCandidatesSnapshot(collectionId)
          : Promise.resolve({ items: [], source: "mock" as const })
      ]);

    setProviders(providersSnapshot.items);
    setCollections(collectionsSnapshot.items);
    setCandidates(candidatesSnapshot.items);
    setSelectedCollectionId(collectionId);
    setManualForm((current) => ({
      ...current,
      collectionId: collectionId ?? ""
    }));
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(
        candidatesSnapshot.items.map((candidate) => [
          candidate.id,
          current[candidate.id] ?? toDraft(candidate)
        ])
      )
    }));
    setSource(
      providersSnapshot.source === "api" ||
        collectionsSnapshot.source === "api" ||
        candidatesSnapshot.source === "api"
        ? "api"
        : "mock"
    );

    if (message) {
      setStatusMessage(message);
    }
  }

  async function loadCollection(collectionId: string) {
    setBusyLabel("Carregando colecao...");

    try {
      const [detailSnapshot, candidatesSnapshot] = await Promise.all([
        getMediaCollectionDetailSnapshot(collectionId),
        getMediaCollectionCandidatesSnapshot(collectionId)
      ]);

      if (detailSnapshot.item?.collection) {
        setCollections((current) => {
          const next = current.filter((collection) => collection.id !== collectionId);
          return [detailSnapshot.item!.collection, ...next];
        });
      }

      setSelectedCollectionId(collectionId);
      setCandidates(candidatesSnapshot.items);
      setDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          candidatesSnapshot.items.map((candidate) => [
            candidate.id,
            current[candidate.id] ?? toDraft(candidate)
          ])
        )
      }));
      setSource(
        detailSnapshot.source === "api" || candidatesSnapshot.source === "api"
          ? "api"
          : "mock"
      );
      setStatusMessage("Colecao carregada.");
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleCreateCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyLabel("Criando colecao...");

    try {
      const created = await createMediaCollectionRequest({
        name: collectionForm.name.trim(),
        provider: collectionForm.provider,
        query: toNullableString(collectionForm.query),
        mediaType: collectionForm.mediaType || null,
        channelId: collectionForm.channelId || null,
        projectId: null,
        dossierId: collectionForm.dossierId || null,
        assetRequirementId: null,
        targetCount: toNullableNumber(collectionForm.targetCount),
        notes: toNullableString(collectionForm.notes)
      });
      setCollectionForm(createCollectionFormState(channels, dossiers));
      await refreshState(created.id, `Colecao '${created.name}' criada com sucesso.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleSearchCollection() {
    if (!selectedCollectionId) {
      setStatusMessage("Selecione uma colecao antes de buscar.");
      return;
    }

    setBusyLabel("Buscando candidatos...");

    try {
      const result = await searchMediaCollectionRequest(selectedCollectionId);
      await refreshState(
        selectedCollectionId,
        `Busca concluida: ${result.candidatesCreated} candidato(s) criado(s) e ${result.candidatesSkipped} ignorado(s).`
      );
      setLastImport(null);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleImportApproved() {
    if (!selectedCollectionId) {
      setStatusMessage("Selecione uma colecao antes de importar.");
      return;
    }

    setBusyLabel("Importando aprovados...");

    try {
      const result = await importApprovedMediaCollectionRequest(selectedCollectionId);
      setLastImport(result);
      await refreshState(
        selectedCollectionId,
        `Importacao concluida: ${result.importedCount} asset(s) criado(s) e ${result.failedCount} falha(s).`
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleCreateManualCandidate(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setBusyLabel("Criando candidato manual...");

    try {
      const created = await createManualUrlCandidateRequest({
        collectionId: manualForm.collectionId || null,
        name: toNullableString(manualForm.name),
        channelId: manualForm.channelId || null,
        projectId: null,
        dossierId: manualForm.dossierId || null,
        assetRequirementId: null,
        title: manualForm.title.trim(),
        sourceUrl: manualForm.sourceUrl.trim(),
        mediaType: manualForm.mediaType,
        category: manualForm.category || null,
        franchise: toNullableString(manualForm.franchise),
        character: toNullableString(manualForm.character),
        emotion: manualForm.emotion || null,
        tags: parseCommaList(manualForm.tags),
        copyrightRisk: manualForm.copyrightRisk || null,
        recommendedUse: toNullableString(manualForm.recommendedUse),
        sourceAuthor: toNullableString(manualForm.sourceAuthor),
        sourceLicense: toNullableString(manualForm.sourceLicense),
        sourceLicenseUrl: toNullableString(manualForm.sourceLicenseUrl),
        usageNotes: toNullableString(manualForm.usageNotes)
      } satisfies ManualUrlCandidatePayload);

      await refreshState(
        created.collectionId,
        `Candidato manual '${created.title}' criado.`
      );
      setManualForm(
        createManualCandidateFormState(
          collections,
          channels,
          dossiers
        )
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyLabel(null);
    }
  }

  function updateDraft(candidateId: string, patch: Partial<CandidateDraft>) {
    setDrafts((current) => ({
      ...current,
      [candidateId]: {
        ...(current[candidateId] ??
          toDraft(candidates.find((candidate) => candidate.id === candidateId)!)),
        ...patch
      }
    }));
  }

  async function handleSaveCandidate(candidate: MediaCandidate) {
    setBusyLabel("Salvando metadados...");

    try {
      const updated = await updateMediaCandidateRequest(
        candidate.id,
        buildCandidatePayload(drafts[candidate.id] ?? toDraft(candidate))
      );
      setCandidates((current) =>
        current.map((entry) => (entry.id === candidate.id ? updated : entry))
      );
      setStatusMessage(`Metadados salvos para ${candidate.title}.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleApprove(candidateId: string) {
    setBusyLabel("Aprovando candidato...");

    try {
      const updated = await approveMediaCandidateRequest(candidateId);
      setCandidates((current) =>
        current.map((entry) => (entry.id === candidateId ? updated : entry))
      );
      setStatusMessage("Candidato aprovado para importacao.");
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleReject(candidateId: string) {
    setBusyLabel("Rejeitando candidato...");

    try {
      const updated = await rejectMediaCandidateRequest(candidateId);
      setCandidates((current) =>
        current.map((entry) => (entry.id === candidateId ? updated : entry))
      );
      setStatusMessage("Candidato marcado como rejeitado.");
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyLabel(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,255,225,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,158,102,0.14),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Media Collector
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Busque, revise e importe midias autorizadas para a biblioteca local
            </h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-mist/72">
              O Media Collector abastece a biblioteca a partir de URLs diretas,
              conectores publicos e requisitos visuais do Research, sempre com
              aprovacao manual antes da importacao.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Providers
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {providers.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Collections
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {collections.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Fonte
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {source === "api" ? "API local ativa" : "Mock local"}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 rounded-[1.3rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/70">
          {busyLabel ?? statusMessage}
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Providers
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Conectores permitidos e status de configuracao
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {provider.name}
                    </p>
                    <p className="mt-1 text-xs text-mist/55">{provider.id}</p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      provider.configured
                        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                        : provider.requiresApiKey
                          ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
                          : "border-white/10 bg-white/[0.04] text-mist/70"
                    }`}
                  >
                    {provider.configured
                      ? "Configurado"
                      : provider.requiresApiKey
                        ? "API key pendente"
                        : "Pronto"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-mist/68">
                  {provider.description}
                </p>
                <p className="mt-3 text-xs text-mist/55">
                  Tipos: {provider.supportedMediaTypes.join(", ")}
                  {provider.experimental ? " • experimental" : ""}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Collections
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-white">
              Arsenal criativo em preparacao
            </h2>
            {selectedCollection ? (
              <button
                type="button"
                onClick={() => {
                  void handleSearchCollection();
                }}
                className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white"
              >
                Buscar nesta colecao
              </button>
            ) : null}
          </div>

          <div className="mt-6 space-y-3">
            {collections.length === 0 ? (
              <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-mist/68">
                Nenhuma colecao criada ainda. Use o formulario ao lado ou gere
                uma colecao a partir de Research/Projects.
              </div>
            ) : (
              collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => {
                    void loadCollection(collection.id);
                  }}
                  className={`w-full rounded-[1.3rem] border p-4 text-left transition ${
                    selectedCollectionId === collection.id
                      ? "border-signal/35 bg-signal/10"
                      : "border-white/10 bg-black/20 hover:border-white/20"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {collection.name}
                      </p>
                      <p className="mt-1 text-xs text-mist/55">
                        {collection.provider} • {collection.status}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      {collection.candidateCount} candidato(s)
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-mist/68">
                    Query: {collection.query ?? "n/d"} • Tipo: {collection.mediaType ?? "n/d"}
                  </p>
                </button>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Create Collection
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Nova busca assistida
          </h2>

          <form className="mt-6 space-y-4" onSubmit={handleCreateCollection}>
            <input
              required
              placeholder="Nome da colecao"
              value={collectionForm.name}
              onChange={(event) =>
                setCollectionForm((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={collectionForm.provider}
                onChange={(event) =>
                  setCollectionForm((current) => ({
                    ...current,
                    provider: event.target.value as CollectionFormState["provider"]
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              <select
                value={collectionForm.mediaType}
                onChange={(event) =>
                  setCollectionForm((current) => ({
                    ...current,
                    mediaType: event.target.value as IntakeMediaType | ""
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Tipo livre</option>
                {intakeMediaTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <input
              placeholder="Query principal"
              value={collectionForm.query}
              onChange={(event) =>
                setCollectionForm((current) => ({
                  ...current,
                  query: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={collectionForm.channelId}
                onChange={(event) =>
                  setCollectionForm((current) => ({
                    ...current,
                    channelId: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem canal</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
              <select
                value={collectionForm.dossierId}
                onChange={(event) =>
                  setCollectionForm((current) => ({
                    ...current,
                    dossierId: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem dossie</option>
                {dossiers.map((dossier) => (
                  <option key={dossier.id} value={dossier.id}>
                    {dossier.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-[0.4fr_1fr]">
              <input
                placeholder="Target"
                value={collectionForm.targetCount}
                onChange={(event) =>
                  setCollectionForm((current) => ({
                    ...current,
                    targetCount: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
              <input
                placeholder="Notas"
                value={collectionForm.notes}
                onChange={(event) =>
                  setCollectionForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink"
            >
              Criar colecao
            </button>
          </form>
        </article>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Manual URL Import
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Candidato manual a partir de URL direta ou caminho local
          </h2>

          <form className="mt-6 space-y-4" onSubmit={handleCreateManualCandidate}>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={manualForm.collectionId}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    collectionId: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Criar colecao manual automatica</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Nome da colecao (opcional)"
                value={manualForm.name}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={manualForm.channelId}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    channelId: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem canal</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
              <select
                value={manualForm.dossierId}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    dossierId: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem dossie</option>
                {dossiers.map((dossier) => (
                  <option key={dossier.id} value={dossier.id}>
                    {dossier.title}
                  </option>
                ))}
              </select>
            </div>
            <input
              required
              placeholder="Titulo do candidato"
              value={manualForm.title}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
            />
            <input
              required
              placeholder="URL direta ou caminho local (file://, C:\\..., storage/...)"
              value={manualForm.sourceUrl}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  sourceUrl: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={manualForm.mediaType}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    mediaType: event.target.value as IntakeMediaType
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {intakeMediaTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                value={manualForm.category}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    category: event.target.value as AssetCategory | ""
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem categoria</option>
                {assetCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                placeholder="Franchise"
                value={manualForm.franchise}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    franchise: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
              <input
                placeholder="Character"
                value={manualForm.character}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    character: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={manualForm.emotion}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    emotion: event.target.value as EmotionTag | ""
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem emocao</option>
                {emotionTags.map((emotion) => (
                  <option key={emotion} value={emotion}>
                    {emotion}
                  </option>
                ))}
              </select>
              <select
                value={manualForm.copyrightRisk}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    copyrightRisk: event.target.value as CopyrightRisk | ""
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem risco</option>
                {copyrightRisks.map((risk) => (
                  <option key={risk} value={risk}>
                    {risk}
                  </option>
                ))}
              </select>
            </div>
            <input
              placeholder="Tags separadas por virgula"
              value={manualForm.tags}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  tags: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                placeholder="Source author"
                value={manualForm.sourceAuthor}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    sourceAuthor: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
              <input
                placeholder="Source license"
                value={manualForm.sourceLicense}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    sourceLicense: event.target.value
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </div>
            <input
              placeholder="Source license URL"
              value={manualForm.sourceLicenseUrl}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  sourceLicenseUrl: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
            />
            <textarea
              rows={3}
              placeholder="Recommended use / usage notes"
              value={`${manualForm.recommendedUse}${manualForm.usageNotes ? `\n${manualForm.usageNotes}` : ""}`}
              onChange={(event) => {
                const [firstLine, ...rest] = event.target.value.split("\n");
                setManualForm((current) => ({
                  ...current,
                  recommendedUse: firstLine ?? "",
                  usageNotes: rest.join("\n")
                }));
              }}
              className="w-full rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink"
            >
              Criar candidato manual
            </button>
          </form>
        </article>
      </section>

      <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Review Queue
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {selectedCollection
                ? `${visibleCandidates.length} candidato(s) em ${selectedCollection.name}`
                : "Selecione uma colecao para revisar candidatos"}
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              value={candidateSearch}
              onChange={(event) => setCandidateSearch(event.target.value)}
              placeholder="Buscar por titulo, autor, tags"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none"
            />
            <button
              type="button"
              onClick={() => {
                void handleImportApproved();
              }}
              className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white"
            >
              Importar aprovados
            </button>
          </div>
        </div>

        {lastImport ? (
          <div className="mt-6 rounded-[1.4rem] border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            <p>
              Importados {lastImport.importedCount} item(ns), falhas {lastImport.failedCount}.
            </p>
            <Link href="/assets" className="mt-3 inline-flex text-sm font-medium text-white underline">
              Abrir biblioteca
            </Link>
            {lastImport.errors.length > 0 ? (
              <div className="mt-3 space-y-2 text-xs text-emerald-50/85">
                {lastImport.errors.map((error) => (
                  <p key={error.candidateId}>
                    {error.title}: {error.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          {selectedCollection && visibleCandidates.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-black/20 px-5 py-8 text-sm text-mist/68">
              Nenhum candidato visivel para esta colecao. Rode a busca, crie um
              candidato manual ou ajuste a pesquisa.
            </div>
          ) : null}

          {visibleCandidates.map((candidate) => {
            const draft = drafts[candidate.id] ?? toDraft(candidate);

            return (
              <article
                key={candidate.id}
                className="grid gap-5 overflow-hidden rounded-[1.7rem] border border-white/10 bg-black/20 p-5 xl:grid-cols-[0.72fr_1.28fr]"
              >
                <IntakeCandidatePreview candidate={candidate} source={source} />

                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-semibold text-white">
                        {candidate.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-mist/66">
                        {candidate.sourceUrl ?? candidate.originalPath ?? "Sem origem informada"}
                      </p>
                    </div>
                    <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-signal">
                      {candidate.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      provider {candidate.provider}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      media {candidate.mediaType}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      {formatBytes(candidate.fileSize)}
                    </span>
                  </div>

                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-mist/68">
                    <p>Tags sugeridas: {candidate.suggestedTags.join(", ") || "n/d"}</p>
                    <p className="mt-2">
                      Autor: {candidate.sourceAuthor ?? "n/d"} • Licenca: {candidate.sourceLicense ?? "n/d"}
                    </p>
                    <p className="mt-2">
                      Atualizado em {formatDate(candidate.updatedAt)}
                    </p>
                    {candidate.errorMessage ? (
                      <p className="mt-2 text-rose-200">
                        Erro: {candidate.errorMessage}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="block">
                      <span className="mb-2 block text-sm text-mist/65">Media type</span>
                      <select
                        value={draft.mediaType}
                        onChange={(event) =>
                          updateDraft(candidate.id, {
                            mediaType: event.target.value as IntakeMediaType
                          })
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                      >
                        {intakeMediaTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm text-mist/65">Category</span>
                      <select
                        value={draft.category}
                        onChange={(event) =>
                          updateDraft(candidate.id, {
                            category: event.target.value as AssetCategory | ""
                          })
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                      >
                        <option value="">Sem categoria</option>
                        {assetCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm text-mist/65">Emotion</span>
                      <select
                        value={draft.emotion}
                        onChange={(event) =>
                          updateDraft(candidate.id, {
                            emotion: event.target.value as EmotionTag | ""
                          })
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                      >
                        <option value="">Sem emocao</option>
                        {emotionTags.map((emotion) => (
                          <option key={emotion} value={emotion}>
                            {emotion}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      value={draft.franchise}
                      onChange={(event) =>
                        updateDraft(candidate.id, { franchise: event.target.value })
                      }
                      placeholder="Franchise"
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                    />
                    <input
                      value={draft.character}
                      onChange={(event) =>
                        updateDraft(candidate.id, { character: event.target.value })
                      }
                      placeholder="Character"
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                    />
                  </div>

                  <input
                    value={draft.tags}
                    onChange={(event) =>
                      updateDraft(candidate.id, { tags: event.target.value })
                    }
                    placeholder="Tags"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                  />

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <select
                      value={draft.copyrightRisk}
                      onChange={(event) =>
                        updateDraft(candidate.id, {
                          copyrightRisk: event.target.value as CopyrightRisk | ""
                        })
                      }
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                    >
                      <option value="">Sem risco</option>
                      {copyrightRisks.map((risk) => (
                        <option key={risk} value={risk}>
                          {risk}
                        </option>
                      ))}
                    </select>
                    <input
                      value={draft.recommendedUse}
                      onChange={(event) =>
                        updateDraft(candidate.id, {
                          recommendedUse: event.target.value
                        })
                      }
                      placeholder="Recommended use"
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none xl:col-span-3"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      value={draft.sourceAuthor}
                      onChange={(event) =>
                        updateDraft(candidate.id, {
                          sourceAuthor: event.target.value
                        })
                      }
                      placeholder="Source author"
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                    />
                    <input
                      value={draft.sourceLicense}
                      onChange={(event) =>
                        updateDraft(candidate.id, {
                          sourceLicense: event.target.value
                        })
                      }
                      placeholder="Source license"
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                    />
                  </div>

                  <textarea
                    rows={2}
                    value={draft.usageNotes}
                    onChange={(event) =>
                      updateDraft(candidate.id, {
                        usageNotes: event.target.value
                      })
                    }
                    placeholder="Usage notes"
                    className="w-full rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        void handleSaveCandidate(candidate);
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white"
                    >
                      Salvar metadados
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleApprove(candidate.id);
                      }}
                      className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink"
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleReject(candidate.id);
                      }}
                      className="rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm text-rose-200"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}