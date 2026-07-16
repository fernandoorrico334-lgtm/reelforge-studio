"use client";

import Link from "next/link";
import {
  getRenderLogUrl,
  getRenderMediaUrl,
  getRenderThumbnailUrl
} from "../lib/studio-api";
import type { StudioRenderJob } from "../lib/studio-types";

interface RenderJobCardProps {
  renderJob: StudioRenderJob;
  showProjectLink?: boolean;
  busyActionId?: string | null;
  onCancel?: (renderJob: StudioRenderJob) => void | Promise<void>;
  onRetry?: (renderJob: StudioRenderJob) => void | Promise<void>;
  onDelete?: (renderJob: StudioRenderJob) => void | Promise<void>;
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
  switch (value) {
    case "queued":
      return "na fila";
    case "processing":
      return "processando";
    case "completed":
      return "concluido";
    case "failed":
      return "falhou";
    case "cancelled":
      return "cancelado";
    default:
      return value.replaceAll("_", " ").toLowerCase();
  }
}

function formatModeLabel(value: StudioRenderJob["renderMode"]) {
  return value === "cinematic_v2" ? "cinematic v2" : "v1";
}

function formatQualityLabel(value: StudioRenderJob["renderQuality"]) {
  switch (value) {
    case "draft":
      return "draft";
    case "high":
      return "high";
    default:
      return "standard";
  }
}

function formatStepLabel(step: StudioRenderJob["currentStep"]) {
  switch (step) {
    case "reading_blueprint":
      return "Lendo blueprint";
    case "generating_subtitles":
      return "Gerando legendas";
    case "rendering_scene":
      return "Renderizando cenas";
    case "concatenating_segments":
      return "Concatenando segmentos";
    case "burning_subtitles":
      return "Queimando legendas";
    case "generating_thumbnail":
      return "Gerando thumbnail";
    case "probing_output":
      return "Coletando metadata";
    case "completed":
      return "Concluido";
    default:
      return "Aguardando etapa";
  }
}

function getStatusTone(status: StudioRenderJob["status"]) {
  switch (status) {
    case "completed":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
    case "failed":
      return "border-[#ff8b8b]/25 bg-[#ff8b8b]/10 text-[#ffd4d4]";
    case "cancelled":
      return "border-[#ffc48b]/25 bg-[#ffc48b]/10 text-[#ffe0c5]";
    case "processing":
      return "border-[#92a7ff]/25 bg-[#92a7ff]/10 text-[#dbe2ff]";
    default:
      return "border-[#ffcf70]/25 bg-[#ffcf70]/10 text-[#fff0c6]";
  }
}

function getModeTone(renderMode: StudioRenderJob["renderMode"]) {
  return renderMode === "cinematic_v2"
    ? "border-[#63ffe1]/30 bg-[#63ffe1]/10 text-[#d4fff8]"
    : "border-[#92a7ff]/25 bg-[#92a7ff]/10 text-[#dbe2ff]";
}

function formatDuration(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "n/d";
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)}s`;
}

function formatResolution(width: number | null, height: number | null) {
  if (!width || !height) {
    return "n/d";
  }

  return `${width}x${height}`;
}

function formatFileSize(bytes: number | null) {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes <= 0) {
    return "n/d";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}


function formatDnaVerdictLabel(value: string) {
  switch (value) {
    case "reference_ready":
      return "referencia pronta";
    case "strong":
      return "forte";
    case "needs_pacing_fix":
      return "ajustar ritmo";
    case "blocked":
      return "bloqueado";
    default:
      return value.replaceAll("_", " ");
  }
}

function getDnaVerdictTone(value: string) {
  switch (value) {
    case "reference_ready":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
    case "strong":
      return "border-[#7be0ff]/25 bg-[#7be0ff]/10 text-[#dff8ff]";
    case "blocked":
      return "border-[#ff8b8b]/25 bg-[#ff8b8b]/10 text-[#ffd4d4]";
    default:
      return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  }
}
function formatBooleanLabel(value: boolean) {
  return value ? "on" : "off";
}

export function RenderJobCard({
  renderJob,
  showProjectLink = false,
  busyActionId = null,
  onCancel,
  onRetry,
  onDelete
}: RenderJobCardProps) {
  const isBusy = busyActionId === renderJob.id;
  const hasVideo = renderJob.status === "completed" && Boolean(renderJob.outputPath);
  const hasLog = Boolean(renderJob.logPath);
  const hasThumbnail =
    renderJob.status === "completed" &&
    Boolean(renderJob.thumbnailUrl ?? renderJob.thumbnailPath);
  const audioQualityReport = renderJob.metadata?.audioQualityReport ?? null;
  const finalVideoDna = renderJob.metadata?.finalVideoDna ?? null;
  const mediaUrl = renderJob.mediaUrl ?? getRenderMediaUrl(renderJob.id);
  const logUrl = renderJob.logUrl ?? getRenderLogUrl(renderJob.id);
  const thumbnailUrl =
    renderJob.thumbnailUrl ?? getRenderThumbnailUrl(renderJob.id);
  const canCancel =
    (renderJob.status === "queued" || renderJob.status === "processing") &&
    Boolean(onCancel);
  const canRetry =
    (renderJob.status === "failed" || renderJob.status === "cancelled") &&
    Boolean(onRetry);
  const canDelete = renderJob.status !== "processing" && Boolean(onDelete);

  return (
    <article className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/20">
      <div
        className={`border-b border-white/8 p-5 ${
          renderJob.renderMode === "cinematic_v2"
            ? "bg-[radial-gradient(circle_at_top_left,_rgba(99,255,225,0.2),_transparent_46%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08))]"
            : "bg-[radial-gradient(circle_at_top_left,_rgba(146,167,255,0.18),_transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.04))]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] ${getStatusTone(
                  renderJob.status
                )}`}
              >
                {formatStatusLabel(renderJob.status)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/72">
                progresso {renderJob.progress ?? 0}%
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/72">
                tentativa {renderJob.attempt}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${getModeTone(
                  renderJob.renderMode
                )}`}
              >
                {formatModeLabel(renderJob.renderMode)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.16em] text-mist/72">
                {formatQualityLabel(renderJob.renderQuality)}
              </span>
              {renderJob.audioMasteringPresetId ? (
                <span className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[#dff8ff]">
                  {renderJob.audioMasteringPresetId}
                </span>
              ) : null}
            </div>
            <h3 className="mt-4 text-xl font-semibold text-white">
              Job {renderJob.id.slice(0, 10)}
            </h3>
            <p className="mt-2 text-sm text-mist/68">
              Projeto {renderJob.videoProject.title}
            </p>
            <p className="mt-3 text-sm text-mist/68">
              {formatStepLabel(renderJob.currentStep)}
              {renderJob.currentSceneIndex && renderJob.totalScenes
                ? ` Â· cena ${renderJob.currentSceneIndex}/${renderJob.totalScenes}`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {showProjectLink ? (
              <Link
                href={`/projects/${renderJob.videoProjectId}`}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80 transition hover:border-signal/35 hover:text-white"
              >
                Abrir projeto
              </Link>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  void onCancel?.(renderJob);
                }}
                className="rounded-full border border-[#ffcf70]/20 bg-[#ffcf70]/10 px-4 py-2 text-sm text-[#fff0c6] transition hover:border-[#ffcf70]/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
            ) : null}
            {canRetry ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  void onRetry?.(renderJob);
                }}
                className="rounded-full border border-[#92a7ff]/20 bg-[#92a7ff]/10 px-4 py-2 text-sm text-[#dbe2ff] transition hover:border-[#92a7ff]/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Retry
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  void onDelete?.(renderJob);
                }}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80 transition hover:border-[#ff8b8b]/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Deletar
              </button>
            ) : null}
            {hasLog ? (
              <a
                href={logUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80 transition hover:border-signal/35 hover:text-white"
              >
                Ver log
              </a>
            ) : null}
            {hasVideo ? (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80 transition hover:border-signal/35 hover:text-white"
              >
                Abrir MP4
              </a>
            ) : null}
          </div>
        </div>

        {renderJob.retriedFromJobId ? (
          <p className="mt-4 text-sm text-mist/62">
            Retry originado de {renderJob.retriedFromJobId.slice(0, 10)}
          </p>
        ) : null}
      </div>

      <div className="p-5">
        <div className="grid gap-3 md:grid-cols-5 xl:grid-cols-10">
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Criado
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {formatDate(renderJob.createdAt)}
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Iniciado
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {formatDate(renderJob.startedAt)}
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Finalizado
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {formatDate(renderJob.completedAt ?? renderJob.cancelledAt)}
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Modo
            </p>
            <p className="mt-2 text-sm font-medium uppercase text-white">
              {formatModeLabel(renderJob.renderMode)}
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Qualidade
            </p>
            <p className="mt-2 text-sm font-medium uppercase text-white">
              {formatQualityLabel(renderJob.renderQuality)}
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Mastering
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {renderJob.audioMasteringPresetId ?? "default"}
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Resolucao
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {formatResolution(renderJob.outputWidth, renderJob.outputHeight)}
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Duracao
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {formatDuration(renderJob.outputDuration)}
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Codec
            </p>
            <p className="mt-2 text-sm font-medium uppercase text-white">
              {renderJob.outputCodec ?? "n/d"}
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Arquivo
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {formatFileSize(renderJob.outputFileSize)}
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Cena atual
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {renderJob.currentSceneIndex && renderJob.totalScenes
                ? `${renderJob.currentSceneIndex}/${renderJob.totalScenes}`
                : "n/d"}
            </p>
          </div>
        </div>

        {finalVideoDna ? (
          <div className="mt-4 rounded-[1.25rem] border border-[#7be0ff]/15 bg-[#7be0ff]/[0.05] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Final Video DNA QA
                </p>
                <p className="mt-2 text-sm text-white">
                  Score {finalVideoDna.overallScore}/100 - {formatDnaVerdictLabel(finalVideoDna.verdict)}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${getDnaVerdictTone(finalVideoDna.verdict)}`}>
                {formatDnaVerdictLabel(finalVideoDna.verdict)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Cortes/min
                </p>
                <p className="mt-2 text-white">
                  {finalVideoDna.measured.cutsPerMinute.toFixed(1)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Plano medio
                </p>
                <p className="mt-2 text-white">
                  {formatDuration(finalVideoDna.measured.averageShotDurationSeconds)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Captions/min
                </p>
                <p className="mt-2 text-white">
                  {finalVideoDna.measured.captionCuesPerMinute.toFixed(1)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Audio peaks
                </p>
                <p className="mt-2 text-white">
                  {finalVideoDna.measured.audioPeakCount}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Vertical
                </p>
                <p className="mt-2 text-white">
                  {formatBooleanLabel(finalVideoDna.measured.verticalConfirmed)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Extracao
                </p>
                <p className="mt-2 text-white">
                  {finalVideoDna.measured.extractionStatus}
                </p>
              </div>
            </div>

            {finalVideoDna.warnings.length > 0 || finalVideoDna.blockers.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {[...finalVideoDna.blockers, ...finalVideoDna.warnings].join(" ")}
              </div>
            ) : null}
          </div>
        ) : null}
        {audioQualityReport ? (
          <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Audio Quality Report
                </p>
                <p className="mt-2 text-sm text-white">
                  {audioQualityReport.masteringPresetName} -{" "}
                  {audioQualityReport.targetLufs} LUFS - codec{" "}
                  {audioQualityReport.finalAudioCodec ?? renderJob.audioCodec ?? "n/a"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-mist/68">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  ducking {audioQualityReport.duckingMode}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  loudnorm {formatBooleanLabel(audioQualityReport.loudnormApplied)}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  limiter {formatBooleanLabel(audioQualityReport.limiterApplied)}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Narracao
                </p>
                <p className="mt-2 text-white">
                  {formatBooleanLabel(audioQualityReport.narrationIncluded)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Musica
                </p>
                <p className="mt-2 text-white">
                  {formatBooleanLabel(audioQualityReport.musicIncluded)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  SFX
                </p>
                <p className="mt-2 text-white">
                  {formatBooleanLabel(audioQualityReport.sfxIncluded)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Sample rate
                </p>
                <p className="mt-2 text-white">
                  {audioQualityReport.finalAudioSampleRate ?? renderJob.audioSampleRate ?? "n/a"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Bitrate
                </p>
                <p className="mt-2 text-white">
                  {audioQualityReport.finalAudioBitrate ?? "n/a"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Duracao audio
                </p>
                <p className="mt-2 text-white">
                  {formatDuration(audioQualityReport.measuredOutputDuration)}
                </p>
              </div>
            </div>

            {audioQualityReport.warnings.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {audioQualityReport.warnings.join(" ")}
              </div>
            ) : null}
          </div>
        ) : null}

        {renderJob.errorMessage ? (
          <div className="mt-4 rounded-[1.2rem] border border-[#ff8b8b]/20 bg-[#ff8b8b]/10 px-4 py-3 text-sm text-[#ffd4d4]">
            {renderJob.errorMessage}
          </div>
        ) : null}

        {(hasThumbnail || hasVideo) ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
            {hasThumbnail ? (
              <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/30">
                <img
                  alt={`Thumbnail do render ${renderJob.id}`}
                  className="aspect-[9/16] h-full w-full object-cover"
                  src={thumbnailUrl ?? undefined}
                />
              </div>
            ) : null}

            {hasVideo ? (
              <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/30">
                <video
                  controls
                  className="aspect-[9/16] w-full bg-black object-cover"
                  src={mediaUrl}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {hasVideo ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={mediaUrl}
              download
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80 transition hover:border-signal/35 hover:text-white"
            >
              Baixar MP4
            </a>
            {hasThumbnail ? (
              <a
                href={thumbnailUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/80 transition hover:border-signal/35 hover:text-white"
              >
                Abrir thumbnail
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

