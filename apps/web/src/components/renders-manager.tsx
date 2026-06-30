"use client";

import { useEffect, useState } from "react";
import {
  cancelRenderJobRequest,
  deleteRenderJobRequest,
  getRenderJobsSnapshot,
  retryRenderJobRequest
} from "../lib/studio-api";
import type { DataSource, StudioRenderJob } from "../lib/studio-types";
import { RenderJobCard } from "./render-job-card";

interface RendersManagerProps {
  initialJobs: StudioRenderJob[];
  initialSource: DataSource;
}

function isRenderJobActive(renderJob: StudioRenderJob) {
  return renderJob.status === "queued" || renderJob.status === "processing";
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Falha ao atualizar a fila de render.";
}

export function RendersManager({
  initialJobs,
  initialSource
}: RendersManagerProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const [source, setSource] = useState<DataSource>(initialSource);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Fila local real sincronizada."
      : "API indisponivel; exibindo fallback local."
  );

  const hasActiveJobs = jobs.some(isRenderJobActive);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const snapshot = await getRenderJobsSnapshot();

        if (!active) {
          return;
        }

        setJobs(snapshot.items);
        setSource(snapshot.source);
        setStatusMessage(
          snapshot.source === "api"
            ? snapshot.items.some(isRenderJobActive)
              ? "Worker acompanhando jobs ativos em tempo quase real."
              : "Fila local real sincronizada."
            : "API indisponivel; exibindo fallback local."
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
  }, [hasActiveJobs]);

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
      setJobs((current) =>
        [retriedJob, ...current].sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt)
        )
      );
      setSource("api");
      setStatusMessage(
        `Retry ${retriedJob.id.slice(0, 10)} criado a partir de ${renderJob.id.slice(0, 10)}.`
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
      setStatusMessage(`Render job ${renderJob.id.slice(0, 10)} removido.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    } finally {
      setBusyActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Queue monitor
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {jobs.length} render jobs monitorados
            </h2>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              source === "api"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : "border-amber-400/30 bg-amber-400/10 text-amber-100"
            }`}
          >
            {source === "api" ? "API local ativa" : "fallback local"}
          </span>
        </div>

        <p className="mt-4 text-sm text-mist/68">{statusMessage}</p>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-[1.6rem] border border-dashed border-white/15 bg-black/20 px-5 py-6 text-sm text-mist/68">
          Nenhum render job encontrado ainda.
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((renderJob) => (
            <RenderJobCard
              key={renderJob.id}
              busyActionId={busyActionId}
              onCancel={handleCancel}
              onDelete={handleDelete}
              onRetry={handleRetry}
              renderJob={renderJob}
              showProjectLink
            />
          ))}
        </div>
      )}
    </div>
  );
}

