"use client";

import { getAssetMediaUrl } from "../lib/studio-api";
import type {
  CaptionPosition,
  CaptionStyleSummary,
  DataSource,
  StudioAsset
} from "../lib/studio-types";

interface CaptionFramePreviewProps {
  asset: StudioAsset | null;
  assetSource: DataSource;
  captionLines: string[];
  captionStyle: CaptionStyleSummary;
  captionPosition: CaptionPosition;
  emphasisWords: string[];
}

function inferPreviewKind(asset: StudioAsset | null) {
  if (!asset) {
    return "none";
  }

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

  return "fallback";
}

function buildPositionClasses(position: CaptionPosition) {
  switch (position) {
    case "top":
      return "items-start pt-10";
    case "center":
      return "items-center justify-center";
    case "bottom":
      return "items-end pb-10";
    case "split":
      return "items-center justify-center";
    case "lower-third":
    default:
      return "items-end pb-24";
  }
}

function cleanWord(word: string) {
  return word.replace(/[!?.,;:()[\]"]/g, "").toLowerCase();
}

function buildTextShadow(style: CaptionStyleSummary) {
  const outline = style.outline;
  const shadow = style.shadow;
  const outlineShadow = [
    `${outline.width}px 0 ${outline.color}`,
    `-${outline.width}px 0 ${outline.color}`,
    `0 ${outline.width}px ${outline.color}`,
    `0 -${outline.width}px ${outline.color}`
  ];
  const ambientShadow = `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px rgba(0,0,0,${shadow.opacity})`;

  return [...outlineShadow, ambientShadow].join(", ");
}

function renderHighlightedLine(line: string, emphasisWords: string[]) {
  const emphasisSet = new Set(emphasisWords.map((entry) => cleanWord(entry)));

  return line.split(" ").map((word, index) => {
    const shouldHighlight = emphasisSet.has(cleanWord(word));

    return (
      <span
        key={`${word}-${index}`}
        className={shouldHighlight ? "text-[#ffe45c]" : undefined}
      >
        {word}
        {index < line.split(" ").length - 1 ? " " : ""}
      </span>
    );
  });
}

export function CaptionFramePreview({
  asset,
  assetSource,
  captionLines,
  captionStyle,
  captionPosition,
  emphasisWords
}: CaptionFramePreviewProps) {
  const previewKind = inferPreviewKind(asset);
  const mediaUrl = asset ? getAssetMediaUrl(asset.id) : null;
  const showMedia = assetSource === "api" && mediaUrl !== null;
  const lines = captionLines.length > 0 ? captionLines : ["PREVIEW DE LEGENDA"];
  const positionClasses = buildPositionClasses(captionPosition);
  const textShadow = buildTextShadow(captionStyle);

  return (
    <article className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/30">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-mist/45">
            Caption Preview
          </p>
          <p className="mt-1 text-sm text-mist/68">
            Frame vertical 9:16 com aproximacao HTML/CSS do estilo aplicado.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-mist/70">
          {captionStyle.id}
        </span>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[0.7fr_0.3fr]">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(99,255,225,0.18),transparent_28%),linear-gradient(180deg,#07090d,#121826)]">
          {showMedia && previewKind === "image" ? (
            <img
              src={mediaUrl}
              alt={asset?.originalName ?? "Asset preview"}
              className="absolute inset-0 h-full w-full object-cover opacity-75"
            />
          ) : null}

          {showMedia && previewKind === "video" ? (
            <video
              src={mediaUrl}
              className="absolute inset-0 h-full w-full object-cover opacity-70"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : null}

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,12,0.14),rgba(4,7,12,0.66))]" />

          <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-4 text-[10px] uppercase tracking-[0.22em] text-mist/55">
            <span>{asset ? asset.type : "NO ASSET"}</span>
            <span>{captionStyle.position}</span>
          </div>

          <div
            className={`absolute inset-0 flex px-5 ${positionClasses}`}
          >
            <div
              className="w-full rounded-[1.2rem]"
              style={{
                backgroundColor: captionStyle.background.enabled
                  ? `rgba(0, 0, 0, ${captionStyle.background.opacity})`
                  : "transparent",
                padding: captionStyle.background.enabled
                  ? `${captionStyle.background.paddingY}px ${captionStyle.background.paddingX}px`
                  : undefined,
                borderRadius: captionStyle.background.enabled
                  ? `${captionStyle.background.radius}px`
                  : undefined
              }}
            >
              {lines.map((line, index) => (
                <div
                  key={`${line}-${index}`}
                  className="text-center"
                  style={{
                    fontFamily: captionStyle.fontFamily,
                    fontSize: `${Math.max(captionStyle.fontSize * 0.52, 20)}px`,
                    fontWeight: captionStyle.fontWeight,
                    letterSpacing:
                      captionStyle.textTransform === "uppercase" ? "0.03em" : "0.01em",
                    lineHeight: 1.04,
                    textTransform: captionStyle.textTransform,
                    textShadow,
                    color: "#ffffff"
                  }}
                >
                  {renderHighlightedLine(line, emphasisWords)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Estilo
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              {captionStyle.name}
            </p>
            <p className="mt-2 text-sm leading-7 text-mist/68">
              {captionStyle.description}
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Layout
            </p>
            <p className="mt-2 text-sm text-white">
              posicao {captionPosition} - max {captionStyle.maxLines} linhas -{" "}
              {captionStyle.maxCharsPerLine} chars por linha
            </p>
            <p className="mt-2 text-sm text-mist/68">
              animacao {captionStyle.animation.entry} / enfase{" "}
              {captionStyle.animation.emphasis}
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Palavras em enfase
            </p>
            <p className="mt-2 text-sm text-white">
              {emphasisWords.length > 0 ? emphasisWords.join(", ") : "nenhuma"}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}