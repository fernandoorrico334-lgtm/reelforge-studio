"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createResearchDossierRequest,
  deleteResearchDossierRequest,
  updateResearchDossierRequest
} from "../lib/studio-api";
import type {
  DataSource,
  ResearchDossier,
  ResearchDossierPayload,
  ResearchDossierStatus,
  StudioChannel
} from "../lib/studio-types";
import { researchDossierStatuses } from "../lib/studio-types";

interface ResearchDossiersManagerProps {
  initialChannels: StudioChannel[];
  initialDossiers: ResearchDossier[];
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
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatStatusLabel(value: string) {
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

function createEmptyForm(channels: StudioChannel[]): DossierFormState {
  return {
    title: "",
    topic: "",
    channelId: channels[0]?.id ?? "",
    niche: "",
    tone: "",
    targetDuration: "45",
    status: "draft"
  };
}

function buildPayload(form: DossierFormState): ResearchDossierPayload {
  return {
    channelId: form.channelId || null,
    title: form.title.trim(),
    topic: form.topic.trim(),
    niche: toNullableString(form.niche),
    tone: toNullableString(form.tone),
    targetDuration: toNullableNumber(form.targetDuration),
    status: form.status,
    summary: null,
    narrativeAngle: null,
    editorialNotes: null,
    safetyNotes: null
  };
}

function sortDossiers(dossiers: ResearchDossier[]) {
  return [...dossiers].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

function createLocalDossier(
  payload: ResearchDossierPayload,
  channels: StudioChannel[]
) {
  const timestamp = new Date().toISOString();
  const channel =
    channels.find((entry) => entry.id === payload.channelId) ?? null;

  return {
    id: createLocalId("dossier"),
    channelId: payload.channelId,
    channel,
    title: payload.title,
    topic: payload.topic,
    niche: payload.niche,
    tone: payload.tone,
    targetDuration: payload.targetDuration,
    status: payload.status,
    summary: payload.summary ?? null,
    narrativeAngle: payload.narrativeAngle ?? null,
    editorialNotes: payload.editorialNotes ?? null,
    safetyNotes: payload.safetyNotes ?? null,
    sourceCount: 0,
    approvedSourceCount: 0,
    factCount: 0,
    timelineCount: 0,
    outlineSceneCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  } satisfies ResearchDossier;
}

function toFormState(dossier: ResearchDossier): DossierFormState {
  return {
    title: dossier.title,
    topic: dossier.topic,
    channelId: dossier.channelId ?? "",
    niche: dossier.niche ?? "",
    tone: dossier.tone ?? "",
    targetDuration: dossier.targetDuration?.toString() ?? "",
    status: dossier.status
  };
}

export function ResearchDossiersManager({
  initialChannels,
  initialDossiers,
  initialSource
}: ResearchDossiersManagerProps) {
  const [dossiers, setDossiers] = useState(sortDossiers(initialDossiers));
  const [source, setSource] = useState<DataSource>(initialSource);
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Research Collector conectado a API local."
      : "Research Collector em modo mock ate a API voltar."
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localOnlyIds, setLocalOnlyIds] = useState<string[]>([]);
  const [form, setForm] = useState(createEmptyForm(initialChannels));

  const readyForReview = dossiers.filter(
    (dossier) => dossier.status === "ready_for_review"
  ).length;
  const totalSources = dossiers.reduce(
    (total, dossier) => total + dossier.sourceCount,
    0
  );
  const totalFacts = dossiers.reduce(
    (total, dossier) => total + dossier.factCount,
    0
  );

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm(initialChannels));
  }

  function startEditing(dossier: ResearchDossier) {
    setEditingId(dossier.id);
    setForm(toFormState(dossier));
    setStatusMessage(`Editando ${dossier.title}.`);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildPayload(form);

    try {
      if (editingId) {
        const updated = await updateResearchDossierRequest(editingId, payload);
        setDossiers((current) =>
          sortDossiers(
            current.map((dossier) => (dossier.id === updated.id ? updated : dossier))
          )
        );
        setStatusMessage("Dossie atualizado na API local.");
      } else {
        const created = await createResearchDossierRequest(payload);
        setDossiers((current) => sortDossiers([created, ...current]));
        setStatusMessage("Dossie criado na API local.");
      }

      setSource("api");
      resetForm();
      return;
    } catch (error) {
      const message = extractErrorMessage(error);

      if (editingId) {
        setDossiers((current) =>
          sortDossiers(
            current.map((dossier) =>
              dossier.id === editingId
                ? {
                    ...dossier,
                    ...payload,
                    channel:
                      initialChannels.find((entry) => entry.id === payload.channelId) ?? null,
                    updatedAt: new Date().toISOString()
                  }
                : dossier
            )
          )
        );
        setStatusMessage(`${message} Dossie atualizado apenas nesta sessao.`);
      } else {
        const localDossier = createLocalDossier(payload, initialChannels);
        setDossiers((current) => sortDossiers([localDossier, ...current]));
        setLocalOnlyIds((current) => [...current, localDossier.id]);
        setStatusMessage(`${message} Dossie criado apenas nesta sessao.`);
      }

      setSource("mock");
      resetForm();
    }
  }

  async function handleDelete(dossier: ResearchDossier) {
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(`Remover o dossie "${dossier.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteResearchDossierRequest(dossier.id);
      setStatusMessage("Dossie removido da API local.");
      setSource("api");
    } catch (error) {
      setStatusMessage(
        `${extractErrorMessage(error)} Dossie removido apenas desta sessao.`
      );
      setSource("mock");
    }

    setDossiers((current) => current.filter((entry) => entry.id !== dossier.id));
    setLocalOnlyIds((current) => current.filter((id) => id !== dossier.id));

    if (editingId === dossier.id) {
      resetForm();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
      <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Dossier Rack
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {dossiers.length} dossie(s) em circulacao
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

        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
          {statusMessage}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
              Fontes totais
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{totalSources}</p>
          </div>
          <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
              Facts mapeados
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{totalFacts}</p>
          </div>
          <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
              Ready for review
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{readyForReview}</p>
          </div>
        </div>

        {localOnlyIds.length > 0 ? (
          <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Dossies criados em fallback local ficam disponiveis apenas nesta sessao
            e nao abrem a area detalhada ate a API local voltar.
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          {dossiers.map((dossier) => {
            const localOnly = localOnlyIds.includes(dossier.id);

            return (
              <article
                key={dossier.id}
                className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-signal">
                        {formatStatusLabel(dossier.status)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                        {dossier.channel?.name ?? "Sem canal"}
                      </span>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-white">
                      {dossier.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-mist/68">
                      Tema: {dossier.topic}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-mist/62">
                      {dossier.summary ?? "Resumo narrativo ainda nao gerado."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {localOnly ? (
                      <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                        Sessao local
                      </span>
                    ) : (
                      <Link
                        href={`/research/${dossier.id}`}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/78 transition hover:border-signal/35 hover:text-white"
                      >
                        Abrir dossie
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => startEditing(dossier)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/78"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(dossier)}
                      className="rounded-full border border-[#ff8b8b]/20 bg-[#ff8b8b]/10 px-4 py-2 text-sm text-[#ffd4d4]"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                      Sources
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {dossier.sourceCount}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                      Timeline
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {dossier.timelineCount}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                      Outline
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {dossier.outlineSceneCount}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                      Atualizado
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {formatDate(dossier.updatedAt)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Dossier Setup
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {editingId ? "Editar dossie" : "Criar novo dossie"}
            </h2>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/78"
            >
              Cancelar
            </button>
          ) : null}
        </div>

        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
          Defina o tema, ligue o dossie a um canal quando fizer sentido e prepare a
          base narrativa antes de buscar fontes e gerar outline.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">Titulo</span>
            <input
              required
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">Tema</span>
            <textarea
              required
              rows={3}
              value={form.topic}
              onChange={(event) =>
                setForm((current) => ({ ...current, topic: event.target.value }))
              }
              className="w-full rounded-[1.6rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Canal</span>
              <select
                value={form.channelId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, channelId: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem canal</option>
                {initialChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
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
                value={form.niche}
                onChange={(event) =>
                  setForm((current) => ({ ...current, niche: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Tom</span>
              <input
                value={form.tone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tone: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">
              Duracao alvo (s)
            </span>
            <input
              value={form.targetDuration}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  targetDuration: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <button
            type="submit"
            className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
          >
            {editingId ? "Salvar dossie" : "Criar dossie"}
          </button>
        </form>
      </section>
    </div>
  );
}

