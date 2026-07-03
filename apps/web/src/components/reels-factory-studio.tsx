"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  createReelsFactoryBatchRequest,
  createReelsFactoryProjectRequest,
  previewReelsFactorySnapshot
} from "../lib/studio-api";
import type {
  DataSource,
  EditingReferencePreset,
  ReelsFactoryBatchPayload,
  ReelsFactoryBatchResponse,
  ReelsFactoryCreateProjectResponse,
  ReelsFactoryPreviewPayload,
  ReelsFactoryPreviewResponse,
  ReelsFactoryTemplate,
  StudioChannel
} from "../lib/studio-types";

interface ReelsFactoryStudioProps {
  channels: StudioChannel[];
  channelsSource: DataSource;
  templates: ReelsFactoryTemplate[];
  templatesSource: DataSource;
  editingReferencePresets: EditingReferencePreset[];
  editingReferencePresetsSource: DataSource;
}

interface FactoryFormState {
  channelId: string;
  templateId: string;
  editingReferencePresetId: string;
  topic: string;
  subject: string;
  angle: string;
  tone: string;
  durationSeconds: string;
  language: string;
  includeMicroclip: boolean;
}

function formatSourceLabel(value: DataSource) {
  return value === "api" ? "API local ativa" : "Mock local";
}

function formatActionLabel(value: string) {
  return value.replaceAll("_", " ");
}

function parseBatchLines(value: string) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawTopic = "", rawSubject = "", rawAngle = ""] = line
        .split("|")
        .map((part) => part.trim());
      const topic = rawTopic.trim();

      return {
        topic,
        subject: rawSubject || topic,
        angle: rawAngle || "o detalhe que mais muda o jogo"
      };
    })
    .filter((item) => item.topic.length > 0);
}

function toPayload(form: FactoryFormState): ReelsFactoryPreviewPayload {
  return {
    channelId: form.channelId || null,
    templateId: form.templateId as ReelsFactoryPreviewPayload["templateId"],
    editingReferencePresetId: form.editingReferencePresetId || null,
    topic: form.topic.trim(),
    subject: form.subject.trim(),
    angle: form.angle.trim(),
    tone: form.tone.trim() || "hype",
    durationSeconds: Number(form.durationSeconds),
    language: form.language.trim() || "pt-BR",
    includeMicroclip: form.includeMicroclip
  };
}

export function ReelsFactoryStudio({
  channels,
  channelsSource,
  templates,
  templatesSource,
  editingReferencePresets,
  editingReferencePresetsSource
}: ReelsFactoryStudioProps) {
  const initialTemplate = templates[0]?.id ?? "player_threat_analysis";
  const initialChannel = channels[0]?.id ?? "";
  const initialEditingReferencePresetId = editingReferencePresets[0]?.id ?? "";
  const [form, setForm] = useState<FactoryFormState>({
    channelId: initialChannel,
    templateId: initialTemplate,
    editingReferencePresetId: initialEditingReferencePresetId,
    topic: "Haaland contra o Brasil",
    subject: "Haaland",
    angle: "por que ele pode ser o maior perigo",
    tone: "hype",
    durationSeconds: "35",
    language: "pt-BR",
    includeMicroclip: true
  });
  const [preview, setPreview] = useState<ReelsFactoryPreviewResponse | null>(null);
  const [previewSource, setPreviewSource] = useState<DataSource>("mock");
  const [createdProject, setCreatedProject] =
    useState<ReelsFactoryCreateProjectResponse | null>(null);
  const [batchInput, setBatchInput] = useState(
    "Haaland contra o Brasil|Haaland|o perigo fisico\nMessi decide de novo|Messi|por que ele ainda muda jogos"
  );
  const [batchResult, setBatchResult] = useState<ReelsFactoryBatchResponse | null>(
    null
  );
  const [statusMessage, setStatusMessage] = useState(
    "Escolha um template, gere a previa e transforme o tema em projeto editorial autoral."
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === form.templateId) ?? null,
    [form.templateId, templates]
  );
  const selectedEditingReferencePreset = useMemo(
    () =>
      editingReferencePresets.find(
        (preset) => preset.id === form.editingReferencePresetId
      ) ?? null,
    [editingReferencePresets, form.editingReferencePresetId]
  );

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const snapshot = await previewReelsFactorySnapshot(toPayload(form));
      setPreview(snapshot.item);
      setPreviewSource(snapshot.source);
      setStatusMessage(
        `Previa pronta com ${snapshot.item.scenes.length} cenas. Fonte ${formatSourceLabel(snapshot.source)}.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha ao gerar a previa da Reels Factory."
      );
    }
  }

  async function handleCreateProject() {
    try {
      const result = await createReelsFactoryProjectRequest(toPayload(form));
      setCreatedProject(result);
      setStatusMessage(
        `Projeto ${result.title} criado com ${result.scenesCreated} cenas.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha ao criar o projeto da Reels Factory."
      );
    }
  }

  async function handleCreateBatch() {
    const items = parseBatchLines(batchInput);

    if (items.length === 0) {
      setStatusMessage("Informe pelo menos um tema no lote.");
      return;
    }

    try {
      const payload: ReelsFactoryBatchPayload = {
        channelId: form.channelId || null,
        templateId: form.templateId as ReelsFactoryBatchPayload["templateId"],
        editingReferencePresetId: form.editingReferencePresetId || null,
        tone: form.tone.trim() || "hype",
        durationSeconds: Number(form.durationSeconds),
        language: form.language.trim() || "pt-BR",
        includeMicroclip: form.includeMicroclip,
        items
      };
      const result = await createReelsFactoryBatchRequest(payload);
      setBatchResult(result);
      setStatusMessage(
        `Lote concluido com ${result.totalCreated} projetos criados e ${result.failures.length} falhas.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha ao criar o lote da Reels Factory."
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Batch Editorial Reels Factory
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              Roteiros editoriais em lote para Reels, Shorts e cobertura de Copa
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-mist/68">
              Gere a estrutura narrativa, o texto de narracao, prompts visuais e
              proximo passo operacional sem depender de IA externa. Tudo parte de
              tema digitado, assets autorizados e render local.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Templates
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {templates.length}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Canais
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {channels.length}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Feed
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                templates {formatSourceLabel(templatesSource)} / canais{" "}
                {formatSourceLabel(channelsSource)} / presets{" "}
                {formatSourceLabel(editingReferencePresetsSource)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <form
          onSubmit={(event) => {
            void handlePreview(event);
          }}
          className="rounded-[1.9rem] border border-[#7be0ff]/18 bg-[#7be0ff]/7 p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Factory Form
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Setup do lote editorial
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
              {selectedTemplate?.recommendedTone ?? "tone livre"}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Canal</span>
              <select
                value={form.channelId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, channelId: event.target.value }))
                }
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
              <span className="mb-2 block text-sm text-mist/65">Template</span>
              <select
                value={form.templateId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, templateId: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-mist/65">
                Editing Reference Preset
              </span>
              <select
                value={form.editingReferencePresetId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    editingReferencePresetId: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem preset editorial</option>
                {editingReferencePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} - {preset.useCase}
                  </option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-mist/65">Topic</span>
              <input
                value={form.topic}
                onChange={(event) =>
                  setForm((current) => ({ ...current, topic: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Subject</span>
              <input
                value={form.subject}
                onChange={(event) =>
                  setForm((current) => ({ ...current, subject: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Angle</span>
              <input
                value={form.angle}
                onChange={(event) =>
                  setForm((current) => ({ ...current, angle: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Tone</span>
              <input
                value={form.tone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tone: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Duration</span>
              <input
                value={form.durationSeconds}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    durationSeconds: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Language</span>
              <input
                value={form.language}
                onChange={(event) =>
                  setForm((current) => ({ ...current, language: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/72">
              <input
                type="checkbox"
                checked={form.includeMicroclip}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    includeMicroclip: event.target.checked
                  }))
                }
                className="h-4 w-4"
              />
              Incluir slot opcional de microclip editorial
            </label>
          </div>

          {selectedTemplate ? (
            <div className="mt-5 rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Template preview
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {selectedTemplate.name}
              </p>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                {selectedTemplate.description}
              </p>
              <p className="mt-3 text-xs leading-6 text-mist/60">
                workflow {selectedTemplate.recommendedWorkflowPackId} / voice{" "}
                {selectedTemplate.recommendedVoicePackId} / mastering{" "}
                {selectedTemplate.recommendedAudioMasteringPresetId}
              </p>
              {selectedEditingReferencePreset ? (
                <div className="mt-4 rounded-[1rem] border border-[#f4c67a]/20 bg-[#f4c67a]/10 p-3 text-xs leading-6 text-[#ffefc8]">
                  preset {selectedEditingReferencePreset.name} / pace{" "}
                  {selectedEditingReferencePreset.cutPace?.toFixed(1) ?? "n/d"}s / zoom{" "}
                  {selectedEditingReferencePreset.zoomStyle} / flash{" "}
                  {selectedEditingReferencePreset.flashStyle} / microclip{" "}
                  {selectedEditingReferencePreset.microclipPlacement}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-4 py-2 text-xs text-[#d8f8ff]"
            >
              Gerar previa
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCreateProject();
              }}
              className="rounded-full border border-signal/25 bg-signal/12 px-4 py-2 text-xs text-signal"
            >
              Criar projeto
            </button>
          </div>
        </form>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Preview Board
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Previa narrativa pronta para virar projeto
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/72">
              {preview ? formatSourceLabel(previewSource) : "Aguardando previa"}
            </span>
          </div>

          {preview ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Titulo
                </p>
                <h4 className="mt-2 text-xl font-semibold text-white">{preview.title}</h4>
                <p className="mt-3 text-sm leading-7 text-mist/68">{preview.shortDescription}</p>
                <p className="mt-3 text-sm font-medium text-white">Hook: {preview.hook}</p>
                {preview.editingStyleSummary ? (
                  <p className="mt-3 text-xs leading-6 text-mist/60">
                    preset {preview.editingStyleSummary.presetName} / narration{" "}
                    {preview.editingStyleSummary.narrationStyle} / music{" "}
                    {preview.editingStyleSummary.musicStyle} / CTA{" "}
                    {preview.editingStyleSummary.ctaStyle}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4">
                {preview.scenes.map((scene) => (
                  <div
                    key={`${scene.orderIndex}-${scene.role}`}
                    className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                          Cena {scene.orderIndex} - {scene.role}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">{scene.title}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/72">
                        {scene.durationSeconds.toFixed(1)}s
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                          Narração
                        </p>
                        <p className="mt-2 text-sm leading-7 text-mist/68">
                          {scene.narrationText}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                          Texto na tela
                        </p>
                        <p className="mt-2 text-sm leading-7 text-mist/68">
                          {scene.onScreenText}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                          Prompt visual
                        </p>
                        <p className="mt-2 text-sm leading-7 text-mist/68">
                          {scene.visualPrompt}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-mist/68">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                        workflow {scene.suggestedWorkflowPackId}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                        voice {scene.suggestedVoicePackId}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                        mastering {scene.suggestedAudioMasteringPresetId}
                      </span>
                      {scene.microclipSlot ? (
                        <span className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-3 py-1 text-[#fff0cb]">
                          microclip {scene.microclipSlot.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Hashtags
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white">
                    {preview.hashtags.join(" ")}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Caption
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white">{preview.caption}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Checklist
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-white">
                    {preview.checklist.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[1.2rem] border border-dashed border-white/10 bg-black/20 p-6 text-sm text-mist/55">
              Gere a previa para ver titulo, hook, cenas, prompts visuais, caption e hashtags.
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[1.9rem] border border-[#ffcf70]/20 bg-[#ffcf70]/8 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Batch Mode
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Um tema por linha, vários projetos de uma vez
              </h3>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                Use o formato <span className="font-medium text-white">topic|subject|angle</span>.
                Se enviar só o tema, a Factory reaproveita o próprio texto como subject.
              </p>
            </div>
          </div>

          <textarea
            rows={9}
            value={batchInput}
            onChange={(event) => setBatchInput(event.target.value)}
            className="mt-6 w-full rounded-[1.6rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
          />

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void handleCreateBatch();
              }}
              className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-4 py-2 text-xs text-[#fff0cb]"
            >
              Criar lote
            </button>
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Production Output
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Próximas ações operacionais
              </h3>
            </div>
            <p className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/72">
              {statusMessage}
            </p>
          </div>

          {createdProject ? (
            <div className="mt-6 rounded-[1.25rem] border border-emerald-400/20 bg-emerald-400/10 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/70">
                Projeto criado
              </p>
              <h4 className="mt-2 text-xl font-semibold text-white">
                {createdProject.title}
              </h4>
              <p className="mt-2 text-sm text-mist/72">
                {createdProject.scenesCreated} cenas prontas para narracao, visual e render.
              </p>
              {createdProject.project.editingStyleSummary ? (
                <p className="mt-2 text-xs text-mist/60">
                  preset {createdProject.project.editingStyleSummary.presetName} / cut pace{" "}
                  {createdProject.project.editingStyleSummary.cutPace?.toFixed(1) ?? "n/d"}s / microclip{" "}
                  {createdProject.project.editingStyleSummary.microclipPlacement}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {createdProject.recommendedNextActions.map((action) => (
                  <span
                    key={action}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white"
                  >
                    {formatActionLabel(action)}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/projects/${createdProject.projectId}`}
                  className="rounded-full border border-signal/30 bg-signal/12 px-4 py-2 text-xs text-signal"
                >
                  Abrir projeto
                </Link>
                <Link
                  href={`/projects/${createdProject.projectId}`}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-mist/80"
                >
                  Gerar narração
                </Link>
                <Link
                  href={`/projects/${createdProject.projectId}`}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-mist/80"
                >
                  Gerar imagens
                </Link>
                <Link
                  href={`/projects/${createdProject.projectId}`}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-mist/80"
                >
                  Anexar microclip
                </Link>
                <Link
                  href={`/projects/${createdProject.projectId}`}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-mist/80"
                >
                  Renderizar
                </Link>
              </div>
            </div>
          ) : null}

          {batchResult ? (
            <div className="mt-6 grid gap-4">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Lote criado
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {batchResult.totalCreated} projeto(s) criado(s)
                </p>
              </div>

              {batchResult.projects.map((item) => (
                <div
                  key={item.projectId}
                  className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-2 text-xs leading-6 text-mist/60">
                        tema {item.topic} / {item.scenesCreated} cenas
                      </p>
                    </div>
                    <Link
                      href={`/projects/${item.projectId}`}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-mist/80"
                    >
                      Abrir projeto
                    </Link>
                  </div>
                </div>
              ))}

              {batchResult.failures.length > 0 ? (
                <div className="rounded-[1.2rem] border border-rose-400/20 bg-rose-400/10 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-rose-100/70">
                    Falhas
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-white">
                    {batchResult.failures.map((failure) => (
                      <p key={`${failure.topic}-${failure.error}`}>
                        {failure.topic}: {failure.error}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
