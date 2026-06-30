"use client";

import {
  generateSourceChecklist
} from "@reelforge/research-collector";
import { getCinematicPresetById } from "@reelforge/cinematic-engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addManualResearchSourceRequest,
  analyzeResearchDossierRequest,
  approveResearchSourceRequest,
  createProductionFromResearchDossierRequest,
  fetchResearchSourceUrlRequest,
  generateResearchSearchQueriesRequest,
  getResearchDossierDetailSnapshot,
  rejectResearchSourceRequest,
  searchWikipediaResearchSourcesRequest,
  searchWikidataResearchSourcesRequest,
  updateResearchDossierRequest
} from "../lib/studio-api";
import {
  buildLocalResearchAnalysis,
  buildLocalResearchSearchBundle
} from "../lib/research-local";
import type {
  DataSource,
  ManualResearchSourcePayload,
  ResearchAnalyzeResponse,
  ResearchConnectorSearchPayload,
  ResearchCreateProductionPayload,
  ResearchDossierDetail,
  ResearchDossierStatus,
  ResearchFetchUrlPayload,
  ResearchSearchBundleResponse,
  ResearchSource,
  ResearchSourceStatus,
  StudioChannel
} from "../lib/studio-types";
import {
  researchDossierStatuses,
  researchSourceStatuses,
  researchSourceTypes
} from "../lib/studio-types";

interface ResearchDossierStudioProps {
  channels: StudioChannel[];
  channelsSource: DataSource;
  initialDetail: ResearchDossierDetail;
  initialSource: DataSource;
}

interface DossierFormState {
  title: string;
  topic: string;
  channelId: string;
  niche: string;
  tone: string;
  targetDuration: string;
  status: ResearchDossierStatus;
  summary: string;
  narrativeAngle: string;
  editorialNotes: string;
  safetyNotes: string;
}

interface ManualSourceFormState {
  title: string;
  url: string;
  provider: string;
  sourceType: ManualResearchSourcePayload["sourceType"];
  author: string;
  publishedAt: string;
  citationText: string;
  excerpt: string;
  notes: string;
  reliabilityScore: string;
}

interface FetchUrlFormState {
  url: string;
  title: string;
  notes: string;
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "n/d";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatConfidenceLabel(value: string) {
  return value.replaceAll("_", " ");
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Operacao falhou na API local.";
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

function syncCounts(detail: ResearchDossierDetail): ResearchDossierDetail {
  const approvedSourceCount = detail.sources.filter(
    (source) => source.status === "approved" || source.status === "imported"
  ).length;

  return {
    ...detail,
    dossier: {
      ...detail.dossier,
      sourceCount: detail.sources.length,
      approvedSourceCount,
      factCount: detail.facts.length,
      timelineCount: detail.timeline.length,
      outlineSceneCount: detail.outline.length,
      updatedAt: new Date().toISOString()
    }
  };
}

function toDossierForm(detail: ResearchDossierDetail): DossierFormState {
  return {
    title: detail.dossier.title,
    topic: detail.dossier.topic,
    channelId: detail.dossier.channelId ?? "",
    niche: detail.dossier.niche ?? "",
    tone: detail.dossier.tone ?? "",
    targetDuration: detail.dossier.targetDuration?.toString() ?? "",
    status: detail.dossier.status,
    summary: detail.dossier.summary ?? "",
    narrativeAngle: detail.dossier.narrativeAngle ?? "",
    editorialNotes: detail.dossier.editorialNotes ?? "",
    safetyNotes: detail.dossier.safetyNotes ?? ""
  };
}

function createEmptyManualSourceForm(): ManualSourceFormState {
  return {
    title: "",
    url: "",
    provider: "manual",
    sourceType: "manual_note",
    author: "",
    publishedAt: "",
    citationText: "",
    excerpt: "",
    notes: "",
    reliabilityScore: ""
  };
}

function createEmptyFetchUrlForm(): FetchUrlFormState {
  return {
    url: "",
    title: "",
    notes: ""
  };
}

function buildManualSourcePayload(form: ManualSourceFormState): ManualResearchSourcePayload {
  return {
    title: form.title.trim(),
    url: toNullableString(form.url),
    provider: toNullableString(form.provider),
    sourceType: form.sourceType,
    author: toNullableString(form.author),
    publishedAt: toNullableString(form.publishedAt),
    citationText: toNullableString(form.citationText),
    excerpt: toNullableString(form.excerpt),
    notes: toNullableString(form.notes),
    reliabilityScore: toNullableNumber(form.reliabilityScore)
  };
}

function buildFetchUrlPayload(form: FetchUrlFormState): ResearchFetchUrlPayload {
  return {
    url: form.url.trim(),
    title: toNullableString(form.title),
    notes: toNullableString(form.notes)
  };
}

export function ResearchDossierStudio({
  channels,
  channelsSource,
  initialDetail,
  initialSource
}: ResearchDossierStudioProps) {
  const router = useRouter();
  const [detail, setDetail] = useState(syncCounts(initialDetail));
  const [source, setSource] = useState<DataSource>(initialSource);
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Dossie conectado a API local."
      : "Dossie em modo mock ate a API local ficar disponivel."
  );
  const [dossierForm, setDossierForm] = useState(toDossierForm(initialDetail));
  const [searchBundle, setSearchBundle] = useState<ResearchSearchBundleResponse>(
    buildLocalResearchSearchBundle(initialDetail.dossier)
  );
  const [lastAnalysis, setLastAnalysis] = useState<ResearchAnalyzeResponse | null>(null);
  const [manualSourceForm, setManualSourceForm] = useState(createEmptyManualSourceForm());
  const [fetchUrlForm, setFetchUrlForm] = useState(createEmptyFetchUrlForm());
  const [connectorQuery, setConnectorQuery] = useState(initialDetail.dossier.topic);
  const [connectorLimit, setConnectorLimit] = useState("5");
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  const checklist = searchBundle.checklist.length
    ? searchBundle.checklist
    : generateSourceChecklist(detail.dossier.topic, detail.dossier.niche);
  const candidateSources = detail.sources.filter((source) => source.status === "candidate");
  const approvedSources = detail.sources.filter(
    (source) => source.status === "approved" || source.status === "imported"
  );

  async function refreshDetail() {
    const snapshot = await getResearchDossierDetailSnapshot(detail.dossier.id);

    if (snapshot.item) {
      setDetail(syncCounts(snapshot.item));
      setSource(snapshot.source);
      setDossierForm(toDossierForm(snapshot.item));
    }
  }

  async function handleSaveOverview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyLabel("Salvando overview...");

    try {
      const updated = await updateResearchDossierRequest(detail.dossier.id, {
        channelId: dossierForm.channelId || null,
        title: dossierForm.title.trim(),
        topic: dossierForm.topic.trim(),
        niche: toNullableString(dossierForm.niche),
        tone: toNullableString(dossierForm.tone),
        targetDuration: toNullableNumber(dossierForm.targetDuration),
        status: dossierForm.status,
        summary: toNullableString(dossierForm.summary),
        narrativeAngle: toNullableString(dossierForm.narrativeAngle),
        editorialNotes: toNullableString(dossierForm.editorialNotes),
        safetyNotes: toNullableString(dossierForm.safetyNotes)
      });
      setDetail((current) =>
        syncCounts({
          ...current,
          dossier: {
            ...current.dossier,
            ...updated
          }
        })
      );
      setSearchBundle(buildLocalResearchSearchBundle(updated));
      setSource("api");
      setStatusMessage("Overview atualizado na API local.");
    } catch (error) {
      const message = extractErrorMessage(error);
      setDetail((current) =>
        syncCounts({
          ...current,
          dossier: {
            ...current.dossier,
            channelId: dossierForm.channelId || null,
            channel:
              channels.find((channel) => channel.id === dossierForm.channelId) ?? null,
            title: dossierForm.title.trim(),
            topic: dossierForm.topic.trim(),
            niche: toNullableString(dossierForm.niche),
            tone: toNullableString(dossierForm.tone),
            targetDuration: toNullableNumber(dossierForm.targetDuration),
            status: dossierForm.status,
            summary: toNullableString(dossierForm.summary),
            narrativeAngle: toNullableString(dossierForm.narrativeAngle),
            editorialNotes: toNullableString(dossierForm.editorialNotes),
            safetyNotes: toNullableString(dossierForm.safetyNotes),
            updatedAt: new Date().toISOString()
          }
        })
      );
      setSearchBundle(
        buildLocalResearchSearchBundle({
          ...detail.dossier,
          topic: dossierForm.topic.trim(),
          niche: toNullableString(dossierForm.niche),
          tone: toNullableString(dossierForm.tone),
          targetDuration: toNullableNumber(dossierForm.targetDuration)
        })
      );
      setSource("mock");
      setStatusMessage(`${message} Overview atualizada apenas nesta sessao.`);
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleGenerateQueries() {
    setBusyLabel("Gerando queries...");

    try {
      const response = await generateResearchSearchQueriesRequest(detail.dossier.id);
      setSearchBundle(response);
      setSource("api");
      setStatusMessage("Queries e links de busca assistida atualizados.");
    } catch (error) {
      setSearchBundle(buildLocalResearchSearchBundle(detail.dossier));
      setSource("mock");
      setStatusMessage(
        `${extractErrorMessage(error)} Queries geradas pelo fallback local.`
      );
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleAddManualSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyLabel("Adicionando fonte manual...");

    try {
      await addManualResearchSourceRequest(
        detail.dossier.id,
        buildManualSourcePayload(manualSourceForm)
      );
      await refreshDetail();
      setManualSourceForm(createEmptyManualSourceForm());
      setSource("api");
      setStatusMessage("Fonte manual adicionada a API local.");
    } catch (error) {
      const timestamp = new Date().toISOString();
      const payload = buildManualSourcePayload(manualSourceForm);
      setDetail((current) =>
        syncCounts({
          ...current,
          sources: [
            {
              id: createLocalId("research-source"),
              dossierId: current.dossier.id,
              title: payload.title,
              url: payload.url,
              provider: payload.provider ?? "manual",
              sourceType: payload.sourceType,
              author: payload.author,
              publishedAt: payload.publishedAt,
              accessedAt: timestamp,
              reliabilityScore: payload.reliabilityScore,
              citationText: payload.citationText,
              rawTextPath: null,
              excerpt: payload.excerpt,
              notes: payload.notes,
              status: "candidate",
              errorMessage: null,
              createdAt: timestamp,
              updatedAt: timestamp
            },
            ...current.sources
          ]
        })
      );
      setManualSourceForm(createEmptyManualSourceForm());
      setSource("mock");
      setStatusMessage(
        `${extractErrorMessage(error)} Fonte manual adicionada apenas nesta sessao.`
      );
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleFetchUrl(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyLabel("Importando URL publica...");

    try {
      await fetchResearchSourceUrlRequest(
        detail.dossier.id,
        buildFetchUrlPayload(fetchUrlForm)
      );
      await refreshDetail();
      setFetchUrlForm(createEmptyFetchUrlForm());
      setSource("api");
      setStatusMessage("URL publica processada pelo conector da API.");
    } catch (error) {
      setStatusMessage(
        `${extractErrorMessage(error)} O fetch real de URL exige a API local ativa.`
      );
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleConnectorSearch(mode: "wikipedia" | "wikidata") {
    setBusyLabel(mode === "wikipedia" ? "Buscando Wikipedia..." : "Buscando Wikidata...");

    const payload: ResearchConnectorSearchPayload = {
      query: toNullableString(connectorQuery),
      limit: toNullableNumber(connectorLimit) ?? 5
    };

    try {
      const result =
        mode === "wikipedia"
          ? await searchWikipediaResearchSourcesRequest(detail.dossier.id, payload)
          : await searchWikidataResearchSourcesRequest(detail.dossier.id, payload);

      await refreshDetail();
      setSource("api");
      setStatusMessage(
        result.warning
          ? result.warning
          : `${result.createdSources.length} fonte(s) candidata(s) adicionada(s).`
      );
    } catch (error) {
      setStatusMessage(
        `${extractErrorMessage(error)} Busca assistida indisponivel sem a API local.`
      );
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleSourceStatusChange(
    sourceId: string,
    nextStatus: ResearchSourceStatus
  ) {
    setBusyLabel(nextStatus === "approved" ? "Aprovando fonte..." : "Rejeitando fonte...");

    try {
      if (nextStatus === "approved") {
        await approveResearchSourceRequest(sourceId);
      } else {
        await rejectResearchSourceRequest(sourceId);
      }

      await refreshDetail();
      setSource("api");
      setStatusMessage(
        nextStatus === "approved"
          ? "Fonte aprovada na API local."
          : "Fonte rejeitada na API local."
      );
    } catch (error) {
      setDetail((current) =>
        syncCounts({
          ...current,
          sources: current.sources.map((source) =>
            source.id === sourceId
              ? {
                  ...source,
                  status: nextStatus,
                  updatedAt: new Date().toISOString()
                }
              : source
          )
        })
      );
      setSource("mock");
      setStatusMessage(
        `${extractErrorMessage(error)} Status atualizado apenas nesta sessao.`
      );
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleAnalyze() {
    setBusyLabel("Analisando dossie...");

    try {
      const response = await analyzeResearchDossierRequest(detail.dossier.id);
      setDetail(syncCounts(response.detail));
      setLastAnalysis(response);
      setSource("api");
      setDossierForm(toDossierForm(response.detail));
      setStatusMessage("Analise local concluida pela API.");
    } catch (error) {
      const localResult = buildLocalResearchAnalysis(detail);
      setDetail(syncCounts(localResult.detail));
      setLastAnalysis(localResult);
      setSource("mock");
      setDossierForm(toDossierForm(localResult.detail));
      setStatusMessage(
        `${extractErrorMessage(error)} Analise rodada no fallback local do navegador.`
      );
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleCreateProduction() {
    setBusyLabel("Criando producao...");

    try {
      const payload: ResearchCreateProductionPayload = {
        title: null,
        status: "SCENE_PLANNING",
        format: "9:16"
      };
      const result = await createProductionFromResearchDossierRequest(
        detail.dossier.id,
        payload
      );
      setStatusMessage(
        `Producao criada com ${result.scenesCreated} cena(s). Abrindo projeto...`
      );
      router.push(`/projects/${result.projectId}`);
      router.refresh();
    } catch (error) {
      setStatusMessage(
        `${extractErrorMessage(error)} Criacao de producao exige API local e um canal vinculado ao dossie.`
      );
    } finally {
      setBusyLabel(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Research Workspace
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              {detail.dossier.title}
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-mist/70">
              {detail.dossier.summary ??
                "Dossie em fase de coleta. Gere queries, traga fontes e rode a analise local para montar facts, timeline, hooks e outline."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/70">
              Fonte do dossie: {source === "api" ? "API local" : "Mock local"}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/70">
              Canais: {channelsSource === "api" ? "API local" : "Mock local"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Sources
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              {detail.sources.length}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Facts
            </p>
            <p className="mt-2 text-xl font-semibold text-white">{detail.facts.length}</p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Timeline
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              {detail.timeline.length}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Outline
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              {detail.outline.length}
            </p>
          </div>
        </div>

        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
          {busyLabel ?? statusMessage}
        </p>
      </div>

      <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">Overview</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              Tema, angulo narrativo e checklist de pesquisa
            </h3>
          </div>
          <button
            type="button"
            onClick={handleGenerateQueries}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80"
          >
            Gerar queries
          </button>
        </div>

        <form className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]" onSubmit={handleSaveOverview}>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Titulo</span>
              <input
                value={dossierForm.title}
                onChange={(event) =>
                  setDossierForm((current) => ({ ...current, title: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Tema</span>
              <textarea
                rows={3}
                value={dossierForm.topic}
                onChange={(event) =>
                  setDossierForm((current) => ({ ...current, topic: event.target.value }))
                }
                className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Canal</span>
                <select
                  value={dossierForm.channelId}
                  onChange={(event) =>
                    setDossierForm((current) => ({
                      ...current,
                      channelId: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="">Sem canal</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Status</span>
                <select
                  value={dossierForm.status}
                  onChange={(event) =>
                    setDossierForm((current) => ({
                      ...current,
                      status: event.target.value as ResearchDossierStatus
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {researchDossierStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Nicho</span>
                <input
                  value={dossierForm.niche}
                  onChange={(event) =>
                    setDossierForm((current) => ({ ...current, niche: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Tom</span>
                <input
                  value={dossierForm.tone}
                  onChange={(event) =>
                    setDossierForm((current) => ({ ...current, tone: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Duracao alvo</span>
              <input
                value={dossierForm.targetDuration}
                onChange={(event) =>
                  setDossierForm((current) => ({
                    ...current,
                    targetDuration: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Resumo</span>
              <textarea
                rows={4}
                value={dossierForm.summary}
                onChange={(event) =>
                  setDossierForm((current) => ({ ...current, summary: event.target.value }))
                }
                className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Angulo narrativo</span>
              <textarea
                rows={3}
                value={dossierForm.narrativeAngle}
                onChange={(event) =>
                  setDossierForm((current) => ({
                    ...current,
                    narrativeAngle: event.target.value
                  }))
                }
                className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink"
            >
              Salvar overview
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Search checklist
              </p>
              <div className="mt-4 space-y-3">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-mist/60">
                        {item.priority}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-mist/68">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Notes
              </p>
              <label className="mt-3 block">
                <span className="mb-2 block text-sm text-mist/65">Notas editoriais</span>
                <textarea
                  rows={4}
                  value={dossierForm.editorialNotes}
                  onChange={(event) =>
                    setDossierForm((current) => ({
                      ...current,
                      editorialNotes: event.target.value
                    }))
                  }
                  className="w-full rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm text-mist/65">Safety notes</span>
                <textarea
                  rows={4}
                  value={dossierForm.safetyNotes}
                  onChange={(event) =>
                    setDossierForm((current) => ({
                      ...current,
                      safetyNotes: event.target.value
                    }))
                  }
                  className="w-full rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
              </label>
            </div>
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                  Source Discovery
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Queries, links assistidos e conectores abertos
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleConnectorSearch("wikipedia");
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80"
                >
                  Buscar Wikipedia
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleConnectorSearch("wikidata");
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80"
                >
                  Buscar Wikidata
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Queries prontas
                </p>
                <div className="mt-4 space-y-3">
                  {searchBundle.queries.map((query) => (
                    <div
                      key={query.id}
                      className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3"
                    >
                      <p className="text-sm font-medium text-white">{query.query}</p>
                      <p className="mt-2 text-sm leading-6 text-mist/65">{query.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Links de busca manual
                </p>
                <div className="mt-4 space-y-3">
                  {searchBundle.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3 transition hover:border-signal/30"
                    >
                      <p className="text-sm font-medium text-white">{link.label}</p>
                      <p className="mt-2 text-sm leading-6 text-mist/65">{link.query}</p>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <form
                className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
                onSubmit={handleFetchUrl}
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Manual URL Fetch
                </p>
                <div className="mt-4 space-y-3">
                  <input
                    required
                    placeholder="https://exemplo.com/fonte-publica"
                    value={fetchUrlForm.url}
                    onChange={(event) =>
                      setFetchUrlForm((current) => ({ ...current, url: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                  />
                  <input
                    placeholder="Titulo opcional"
                    value={fetchUrlForm.title}
                    onChange={(event) =>
                      setFetchUrlForm((current) => ({
                        ...current,
                        title: event.target.value
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                  />
                  <textarea
                    rows={3}
                    placeholder="Notas sobre por que essa URL importa"
                    value={fetchUrlForm.notes}
                    onChange={(event) =>
                      setFetchUrlForm((current) => ({
                        ...current,
                        notes: event.target.value
                      }))
                    }
                    className="w-full rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Importar URL
                  </button>
                </div>
              </form>

              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Search connectors
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    value={connectorQuery}
                    onChange={(event) => setConnectorQuery(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                  />
                  <input
                    value={connectorLimit}
                    onChange={(event) => setConnectorLimit(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-mist/65">
                  Google segue apenas como busca assistida via links. Wikipedia e Wikidata
                  entram como conectores abertos quando a internet estiver disponivel.
                </p>
              </div>
            </div>

            <form className="mt-6 rounded-[1.4rem] border border-white/10 bg-black/20 p-4" onSubmit={handleAddManualSource}>
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Manual Source
              </p>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <input
                  required
                  placeholder="Titulo da fonte"
                  value={manualSourceForm.title}
                  onChange={(event) =>
                    setManualSourceForm((current) => ({
                      ...current,
                      title: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
                <input
                  placeholder="URL opcional"
                  value={manualSourceForm.url}
                  onChange={(event) =>
                    setManualSourceForm((current) => ({
                      ...current,
                      url: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
                <input
                  placeholder="Provider"
                  value={manualSourceForm.provider}
                  onChange={(event) =>
                    setManualSourceForm((current) => ({
                      ...current,
                      provider: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
                <select
                  value={manualSourceForm.sourceType}
                  onChange={(event) =>
                    setManualSourceForm((current) => ({
                      ...current,
                      sourceType: event.target.value as ManualSourceFormState["sourceType"]
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                >
                  {researchSourceTypes.map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {sourceType}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Autor"
                  value={manualSourceForm.author}
                  onChange={(event) =>
                    setManualSourceForm((current) => ({
                      ...current,
                      author: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
                <input
                  placeholder="Publicado em"
                  value={manualSourceForm.publishedAt}
                  onChange={(event) =>
                    setManualSourceForm((current) => ({
                      ...current,
                      publishedAt: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
                <input
                  placeholder="Citation text"
                  value={manualSourceForm.citationText}
                  onChange={(event) =>
                    setManualSourceForm((current) => ({
                      ...current,
                      citationText: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none xl:col-span-2"
                />
                <textarea
                  rows={3}
                  placeholder="Excerpt"
                  value={manualSourceForm.excerpt}
                  onChange={(event) =>
                    setManualSourceForm((current) => ({
                      ...current,
                      excerpt: event.target.value
                    }))
                  }
                  className="w-full rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
                <textarea
                  rows={3}
                  placeholder="Notas"
                  value={manualSourceForm.notes}
                  onChange={(event) =>
                    setManualSourceForm((current) => ({
                      ...current,
                      notes: event.target.value
                    }))
                  }
                  className="w-full rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
                <input
                  placeholder="Reliability 0-100"
                  value={manualSourceForm.reliabilityScore}
                  onChange={(event) =>
                    setManualSourceForm((current) => ({
                      ...current,
                      reliabilityScore: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none xl:col-span-2"
                />
              </div>
              <button
                type="submit"
                className="mt-4 rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink"
              >
                Adicionar fonte manual
              </button>
            </form>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                  Sources
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Fontes candidatas, aprovadas e importadas
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                className="rounded-full border border-signal/35 bg-signal/10 px-4 py-2 text-sm text-signal"
              >
                Rodar analyze
              </button>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Candidatas
                </p>
                <div className="mt-4 space-y-3">
                  {candidateSources.length === 0 ? (
                    <p className="text-sm text-mist/65">
                      Nenhuma fonte candidata no momento.
                    </p>
                  ) : (
                    candidateSources.map((sourceItem) => (
                      <div
                        key={sourceItem.id}
                        className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {sourceItem.title}
                            </p>
                            <p className="mt-1 text-xs text-mist/55">
                              {sourceItem.provider} - {sourceItem.sourceType}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void handleSourceStatusChange(sourceItem.id, "approved");
                              }}
                              className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100"
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void handleSourceStatusChange(sourceItem.id, "rejected");
                              }}
                              className="rounded-full border border-[#ff8b8b]/20 bg-[#ff8b8b]/10 px-3 py-1 text-xs text-[#ffd4d4]"
                            >
                              Rejeitar
                            </button>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-mist/68">
                          {sourceItem.excerpt ?? sourceItem.notes ?? "Sem excerpt disponivel."}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Aprovadas e importadas
                </p>
                <div className="mt-4 space-y-3">
                  {approvedSources.length === 0 ? (
                    <p className="text-sm text-mist/65">
                      Aprove ou importe fontes para destravar a analise.
                    </p>
                  ) : (
                    approvedSources.map((sourceItem) => (
                      <div
                        key={sourceItem.id}
                        className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {sourceItem.title}
                            </p>
                            <p className="mt-1 text-xs text-mist/55">
                              {sourceItem.provider} - score {sourceItem.reliabilityScore ?? "n/d"}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/70">
                            {formatStatusLabel(sourceItem.status)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-mist/68">
                          {sourceItem.excerpt ?? sourceItem.notes ?? "Sem excerpt disponivel."}
                        </p>
                        {sourceItem.url ? (
                          <a
                            href={sourceItem.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex text-xs text-signal"
                          >
                            Abrir fonte
                          </a>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-mist/55">Facts</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Fatos e pontos de incerteza
                </h3>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/70">
                {detail.facts.length} facts
              </span>
            </div>
            <div className="mt-6 space-y-3">
              {detail.facts.length === 0 ? (
                <p className="text-sm text-mist/65">
                  Rode a analise local para preencher esta camada.
                </p>
              ) : (
                detail.facts.map((fact) => (
                  <div
                    key={fact.id}
                    className="rounded-[1.15rem] border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-mist/60">
                        {fact.factType}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-mist/60">
                        {formatConfidenceLabel(fact.confidence)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white">{fact.claim}</p>
                    <p className="mt-2 text-xs text-mist/55">
                      Fonte: {fact.source?.title ?? "sem fonte"} {fact.dateValue ? `- ${fact.dateValue}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">Timeline</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              Eventos ordenados
            </h3>
            <div className="mt-6 space-y-3">
              {detail.timeline.length === 0 ? (
                <p className="text-sm text-mist/65">Nenhum evento cronologico ainda.</p>
              ) : (
                detail.timeline.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-[1.15rem] border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">
                        {event.order ?? "-"} - {event.title}
                      </p>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-mist/60">
                        {formatConfidenceLabel(event.confidence)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-mist/68">{event.description}</p>
                    <p className="mt-2 text-xs text-mist/55">
                      {event.dateValue ?? "sem data"} {event.location ? `- ${event.location}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">Hooks</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              Ganchos sugeridos
            </h3>
            <div className="mt-6 space-y-3">
              {detail.hooks.length === 0 ? (
                <p className="text-sm text-mist/65">Sem hooks locais ainda.</p>
              ) : (
                detail.hooks.map((hook) => (
                  <div
                    key={hook.id}
                    className="rounded-[1.15rem] border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{hook.text}</p>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-mist/60">
                        {hook.hookType} {hook.strengthScore ? `- ${hook.strengthScore}` : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-mist/68">
                      {hook.notes ?? "Sem notas adicionais."}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">Outline</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Estrutura sugerida para cenas
              </h3>
            </div>
            {lastAnalysis ? (
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/70">
                {lastAnalysis.outlineSceneCount} cena(s) sugerida(s)
              </span>
            ) : null}
          </div>
          <div className="mt-6 space-y-4">
            {detail.outline.length === 0 ? (
              <p className="text-sm text-mist/65">
                O outline aparece apos a analise local das fontes aprovadas.
              </p>
            ) : (
              detail.outline.map((scene) => {
                const preset = scene.visualPreset
                  ? getCinematicPresetById(scene.visualPreset)
                  : null;

                return (
                  <div
                    key={scene.id}
                    className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {scene.order}. {scene.title}
                        </p>
                        <p className="mt-1 text-xs text-mist/55">
                          {scene.role} {scene.estimatedDuration ? `- ${scene.estimatedDuration}s` : ""}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-mist/60">
                        {scene.emotion ?? "sem emocao"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-mist/70">
                      {scene.narrationDraft}
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                          Caption draft
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {scene.captionDraft ?? "Sem legenda sugerida."}
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                          Preset visual
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {preset?.name ?? scene.visualPreset ?? "sem preset"}
                        </p>
                        <p className="mt-2 text-xs text-mist/60">
                          {preset?.description ?? "A definir na timeline de producao."}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Asset Requirements
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              Cobertura visual necessaria
            </h3>
            <div className="mt-6 space-y-3">
              {detail.assetRequirements.length === 0 ? (
                <p className="text-sm text-mist/65">
                  Os requirements surgem junto com o outline.
                </p>
              ) : (
                detail.assetRequirements.map((requirement) => (
                  <div
                    key={requirement.id}
                    className="rounded-[1.15rem] border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">
                        {requirement.description}
                      </p>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-mist/60">
                        {requirement.mediaType}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-mist/68">
                      Tags sugeridas: {requirement.suggestedTags.join(", ") || "n/d"}
                    </p>
                    <p className="mt-2 text-xs text-mist/55">
                      Prioridade {requirement.priority ?? "n/d"} {requirement.sceneRole ? `- ${requirement.sceneRole}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Create Production
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              Transformar outline em projeto editavel
            </h3>
            <p className="mt-4 text-sm leading-7 text-mist/68">
              O create-production converte o outline em `VideoProject`, cria as
              cenas iniciais, reaproveita o canal quando existir e abre a timeline
              para refinamento manual.
            </p>
            <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-black/20 p-4 text-sm text-mist/68">
              Canal: {detail.dossier.channel?.name ?? "sem canal"} <br />
              Sources aprovadas: {approvedSources.length} <br />
              Facts: {detail.facts.length} <br />
              Outline: {detail.outline.length}
            </div>
            <button
              type="button"
              onClick={handleCreateProduction}
              className="mt-4 rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink"
            >
              Criar producao a partir deste dossie
            </button>
            {detail.dossier.channelId ? (
              <p className="mt-3 text-xs text-mist/55">
                Se a API local estiver ativa, o redirecionamento vai abrir o projeto em{" "}
                <Link href="/projects" className="text-signal">
                  /projects
                </Link>
                .
              </p>
            ) : (
              <p className="mt-3 text-xs text-amber-100">
                Vincule um canal ao dossie antes de criar a producao.
              </p>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
