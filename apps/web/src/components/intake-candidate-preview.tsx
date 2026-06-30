"use client";

import { useState } from "react";
import { getCandidateMediaUrl } from "../lib/studio-api";
import type { DataSource, MediaCandidate } from "../lib/studio-types";

interface IntakeCandidatePreviewProps {
  candidate: MediaCandidate;
  source: DataSource;
}

function inferPreviewKind(candidate: MediaCandidate) {
  const mimeType = candidate.mimeType?.toLowerCase() ?? "";
  const extension = candidate.extension?.toLowerCase() ?? "";

  if (
    mimeType.startsWith("image/") ||
    candidate.mediaType === "image" ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(extension)
  ) {
    return "image";
  }

  if (
    mimeType.startsWith("video/") ||
    candidate.mediaType === "video" ||
    [".mp4", ".mov", ".webm", ".m4v"].includes(extension)
  ) {
    return "video";
  }

  if (
    mimeType.startsWith("audio/") ||
    candidate.mediaType === "audio" ||
    candidate.mediaType === "music" ||
    candidate.mediaType === "sfx"
  ) {
    return "audio";
  }

  if (candidate.mediaType === "document" || candidate.mediaType === "reference") {
    return "document";
  }

  return "file";
}

function PreviewFallback({
  title,
  detail
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="flex h-full min-h-52 flex-col justify-between rounded-[1.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,158,102,0.18),transparent_32%),rgba(255,255,255,0.04)] p-5">
      <div className="inline-flex w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mist/70">
        Preview
      </div>
      <div>
        <p className="text-2xl font-semibold text-white">{title}</p>
        <p className="mt-3 text-sm leading-7 text-mist/68">{detail}</p>
      </div>
    </div>
  );
}

export function IntakeCandidatePreview({
  candidate,
  source
}: IntakeCandidatePreviewProps) {
  const [hasError, setHasError] = useState(false);
  const previewKind = inferPreviewKind(candidate);
  const previewUrl = getCandidateMediaUrl(candidate.id);
  const shouldTryPreview = source === "api" && !hasError;

  if (!shouldTryPreview) {
    return (
      <PreviewFallback
        title={candidate.mediaType}
        detail="Preview disponivel quando a API local puder acessar o arquivo original do inbox."
      />
    );
  }

  if (previewKind === "image") {
    return (
      <div className="min-h-52 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/30">
        <img
          src={previewUrl}
          alt={candidate.title}
          className="h-full min-h-52 w-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  if (previewKind === "video") {
    return (
      <div className="min-h-52 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/30">
        <video
          controls
          preload="metadata"
          className="h-full min-h-52 w-full object-cover"
          onError={() => setHasError(true)}
        >
          <source src={previewUrl} />
        </video>
      </div>
    );
  }

  if (previewKind === "audio") {
    return (
      <div className="flex min-h-52 flex-col justify-between rounded-[1.4rem] border border-white/10 bg-[linear-gradient(145deg,rgba(99,255,225,0.18),rgba(255,255,255,0.04))] p-5">
        <div className="inline-flex w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mist/70">
          Audio Preview
        </div>
        <div className="space-y-4">
          <p className="text-2xl font-semibold text-white">{candidate.mediaType}</p>
          <audio
            controls
            preload="metadata"
            className="w-full"
            onError={() => setHasError(true)}
          >
            <source src={previewUrl} />
          </audio>
        </div>
      </div>
    );
  }

  if (previewKind === "document") {
    return (
      <PreviewFallback
        title="DOC"
        detail="Documentos e referencias nao-media entram nesta etapa para revisao e catalogacao manual."
      />
    );
  }

  return (
    <PreviewFallback
      title={candidate.mediaType}
      detail="Este formato ainda usa placeholder visual, mas ja pode ser aprovado, rejeitado e importado quando suportado."
    />
  );
}

