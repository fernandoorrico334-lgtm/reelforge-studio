"use client";

import Link from "next/link";
import { useState } from "react";
import { createProductionFromScriptSnapshot } from "../lib/studio-api";
import type {
  CreateProductionFromScriptPayload,
  CreateProductionFromScriptResponse,
  DataSource,
  ProjectStatus,
  StudioAsset,
  StudioChannel
} from "../lib/studio-types";
import { projectStatuses } from "../lib/studio-types";

interface ProductionFlowStudioProps {
  assets: StudioAsset[];
  channels: StudioChannel[];
  initialSource: DataSource;
}

interface ProductionFormState {
  title: string;
  channelId: string;
  script: string;
  durationTarget: string;
  sceneDuration: string;
  format: string;
  status: ProjectStatus;
  autoAssignAssets: boolean;
}

function toNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createInitialForm(channels: StudioChannel[]): ProductionFormState {
  const firstChannel = channels[0];

  return {
    title: "",
    channelId: firstChannel?.id ?? "",
    script: "",
    durationTarget: firstChannel?.defaultDurationTarget?.toString() ?? "30",
    sceneDuration: firstChannel?.defaultSceneDuration?.toString() ?? "4",
    format: "9:16",
    status: "SCENE_PLANNING",
    autoAssignAssets: true
  };
}

function buildPayload(form: ProductionFormState): CreateProductionFromScriptPayload {
  return {
    title: form.title.trim(),
    channelId: form.channelId,
    script: form.script.trim(),
    durationTarget: toNullableNumber(form.durationTarget),
    sceneDuration: toNullableNumber(form.sceneDuration),
    format: form.format.trim() || "9:16",
    status: form.status,
    autoAssignAssets: form.autoAssignAssets
  };
}

function formatDuration(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}s`;
}

export function ProductionFlowStudio({
  assets,
  channels,
  initialSource
}: ProductionFlowStudioProps) {
  const [form, setForm] = useState<ProductionFormState>(createInitialForm(channels));
  const [result, setResult] = useState<CreateProductionFromScriptResponse | null>(
    null
  );
  const [source, setSource] = useState<DataSource>(initialSource);
  const [statusMessage, setStatusMessage] = useState(
    "Cole um roteiro bruto, escolha o canal e gere o primeiro corte de producao."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedChannel =
    channels.find((channel) => channel.id === form.channelId) ?? channels[0] ?? null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.channelId) {
      setStatusMessage("Selecione um canal antes de gerar a producao.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildPayload(form);
      const snapshot = await createProductionFromScriptSnapshot(
        payload,
        channels,
        assets
      );

      setResult(snapshot.item);
      setSource(snapshot.source);
      setStatusMessage(
        snapshot.source === "api"
          ? "Projeto criado na API local com cenas, presets e sugestoes."
          : "API indisponivel. Exibindo uma versao local de preview desta producao."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Production Flow
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Script para timeline
            </h2>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs ${
              source === "api"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-amber-400/30 bg-amber-400/10 text-amber-200"
            }`}
          >
            {source === "api" ? "API live" : "Local preview"}
          </div>
        </div>

        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/70">
          {statusMessage}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">
              Titulo do projeto
            </span>
            <input
              required
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Canal</span>
              <select
                required
                value={form.channelId}
                onChange={(event) => {
                  const channel = channels.find(
                    (entry) => entry.id === event.target.value
                  );

                  setForm((current) => ({
                    ...current,
                    channelId: event.target.value,
                    durationTarget:
                      channel?.defaultDurationTarget?.toString() ??
                      current.durationTarget,
                    sceneDuration:
                      channel?.defaultSceneDuration?.toString() ??
                      current.sceneDuration
                  }));
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
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
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as ProjectStatus
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {projectStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">Script bruto</span>
            <textarea
              required
              rows={10}
              value={form.script}
              onChange={(event) =>
                setForm((current) => ({ ...current, script: event.target.value }))
              }
              placeholder="Cole o roteiro completo aqui. O ReelForge vai quebrar em cenas, sugerir presets e amarrar assets da biblioteca."
              className="w-full rounded-[1.6rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Duracao alvo
              </span>
              <input
                value={form.durationTarget}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    durationTarget: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Duracao por cena
              </span>
              <input
                value={form.sceneDuration}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sceneDuration: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Formato</span>
              <input
                value={form.format}
                onChange={(event) =>
                  setForm((current) => ({ ...current, format: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/75">
            <input
              type="checkbox"
              checked={form.autoAssignAssets}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  autoAssignAssets: event.target.checked
                }))
              }
              className="accent-[#63ffe1]"
            />
            Auto-associar o melhor asset sugerido em cada cena
          </label>

          {selectedChannel ? (
            <div className="rounded-[1.45rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Defaults do canal
              </p>
              <p className="mt-3 text-sm leading-7 text-mist/70">
                {selectedChannel.defaultTemplate ?? "sem template"} |{" "}
                {selectedChannel.defaultRenderMode} /{" "}
                {selectedChannel.defaultRenderQuality} | preset{" "}
                {selectedChannel.defaultVisualPreset ?? "auto"} | caption{" "}
                {selectedChannel.defaultCaptionStyle ?? "auto"}
              </p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Gerando producao..." : "Criar producao"}
          </button>
        </form>
      </section>

      <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Production Preview
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {result ? result.project.title : "Aguardando geracao"}
            </h2>
          </div>
          {result && source === "api" ? (
            <Link
              href={`/projects/${result.project.id}`}
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/75 transition hover:border-signal/35 hover:text-white"
            >
              Abrir timeline
            </Link>
          ) : null}
        </div>

        {!result ? (
          <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 px-4 py-6 text-sm text-mist/68">
            O preview vai mostrar checklist de prontidao, cenas criadas, preset
            sugerido e o asset mais provavel para cada bloco narrativo.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                  Cenas
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {result.scenesCreated}
                </p>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                  Assets auto
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {result.autoAssignedAssets}
                </p>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                  Score
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {result.checklist.readinessScore}
                </p>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                  Render
                </p>
                <p className="mt-3 text-sm font-medium text-white">
                  {result.checklist.recommendedRenderMode} /{" "}
                  {result.checklist.recommendedRenderQuality}
                </p>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">
                Checklist de prontidao
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {result.checklist.checklist.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <p className="text-sm font-medium text-white">
                      {item.done ? "OK" : "Pendente"} - {item.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-mist/68">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {result.scenes.map((scene) => (
              <article
                key={scene.sceneId}
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                      Cena {scene.draft.order}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      {scene.draft.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-mist/70">
                      {scene.draft.captionText}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-signal/20 bg-signal/10 px-3 py-1 text-xs text-signal">
                      {scene.draft.suggestedRole}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      {scene.draft.suggestedPresetId}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      {formatDuration(scene.draft.duration)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                      Narracao
                    </p>
                    <p className="mt-2 text-sm leading-7 text-mist/70">
                      {scene.draft.narrationText}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                      Melhor asset sugerido
                    </p>
                    {scene.suggestions[0]?.asset ? (
                      <>
                        <p className="mt-2 text-sm font-medium text-white">
                          {scene.suggestions[0].asset.filename}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-mist/68">
                          score {scene.suggestions[0].score} |{" "}
                          {scene.suggestions[0].reasons.join(" | ")}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-mist/68">
                        Nenhum asset forte o suficiente apareceu na biblioteca.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}