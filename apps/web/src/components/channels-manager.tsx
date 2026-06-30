"use client";

import { getAudioMoodPresets } from "@reelforge/audio-engine";
import { getCaptionStyles } from "@reelforge/caption-engine";
import { listCinematicPresets } from "@reelforge/cinematic-engine";
import { getTemplates } from "@reelforge/templates";
import { useState } from "react";
import {
  createChannelRequest,
  deleteChannelRequest,
  updateChannelRequest
} from "../lib/studio-api";
import type {
  AssetCategory,
  ChannelPayload,
  DataSource,
  StudioAsset,
  StudioChannel
} from "../lib/studio-types";
import {
  assetCategories,
  renderModes,
  renderQualities
} from "../lib/studio-types";

interface ChannelsManagerProps {
  initialAssets: StudioAsset[];
  initialChannels: StudioChannel[];
  initialSource: DataSource;
}

interface ChannelFormState {
  name: string;
  niche: string;
  language: string;
  visualStyle: string;
  narrativeTone: string;
  defaultTemplate: string;
  defaultRenderMode: StudioChannel["defaultRenderMode"];
  defaultRenderQuality: StudioChannel["defaultRenderQuality"];
  defaultAudioMood: string;
  defaultCaptionStyle: string;
  defaultVisualPreset: string;
  defaultMusicAssetId: string;
  defaultVoiceoverAssetId: string;
  defaultDurationTarget: string;
  defaultSceneDuration: string;
  preferredAssetCategories: AssetCategory[];
  preferredAssetTags: string;
}

const templateCatalog = getTemplates();
const audioMoodCatalog = getAudioMoodPresets();
const captionStyleCatalog = getCaptionStyles();
const cinematicPresetCatalog = listCinematicPresets();

const emptyForm: ChannelFormState = {
  name: "",
  niche: "",
  language: "pt-BR",
  visualStyle: "",
  narrativeTone: "",
  defaultTemplate: "",
  defaultRenderMode: "cinematic_v2",
  defaultRenderQuality: "standard",
  defaultAudioMood: "",
  defaultCaptionStyle: "",
  defaultVisualPreset: "",
  defaultMusicAssetId: "",
  defaultVoiceoverAssetId: "",
  defaultDurationTarget: "30",
  defaultSceneDuration: "4",
  preferredAssetCategories: [],
  preferredAssetTags: ""
};

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

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPayload(form: ChannelFormState): ChannelPayload {
  return {
    name: form.name.trim(),
    niche: form.niche.trim(),
    language: form.language.trim(),
    visualStyle: form.visualStyle.trim() || null,
    narrativeTone: form.narrativeTone.trim() || null,
    defaultTemplate: (form.defaultTemplate || null) as ChannelPayload["defaultTemplate"],
    defaultRenderMode: form.defaultRenderMode,
    defaultRenderQuality: form.defaultRenderQuality,
    defaultAudioMood: (form.defaultAudioMood || null) as ChannelPayload["defaultAudioMood"],
    defaultCaptionStyle:
      (form.defaultCaptionStyle || null) as ChannelPayload["defaultCaptionStyle"],
    defaultVisualPreset:
      (form.defaultVisualPreset || null) as ChannelPayload["defaultVisualPreset"],
    defaultMusicAssetId: form.defaultMusicAssetId || null,
    defaultVoiceoverAssetId: form.defaultVoiceoverAssetId || null,
    defaultDurationTarget: toNullableNumber(form.defaultDurationTarget),
    defaultSceneDuration: Math.max(toNullableNumber(form.defaultSceneDuration) ?? 4, 0.5),
    preferredAssetCategories: form.preferredAssetCategories,
    preferredAssetTags: parseCommaList(form.preferredAssetTags)
  };
}

function toFormState(channel: StudioChannel): ChannelFormState {
  return {
    name: channel.name,
    niche: channel.niche,
    language: channel.language,
    visualStyle: channel.visualStyle ?? "",
    narrativeTone: channel.narrativeTone ?? "",
    defaultTemplate: channel.defaultTemplate ?? "",
    defaultRenderMode: channel.defaultRenderMode,
    defaultRenderQuality: channel.defaultRenderQuality,
    defaultAudioMood: channel.defaultAudioMood ?? "",
    defaultCaptionStyle: channel.defaultCaptionStyle ?? "",
    defaultVisualPreset: channel.defaultVisualPreset ?? "",
    defaultMusicAssetId: channel.defaultMusicAssetId ?? "",
    defaultVoiceoverAssetId: channel.defaultVoiceoverAssetId ?? "",
    defaultDurationTarget: channel.defaultDurationTarget?.toString() ?? "",
    defaultSceneDuration: channel.defaultSceneDuration.toString(),
    preferredAssetCategories: [...channel.preferredAssetCategories],
    preferredAssetTags: channel.preferredAssetTags.join(", ")
  };
}

function applyPayload(
  current: StudioChannel,
  payload: ChannelPayload,
  timestamp: string
): StudioChannel {
  return {
    ...current,
    ...payload,
    updatedAt: timestamp
  };
}

function toggleCategory(
  categories: AssetCategory[],
  category: AssetCategory
) {
  return categories.includes(category)
    ? categories.filter((entry) => entry !== category)
    : [...categories, category];
}

export function ChannelsManager({
  initialAssets,
  initialChannels,
  initialSource
}: ChannelsManagerProps) {
  const [channels, setChannels] = useState(initialChannels);
  const [source, setSource] = useState<DataSource>(initialSource);
  const [form, setForm] = useState<ChannelFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Conectado a API local."
      : "Rodando em modo mock ate a API ficar disponivel."
  );

  const orderedChannels = [...channels].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
  const musicAssets = initialAssets.filter(
    (asset) => asset.type === "MUSIC" || asset.type === "AUDIO"
  );
  const voiceoverAssets = initialAssets.filter((asset) => asset.type === "AUDIO");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = toPayload(form);
    const now = new Date().toISOString();

    try {
      if (editingId) {
        const updated = await updateChannelRequest(editingId, payload);
        setChannels((current) =>
          current.map((channel) =>
            channel.id === editingId ? updated : channel
          )
        );
        setStatusMessage("Canal atualizado com defaults de producao.");
      } else {
        const created = await createChannelRequest(payload);
        setChannels((current) => [created, ...current]);
        setStatusMessage("Canal criado com perfil editorial e defaults.");
      }

      setSource("api");
    } catch {
      if (editingId) {
        setChannels((current) =>
          current.map((channel) =>
            channel.id === editingId ? applyPayload(channel, payload, now) : channel
          )
        );
        setStatusMessage(
          "API indisponivel. Canal atualizado apenas nesta sessao local."
        );
      } else {
        setChannels((current) => [
          {
            id: createLocalId("channel"),
            createdAt: now,
            updatedAt: now,
            ...payload
          },
          ...current
        ]);
        setStatusMessage(
          "API indisponivel. Canal criado apenas nesta sessao local."
        );
      }

      setSource("mock");
    }

    setForm(emptyForm);
    setEditingId(null);
  }

  function startEditing(channel: StudioChannel) {
    setEditingId(channel.id);
    setForm(toFormState(channel));
    setStatusMessage(`Editando defaults de ${channel.name}.`);
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
    setStatusMessage(
      source === "api"
        ? "Conectado a API local."
        : "Rodando em modo mock ate a API ficar disponivel."
    );
  }

  async function handleDelete(id: string) {
    try {
      await deleteChannelRequest(id);
      setChannels((current) => current.filter((channel) => channel.id !== id));
      setSource("api");
      setStatusMessage("Canal removido da API local.");
    } catch {
      setChannels((current) => current.filter((channel) => channel.id !== id));
      setSource("mock");
      setStatusMessage(
        "API indisponivel. Canal removido apenas desta sessao local."
      );
    }

    if (editingId === id) {
      cancelEditing();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Channel Forge
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {editingId ? "Editar canal" : "Novo canal"}
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

        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/70">
          {statusMessage}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">Nome</span>
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">Nicho</span>
            <textarea
              required
              rows={3}
              value={form.niche}
              onChange={(event) =>
                setForm((current) => ({ ...current, niche: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Idioma</span>
              <input
                required
                value={form.language}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    language: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Template</span>
              <select
                value={form.defaultTemplate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultTemplate: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem template fixo</option>
                {templateCatalog.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">
              Visual style
            </span>
            <textarea
              rows={3}
              value={form.visualStyle}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  visualStyle: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">
              Narrative tone
            </span>
            <textarea
              rows={3}
              value={form.narrativeTone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  narrativeTone: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Render mode
              </span>
              <select
                value={form.defaultRenderMode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultRenderMode: event.target.value as ChannelFormState["defaultRenderMode"]
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {renderModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Render quality
              </span>
              <select
                value={form.defaultRenderQuality}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultRenderQuality:
                      event.target.value as ChannelFormState["defaultRenderQuality"]
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {renderQualities.map((quality) => (
                  <option key={quality} value={quality}>
                    {quality}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Audio mood</span>
              <select
                value={form.defaultAudioMood}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultAudioMood: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem mood fixo</option>
                {audioMoodCatalog.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Caption style
              </span>
              <select
                value={form.defaultCaptionStyle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultCaptionStyle: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Auto por template</option>
                {captionStyleCatalog.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Visual preset
              </span>
              <select
                value={form.defaultVisualPreset}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultVisualPreset: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem preset fixo</option>
                {cinematicPresetCatalog.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Musica default
              </span>
              <select
                value={form.defaultMusicAssetId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultMusicAssetId: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem trilha fixa</option>
                {musicAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.filename}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Voiceover default
              </span>
              <select
                value={form.defaultVoiceoverAssetId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultVoiceoverAssetId: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem voiceover fixo</option>
                {voiceoverAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.filename}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Duracao alvo default
              </span>
              <input
                value={form.defaultDurationTarget}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultDurationTarget: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Duracao padrao por cena
              </span>
              <input
                value={form.defaultSceneDuration}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultSceneDuration: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>
          </div>

          <div className="rounded-[1.45rem] border border-white/10 bg-black/20 p-4">
            <p className="text-sm uppercase tracking-[0.24em] text-mist/55">
              Preferencias de biblioteca
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {assetCategories.map((category) => {
                const active = form.preferredAssetCategories.includes(category);

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        preferredAssetCategories: toggleCategory(
                          current.preferredAssetCategories,
                          category
                        )
                      }))
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      active
                        ? "border-signal/35 bg-signal/12 text-signal"
                        : "border-white/10 bg-white/[0.04] text-mist/70"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm text-mist/65">
                Tags preferidas
              </span>
              <input
                value={form.preferredAssetTags}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    preferredAssetTags: event.target.value
                  }))
                }
                placeholder="anime, lore, suspense, hook"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
            >
              {editingId ? "Salvar canal" : "Criar canal"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm text-mist/80"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Channel Library
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {orderedChannels.length} canais preparados
            </h2>
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/65">
            Defaults operacionais
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {orderedChannels.map((channel) => (
            <article
              key={channel.id}
              className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {channel.name}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-mist/68">
                    {channel.niche}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(channel)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(channel.id)}
                    className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-100"
                  >
                    Deletar
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                  {channel.language}
                </span>
                <span className="rounded-full border border-signal/20 bg-signal/10 px-3 py-1 text-xs text-signal">
                  {channel.defaultRenderMode} / {channel.defaultRenderQuality}
                </span>
                {channel.defaultTemplate ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                    {channel.defaultTemplate}
                  </span>
                ) : null}
              </div>

              <dl className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-mist/45">
                    Stack criativo
                  </dt>
                  <dd className="mt-2 text-sm leading-7 text-mist/70">
                    Preset {channel.defaultVisualPreset ?? "auto"} | caption{" "}
                    {channel.defaultCaptionStyle ?? "auto"} | mood{" "}
                    {channel.defaultAudioMood ?? "manual"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-mist/45">
                    Ritmo base
                  </dt>
                  <dd className="mt-2 text-sm leading-7 text-mist/70">
                    alvo {channel.defaultDurationTarget ?? "n/d"}s | cenas de{" "}
                    {channel.defaultSceneDuration.toFixed(1)}s
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-mist/45">
                    Biblioteca favorita
                  </dt>
                  <dd className="mt-2 text-sm leading-7 text-mist/70">
                    {channel.preferredAssetCategories.length > 0
                      ? channel.preferredAssetCategories.join(", ")
                      : "Sem categorias fixas."}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-mist/45">
                    Tags favoritas
                  </dt>
                  <dd className="mt-2 text-sm leading-7 text-mist/70">
                    {channel.preferredAssetTags.length > 0
                      ? channel.preferredAssetTags.join(", ")
                      : "Sem tags fixas."}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 text-xs text-mist/45">
                Atualizado em {formatDate(channel.updatedAt)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}