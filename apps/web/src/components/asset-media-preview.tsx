"use client";

import { useState } from "react";
import { getAssetMediaUrl } from "../lib/studio-api";
import type { DataSource, StudioAsset } from "../lib/studio-types";

interface AssetMediaPreviewProps {
  asset: StudioAsset;
  source: DataSource;
}

function inferPreviewKind(asset: StudioAsset) {
  const mimeType = asset.mimeType?.toLowerCase() ?? "";
  const extension = asset.extension?.toLowerCase() ?? "";

  if (
    mimeType.startsWith("image/") ||
    (asset.type === "IMAGE" &&
      [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(extension))
  ) {
    return "image";
  }

  if (
    mimeType.startsWith("video/") ||
    (asset.type === "VIDEO" &&
      [".mp4", ".mov", ".webm", ".m4v"].includes(extension))
  ) {
    return "video";
  }

  if (
    mimeType.startsWith("audio/") ||
    asset.type === "AUDIO" ||
    asset.type === "MUSIC" ||
    asset.type === "SFX"
  ) {
    return "audio";
  }

  if (asset.type === "FONT") {
    return "font";
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
    <div className="flex h-full min-h-48 flex-col justify-between rounded-[1.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,255,225,0.18),transparent_32%),rgba(255,255,255,0.04)] p-5">
      <div className="inline-flex w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mist/70">
        Preview
      </div>
      <div>
        <p className="text-3xl font-semibold text-white">{title}</p>
        <p className="mt-3 text-sm leading-7 text-mist/68">{detail}</p>
      </div>
    </div>
  );
}

export function AssetMediaPreview({
  asset,
  source
}: AssetMediaPreviewProps) {
  const [hasError, setHasError] = useState(false);
  const previewKind = inferPreviewKind(asset);
  const mediaUrl = getAssetMediaUrl(asset.id);
  const shouldTryPreview = source === "api" && !hasError;

  if (!shouldTryPreview) {
    return (
      <PreviewFallback
        title={asset.type}
        detail="Preview disponivel quando o arquivo estiver acessivel pela API local."
      />
    );
  }

  if (previewKind === "image") {
    return (
      <div className="min-h-48 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/30">
        <img
          src={mediaUrl}
          alt={asset.originalName}
          className="h-full min-h-48 w-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  if (previewKind === "video") {
    return (
      <div className="min-h-48 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/30">
        <video
          controls
          preload="metadata"
          className="h-full min-h-48 w-full object-cover"
          onError={() => setHasError(true)}
        >
          <source src={mediaUrl} />
        </video>
      </div>
    );
  }

  if (previewKind === "audio") {
    return (
      <div className="flex min-h-48 flex-col justify-between rounded-[1.4rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,158,102,0.18),rgba(255,255,255,0.04))] p-5">
        <div className="inline-flex w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mist/70">
          Audio Preview
        </div>
        <div className="space-y-4">
          <p className="text-2xl font-semibold text-white">{asset.type}</p>
          <audio
            controls
            preload="metadata"
            className="w-full"
            onError={() => setHasError(true)}
          >
            <source src={mediaUrl} />
          </audio>
        </div>
      </div>
    );
  }

  if (previewKind === "font") {
    return (
      <PreviewFallback
        title="Aa"
        detail="Fonte catalogada. Preview tipografico detalhado entra na proxima iteracao."
      />
    );
  }

  return (
    <PreviewFallback
      title={asset.type}
      detail="Este formato ainda usa placeholder visual, mas ja esta catalogado na biblioteca."
    />
  );
}

