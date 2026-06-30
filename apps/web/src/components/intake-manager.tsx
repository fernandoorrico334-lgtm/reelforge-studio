"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { IntakeCandidatePreview } from "./intake-candidate-preview";
import {
  approveIntakeCandidateRequest,
  getIntakeCandidatesSnapshot,
  getIntakeCollectionsSnapshot,
  getIntakeFoldersSnapshot,
  importApprovedCandidatesRequest,
  rejectIntakeCandidateRequest,
  scanInboxRequest,
  updateIntakeCandidateRequest
} from "../lib/studio-api";
import type {
  AssetCategory,
  CopyrightRisk,
  DataSource,
  EmotionTag,
  ImportApprovedResponse,
  IntakeFoldersResponse,
  IntakeMediaType,
  MediaCandidate,
  MediaCandidateStatus,
  MediaCollection
} from "../lib/studio-types";
import {
  assetCategories,
  copyrightRisks,
  emotionTags,
  intakeMediaTypes,
  mediaCandidateStatuses
} from "../lib/studio-types";

interface IntakeManagerProps {
  initialFolders: IntakeFoldersResponse;
  initialCollections: MediaCollection[];
  initialCandidates: MediaCandidate[];
  initialSource: DataSource;
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
  usageNotes: string;
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
    usageNotes: candidate.usageNotes ?? ""
  };
}

function normalizeTags(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Operacao falhou na API local.";
}

export function IntakeManager({
  initialFolders,
  initialCollections,
  initialCandidates,
  initialSource
}: IntakeManagerProps) {
  const [folders, setFolders] = useState(initialFolders);
  const [collections, setCollections] = useState(initialCollections);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [source, setSource] = useState<DataSource>(initialSource);
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Inbox conectado a API local."
      : "Inbox em modo mock ate a API ficar disponivel."
  );
  const [lastImport, setLastImport] = useState<ImportApprovedResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<MediaCandidateStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<IntakeMediaType | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | "ALL">("ALL");
  const [characterFilter, setCharacterFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const deferredCharacterFilter = useDeferredValue(characterFilter);
  const deferredProjectFilter = useDeferredValue(projectFilter);
  const [drafts, setDrafts] = useState<Record<string, CandidateDraft>>(
    Object.fromEntries(initialCandidates.map((candidate) => [candidate.id, toDraft(candidate)]))
  );

  const summary = useMemo(() => {
    return {
      pending: candidates.filter((candidate) => candidate.status === "pending").length,
      approved: candidates.filter((candidate) => candidate.status === "approved").length,
      imported: candidates.filter((candidate) => candidate.status === "imported").length,
      failed: candidates.filter((candidate) => candidate.status === "failed").length
    };
  }, [candidates]);

  const visibleCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      if (statusFilter !== "ALL" && candidate.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== "ALL" && candidate.mediaType !== typeFilter) {
        return false;
      }

      if (categoryFilter !== "ALL" && candidate.category !== categoryFilter) {
        return false;
      }

      if (
        deferredCharacterFilter.trim() &&
        ![
          candidate.character ?? "",
          candidate.suggestedCharacter ?? ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(deferredCharacterFilter.trim().toLowerCase())
      ) {
        return false;
      }

      if (
        deferredProjectFilter.trim() &&
        !(candidate.suggestedProject ?? "")
          .toLowerCase()
          .includes(deferredProjectFilter.trim().toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [
    candidates,
    categoryFilter,
    deferredCharacterFilter,
    deferredProjectFilter,
    statusFilter,
    typeFilter
  ]);

  async function refreshSnapshots(message?: string) {
    const [nextFolders, nextCollections, nextCandidates] = await Promise.all([
      getIntakeFoldersSnapshot(),
      getIntakeCollectionsSnapshot(),
      getIntakeCandidatesSnapshot()
    ]);

    setFolders(nextFolders.item);
    setCollections(nextCollections.items);
    setCandidates(nextCandidates.items);
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(
        nextCandidates.items.map((candidate) => [
          candidate.id,
          current[candidate.id] ?? toDraft(candidate)
        ])
      )
    }));
    setSource(
      nextCandidates.source === "api" || nextCollections.source === "api"
        ? "api"
        : "mock"
    );

    if (message) {
      setStatusMessage(message);
    }
  }

  async function handleScan() {
    try {
      const result = await scanInboxRequest();
      await refreshSnapshots(
        `Scan concluido: ${result.candidatesCreated} candidatos criados e ${result.candidatesSkipped} ignorados.`
      );
      setLastImport(null);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleImportApproved() {
    try {
      const result = await importApprovedCandidatesRequest();
      setLastImport(result);
      await refreshSnapshots(
        `Importacao concluida: ${result.importedCount} asset(s) criados e ${result.failedCount} falha(s).`
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  function updateDraft(candidateId: string, nextDraft: Partial<CandidateDraft>) {
    setDrafts((current) => ({
      ...current,
      [candidateId]: {
        ...(current[candidateId] ?? toDraft(candidates.find((candidate) => candidate.id === candidateId)!)),
        ...nextDraft
      }
    }));
  }

  async function handleSaveCandidate(candidate: MediaCandidate) {
    const draft = drafts[candidate.id] ?? toDraft(candidate);

    try {
      const updated = await updateIntakeCandidateRequest(candidate.id, {
        mediaType: draft.mediaType,
        category: draft.category || null,
        franchise: draft.franchise.trim() || null,
        character: draft.character.trim() || null,
        emotion: draft.emotion || null,
        tags: normalizeTags(draft.tags),
        copyrightRisk: draft.copyrightRisk || null,
        recommendedUse: draft.recommendedUse.trim() || null,
        sourceAuthor: draft.sourceAuthor.trim() || null,
        sourceLicense: draft.sourceLicense.trim() || null,
        usageNotes: draft.usageNotes.trim() || null
      });

      setCandidates((current) =>
        current.map((entry) => (entry.id === candidate.id ? updated : entry))
      );
      setStatusMessage(`Metadata salva para ${candidate.title}.`);
      await refreshSnapshots();
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleApprove(candidateId: string) {
    try {
      const updated = await approveIntakeCandidateRequest(candidateId);
      setCandidates((current) =>
        current.map((candidate) => (candidate.id === candidateId ? updated : candidate))
      );
      setStatusMessage("Candidato aprovado para importacao.");
      await refreshSnapshots();
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleReject(candidateId: string) {
    try {
      const updated = await rejectIntakeCandidateRequest(candidateId);
      setCandidates((current) =>
        current.map((candidate) => (candidate.id === candidateId ? updated : candidate))
      );
      setStatusMessage("Candidato marcado como rejeitado.");
      await refreshSnapshots();
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Pastas de Entrada
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Inbox local pronto para revisao manual
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void handleScan()}
              className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
            >
              Escanear Inbox
            </button>
          </div>

          <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/70">
            {statusMessage}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {folders.folders.map((folder) => (
              <div
                key={folder.id}
                className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                  {folder.label}
                </p>
                <p className="mt-3 text-sm leading-6 text-mist/70">
                  {folder.relativePath}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Intake Ops
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Revisao, aprovacao e importacao em lote
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void handleImportApproved()}
              className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:border-signal/35 hover:text-signal"
            >
              Importar aprovados
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Pending</p>
              <p className="mt-2 text-3xl font-semibold text-white">{summary.pending}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Approved</p>
              <p className="mt-2 text-3xl font-semibold text-white">{summary.approved}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Imported</p>
              <p className="mt-2 text-3xl font-semibold text-white">{summary.imported}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-mist/45">Failed</p>
              <p className="mt-2 text-3xl font-semibold text-white">{summary.failed}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {collections.length === 0 ? (
              <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-mist/68">
                Nenhuma colecao registrada ainda. O primeiro scan cria ou reusa a colecao manual-intake automaticamente.
              </div>
            ) : (
              collections.slice(0, 4).map((collection) => (
                <div
                  key={collection.id}
                  className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{collection.name}</p>
                      <p className="mt-1 text-xs text-mist/55">
                        {collection.provider} â€¢ {collection.status}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      {collection.candidateCount} candidato(s)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {lastImport ? (
            <div className="mt-6 rounded-[1.4rem] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              <p>
                Importados {lastImport.importedCount} item(ns), falhas {lastImport.failedCount}.
              </p>
              <Link href="/assets" className="mt-3 inline-flex text-sm font-medium text-white underline">
                Abrir biblioteca importada
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
        </article>
      </section>

      <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Candidates
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {visibleCandidates.length} candidato(s) visiveis
            </h2>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs ${
              source === "api"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-amber-400/30 bg-amber-400/10 text-amber-200"
            }`}
          >
            {source === "api" ? "API live" : "Mock mode"}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as MediaCandidateStatus | "ALL")
            }
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">Todos os status</option>
            {mediaCandidateStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as IntakeMediaType | "ALL")
            }
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">Todos os tipos</option>
            {intakeMediaTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value as AssetCategory | "ALL")
            }
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">Todas as categorias</option>
            {assetCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            value={characterFilter}
            onChange={(event) => setCharacterFilter(event.target.value)}
            placeholder="Filtrar personagem"
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/50"
          />
          <input
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            placeholder="Filtrar projeto sugerido"
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/50"
          />
        </div>

        <div className="mt-6 space-y-5">
          {visibleCandidates.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-black/20 px-5 py-8 text-sm text-mist/68">
              Nenhum candidato visivel com os filtros atuais. Rode o scan ou ajuste os filtros.
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
                      <h3 className="text-2xl font-semibold text-white">{candidate.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-mist/66">
                        {candidate.originalPath ?? "Sem caminho original"}
                      </p>
                    </div>
                    <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-signal">
                      {candidate.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      media {candidate.mediaType}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      sugerido {candidate.suggestedCategory ?? "n/d"}
                    </span>
                    {candidate.suggestedCharacter ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                        char {candidate.suggestedCharacter}
                      </span>
                    ) : null}
                    {candidate.suggestedProject ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                        projeto {candidate.suggestedProject}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      {formatBytes(candidate.fileSize)}
                    </span>
                  </div>

                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-mist/68">
                    <p>Tags sugeridas: {candidate.suggestedTags.join(", ") || "n/d"}</p>
                    <p className="mt-2">Detectado: {candidate.detectedType ?? "n/d"} â€¢ Atualizado em {formatDate(candidate.updatedAt)}</p>
                    {candidate.errorMessage ? (
                      <p className="mt-2 text-rose-200">Erro: {candidate.errorMessage}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    <label className="block">
                      <span className="mb-2 block text-sm text-mist/65">Franchise</span>
                      <input
                        value={draft.franchise}
                        onChange={(event) =>
                          updateDraft(candidate.id, { franchise: event.target.value })
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm text-mist/65">Character</span>
                      <input
                        value={draft.character}
                        onChange={(event) =>
                          updateDraft(candidate.id, { character: event.target.value })
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm text-mist/65">Tags</span>
                    <input
                      value={draft.tags}
                      onChange={(event) =>
                        updateDraft(candidate.id, { tags: event.target.value })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                      <span className="mb-2 block text-sm text-mist/65">Risk</span>
                      <select
                        value={draft.copyrightRisk}
                        onChange={(event) =>
                          updateDraft(candidate.id, {
                            copyrightRisk: event.target.value as CopyrightRisk | ""
                          })
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                      >
                        <option value="">Sem risco</option>
                        {copyrightRisks.map((risk) => (
                          <option key={risk} value={risk}>
                            {risk}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block xl:col-span-3">
                      <span className="mb-2 block text-sm text-mist/65">Recommended use</span>
                      <input
                        value={draft.recommendedUse}
                        onChange={(event) =>
                          updateDraft(candidate.id, { recommendedUse: event.target.value })
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm text-mist/65">Source author</span>
                      <input
                        value={draft.sourceAuthor}
                        onChange={(event) =>
                          updateDraft(candidate.id, { sourceAuthor: event.target.value })
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm text-mist/65">Source license</span>
                      <input
                        value={draft.sourceLicense}
                        onChange={(event) =>
                          updateDraft(candidate.id, { sourceLicense: event.target.value })
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm text-mist/65">Usage notes</span>
                    <textarea
                      rows={2}
                      value={draft.usageNotes}
                      onChange={(event) =>
                        updateDraft(candidate.id, { usageNotes: event.target.value })
                      }
                      className="w-full rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSaveCandidate(candidate)}
                      className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white transition hover:border-signal/35 hover:text-signal"
                    >
                      Salvar metadados
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApprove(candidate.id)}
                      className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReject(candidate.id)}
                      className="rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:border-rose-300/40"
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

