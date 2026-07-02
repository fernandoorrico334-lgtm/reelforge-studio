"use client";

import { getAudioMasteringPresets } from "@reelforge/audio-engine/mastering";
import { useEffect, useState, useTransition } from "react";
import {
  cancelRenderJobRequest,
  createRenderJobRequest,
  deleteRenderJobRequest,
  getProjectRenderJobsSnapshot,
  retryRenderJobRequest
} from "../lib/studio-api";
import {
  renderModes,
  renderQualities,
  type AudioMasteringPreview,
  type AudioMasteringPresetId,
  type DataSource,
  type RenderMode,
  type RenderQuality,
  type StudioRenderJob
} from "../lib/studio-types";
import { RenderJobCard } from "./render-job-card";

interface RenderJobsPanelProps {
  projectId: string;
  selectedAudioMasteringPresetId?: AudioMasteringPresetId;
  onSelectAudioMasteringPreset?: (presetId: AudioMasteringPresetId) => void;
  audioMasteringPreview?: AudioMasteringPreview | null;
}

const audioMasteringPresets = getAudioMasteringPresets();

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Falha ao comunicar com a API local de render.";
}

function isRenderJobActive(renderJob: StudioRenderJob) {
  return renderJob.status === "queued" || renderJob.status === "processing";
}

function countByStatus(
  renderJobs: StudioRenderJob[],
  statuses: StudioRenderJob["status"][]
) {
  return renderJobs.filter((renderJob) => statuses.includes(renderJob.status)).length;
}

export function RenderJobsPanel({
  projectId,
  selectedAudioMasteringPresetId,
  onSelectAudioMasteringPreset,
  audioMasteringPreview = null
}: RenderJobsPanelProps) {
  const [jobs, setJobs] = useState<StudioRenderJob[]>([]);
  const [source, setSource] = useState<DataSource>("mock");
  const [statusMessage, setStatusMessage] = useState(
    "Carregando render jobs do projeto."
  );
  const [selectedRenderMode, setSelectedRenderMode] =
    useState<RenderMode>("v1");
  const [selectedRenderQuality, setSelectedRenderQuality] =
    useState<RenderQuality>("standard");
  const [localAudioMasteringPresetId, setLocalAudioMasteringPresetId] =
    useState<AudioMasteringPresetId>("shorts_clean_voice");
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasActiveJobs = jobs.some(isRenderJobActive);
  const effectiveAudioMasteringPresetId =
    selectedAudioMasteringPresetId ?? localAudioMasteringPresetId;
  const selectedAudioMasteringPreset =
    audioMasteringPresets.find(
      (preset) => preset.id === effectiveAudioMasteringPresetId
    ) ?? audioMasteringPresets[0]!;

  function handleAudioPresetChange(presetId: AudioMasteringPresetId) {
    if (onSelectAudioMasteringPreset) {
      onSelectAudioMasteringPreset(presetId);
      return;
    }

    setLocalAudioMasteringPresetId(presetId);
  }

  async function refreshJobs() {
    const snapshot = await getProjectRenderJobsSnapshot(projectId);
    setJobs(snapshot.items);
    setSource(snapshot.source);
    setStatusMessage(
      snapshot.source === "api"
        ? snapshot.items.some(isRenderJobActive)
          ? "Worker acompanhando jobs ativos em tempo quase real."
          : "Render jobs sincronizados com a API local."
        : "API indisponivel para render jobs; exibindo fallback vazio."
    );
  }

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const snapshot = await getProjectRenderJobsSnapshot(projectId);

        if (!active) {
          return;
        }

        setJobs(snapshot.items);
        setSource(snapshot.source);
        setStatusMessage(
          snapshot.source === "api"
            ? snapshot.items.some(isRenderJobActive)
              ? "Worker acompanhando jobs ativos em tempo quase real."
              : "Render jobs sincronizados com a API local."
            : "API indisponivel para render jobs; exibindo fallback vazio."
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setStatusMessage(extractErrorMessage(error));
      }
    };

    void refresh();

    if (!hasActiveJobs) {
      return () => {
        active = false;
      };
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 2_500);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [hasActiveJobs, projectId]);

  function handleCreateRenderJob() {
    startTransition(async () => {
      try {
        const createdJob = await createRenderJobRequest(projectId, {
          renderMode: selectedRenderMode,
          renderQuality: selectedRenderQuality,
          audioMasteringPresetId: effectiveAudioMasteringPresetId
        });
        setJobs((current) =>
          [createdJob, ...current.filter((job) => job.id !== createdJob.id)].sort(
            (left, right) => right.createdAt.localeCompare(left.createdAt)
          )
        );
        setSource("api");
        setStatusMessage(
          `Render job ${createdJob.id.slice(0, 10)} criado em ${createdJob.renderMode} (${createdJob.renderQuality}) com preset ${createdJob.audioMasteringPresetId ?? effectiveAudioMasteringPresetId}.`
        );
      } catch (error) {
        setStatusMessage(extractErrorMessage(error));
      }
    });
  }

  async function handleCancel(renderJob: StudioRenderJob) {
    setBusyActionId(renderJob.id);

    try {
      const updatedJob = await cancelRenderJobRequest(renderJob.id);
      setJobs((current) =>
        current.map((job) => (job.id === updatedJob.id ? updatedJob : job))
      );
      setSource("api");
      setStatusMessage(`Render job ${renderJob.id.slice(0, 10)} cancelado.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleRetry(renderJob: StudioRenderJob) {
    setBusyActionId(renderJob.id);

    try {
      const retriedJob = await retryRenderJobRequest(renderJob.id);
      await refreshJobs();
      setJobs((current) =>
        [retriedJob, ...current.filter((job) => job.id !== retriedJob.id)].sort(
          (left, right) => right.createdAt.localeCompare(left.createdAt)
        )
      );
      setSource("api");
      setStatusMessage(
        `Novo retry ${retriedJob.id.slice(0, 10)} criado a partir de ${renderJob.id.slice(0, 10)}.`
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleDelete(renderJob: StudioRenderJob) {
    setBusyActionId(renderJob.id);

    try {
      await deleteRenderJobRequest(renderJob.id);
      setJobs((current) => current.filter((job) => job.id !== renderJob.id));
      setSource("api");
      setStatusMessage(
        `Render job ${renderJob.id.slice(0, 10)} removido do painel.`
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyActionId(null);
    }
  }

  return (
    <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Renderizacoes
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Render Engine local com V1 e Cinematic V2
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-mist/70">
            Gere jobs a partir do Render Blueprint, escolha entre o fallback
            rapido V1 e o pipeline visual Cinematic V2, acompanhe progresso,
            logs, thumbnail, metadata final e a trilha operacional completa do
            worker local.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              source === "api"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : "border-amber-400/30 bg-amber-400/10 text-amber-100"
            }`}
          >
            {source === "api" ? "API local" : "fallback local"}
          </span>
          <label className="min-w-[180px]">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Modo
            </span>
            <select
              value={selectedRenderMode}
              onChange={(event) =>
                setSelectedRenderMode(event.target.value as RenderMode)
              }
              className="w-full rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
            >
              {renderModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === "v1" ? "Render V1 rapido" : "Cinematic V2"}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[160px]">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Qualidade
            </span>
            <select
              value={selectedRenderQuality}
              onChange={(event) =>
                setSelectedRenderQuality(event.target.value as RenderQuality)
              }
              className="w-full rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
            >
              {renderQualities.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[220px]">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Audio Mastering
            </span>
            <select
              value={effectiveAudioMasteringPresetId}
              onChange={(event) =>
                handleAudioPresetChange(
                  event.target.value as AudioMasteringPresetId
                )
              }
              className="w-full rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
            >
              {audioMasteringPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={isPending}
            onClick={handleCreateRenderJob}
            className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Criando job..."
              : selectedRenderMode === "v1"
                ? "Gerar render V1"
                : "Gerar Cinematic V2"}
          </button>
        </div>
      </div>

      <p className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
        {statusMessage}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-mist/58">
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
          `v1`: mais rapido e conservador
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
          `cinematic_v2`: motion, fades e look visual mais premium
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
          mastering `{selectedAudioMasteringPreset.id}`
        </span>
      </div>

      <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Mix Preview
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              {selectedAudioMasteringPreset.name}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-mist/68">
              {audioMasteringPreview?.summary ?? selectedAudioMasteringPreset.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-mist/65">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              target {selectedAudioMasteringPreset.targetLufs} LUFS
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              ducking {audioMasteringPreview?.duckingMode ?? (selectedAudioMasteringPreset.duckingEnabled ? "sidechain" : "none")}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              compressor {(audioMasteringPreview?.compressorApplied ?? selectedAudioMasteringPreset.compressorEnabled) ? "on" : "off"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              limiter {(audioMasteringPreview?.limiterApplied ?? selectedAudioMasteringPreset.limiterEnabled) ? "on" : "off"}
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-mist/68">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Narracao
            </p>
            <p className="mt-2 text-white">
              {audioMasteringPreview?.narrationIncluded ? "incluida" : "off"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-mist/68">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Musica
            </p>
            <p className="mt-2 text-white">
              {audioMasteringPreview?.musicIncluded ? "incluida" : "off"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-mist/68">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              SFX
            </p>
            <p className="mt-2 text-white">
              {audioMasteringPreview?.sfxIncluded ? "incluido" : "off"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-mist/68">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Voz gain
            </p>
            <p className="mt-2 text-white">
              {selectedAudioMasteringPreset.narrationGainDb > 0 ? "+" : ""}
              {selectedAudioMasteringPreset.narrationGainDb} dB
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-mist/68">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Music gain
            </p>
            <p className="mt-2 text-white">
              {selectedAudioMasteringPreset.musicGainDb} dB
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-mist/68">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Peak
            </p>
            <p className="mt-2 text-white">
              {selectedAudioMasteringPreset.truePeakDb} dBTP
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
            Jobs totais
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">{jobs.length}</p>
        </div>
        <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
            Em fila ou processo
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {countByStatus(jobs, ["queued", "processing"])}
          </p>
        </div>
        <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
            Concluidos
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {countByStatus(jobs, ["completed"])}
          </p>
        </div>
        <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
            Falha ou cancelado
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {countByStatus(jobs, ["failed", "cancelled"])}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {jobs.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-black/20 px-4 py-6 text-sm text-mist/68">
            Nenhum render job criado ainda para este projeto.
          </div>
        ) : (
          jobs.map((renderJob) => (
            <RenderJobCard
              key={renderJob.id}
              busyActionId={busyActionId}
              onCancel={handleCancel}
              onDelete={handleDelete}
              onRetry={handleRetry}
              renderJob={renderJob}
            />
          ))
        )}
      </div>
    </article>
  );
}

