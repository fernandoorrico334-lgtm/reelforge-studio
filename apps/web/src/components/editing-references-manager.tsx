"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  analyzeEditingReferenceRequest,
  buildEditingReferencePresetRequest,
  createEditingReferenceRequest,
  deleteEditingReferencePresetRequest,
  deleteEditingReferenceRequest,
  updateEditingReferenceRequest
} from "../lib/studio-api";
import type {
  DataSource,
  EditingReference,
  EditingReferencePreset,
  EditingReferenceBeatIntensity,
  EditingReferenceCaptionStyle,
  EditingReferenceCategory,
  EditingReferenceCtaStyle,
  EditingReferenceFlashStyle,
  EditingReferenceHookStyle,
  EditingReferenceMicroclipPlacement,
  EditingReferenceMusicStyle,
  EditingReferenceNarrationStyle,
  EditingReferencePacing,
  EditingReferenceSfxStyle,
  EditingReferenceSourceType,
  EditingReferenceStatus,
  EditingReferenceTransitionStyle,
  EditingReferenceZoomStyle,
  StudioAsset
} from "../lib/studio-types";
import {
  editingReferenceBeatIntensities,
  editingReferenceCaptionStyles,
  editingReferenceCategories,
  editingReferenceCtaStyles,
  editingReferenceFlashStyles,
  editingReferenceHookStyles,
  editingReferenceMicroclipPlacements,
  editingReferenceMusicStyles,
  editingReferenceNarrationStyles,
  editingReferencePacingOptions,
  editingReferenceSfxStyles,
  editingReferenceSourceTypes,
  editingReferenceStatuses,
  editingReferenceTransitionStyles,
  editingReferenceZoomStyles
} from "../lib/studio-types";

interface EditingReferencesManagerProps {
  assets: StudioAsset[];
  initialReferences: EditingReference[];
  initialReferenceSource: DataSource;
  initialPresets: EditingReferencePreset[];
  initialPresetSource: DataSource;
}

interface ReferenceFormState {
  title: string;
  description: string;
  assetId: string;
  localPath: string;
  sourceType: EditingReferenceSourceType;
  category: EditingReferenceCategory;
  status: EditingReferenceStatus;
  beatIntensity: EditingReferenceBeatIntensity;
  pacing: EditingReferencePacing;
  zoomStyle: EditingReferenceZoomStyle;
  flashStyle: EditingReferenceFlashStyle;
  transitionStyle: EditingReferenceTransitionStyle;
  captionStyle: EditingReferenceCaptionStyle;
  narrationStyle: EditingReferenceNarrationStyle;
  musicStyle: EditingReferenceMusicStyle;
  sfxStyle: EditingReferenceSfxStyle;
  hookStyle: EditingReferenceHookStyle;
  ctaStyle: EditingReferenceCtaStyle;
  microclipPlacement: EditingReferenceMicroclipPlacement;
  visualStyleNotes: string;
  audioStyleNotes: string;
  editingStyleNotes: string;
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

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function createInitialForm(): ReferenceFormState {
  return {
    title: "",
    description: "",
    assetId: "",
    localPath: "",
    sourceType: "local_file",
    category: "generic",
    status: "draft",
    beatIntensity: "medium",
    pacing: "medium",
    zoomStyle: "subtle",
    flashStyle: "none",
    transitionStyle: "cut",
    captionStyle: "lower_clean",
    narrationStyle: "calm",
    musicStyle: "none",
    sfxStyle: "none",
    hookStyle: "curiosity",
    ctaStyle: "short",
    microclipPlacement: "none",
    visualStyleNotes: "",
    audioStyleNotes: "",
    editingStyleNotes: ""
  };
}

function toFormState(reference: EditingReference): ReferenceFormState {
  return {
    title: reference.title,
    description: reference.description ?? "",
    assetId: reference.assetId ?? "",
    localPath: reference.localPath ?? "",
    sourceType: reference.sourceType,
    category: reference.category,
    status: reference.status,
    beatIntensity: reference.beatIntensity,
    pacing: reference.pacing,
    zoomStyle: reference.zoomStyle,
    flashStyle: reference.flashStyle,
    transitionStyle: reference.transitionStyle,
    captionStyle: reference.captionStyle,
    narrationStyle: reference.narrationStyle,
    musicStyle: reference.musicStyle,
    sfxStyle: reference.sfxStyle,
    hookStyle: reference.hookStyle,
    ctaStyle: reference.ctaStyle,
    microclipPlacement: reference.microclipPlacement,
    visualStyleNotes: reference.visualStyleNotes ?? "",
    audioStyleNotes: reference.audioStyleNotes ?? "",
    editingStyleNotes: reference.editingStyleNotes ?? ""
  };
}

function sortByUpdatedAt<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

export function EditingReferencesManager({
  assets,
  initialReferences,
  initialReferenceSource,
  initialPresets,
  initialPresetSource
}: EditingReferencesManagerProps) {
  const [references, setReferences] = useState(sortByUpdatedAt(initialReferences));
  const [referenceSource] = useState(initialReferenceSource);
  const [presets, setPresets] = useState(sortByUpdatedAt(initialPresets));
  const [presetSource] = useState(initialPresetSource);
  const [editingReferenceId, setEditingReferenceId] = useState<string | null>(null);
  const [form, setForm] = useState<ReferenceFormState>(createInitialForm());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoAssets = useMemo(
    () => assets.filter((asset) => asset.type === "VIDEO"),
    [assets]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusyKey("submit-reference");

    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        assetId: form.assetId || null,
        localPath: form.localPath || null,
        sourceType: form.sourceType,
        category: form.category,
        status: form.status,
        beatIntensity: form.beatIntensity,
        pacing: form.pacing,
        zoomStyle: form.zoomStyle,
        flashStyle: form.flashStyle,
        transitionStyle: form.transitionStyle,
        captionStyle: form.captionStyle,
        narrationStyle: form.narrationStyle,
        musicStyle: form.musicStyle,
        sfxStyle: form.sfxStyle,
        hookStyle: form.hookStyle,
        ctaStyle: form.ctaStyle,
        microclipPlacement: form.microclipPlacement,
        visualStyleNotes: form.visualStyleNotes || null,
        audioStyleNotes: form.audioStyleNotes || null,
        editingStyleNotes: form.editingStyleNotes || null
      };

      const saved = editingReferenceId
        ? await updateEditingReferenceRequest(editingReferenceId, payload)
        : await createEditingReferenceRequest(payload);

      setReferences((current) =>
        sortByUpdatedAt(
          editingReferenceId
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [saved, ...current]
        )
      );
      setEditingReferenceId(null);
      setForm(createInitialForm());
      setMessage(
        editingReferenceId
          ? "Referencia editorial atualizada."
          : "Referencia editorial cadastrada."
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nao foi possivel salvar a referencia."
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAnalyze(reference: EditingReference) {
    setError(null);
    setMessage(null);
    setBusyKey(`analyze:${reference.id}`);

    try {
      const result = await analyzeEditingReferenceRequest(reference.id);
      setReferences((current) =>
        sortByUpdatedAt(
          current.map((item) =>
            item.id === result.reference.id ? result.reference : item
          )
        )
      );
      setMessage(
        `Analise concluida para "${reference.title}". ${result.summary}`
      );
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Nao foi possivel analisar a referencia."
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleBuildPreset(reference: EditingReference) {
    setError(null);
    setMessage(null);
    setBusyKey(`preset:${reference.id}`);

    try {
      const result = await buildEditingReferencePresetRequest(reference.id, {
        name: `${reference.title} Preset`
      });
      setPresets((current) => sortByUpdatedAt([result.preset, ...current]));
      setReferences((current) =>
        current.map((item) =>
          item.id === reference.id ? { ...item, status: "preset_ready" } : item
        )
      );
      setMessage(`Preset derivado criado. ${result.summary}`);
    } catch (buildError) {
      setError(
        buildError instanceof Error
          ? buildError.message
          : "Nao foi possivel derivar o preset."
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteReference(reference: EditingReference) {
    setError(null);
    setMessage(null);
    setBusyKey(`delete-reference:${reference.id}`);

    try {
      await deleteEditingReferenceRequest(reference.id);
      setReferences((current) => current.filter((item) => item.id !== reference.id));
      setPresets((current) =>
        current.map((item) =>
          item.referenceId === reference.id
            ? { ...item, referenceId: null, reference: null }
            : item
        )
      );
      if (editingReferenceId === reference.id) {
        setEditingReferenceId(null);
        setForm(createInitialForm());
      }
      setMessage(`Referencia "${reference.title}" removida.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Nao foi possivel remover a referencia."
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeletePreset(preset: EditingReferencePreset) {
    setError(null);
    setMessage(null);
    setBusyKey(`delete-preset:${preset.id}`);

    try {
      await deleteEditingReferencePresetRequest(preset.id);
      setPresets((current) => current.filter((item) => item.id !== preset.id));
      setMessage(`Preset "${preset.name}" removido.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Nao foi possivel remover o preset."
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
            Referencias
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {references.length}
          </p>
          <p className="mt-2 text-sm text-mist/65">
            {formatSourceLabel(referenceSource)}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
            Presets
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">{presets.length}</p>
          <p className="mt-2 text-sm text-mist/65">
            {formatSourceLabel(presetSource)}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
            Assets de video
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {videoAssets.length}
          </p>
          <p className="mt-2 text-sm text-mist/65">
            Clipes locais prontos para serem usados como referencia editorial.
          </p>
        </div>
      </section>

      {message ? (
        <div className="rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[1.2rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Registrar referencia
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Cadastre reels locais e capture o DNA editorial deles
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingReferenceId(null);
              setForm(createInitialForm());
            }}
            className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/70 transition hover:border-white/20 hover:text-white"
          >
            Limpar formulario
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 xl:col-span-2">
              <span className="text-xs uppercase tracking-[0.22em] text-mist/45">
                Titulo
              </span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/40"
                placeholder="Ex.: Stadium Pressure Short"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-mist/45">
                Source type
              </span>
              <select
                value={form.sourceType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceType: event.target.value as EditingReferenceSourceType
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/40"
              >
                {editingReferenceSourceTypes.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-mist/45">
                Categoria
              </span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value as EditingReferenceCategory
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/40"
              >
                {editingReferenceCategories.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-mist/45">
                Asset de video
              </span>
              <select
                value={form.assetId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, assetId: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/40"
              >
                <option value="">Nenhum asset da biblioteca</option>
                {videoAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.filename}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-mist/45">
                Local path
              </span>
              <input
                value={form.localPath}
                onChange={(event) =>
                  setForm((current) => ({ ...current, localPath: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/40"
                placeholder="storage/references/..."
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-mist/45">
              Descricao
            </span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
              rows={3}
              className="w-full rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/40"
              placeholder="Descreva o que esta referencia ensina sobre ritmo, estilo e leitura editorial."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {([
              ["status", editingReferenceStatuses],
              ["beatIntensity", editingReferenceBeatIntensities],
              ["pacing", editingReferencePacingOptions],
              ["zoomStyle", editingReferenceZoomStyles],
              ["flashStyle", editingReferenceFlashStyles],
              ["transitionStyle", editingReferenceTransitionStyles],
              ["captionStyle", editingReferenceCaptionStyles],
              ["narrationStyle", editingReferenceNarrationStyles],
              ["musicStyle", editingReferenceMusicStyles],
              ["sfxStyle", editingReferenceSfxStyles],
              ["hookStyle", editingReferenceHookStyles],
              ["ctaStyle", editingReferenceCtaStyles],
              ["microclipPlacement", editingReferenceMicroclipPlacements]
            ] as Array<[keyof ReferenceFormState, readonly string[]]>).map(([field, options]) => (
              <label key={field} className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-mist/45">
                  {formatLabel(field)}
                </span>
                <select
                  value={form[field as keyof ReferenceFormState] as string}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [field]: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/40"
                >
                  {(options as string[]).map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-mist/45">
                Visual notes
              </span>
              <textarea
                value={form.visualStyleNotes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    visualStyleNotes: event.target.value
                  }))
                }
                rows={4}
                className="w-full rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/40"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-mist/45">
                Audio notes
              </span>
              <textarea
                value={form.audioStyleNotes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    audioStyleNotes: event.target.value
                  }))
                }
                rows={4}
                className="w-full rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/40"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-mist/45">
                Editing notes
              </span>
              <textarea
                value={form.editingStyleNotes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    editingStyleNotes: event.target.value
                  }))
                }
                rows={4}
                className="w-full rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-signal/40"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busyKey === "submit-reference"}
              className="rounded-full border border-signal/30 bg-signal/12 px-5 py-3 text-sm font-medium text-signal disabled:opacity-45"
            >
              {editingReferenceId ? "Atualizar referencia" : "Cadastrar referencia"}
            </button>
            {editingReferenceId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingReferenceId(null);
                  setForm(createInitialForm());
                }}
                className="rounded-full border border-white/10 bg-black/20 px-5 py-3 text-sm text-mist/70"
              >
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Referencias cadastradas
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Reels locais que alimentam novos presets
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {references.map((reference) => (
              <div
                key={reference.id}
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {reference.title}
                    </h3>
                    <p className="mt-2 text-sm text-mist/65">
                      {reference.description ?? "Sem descricao editorial ainda."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                      {formatLabel(reference.category)}
                    </span>
                    <span className="rounded-full border border-signal/20 bg-signal/10 px-3 py-1 text-xs text-signal">
                      {formatLabel(reference.status)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-mist/65">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    source {formatLabel(reference.sourceType)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    duracao {formatDuration(reference.durationSeconds)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    cut pace {formatDuration(reference.averageCutPaceSeconds)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    beat {formatLabel(reference.beatIntensity)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    pacing {formatLabel(reference.pacing)}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-mist/68">
                    <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                      Fonte
                    </p>
                    <p className="mt-2 text-white">
                      {reference.asset?.filename ??
                        reference.localPath ??
                        "Sem origem resolvida"}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-mist/60">
                      assetId {reference.assetId ?? "n/a"} / path{" "}
                      {reference.localPath ?? reference.asset?.path ?? "n/a"}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-mist/68">
                    <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                      Estilo derivado
                    </p>
                    <p className="mt-2 text-white">
                      zoom {formatLabel(reference.zoomStyle)} / flash{" "}
                      {formatLabel(reference.flashStyle)} / transicao{" "}
                      {formatLabel(reference.transitionStyle)}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-mist/60">
                      caption {formatLabel(reference.captionStyle)} / narracao{" "}
                      {formatLabel(reference.narrationStyle)} / musica{" "}
                      {formatLabel(reference.musicStyle)}
                    </p>
                  </div>
                </div>

                {reference.analysisWarnings.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {reference.analysisWarnings.map((warning) => (
                      <div
                        key={warning}
                        className="rounded-[1rem] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
                      >
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : null}

                <p className="mt-4 text-xs text-mist/55">
                  Atualizado em {formatDate(reference.updatedAt)}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReferenceId(reference.id);
                      setForm(toFormState(reference));
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleAnalyze(reference);
                    }}
                    disabled={busyKey === `analyze:${reference.id}`}
                    className="rounded-full border border-[#7be0ff]/30 bg-[#7be0ff]/10 px-3 py-2 text-xs text-[#7be0ff] disabled:opacity-45"
                  >
                    Analisar com FFmpeg
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleBuildPreset(reference);
                    }}
                    disabled={busyKey === `preset:${reference.id}`}
                    className="rounded-full border border-signal/30 bg-signal/12 px-3 py-2 text-xs text-signal disabled:opacity-45"
                  >
                    Derivar preset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteReference(reference);
                    }}
                    disabled={busyKey === `delete-reference:${reference.id}`}
                    className="rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-100 disabled:opacity-45"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}

            {references.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-6 text-sm text-mist/55">
                Nenhuma referencia editorial cadastrada ainda.
              </div>
            ) : null}
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Presets prontos
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Catálogo editorial reutilizável
          </h2>

          <div className="mt-6 space-y-4">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {preset.name}
                    </h3>
                    <p className="mt-2 text-sm text-mist/65">
                      {preset.description}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/70">
                    {preset.slug}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-mist/65">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    use case {formatLabel(preset.useCase)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    cut pace {formatDuration(preset.cutPace)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    microclip {formatLabel(preset.microclipPlacement)}
                  </span>
                </div>

                <p className="mt-4 text-xs leading-6 text-mist/60">
                  templates {preset.recommendedTemplates.join(", ") || "n/d"} /
                  music {preset.recommendedMusicPresetId ?? "n/d"} / mastering{" "}
                  {preset.recommendedAudioMasteringPresetId ?? "n/d"} / voice{" "}
                  {preset.recommendedNarrationVoicePackId ?? "n/d"}
                </p>

                {preset.reference ? (
                  <p className="mt-3 text-xs text-mist/50">
                    Derivado de {preset.reference.title}
                  </p>
                ) : null}

                {preset.notes ? (
                  <p className="mt-3 text-sm leading-7 text-mist/68">
                    {preset.notes}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeletePreset(preset);
                    }}
                    disabled={busyKey === `delete-preset:${preset.id}`}
                    className="rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-100 disabled:opacity-45"
                  >
                    Remover preset
                  </button>
                </div>
              </div>
            ))}

            {presets.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-6 text-sm text-mist/55">
                Nenhum preset editorial derivado ainda.
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
