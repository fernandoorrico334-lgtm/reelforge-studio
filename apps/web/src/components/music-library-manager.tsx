"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { AssetMediaPreview } from "./asset-media-preview";
import {
  analyzeMusicLibraryAssetRequest,
  updateMusicLibraryProfileRequest,
  updateSfxLibraryProfileRequest
} from "../lib/studio-api";
import type {
  AudioLicenseStatus,
  DataSource,
  MusicEnergy,
  MusicGenre,
  MusicLibraryItemRecord,
  MusicMood,
  MusicSourceType,
  MusicUseCase,
  SfxCategory,
  SfxIntensity,
  SfxLibraryItemRecord,
  SfxUseCase
} from "../lib/studio-types";
import {
  audioLicenseStatuses,
  musicEnergies,
  musicGenres,
  musicMoods,
  musicUseCases,
  sfxCategories,
  sfxIntensities,
  sfxUseCases
} from "../lib/studio-types";

interface MusicLibraryManagerProps {
  initialMusicItems: MusicLibraryItemRecord[];
  initialMusicSource: DataSource;
  initialSfxItems: SfxLibraryItemRecord[];
  initialSfxSource: DataSource;
}

interface MusicProfileFormState {
  title: string;
  artist: string;
  sourceType: MusicSourceType;
  licenseStatus: AudioLicenseStatus;
  mood: MusicMood;
  genre: MusicGenre;
  bpm: string;
  bpmConfidence: string;
  energy: MusicEnergy;
  useCase: MusicUseCase;
  loudness: string;
  notes: string;
  safetyWarning: string;
}

interface SfxProfileFormState {
  title: string;
  category: SfxCategory;
  intensity: SfxIntensity;
  useCase: SfxUseCase;
  licenseStatus: AudioLicenseStatus;
  notes: string;
}

function formatSourceLabel(value: DataSource) {
  return value === "api" ? "API local ativa" : "Mock local";
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "n/d";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDuration(value: number | null | undefined) {
  if (typeof value !== "number" || value <= 0) {
    return "n/d";
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}s`;
}

function formatTagLabel(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function toMusicFormState(item: MusicLibraryItemRecord): MusicProfileFormState {
  return {
    title: item.profile?.title ?? item.asset.filename,
    artist: item.profile?.artist ?? "",
    sourceType: item.profile?.sourceType ?? "unknown",
    licenseStatus: item.profile?.licenseStatus ?? "unknown",
    mood: item.profile?.mood ?? "cinematic",
    genre: item.profile?.genre ?? "generic",
    bpm: item.profile?.bpm?.toString() ?? "",
    bpmConfidence: item.profile?.bpmConfidence?.toString() ?? "0",
    energy: item.profile?.energy ?? "medium",
    useCase: item.profile?.useCase ?? "generic",
    loudness: item.profile?.loudness?.toString() ?? "",
    notes: item.profile?.notes ?? "",
    safetyWarning: item.profile?.safetyWarning ?? ""
  };
}

function toSfxFormState(item: SfxLibraryItemRecord): SfxProfileFormState {
  return {
    title: item.profile?.title ?? item.asset.filename,
    category: item.profile?.category ?? "transition",
    intensity: item.profile?.intensity ?? "medium",
    useCase: item.profile?.useCase ?? "generic",
    licenseStatus: item.profile?.licenseStatus ?? "unknown",
    notes: item.profile?.notes ?? ""
  };
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

function replaceMusicItem(
  items: MusicLibraryItemRecord[],
  nextItem: MusicLibraryItemRecord
) {
  return items.map((item) =>
    item.asset.id === nextItem.asset.id ? nextItem : item
  );
}

function replaceSfxItem(
  items: SfxLibraryItemRecord[],
  nextItem: SfxLibraryItemRecord
) {
  return items.map((item) =>
    item.asset.id === nextItem.asset.id ? nextItem : item
  );
}

export function MusicLibraryManager({
  initialMusicItems,
  initialMusicSource,
  initialSfxItems,
  initialSfxSource
}: MusicLibraryManagerProps) {
  const [tab, setTab] = useState<"music" | "sfx">("music");
  const [musicItems, setMusicItems] = useState(initialMusicItems);
  const [musicSource, setMusicSource] = useState(initialMusicSource);
  const [sfxItems, setSfxItems] = useState(initialSfxItems);
  const [sfxSource, setSfxSource] = useState(initialSfxSource);
  const [search, setSearch] = useState("");
  const [musicMoodFilter, setMusicMoodFilter] = useState("ALL");
  const [musicGenreFilter, setMusicGenreFilter] = useState("ALL");
  const [musicEnergyFilter, setMusicEnergyFilter] = useState("ALL");
  const [musicUseCaseFilter, setMusicUseCaseFilter] = useState("ALL");
  const [licenseFilter, setLicenseFilter] = useState("ALL");
  const [sfxCategoryFilter, setSfxCategoryFilter] = useState("ALL");
  const [sfxIntensityFilter, setSfxIntensityFilter] = useState("ALL");
  const [sfxUseCaseFilter, setSfxUseCaseFilter] = useState("ALL");
  const [selectedMusicAssetId, setSelectedMusicAssetId] = useState(
    initialMusicItems[0]?.asset.id ?? ""
  );
  const [selectedSfxAssetId, setSelectedSfxAssetId] = useState(
    initialSfxItems[0]?.asset.id ?? ""
  );
  const [musicForm, setMusicForm] = useState<MusicProfileFormState>(
    initialMusicItems[0]
      ? toMusicFormState(initialMusicItems[0])
      : {
          title: "",
          artist: "",
          sourceType: "unknown",
          licenseStatus: "unknown",
          mood: "cinematic",
          genre: "generic",
          bpm: "",
          bpmConfidence: "0",
          energy: "medium",
          useCase: "generic",
          loudness: "",
          notes: "",
          safetyWarning: ""
        }
  );
  const [sfxForm, setSfxForm] = useState<SfxProfileFormState>(
    initialSfxItems[0]
      ? toSfxFormState(initialSfxItems[0])
      : {
          title: "",
          category: "transition",
          intensity: "medium",
          useCase: "generic",
          licenseStatus: "unknown",
          notes: ""
        }
  );
  const [statusMessage, setStatusMessage] = useState(
    initialMusicSource === "api" || initialSfxSource === "api"
      ? "Music Library conectada a API local."
      : "Music Library em modo mock ate a API ficar disponivel."
  );
  const deferredSearch = useDeferredValue(search);

  const visibleMusicItems = useMemo(
    () =>
      musicItems.filter((item) => {
        if (musicMoodFilter !== "ALL" && item.profile?.mood !== musicMoodFilter) {
          return false;
        }

        if (
          musicGenreFilter !== "ALL" &&
          item.profile?.genre !== musicGenreFilter
        ) {
          return false;
        }

        if (
          musicEnergyFilter !== "ALL" &&
          item.profile?.energy !== musicEnergyFilter
        ) {
          return false;
        }

        if (
          musicUseCaseFilter !== "ALL" &&
          item.profile?.useCase !== musicUseCaseFilter
        ) {
          return false;
        }

        if (
          licenseFilter !== "ALL" &&
          item.profile?.licenseStatus !== licenseFilter
        ) {
          return false;
        }

        if (!deferredSearch.trim()) {
          return true;
        }

        const haystack = [
          item.asset.filename,
          item.asset.originalName,
          item.profile?.title ?? "",
          item.profile?.artist ?? "",
          item.asset.tags.join(" "),
          item.asset.recommendedUse ?? "",
          item.summary
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(deferredSearch.toLowerCase());
      }),
    [
      deferredSearch,
      licenseFilter,
      musicEnergyFilter,
      musicGenreFilter,
      musicItems,
      musicMoodFilter,
      musicUseCaseFilter
    ]
  );

  const visibleSfxItems = useMemo(
    () =>
      sfxItems.filter((item) => {
        if (
          sfxCategoryFilter !== "ALL" &&
          item.profile?.category !== sfxCategoryFilter
        ) {
          return false;
        }

        if (
          sfxIntensityFilter !== "ALL" &&
          item.profile?.intensity !== sfxIntensityFilter
        ) {
          return false;
        }

        if (
          sfxUseCaseFilter !== "ALL" &&
          item.profile?.useCase !== sfxUseCaseFilter
        ) {
          return false;
        }

        if (
          licenseFilter !== "ALL" &&
          item.profile?.licenseStatus !== licenseFilter
        ) {
          return false;
        }

        if (!deferredSearch.trim()) {
          return true;
        }

        const haystack = [
          item.asset.filename,
          item.profile?.title ?? "",
          item.asset.tags.join(" "),
          item.profile?.notes ?? ""
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(deferredSearch.toLowerCase());
      }),
    [
      deferredSearch,
      licenseFilter,
      sfxCategoryFilter,
      sfxIntensityFilter,
      sfxItems,
      sfxUseCaseFilter
    ]
  );

  const selectedMusicItem =
    visibleMusicItems.find((item) => item.asset.id === selectedMusicAssetId) ??
    musicItems.find((item) => item.asset.id === selectedMusicAssetId) ??
    visibleMusicItems[0] ??
    musicItems[0] ??
    null;
  const selectedSfxItem =
    visibleSfxItems.find((item) => item.asset.id === selectedSfxAssetId) ??
    sfxItems.find((item) => item.asset.id === selectedSfxAssetId) ??
    visibleSfxItems[0] ??
    sfxItems[0] ??
    null;

  function selectMusicItem(item: MusicLibraryItemRecord) {
    setSelectedMusicAssetId(item.asset.id);
    setMusicForm(toMusicFormState(item));
  }

  function selectSfxItem(item: SfxLibraryItemRecord) {
    setSelectedSfxAssetId(item.asset.id);
    setSfxForm(toSfxFormState(item));
  }

  async function handleAnalyzeMusic() {
    if (!selectedMusicItem) {
      return;
    }

    try {
      const nextItem = await analyzeMusicLibraryAssetRequest(
        selectedMusicItem.asset.id
      );
      setMusicItems((current) => replaceMusicItem(current, nextItem));
      setMusicSource("api");
      setMusicForm(toMusicFormState(nextItem));
      setStatusMessage(
        `Analise FFmpeg concluida para ${nextItem.asset.filename}.`
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleSaveMusicProfile() {
    if (!selectedMusicItem) {
      return;
    }

    try {
      const nextItem = await updateMusicLibraryProfileRequest(
        selectedMusicItem.asset.id,
        {
          title: musicForm.title.trim(),
          artist: toNullableString(musicForm.artist),
          sourceType: musicForm.sourceType,
          licenseStatus: musicForm.licenseStatus,
          mood: musicForm.mood,
          genre: musicForm.genre,
          bpm: toNullableNumber(musicForm.bpm),
          bpmConfidence: Number(musicForm.bpmConfidence || 0),
          energy: musicForm.energy,
          useCase: musicForm.useCase,
          loudness: toNullableNumber(musicForm.loudness),
          notes: toNullableString(musicForm.notes),
          safetyWarning: toNullableString(musicForm.safetyWarning)
        }
      );
      setMusicItems((current) => replaceMusicItem(current, nextItem));
      setMusicSource("api");
      setMusicForm(toMusicFormState(nextItem));
      setStatusMessage(`Perfil musical salvo para ${nextItem.asset.filename}.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleSaveSfxProfile() {
    if (!selectedSfxItem) {
      return;
    }

    try {
      const nextItem = await updateSfxLibraryProfileRequest(
        selectedSfxItem.asset.id,
        {
          title: sfxForm.title.trim(),
          category: sfxForm.category,
          intensity: sfxForm.intensity,
          useCase: sfxForm.useCase,
          licenseStatus: sfxForm.licenseStatus,
          notes: toNullableString(sfxForm.notes)
        }
      );
      setSfxItems((current) => replaceSfxItem(current, nextItem));
      setSfxSource("api");
      setSfxForm(toSfxFormState(nextItem));
      setStatusMessage(`Perfil de SFX salvo para ${nextItem.asset.filename}.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[1.95rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(123,224,255,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(255,207,112,0.14),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Music Ops
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Biblioteca local de musica e SFX com BPM, energia e licenca
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Classifique trilhas e efeitos locais, rode analise FFmpeg quando
              disponivel e deixe o projeto pronto para selecao automatica e beat
              sync editorial.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Music
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {musicItems.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                SFX
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {sfxItems.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Fontes
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                music {formatSourceLabel(musicSource)} / sfx{" "}
                {formatSourceLabel(sfxSource)}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 rounded-[1.35rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
          {statusMessage}
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setTab("music")}
          className={`rounded-full border px-4 py-2 text-sm ${
            tab === "music"
              ? "border-signal/35 bg-signal/10 text-white"
              : "border-white/10 bg-black/20 text-mist/70"
          }`}
        >
          Music Library
        </button>
        <button
          type="button"
          onClick={() => setTab("sfx")}
          className={`rounded-full border px-4 py-2 text-sm ${
            tab === "sfx"
              ? "border-signal/35 bg-signal/10 text-white"
              : "border-white/10 bg-black/20 text-mist/70"
          }`}
        >
          SFX Library
        </button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[1.85rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Library Queue
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {tab === "music" ? "Musicas locais" : "SFX locais"}
              </h2>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, tags ou notas"
              className="w-full max-w-sm rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none md:w-auto"
            />
          </div>

          {tab === "music" ? (
            <>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <select
                  value={musicMoodFilter}
                  onChange={(event) => setMusicMoodFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="ALL">Mood</option>
                  {musicMoods.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={musicGenreFilter}
                  onChange={(event) => setMusicGenreFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="ALL">Genre</option>
                  {musicGenres.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={musicEnergyFilter}
                  onChange={(event) => setMusicEnergyFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="ALL">Energy</option>
                  {musicEnergies.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={musicUseCaseFilter}
                  onChange={(event) => setMusicUseCaseFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="ALL">Use case</option>
                  {musicUseCases.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={licenseFilter}
                  onChange={(event) => setLicenseFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="ALL">Licenca</option>
                  {audioLicenseStatuses.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 space-y-3">
                {visibleMusicItems.map((item) => (
                  <button
                    key={item.asset.id}
                    type="button"
                    onClick={() => selectMusicItem(item)}
                    className={`w-full rounded-[1.3rem] border p-4 text-left transition ${
                      selectedMusicItem?.asset.id === item.asset.id
                        ? "border-signal/30 bg-signal/10"
                        : "border-white/10 bg-black/20 hover:border-white/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-mist/70">
                        {item.asset.type}
                      </span>
                      <span className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-3 py-1 text-[11px] text-[#e2e8ff]">
                        {item.profile?.licenseStatus ?? "pending"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-white">
                      {item.profile?.title ?? item.asset.filename}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-mist/65">
                      {item.summary}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <select
                  value={sfxCategoryFilter}
                  onChange={(event) => setSfxCategoryFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="ALL">Category</option>
                  {sfxCategories.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={sfxIntensityFilter}
                  onChange={(event) => setSfxIntensityFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="ALL">Intensity</option>
                  {sfxIntensities.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={sfxUseCaseFilter}
                  onChange={(event) => setSfxUseCaseFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="ALL">Use case</option>
                  {sfxUseCases.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 space-y-3">
                {visibleSfxItems.map((item) => (
                  <button
                    key={item.asset.id}
                    type="button"
                    onClick={() => selectSfxItem(item)}
                    className={`w-full rounded-[1.3rem] border p-4 text-left transition ${
                      selectedSfxItem?.asset.id === item.asset.id
                        ? "border-signal/30 bg-signal/10"
                        : "border-white/10 bg-black/20 hover:border-white/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-mist/70">
                        {item.profile?.category ?? "pending"}
                      </span>
                      <span className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-3 py-1 text-[11px] text-[#e2e8ff]">
                        {item.profile?.intensity ?? "pending"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-white">
                      {item.profile?.title ?? item.asset.filename}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-mist/65">
                      use case {item.profile?.useCase ?? "generic"} / licenca{" "}
                      {item.profile?.licenseStatus ?? "unknown"}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </article>

        <article className="rounded-[1.85rem] border border-white/10 bg-white/[0.04] p-6">
          {tab === "music" && selectedMusicItem ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                    Music Inspector
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    {selectedMusicItem.profile?.title ?? selectedMusicItem.asset.filename}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleAnalyzeMusic();
                    }}
                    className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-4 py-2 text-sm text-[#d8f8ff]"
                  >
                    Analisar com FFmpeg
                  </button>
                  <Link
                    href="/assets"
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/75"
                  >
                    Abrir asset
                  </Link>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
                <AssetMediaPreview asset={selectedMusicItem.asset} source={musicSource} />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-mist/65">Title</span>
                  <input
                    value={musicForm.title}
                    onChange={(event) =>
                      setMusicForm((current) => ({
                        ...current,
                        title: event.target.value
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-mist/65">Artist</span>
                  <input
                    value={musicForm.artist}
                    onChange={(event) =>
                      setMusicForm((current) => ({
                        ...current,
                        artist: event.target.value
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <select
                  value={musicForm.mood}
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      mood: event.target.value as MusicMood
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {musicMoods.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={musicForm.genre}
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      genre: event.target.value as MusicGenre
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {musicGenres.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={musicForm.energy}
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      energy: event.target.value as MusicEnergy
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {musicEnergies.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={musicForm.useCase}
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      useCase: event.target.value as MusicUseCase
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {musicUseCases.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={musicForm.licenseStatus}
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      licenseStatus: event.target.value as AudioLicenseStatus
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {audioLicenseStatuses.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <input
                  value={musicForm.sourceType}
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      sourceType: event.target.value as MusicSourceType
                    }))
                  }
                  placeholder="source type"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <input
                  value={musicForm.bpm}
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      bpm: event.target.value
                    }))
                  }
                  placeholder="BPM"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
                <input
                  value={musicForm.bpmConfidence}
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      bpmConfidence: event.target.value
                    }))
                  }
                  placeholder="BPM confidence"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
                <input
                  value={musicForm.loudness}
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      loudness: event.target.value
                    }))
                  }
                  placeholder="Loudness"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </div>

              <textarea
                rows={3}
                value={musicForm.notes}
                onChange={(event) =>
                  setMusicForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
                placeholder="Notas editoriais"
                className="mt-4 w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
              <textarea
                rows={2}
                value={musicForm.safetyWarning}
                onChange={(event) =>
                  setMusicForm((current) => ({
                    ...current,
                    safetyWarning: event.target.value
                  }))
                }
                placeholder="Warning de licenca/seguranca"
                className="mt-4 w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 text-sm text-mist/68">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Analise atual
                  </p>
                  <p className="mt-2 text-white">
                    {selectedMusicItem.summary}
                  </p>
                  <p className="mt-2 text-xs">
                    beat markers {selectedMusicItem.profile?.beatMarkers.length ?? 0} /
                    energy points {selectedMusicItem.profile?.energyTimeline.length ?? 0}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 text-sm text-mist/68">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Metadata
                  </p>
                  <p className="mt-2 text-white">
                    duracao {formatDuration(selectedMusicItem.profile?.durationSeconds)}
                  </p>
                  <p className="mt-2 text-xs">
                    atualizado {formatDate(selectedMusicItem.profile?.updatedAt)}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveMusicProfile();
                  }}
                  className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink"
                >
                  Salvar perfil musical
                </button>
              </div>
            </>
          ) : null}

          {tab === "sfx" && selectedSfxItem ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                    SFX Inspector
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    {selectedSfxItem.profile?.title ?? selectedSfxItem.asset.filename}
                  </h2>
                </div>
                <Link
                  href="/assets"
                  className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/75"
                >
                  Abrir asset
                </Link>
              </div>

              <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
                <AssetMediaPreview asset={selectedSfxItem.asset} source={sfxSource} />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <input
                  value={sfxForm.title}
                  onChange={(event) =>
                    setSfxForm((current) => ({
                      ...current,
                      title: event.target.value
                    }))
                  }
                  placeholder="Title"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
                <select
                  value={sfxForm.licenseStatus}
                  onChange={(event) =>
                    setSfxForm((current) => ({
                      ...current,
                      licenseStatus: event.target.value as AudioLicenseStatus
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {audioLicenseStatuses.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={sfxForm.category}
                  onChange={(event) =>
                    setSfxForm((current) => ({
                      ...current,
                      category: event.target.value as SfxCategory
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {sfxCategories.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={sfxForm.intensity}
                  onChange={(event) =>
                    setSfxForm((current) => ({
                      ...current,
                      intensity: event.target.value as SfxIntensity
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {sfxIntensities.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={sfxForm.useCase}
                  onChange={(event) =>
                    setSfxForm((current) => ({
                      ...current,
                      useCase: event.target.value as SfxUseCase
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {sfxUseCases.map((value) => (
                    <option key={value} value={value}>
                      {formatTagLabel(value)}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                rows={4}
                value={sfxForm.notes}
                onChange={(event) =>
                  setSfxForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
                placeholder="Notas de uso e intensidade"
                className="mt-4 w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />

              <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-black/20 p-4 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Metadata
                </p>
                <p className="mt-2 text-white">
                  duracao {formatDuration(selectedSfxItem.profile?.durationSeconds)}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveSfxProfile();
                  }}
                  className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink"
                >
                  Salvar perfil de SFX
                </button>
              </div>
            </>
          ) : null}
        </article>
      </section>
    </div>
  );
}
