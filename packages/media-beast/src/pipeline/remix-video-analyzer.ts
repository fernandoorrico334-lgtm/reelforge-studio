import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RemixVideoPlatform } from "./remix-video-downloader.js";
import {
  clampRemixOutputDuration,
  clampRemixSourceDuration,
  evenSceneDurations,
  shortSceneCount
} from "./short-production-limits.js";
import {
  buildRemixContentIntelligence,
  type RemixStructuredContentDescription
} from "./remix-content-intelligence.js";
import {
  collectRemixResearch,
  type RemixResearchDossier,
  type RemixResearchOptions
} from "./remix-research-bridge.js";
import type { RemixSceneRole } from "./remix-scene-restructure.js";

const execFileAsync = promisify(execFile);

export interface RemixVideoMainScene {
  sceneId: string;
  order: number;
  role: RemixSceneRole;
  startSeconds: number;
  endSeconds: number;
  label: string;
  energy: "low" | "medium" | "high";
  focusEntity: string | null;
  focusAction: string | null;
  visualHint: string | null;
  narrationAngle: string | null;
}

export interface VideoRemixAnalysis {
  sourceDurationSeconds: number;
  outputDurationSeconds: number;
  probeMethod: "ffprobe" | "metadata" | "estimated";
  platform: RemixVideoPlatform | "local";
  title: string;
  themeSummary: string;
  contextKeywords: string[];
  mainScenes: RemixVideoMainScene[];
  narrativeArc: string[];
  analysisNotes: string[];
  contentIntelligence: RemixStructuredContentDescription;
  researchDossier: RemixResearchDossier | null;
}

const ROLE_SEQUENCE: RemixSceneRole[] = ["hook", "context", "evidence", "climax", "outro"];

const ROLE_LABELS: Record<RemixSceneRole, string> = {
  hook: "Abertura / gancho",
  context: "Contexto do assunto",
  evidence: "Prova visual / detalhe",
  tension: "Tensão narrativa",
  climax: "Momento de pico",
  outro: "Fechamento"
};

const FILENAME_NOISE = new Set([
  "smoke",
  "remix",
  "test",
  "local",
  "beast",
  "http",
  "placeholder",
  "tmp",
  "video",
  "clip",
  "source",
  "sample",
  "draft",
  "final",
  "output",
  "input",
  "mp4",
  "mov",
  "webm",
  "avi",
  "mkv",
  "short",
  "shorts",
  "reel",
  "reels"
]);

function normalizeRemixTitle(rawTitle: string): string {
  return (
    rawTitle
      .replace(/\.(mp4|mov|webm|avi|mkv|m4v)$/i, "")
      .replace(/#[\p{L}\p{N}_]+/gu, " ")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
      .replace(/[-_]+/g, " ")
      .replace(/\b\d{8,}\b/g, " ")
      .replace(/!+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || rawTitle.trim()
  );
}

function looksLikeFilenameTitle(title: string): boolean {
  const compact = title.replace(/\s+/g, "");
  return (
    /^(smoke|beast|test|remix|sample|tmp|local|http|placeholder)/i.test(title) ||
    /^[\w-]+\d{6,}$/i.test(compact) ||
    FILENAME_NOISE.has(title.toLowerCase().split(/\s+/)[0] ?? "")
  );
}

function resolveAnalysisTitle(title: string, topicHint?: string | null): string {
  const normalized = normalizeRemixTitle(title);
  const hint = topicHint?.trim().split("|")[0]?.trim();

  if (hint && hint.length > 8) {
    const hintWords = hint.split(/\s+/).filter(Boolean).length;
    const titleWords = normalized.split(/\s+/).filter(Boolean).length;
    const hintIsRicher =
      hintWords >= titleWords + 3 || hint.length >= normalized.length * 1.35;

    if (looksLikeFilenameTitle(normalized) || hintIsRicher) {
      return normalizeRemixTitle(hint);
    }
  }

  return normalized || hint || title;
}

function extractKeywords(title: string, platform: string): string[] {
  const hashtagTokens = [...title.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((match) => match[1]!);
  const cleaned = title
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[#@]|shorts?|reels?|tiktok|viral/gi, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned
    .split(/[\s,!?.\-:|]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(
      (token) =>
        token.length > 3 &&
        !FILENAME_NOISE.has(token) &&
        !/^\d+$/.test(token)
    );

  const meaningful = [...new Set([...tokens, ...hashtagTokens.map((tag) => tag.toLowerCase())])];
  const platformToken =
    platform !== "local" && !FILENAME_NOISE.has(platform) ? [platform] : [];

  return [...platformToken, ...meaningful].slice(0, 10);
}

function inferThemeSummary(title: string, platform: string, keywords: string[]): string {
  const subject = title.replace(/\s+/g, " ").trim() || "conteúdo de short-form";
  const lead =
    keywords
      .filter((keyword) => keyword !== platform && !FILENAME_NOISE.has(keyword))
      .slice(0, 3)
      .join(", ") || subject;

  if (/football|futebol|gol|lance|nba|sport|messi|ronaldo|neymar/i.test(subject)) {
    return `Clip esportivo de ${platform} sobre ${lead || "um lance marcante"}.`;
  }
  if (/crime|assassin|serial|mystery|caso|investiga/i.test(subject)) {
    return `Narrativa de true crime / mistério em ${platform}: ${lead || subject}.`;
  }
  if (/história|history|documentary|arquivo|império|guerra|século/i.test(subject)) {
    return `Conteúdo documental ou histórico vindo de ${platform}: ${lead || subject}.`;
  }
  if (/anime|manga|naruto|one piece|demon slayer|goku/i.test(subject)) {
    return `Corte de anime / cultura pop em ${platform}: ${lead || subject}.`;
  }
  if (/ciência|science|curios|fato|mistério científico|universo|espaço/i.test(subject)) {
    return `Short de curiosidades científicas em ${platform}: ${lead || subject}.`;
  }
  if (/tutorial|como|dica|hack|review|explica/i.test(subject)) {
    return `Conteúdo explicativo ou de review em ${platform}: ${lead || subject}.`;
  }
  if (/horror|terror|assombra|paranormal|sombrio/i.test(subject)) {
    return `Conteúdo de horror / suspense em ${platform}: ${lead || subject}.`;
  }

  if (looksLikeFilenameTitle(subject)) {
    return `Clip de short-form em ${platform} — use um título descritivo ou legenda para narração mais contextual.`;
  }

  return `Short de ${platform} com foco em ${lead || subject}.`;
}

async function probeDurationWithFfprobe(localPath: string): Promise<number | null> {
  const ffprobe = process.env.FFPROBE_PATH?.trim() || "ffprobe";

  try {
    const { stdout } = await execFileAsync(
      ffprobe,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        localPath
      ],
      { timeout: 15_000, windowsHide: true }
    );

    const parsed = Number(stdout.trim());
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : null;
  } catch {
    return null;
  }
}

function buildMainScenes(
  outputDurationSeconds: number,
  intensity: "medium" | "extreme",
  intelligence: RemixStructuredContentDescription
): RemixVideoMainScene[] {
  const sceneCount = shortSceneCount(outputDurationSeconds, intensity);
  const durations = evenSceneDurations(outputDurationSeconds, sceneCount);
  const scenes: RemixVideoMainScene[] = [];
  let cursor = 0;

  for (let index = 0; index < sceneCount; index += 1) {
    const role = ROLE_SEQUENCE[index] ?? "context";
    const duration = durations[index] ?? 7;
    const startSeconds = Number(cursor.toFixed(2));
    const endSeconds = Number((cursor + duration).toFixed(2));
    cursor += duration;
    const insight = intelligence.sceneInsights[index];

    scenes.push({
      sceneId: insight?.sceneId ?? `analysis-scene-${index + 1}`,
      order: index + 1,
      role,
      startSeconds,
      endSeconds,
      label: insight?.focusEntity
        ? `${ROLE_LABELS[role]} · ${insight.focusEntity}`
        : ROLE_LABELS[role],
      energy: insight?.energy ?? (role === "hook" || role === "climax" ? "high" : "medium"),
      focusEntity: insight?.focusEntity ?? intelligence.entities[0]?.name ?? null,
      focusAction: insight?.focusAction ?? intelligence.actions[0]?.label ?? null,
      visualHint: insight?.visualHint ?? null,
      narrationAngle: insight?.narrationAngle ?? null
    });
  }

  return scenes;
}

export async function analyzeRemixSourceVideo(input: {
  localPath: string;
  title: string;
  platform: RemixVideoPlatform | "local";
  topicHint?: string | null;
  metadataDurationSeconds?: number | null;
  targetOutputSeconds?: number | null;
  intensity?: "medium" | "extreme";
  researchOptions?: RemixResearchOptions;
}): Promise<VideoRemixAnalysis> {
  const intensity = input.intensity ?? "extreme";
  const probed = await probeDurationWithFfprobe(input.localPath);
  const metadataDuration =
    typeof input.metadataDurationSeconds === "number" &&
    Number.isFinite(input.metadataDurationSeconds)
      ? input.metadataDurationSeconds
      : null;

  const sourceDurationSeconds = clampRemixSourceDuration(
    probed ?? metadataDuration ?? 35
  );

  const probeMethod: VideoRemixAnalysis["probeMethod"] = probed
    ? "ffprobe"
    : metadataDuration
      ? "metadata"
      : "estimated";

  const outputDurationSeconds = clampRemixOutputDuration(
    input.targetOutputSeconds ?? Math.min(sourceDurationSeconds, 40)
  );

  const resolvedTitle = resolveAnalysisTitle(input.title, input.topicHint);
  const contentIntelligence = buildRemixContentIntelligence({
    title: input.title,
    platform: input.platform,
    topicHint: input.topicHint ?? null,
    outputDurationSeconds,
    intensity
  });
  const contextKeywords = [
    ...contentIntelligence.entities.map((entity) => entity.name),
    contentIntelligence.setting,
    contentIntelligence.actions[0]?.label,
    ...extractKeywords(input.title, input.platform)
  ]
    .filter((keyword): keyword is string => Boolean(keyword))
    .map((keyword) => keyword.toLowerCase())
    .slice(0, 10);
  const uniqueKeywords = [...new Set(contextKeywords)];
  const themeSummary =
    contentIntelligence.narrativeBrief ||
    (contentIntelligence.entities.length > 0
      ? contentIntelligence.headline
      : inferThemeSummary(resolvedTitle, input.platform, uniqueKeywords));
  const mainScenes = buildMainScenes(outputDurationSeconds, intensity, contentIntelligence);
  const preliminaryAnalysis: VideoRemixAnalysis = {
    sourceDurationSeconds,
    outputDurationSeconds,
    probeMethod,
    platform: input.platform,
    title: resolvedTitle,
    themeSummary,
    contextKeywords: uniqueKeywords,
    mainScenes,
    narrativeArc: [],
    analysisNotes: [],
    contentIntelligence,
    researchDossier: null
  };
  const researchDossier = collectRemixResearch(preliminaryAnalysis, {
    enabled: input.researchOptions?.enabled !== false,
    deepResearch: input.researchOptions?.deepResearch === true,
    ...(input.researchOptions?.selectedCuriosityIds
      ? { selectedCuriosityIds: input.researchOptions.selectedCuriosityIds }
      : {}),
    ...(input.researchOptions?.bypassCache
      ? { bypassCache: input.researchOptions.bypassCache }
      : {}),
    ...(input.researchOptions?.targetStyle
      ? { targetStyle: input.researchOptions.targetStyle }
      : {}),
    language: input.researchOptions?.language ?? "pt-BR",
    niche: input.researchOptions?.niche ?? contentIntelligence.domain
  });

  const analysisNotes = [
    `Duração da fonte: ${sourceDurationSeconds}s (${probeMethod}).`,
    `Remix alvo: ${outputDurationSeconds}s (máx. 45s).`,
    `${mainScenes.length} cenas principais mapeadas com entidades/ações (Fase 2).`,
    `Domínio detectado: ${contentIntelligence.domain}.`,
    contentIntelligence.entities.length
      ? `Entidades: ${contentIntelligence.entities.map((entity) => entity.name).join(", ")}.`
      : "Entidades: inferência limitada — forneça título/legenda mais descritivos.",
    contentIntelligence.actions.length
      ? `Ações: ${contentIntelligence.actions.map((action) => action.label).join(", ")}.`
      : null,
    researchDossier.rankedCuriosities.length
      ? `Research Collector: ${researchDossier.rankedCuriosities.length} curiosidades ranqueadas (${researchDossier.researchMode}${researchDossier.cacheHit ? ", cache" : ""}).`
      : "Research Collector: pesquisa automática sem curiosidades ranqueadas.",
    researchDossier.selectedCuriosityIds.length
      ? `Curiosidades selecionadas para narração: ${researchDossier.selectedCuriosityIds.length}.`
      : null
  ].filter((note): note is string => Boolean(note));

  if (probeMethod === "estimated") {
    analysisNotes.push(
      "ffprobe indisponível — duração estimada a partir de metadados do download."
    );
  }

  return {
    sourceDurationSeconds,
    outputDurationSeconds,
    probeMethod,
    platform: input.platform,
    title: resolvedTitle,
    themeSummary,
    contextKeywords: uniqueKeywords,
    mainScenes,
    narrativeArc: [
      contentIntelligence.narrativeHook,
      contentIntelligence.narrativeBrief,
      ...contentIntelligence.sceneInsights.map((insight) => insight.narrationAngle),
      contentIntelligence.curiosityAngle,
      ...contentIntelligence.differentiationGoals.slice(0, 2)
    ],
    analysisNotes,
    contentIntelligence,
    researchDossier
  };
}