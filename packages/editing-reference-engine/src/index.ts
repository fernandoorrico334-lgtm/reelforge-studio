export const editingReferenceSourceTypes = [
  "local_file",
  "asset_library"
] as const;

export type EditingReferenceSourceType =
  (typeof editingReferenceSourceTypes)[number];

export const editingReferenceCategories = [
  "football",
  "documentary",
  "true_crime",
  "cinematic",
  "viral",
  "generic"
] as const;

export type EditingReferenceCategory =
  (typeof editingReferenceCategories)[number];

export const editingReferenceStatuses = [
  "draft",
  "analyzed",
  "preset_ready"
] as const;

export type EditingReferenceStatus =
  (typeof editingReferenceStatuses)[number];

export const editingReferenceBeatIntensities = [
  "low",
  "medium",
  "high",
  "extreme"
] as const;

export type EditingReferenceBeatIntensity =
  (typeof editingReferenceBeatIntensities)[number];

export const editingReferencePacingOptions = [
  "slow",
  "medium",
  "fast",
  "hyper"
] as const;

export type EditingReferencePacing =
  (typeof editingReferencePacingOptions)[number];

export const editingReferenceZoomStyles = [
  "none",
  "subtle",
  "medium",
  "aggressive"
] as const;

export type EditingReferenceZoomStyle =
  (typeof editingReferenceZoomStyles)[number];

export const editingReferenceFlashStyles = [
  "none",
  "low",
  "medium",
  "high"
] as const;

export type EditingReferenceFlashStyle =
  (typeof editingReferenceFlashStyles)[number];

export const editingReferenceTransitionStyles = [
  "cut",
  "fast_cut",
  "flash_cut",
  "smooth",
  "mixed"
] as const;

export type EditingReferenceTransitionStyle =
  (typeof editingReferenceTransitionStyles)[number];

export const editingReferenceCaptionStyles = [
  "none",
  "center_bold",
  "lower_clean",
  "kinetic",
  "dramatic"
] as const;

export type EditingReferenceCaptionStyle =
  (typeof editingReferenceCaptionStyles)[number];

export const editingReferenceNarrationStyles = [
  "none",
  "calm",
  "documentary",
  "hype",
  "aggressive",
  "epic"
] as const;

export type EditingReferenceNarrationStyle =
  (typeof editingReferenceNarrationStyles)[number];

export const editingReferenceMusicStyles = [
  "none",
  "hype",
  "dark",
  "epic",
  "documentary",
  "viral"
] as const;

export type EditingReferenceMusicStyle =
  (typeof editingReferenceMusicStyles)[number];

export const editingReferenceSfxStyles = [
  "none",
  "low",
  "medium",
  "high"
] as const;

export type EditingReferenceSfxStyle =
  (typeof editingReferenceSfxStyles)[number];

export const editingReferenceHookStyles = [
  "question",
  "warning",
  "explosive",
  "curiosity",
  "ranking",
  "story"
] as const;

export type EditingReferenceHookStyle =
  (typeof editingReferenceHookStyles)[number];

export const editingReferenceCtaStyles = [
  "none",
  "short",
  "strong",
  "subtle"
] as const;

export type EditingReferenceCtaStyle =
  (typeof editingReferenceCtaStyles)[number];

export const editingReferenceMicroclipPlacements = [
  "none",
  "intro",
  "middle",
  "climax",
  "outro",
  "multiple"
] as const;

export type EditingReferenceMicroclipPlacement =
  (typeof editingReferenceMicroclipPlacements)[number];

export interface EditingReferenceRecord {
  id: string;
  title: string;
  description: string | null;
  assetId: string | null;
  localPath: string | null;
  sourceType: EditingReferenceSourceType;
  category: EditingReferenceCategory;
  status: EditingReferenceStatus;
  durationSeconds: number | null;
  averageCutPaceSeconds: number | null;
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
  visualStyleNotes: string | null;
  audioStyleNotes: string | null;
  editingStyleNotes: string | null;
  analysisWarnings: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EditingReferencePresetRecord {
  id: string;
  referenceId: string | null;
  name: string;
  slug: string;
  description: string;
  useCase: EditingReferenceCategory;
  cutPace: number | null;
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
  recommendedTemplates: string[];
  recommendedMusicPresetId: string | null;
  recommendedAudioMasteringPresetId: string | null;
  recommendedNarrationVoicePackId: string | null;
  defaultShotDurationSeconds: number | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EditingStyleSummary {
  presetId: string;
  presetName: string;
  useCase: EditingReferenceCategory;
  pacing: EditingReferencePacing;
  cutPace: number | null;
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
  defaultShotDurationSeconds: number | null;
  recommendedMusicPresetId: string | null;
  recommendedAudioMasteringPresetId: string | null;
  recommendedNarrationVoicePackId: string | null;
  notes: string | null;
}

export interface ReferenceDurationResult {
  durationSeconds: number | null;
  warning: string | null;
}

export interface ApproxSceneChangesResult {
  approximateSceneChanges: number | null;
  sceneTimestamps: number[];
  warning: string | null;
}

export interface AudioEnergyResult {
  averageEnergy: number | null;
  peakDensity: number | null;
  beatIntensity: EditingReferenceBeatIntensity;
  warning: string | null;
}

export interface EditingReferenceAnalysisInput {
  referencePath: string;
  title?: string | null;
  category?: EditingReferenceCategory | null;
}

export interface EditingReferenceAnalysisResult {
  status: "completed" | "skipped";
  referencePath: string;
  title: string | null;
  category: EditingReferenceCategory | null;
  durationSeconds: number | null;
  approximateSceneChanges: number | null;
  averageCutPaceSeconds: number | null;
  beatIntensity: EditingReferenceBeatIntensity;
  pacing: EditingReferencePacing;
  audioEnergy: number | null;
  warnings: string[];
  diagnostics: string[];
}

export interface BuildEditingReferencePresetInput {
  reference: Pick<
    EditingReferenceRecord,
    | "id"
    | "title"
    | "category"
    | "averageCutPaceSeconds"
    | "pacing"
    | "zoomStyle"
    | "flashStyle"
    | "transitionStyle"
    | "captionStyle"
    | "narrationStyle"
    | "musicStyle"
    | "sfxStyle"
    | "hookStyle"
    | "ctaStyle"
    | "microclipPlacement"
    | "visualStyleNotes"
    | "audioStyleNotes"
    | "editingStyleNotes"
    | "analysisWarnings"
  >;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  recommendedTemplates?: string[] | null;
  recommendedMusicPresetId?: string | null;
  recommendedAudioMasteringPresetId?: string | null;
  recommendedNarrationVoicePackId?: string | null;
  defaultShotDurationSeconds?: number | null;
  notes?: string | null;
}

export interface EditingReferencePresetSuggestion {
  templateId: string;
  preset: EditingReferencePresetRecord;
  reason: string;
}

interface CommandResult {
  stdout: Buffer;
  stderr: string;
}

async function getNodeSpawn() {
  if (typeof process === "undefined" || !process.versions?.node) {
    throw new Error(
      "Editing reference analysis is only available in the local Node runtime."
    );
  }

  const runtime = (await new Function(
    "specifier",
    "return import(specifier);"
  )("node:child_process")) as typeof import("node:child_process");

  return runtime.spawn;
}

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveBinary(envName: "FFMPEG_PATH" | "FFPROBE_PATH", fallback: string) {
  const fromEnv = process.env[envName]?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : fallback;
}

function normalizePresetName(name: string) {
  return name.trim().replace(/\s+/gu, " ");
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/gu, "")
    .trim()
    .replace(/[\s_]+/gu, "-")
    .replace(/-+/gu, "-")
    .toLowerCase();
}

function runCommand(command: string, args: string[]) {
  return new Promise<CommandResult>(async (resolve, reject) => {
    const spawn = await getNodeSpawn();
    const child = spawn(command, args, {
      windowsHide: true,
      shell: false
    });

    const stdoutChunks: Buffer[] = [];
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(`Failed to spawn '${command}'. ${error.message}`)
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          stdout: Buffer.concat(stdoutChunks),
          stderr
        });
        return;
      }

      reject(
        new Error(
          `Command '${command} ${args.join(" ")}' failed with code ${code ?? "unknown"}. ${stderr.trim()}`
        )
      );
    });
  });
}

async function checkBinary(command: string, args: string[]) {
  try {
    await runCommand(command, args);
    return { available: true, message: null as string | null };
  } catch (error) {
    return {
      available: false,
      message:
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : `${command} is unavailable.`
    };
  }
}

function classifyPacing(averageCutPaceSeconds: number | null): EditingReferencePacing {
  if (averageCutPaceSeconds === null) {
    return "medium";
  }

  if (averageCutPaceSeconds >= 4.8) {
    return "slow";
  }

  if (averageCutPaceSeconds >= 2.8) {
    return "medium";
  }

  if (averageCutPaceSeconds >= 1.5) {
    return "fast";
  }

  return "hyper";
}

function classifyBeatIntensity(averageEnergy: number | null) {
  if (averageEnergy === null) {
    return "medium";
  }

  if (averageEnergy < 0.16) {
    return "low";
  }

  if (averageEnergy < 0.34) {
    return "medium";
  }

  if (averageEnergy < 0.56) {
    return "high";
  }

  return "extreme";
}

function defaultDescriptionForCategory(category: EditingReferenceCategory) {
  switch (category) {
    case "football":
      return "Preset editorial para reels esportivos com cortes ritmados, energia alta e climax visual.";
    case "documentary":
      return "Preset editorial para explicacao documental com leitura limpa e progressao controlada.";
    case "true_crime":
      return "Preset editorial para casos, dossies e narrativas sombrias com tensao gradual.";
    case "cinematic":
      return "Preset editorial premium para storytelling com arco equilibrado e acabamento cinematografico.";
    case "viral":
      return "Preset editorial para alto impacto, cortes curtos e CTA forte.";
    default:
      return "Preset editorial generico equilibrado para reels curtos.";
  }
}

function defaultRecommendationsForCategory(category: EditingReferenceCategory) {
  switch (category) {
    case "football":
      return {
        recommendedTemplates: [
          "sports_hype",
          "player_threat_analysis",
          "rivalry_hype",
          "match_preview"
        ],
        recommendedMusicPresetId: "football_hype",
        recommendedAudioMasteringPresetId: "football_hype",
        recommendedNarrationVoicePackId: "sports_hype_ptbr"
      };
    case "documentary":
      return {
        recommendedTemplates: ["mystery_doc", "history_dark", "cinematic_story"],
        recommendedMusicPresetId: "documentary_clean",
        recommendedAudioMasteringPresetId: "documentary_clean",
        recommendedNarrationVoicePackId: "documentary_ptbr"
      };
    case "true_crime":
      return {
        recommendedTemplates: ["true_crime", "mystery_doc", "history_dark"],
        recommendedMusicPresetId: "true_crime_dark",
        recommendedAudioMasteringPresetId: "true_crime_dark",
        recommendedNarrationVoicePackId: "true_crime_dark_ptbr"
      };
    case "cinematic":
      return {
        recommendedTemplates: ["cinematic_story", "game_epic", "underdog_story"],
        recommendedMusicPresetId: "cinematic_epic",
        recommendedAudioMasteringPresetId: "cinematic_epic",
        recommendedNarrationVoicePackId: "story_epic_ptbr"
      };
    case "viral":
      return {
        recommendedTemplates: ["sports_hype", "top_3_ranking", "post_match_hot_take"],
        recommendedMusicPresetId: "viral_fast_cut",
        recommendedAudioMasteringPresetId: "viral_fast_cut",
        recommendedNarrationVoicePackId: "sports_hype_ptbr"
      };
    default:
      return {
        recommendedTemplates: ["cinematic_story", "comic_drama", "anime_dark"],
        recommendedMusicPresetId: "shorts_clean_voice",
        recommendedAudioMasteringPresetId: "shorts_clean_voice",
        recommendedNarrationVoicePackId: "narrator_clean_ptbr"
      };
  }
}

const builtInPresetCatalog: EditingReferencePresetRecord[] = [
  {
    id: "builtin-comic-viral-reference-antman",
    referenceId: null,
    name: "Comic Viral Reference - Antman",
    slug: "comic-viral-reference-antman",
    description:
      "Preset baseado em referencia vertical de HQ/super-heroi: cortes densos, narracao direta, captions cineticas e zoom agressivo em paineis para superar shorts narrativos de cultura pop.",
    useCase: "viral",
    cutPace: 0.9,
    pacing: "hyper",
    zoomStyle: "aggressive",
    flashStyle: "high",
    transitionStyle: "flash_cut",
    captionStyle: "kinetic",
    narrationStyle: "hype",
    musicStyle: "viral",
    sfxStyle: "high",
    hookStyle: "explosive",
    ctaStyle: "strong",
    microclipPlacement: "multiple",
    recommendedTemplates: ["comic_drama", "anime_dark", "cinematic_story", "top_3_ranking"],
    recommendedMusicPresetId: "viral_fast_cut",
    recommendedAudioMasteringPresetId: "viral_fast_cut",
    recommendedNarrationVoicePackId: "story_epic_ptbr",
    defaultShotDurationSeconds: 0.9,
    notes:
      "Referencia analisada: 1080x1920, ~80s, 30fps, ~92 mudancas visuais fortes em threshold 0.18, audio medio -15.4 dB/pico -5.7 dB. Usar como piso: rajadas de cortes, captions centrais curtas, zoom/pan continuo nos paineis, SFX de impacto e narra??o sem pausas longas."
  },
  {
    id: "builtin-football-flash-pressure",
    referenceId: null,
    name: "Football Flash Pressure",
    slug: "football-flash-pressure",
    description:
      "Preset premium para reels esportivos com flash-cut, punch-ins e climax carregado de microclips.",
    useCase: "football",
    cutPace: 1.7,
    pacing: "hyper",
    zoomStyle: "aggressive",
    flashStyle: "medium",
    transitionStyle: "flash_cut",
    captionStyle: "center_bold",
    narrationStyle: "hype",
    musicStyle: "hype",
    sfxStyle: "high",
    hookStyle: "explosive",
    ctaStyle: "strong",
    microclipPlacement: "climax",
    recommendedTemplates: ["sports_hype", "player_threat_analysis", "rivalry_hype"],
    recommendedMusicPresetId: "football_hype",
    recommendedAudioMasteringPresetId: "football_hype",
    recommendedNarrationVoicePackId: "sports_hype_ptbr",
    defaultShotDurationSeconds: 1.7,
    notes: "Ideal para pressao, duelo e clips de momentum."
  },
  {
    id: "builtin-documentary-clean-proof",
    referenceId: null,
    name: "Documentary Clean Proof",
    slug: "documentary-clean-proof",
    description:
      "Preset de leitura clara, captions discretas e progressao de provas em ritmo seguro.",
    useCase: "documentary",
    cutPace: 3.4,
    pacing: "medium",
    zoomStyle: "subtle",
    flashStyle: "none",
    transitionStyle: "smooth",
    captionStyle: "lower_clean",
    narrationStyle: "documentary",
    musicStyle: "documentary",
    sfxStyle: "low",
    hookStyle: "curiosity",
    ctaStyle: "subtle",
    microclipPlacement: "middle",
    recommendedTemplates: ["mystery_doc", "history_dark", "cinematic_story"],
    recommendedMusicPresetId: "documentary_clean",
    recommendedAudioMasteringPresetId: "documentary_clean",
    recommendedNarrationVoicePackId: "documentary_ptbr",
    defaultShotDurationSeconds: 3.4,
    notes: "Bom para fatos, explicacao e flow analitico."
  },
  {
    id: "builtin-true-crime-casefile",
    referenceId: null,
    name: "True Crime Casefile",
    slug: "true-crime-casefile",
    description:
      "Preset de tensao documental com inserts curtos, arquivo frio e perguntas abertas.",
    useCase: "true_crime",
    cutPace: 2.8,
    pacing: "fast",
    zoomStyle: "subtle",
    flashStyle: "low",
    transitionStyle: "mixed",
    captionStyle: "lower_clean",
    narrationStyle: "documentary",
    musicStyle: "dark",
    sfxStyle: "medium",
    hookStyle: "warning",
    ctaStyle: "subtle",
    microclipPlacement: "middle",
    recommendedTemplates: ["true_crime", "mystery_doc", "history_dark"],
    recommendedMusicPresetId: "true_crime_dark",
    recommendedAudioMasteringPresetId: "true_crime_dark",
    recommendedNarrationVoicePackId: "true_crime_dark_ptbr",
    defaultShotDurationSeconds: 2.8,
    notes: "Equilibra contexto, evidencia e cliffhanger."
  },
  {
    id: "builtin-cinematic-balanced-arc",
    referenceId: null,
    name: "Cinematic Balanced Arc",
    slug: "cinematic-balanced-arc",
    description:
      "Preset para storytelling premium com respiracao visual e crescendo controlado.",
    useCase: "cinematic",
    cutPace: 3.1,
    pacing: "medium",
    zoomStyle: "medium",
    flashStyle: "low",
    transitionStyle: "smooth",
    captionStyle: "dramatic",
    narrationStyle: "epic",
    musicStyle: "epic",
    sfxStyle: "medium",
    hookStyle: "story",
    ctaStyle: "short",
    microclipPlacement: "outro",
    recommendedTemplates: ["cinematic_story", "game_epic", "underdog_story"],
    recommendedMusicPresetId: "cinematic_epic",
    recommendedAudioMasteringPresetId: "cinematic_epic",
    recommendedNarrationVoicePackId: "story_epic_ptbr",
    defaultShotDurationSeconds: 3.1,
    notes: "Funciona bem para arco de setup, build e resolve."
  },
  {
    id: "builtin-viral-punch-stack",
    referenceId: null,
    name: "Viral Punch Stack",
    slug: "viral-punch-stack",
    description:
      "Preset para cortes curtissimos, hook agressivo e CTA alto em videos de impacto.",
    useCase: "viral",
    cutPace: 1.2,
    pacing: "hyper",
    zoomStyle: "aggressive",
    flashStyle: "high",
    transitionStyle: "flash_cut",
    captionStyle: "kinetic",
    narrationStyle: "hype",
    musicStyle: "viral",
    sfxStyle: "high",
    hookStyle: "ranking",
    ctaStyle: "strong",
    microclipPlacement: "multiple",
    recommendedTemplates: ["sports_hype", "top_3_ranking", "post_match_hot_take"],
    recommendedMusicPresetId: "viral_fast_cut",
    recommendedAudioMasteringPresetId: "viral_fast_cut",
    recommendedNarrationVoicePackId: "sports_hype_ptbr",
    defaultShotDurationSeconds: 1.2,
    notes: "Bom para listas, takes quentes e choque rapido."
  },
  {
    id: "builtin-generic-story-grid",
    referenceId: null,
    name: "Generic Story Grid",
    slug: "generic-story-grid",
    description:
      "Preset equilibrado para construir reels a partir de referencia local ainda pouco classificada.",
    useCase: "generic",
    cutPace: 3,
    pacing: "medium",
    zoomStyle: "subtle",
    flashStyle: "none",
    transitionStyle: "cut",
    captionStyle: "lower_clean",
    narrationStyle: "calm",
    musicStyle: "none",
    sfxStyle: "low",
    hookStyle: "question",
    ctaStyle: "short",
    microclipPlacement: "none",
    recommendedTemplates: ["cinematic_story", "comic_drama", "anime_dark"],
    recommendedMusicPresetId: "shorts_clean_voice",
    recommendedAudioMasteringPresetId: "shorts_clean_voice",
    recommendedNarrationVoicePackId: "narrator_clean_ptbr",
    defaultShotDurationSeconds: 3,
    notes: "Fallback seguro para preset derivado local."
  }
];

export function getEditingReferenceCategories() {
  return [...editingReferenceCategories];
}

export function getEditingReferencePresetCatalog() {
  return builtInPresetCatalog.map((preset) => ({
    ...preset,
    recommendedTemplates: [...preset.recommendedTemplates]
  }));
}

export async function detectReferenceDuration(
  referencePath: string
): Promise<ReferenceDurationResult> {
  const ffprobeCommand = resolveBinary("FFPROBE_PATH", "ffprobe");

  try {
    const { stdout } = await runCommand(ffprobeCommand, [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      referencePath
    ]);
    const parsed = JSON.parse(stdout.toString("utf8")) as {
      format?: { duration?: string };
      streams?: Array<{ duration?: string }>;
    };
    const durationCandidates = [
      Number(parsed.format?.duration ?? 0),
      ...(parsed.streams ?? []).map((stream) => Number(stream.duration ?? 0))
    ].filter((value) => Number.isFinite(value) && value > 0);

    return {
      durationSeconds:
        durationCandidates.length > 0
          ? roundToThreeDecimals(Math.max(...durationCandidates))
          : null,
      warning:
        durationCandidates.length > 0
          ? null
          : "Nao foi possivel detectar a duracao da referencia."
    };
  } catch (error) {
    return {
      durationSeconds: null,
      warning:
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "FFprobe falhou ao ler a referencia."
    };
  }
}

export async function detectApproxSceneChanges(
  referencePath: string
): Promise<ApproxSceneChangesResult> {
  const ffmpegCommand = resolveBinary("FFMPEG_PATH", "ffmpeg");

  try {
    const { stderr } = await runCommand(ffmpegCommand, [
      "-hide_banner",
      "-i",
      referencePath,
      "-vf",
      "select=gt(scene\\,0.27),showinfo",
      "-an",
      "-f",
      "null",
      "-"
    ]);
    const timestamps = Array.from(
      stderr.matchAll(/pts_time:(\d+(?:\.\d+)?)/gu),
      (match) => roundToThreeDecimals(Number(match[1]))
    ).filter((value) => Number.isFinite(value));

    return {
      approximateSceneChanges: timestamps.length,
      sceneTimestamps: timestamps,
      warning:
        timestamps.length === 0
          ? "Nenhum corte forte foi detectado; use curadoria manual para confirmar o ritmo."
          : null
    };
  } catch (error) {
    return {
      approximateSceneChanges: null,
      sceneTimestamps: [],
      warning:
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "FFmpeg falhou ao estimar cortes."
    };
  }
}

export async function estimateAverageCutPace(
  referencePath: string
): Promise<number | null> {
  const [durationResult, sceneChangesResult] = await Promise.all([
    detectReferenceDuration(referencePath),
    detectApproxSceneChanges(referencePath)
  ]);

  if (
    durationResult.durationSeconds === null ||
    sceneChangesResult.approximateSceneChanges === null
  ) {
    return null;
  }

  const segmentCount = Math.max(sceneChangesResult.approximateSceneChanges + 1, 1);
  return roundToThreeDecimals(durationResult.durationSeconds / segmentCount);
}

async function extractAudioPcmBuffer(referencePath: string) {
  const ffmpegCommand = resolveBinary("FFMPEG_PATH", "ffmpeg");

  const { stdout } = await runCommand(ffmpegCommand, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    referencePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "200",
    "-f",
    "s16le",
    "-"
  ]);

  return stdout;
}

export async function detectAudioEnergy(
  referencePath: string
): Promise<AudioEnergyResult> {
  const durationResult = await detectReferenceDuration(referencePath);

  if (!durationResult.durationSeconds || durationResult.durationSeconds <= 0) {
    return {
      averageEnergy: null,
      peakDensity: null,
      beatIntensity: "medium",
      warning: "Duracao invalida para detectar energia de audio."
    };
  }

  try {
    const pcmBuffer = await extractAudioPcmBuffer(referencePath);
    const sampleCount = Math.floor(pcmBuffer.length / 2);

    if (sampleCount === 0) {
      return {
        averageEnergy: null,
        peakDensity: null,
        beatIntensity: "medium",
        warning: "Referencia sem trilha de audio detectavel."
      };
    }

    const samplesPerSecond = sampleCount / durationResult.durationSeconds;
    const amplitudes = new Array<number>(sampleCount);
    let maxAmplitude = 1;
    let sum = 0;

    for (let index = 0; index < sampleCount; index += 1) {
      const sample = pcmBuffer.readInt16LE(index * 2);
      const amplitude = Math.abs(sample) / 32768;
      amplitudes[index] = amplitude;
      maxAmplitude = Math.max(maxAmplitude, amplitude);
      sum += amplitude;
    }

    const normalized = amplitudes.map((value) => value / maxAmplitude);
    const averageEnergy = sum / sampleCount;
    const mean = normalized.reduce((total, value) => total + value, 0) / sampleCount;
    const variance =
      normalized.reduce((total, value) => total + (value - mean) ** 2, 0) /
      sampleCount;
    const threshold = clamp(mean + Math.sqrt(variance), 0.12, 0.88);
    const minimumPeakGapSamples = Math.max(Math.round(samplesPerSecond * 0.18), 4);
    const peaks: number[] = [];

    for (let index = 2; index < normalized.length - 2; index += 1) {
      const current = normalized[index] ?? 0;

      if (current < threshold) {
        continue;
      }

      if (
        current >= (normalized[index - 1] ?? 0) &&
        current >= (normalized[index + 1] ?? 0) &&
        current >= (normalized[index - 2] ?? 0) &&
        current >= (normalized[index + 2] ?? 0)
      ) {
        const lastPeak = peaks[peaks.length - 1];

        if (typeof lastPeak === "number" && index - lastPeak < minimumPeakGapSamples) {
          continue;
        }

        peaks.push(index);
      }
    }

    return {
      averageEnergy: roundToThreeDecimals(clamp(averageEnergy, 0, 1)),
      peakDensity: roundToThreeDecimals(peaks.length / durationResult.durationSeconds),
      beatIntensity: classifyBeatIntensity(averageEnergy),
      warning:
        peaks.length === 0
          ? "Energia de audio detectada com poucos picos; considere revisar manualmente."
          : null
    };
  } catch (error) {
    return {
      averageEnergy: null,
      peakDensity: null,
      beatIntensity: "medium",
      warning:
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "FFmpeg falhou ao analisar a energia de audio."
    };
  }
}

export async function analyzeEditingReference(
  input: EditingReferenceAnalysisInput
): Promise<EditingReferenceAnalysisResult> {
  const ffmpegAvailability = await checkBinary(resolveBinary("FFMPEG_PATH", "ffmpeg"), [
    "-version"
  ]);
  const ffprobeAvailability = await checkBinary(
    resolveBinary("FFPROBE_PATH", "ffprobe"),
    ["-version"]
  );
  const diagnostics: string[] = [];

  if (!ffmpegAvailability.available) {
    diagnostics.push(ffmpegAvailability.message ?? "FFmpeg indisponivel.");
  }

  if (!ffprobeAvailability.available) {
    diagnostics.push(ffprobeAvailability.message ?? "FFprobe indisponivel.");
  }

  if (!ffmpegAvailability.available || !ffprobeAvailability.available) {
    return {
      status: "skipped",
      referencePath: input.referencePath,
      title: input.title ?? null,
      category: input.category ?? null,
      durationSeconds: null,
      approximateSceneChanges: null,
      averageCutPaceSeconds: null,
      beatIntensity: "medium",
      pacing: "medium",
      audioEnergy: null,
      warnings: [
        "Analise local pulada porque FFmpeg/ffprobe nao estao disponiveis neste ambiente."
      ],
      diagnostics
    };
  }

  const [durationResult, sceneChangesResult, audioEnergyResult] = await Promise.all([
    detectReferenceDuration(input.referencePath),
    detectApproxSceneChanges(input.referencePath),
    detectAudioEnergy(input.referencePath)
  ]);
  const warnings = [
    durationResult.warning,
    sceneChangesResult.warning,
    audioEnergyResult.warning
  ].filter((value): value is string => Boolean(value));
  const averageCutPaceSeconds =
    durationResult.durationSeconds !== null &&
    sceneChangesResult.approximateSceneChanges !== null
      ? roundToThreeDecimals(
          durationResult.durationSeconds /
            Math.max(sceneChangesResult.approximateSceneChanges + 1, 1)
        )
      : null;
  const pacing = classifyPacing(averageCutPaceSeconds);

  if (averageCutPaceSeconds !== null && averageCutPaceSeconds > 5.5) {
    warnings.push("Referencia com ritmo mais lento; pode exigir curadoria manual para shorts.");
  }

  if (
    sceneChangesResult.approximateSceneChanges !== null &&
    sceneChangesResult.approximateSceneChanges <= 1
  ) {
    warnings.push("Poucas mudancas de cena detectadas; valide se a referencia nao e um plano longo.");
  }

  return {
    status: "completed",
    referencePath: input.referencePath,
    title: input.title ?? null,
    category: input.category ?? null,
    durationSeconds: durationResult.durationSeconds,
    approximateSceneChanges: sceneChangesResult.approximateSceneChanges,
    averageCutPaceSeconds,
    beatIntensity: audioEnergyResult.beatIntensity,
    pacing,
    audioEnergy: audioEnergyResult.averageEnergy,
    warnings: [...new Set(warnings)],
    diagnostics
  };
}

export function buildEditingReferencePreset(
  input: BuildEditingReferencePresetInput
): EditingReferencePresetRecord {
  const fallbackRecommendations = defaultRecommendationsForCategory(
    input.reference.category
  );
  const name =
    normalizePresetName(
      input.name?.trim() ||
        `${input.reference.title} Preset`
    );
  const slug = slugify(input.slug?.trim() || name);
  const description =
    input.description?.trim() ||
    defaultDescriptionForCategory(input.reference.category);

  return {
    id: `preset-${slug}`,
    referenceId: input.reference.id,
    name,
    slug,
    description,
    useCase: input.reference.category,
    cutPace: input.reference.averageCutPaceSeconds,
    pacing: input.reference.pacing,
    zoomStyle: input.reference.zoomStyle,
    flashStyle: input.reference.flashStyle,
    transitionStyle: input.reference.transitionStyle,
    captionStyle: input.reference.captionStyle,
    narrationStyle: input.reference.narrationStyle,
    musicStyle: input.reference.musicStyle,
    sfxStyle: input.reference.sfxStyle,
    hookStyle: input.reference.hookStyle,
    ctaStyle: input.reference.ctaStyle,
    microclipPlacement: input.reference.microclipPlacement,
    recommendedTemplates:
      input.recommendedTemplates?.length
        ? [...new Set(input.recommendedTemplates)]
        : fallbackRecommendations.recommendedTemplates,
    recommendedMusicPresetId:
      input.recommendedMusicPresetId ??
      fallbackRecommendations.recommendedMusicPresetId,
    recommendedAudioMasteringPresetId:
      input.recommendedAudioMasteringPresetId ??
      fallbackRecommendations.recommendedAudioMasteringPresetId,
    recommendedNarrationVoicePackId:
      input.recommendedNarrationVoicePackId ??
      fallbackRecommendations.recommendedNarrationVoicePackId,
    defaultShotDurationSeconds:
      input.defaultShotDurationSeconds ??
      input.reference.averageCutPaceSeconds ??
      null,
    notes:
      input.notes?.trim() ||
      [
        input.reference.visualStyleNotes,
        input.reference.audioStyleNotes,
        input.reference.editingStyleNotes,
        input.reference.analysisWarnings.length > 0
          ? `Warnings: ${input.reference.analysisWarnings.join(" | ")}`
          : null
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .trim() ||
      null
  };
}

export function suggestReferencePresetsForTemplate(templateId: string) {
  const normalizedTemplateId = templateId.trim().toLowerCase().replaceAll("-", "_");
  const suggestions = builtInPresetCatalog
    .filter((preset) => preset.recommendedTemplates.includes(normalizedTemplateId))
    .map((preset) => ({
      templateId: normalizedTemplateId,
      preset: {
        ...preset,
        recommendedTemplates: [...preset.recommendedTemplates]
      },
      reason: `Preset '${preset.name}' combina com o template '${normalizedTemplateId}'.`
    }));

  if (suggestions.length > 0) {
    return suggestions;
  }

  const categoryFallbackMap: Record<string, EditingReferenceCategory> = {
    sports_hype: "football",
    player_threat_analysis: "football",
    tactical_breakdown: "documentary",
    match_preview: "football",
    post_match_hot_take: "viral",
    rivalry_hype: "football",
    top_3_ranking: "viral",
    underdog_story: "cinematic",
    brazil_warning: "football",
    anime_dark: "cinematic",
    comic_drama: "cinematic",
    game_epic: "cinematic",
    mystery_doc: "documentary",
    history_dark: "documentary",
    true_crime: "true_crime",
    cinematic_story: "cinematic"
  };
  const fallbackCategory = categoryFallbackMap[normalizedTemplateId] ?? "generic";

  return builtInPresetCatalog
    .filter((preset) => preset.useCase === fallbackCategory)
    .map((preset) => ({
      templateId: normalizedTemplateId,
      preset: {
        ...preset,
        recommendedTemplates: [...preset.recommendedTemplates]
      },
      reason: `Sem preset dedicado para '${normalizedTemplateId}', usando fallback por categoria '${fallbackCategory}'.`
    }));
}

export function summarizeEditingReference(reference: EditingReferenceRecord) {
  const durationLabel =
    typeof reference.durationSeconds === "number"
      ? `${reference.durationSeconds.toFixed(reference.durationSeconds >= 10 ? 0 : 1)}s`
      : "duracao n/d";
  const cutPaceLabel =
    typeof reference.averageCutPaceSeconds === "number"
      ? `${reference.averageCutPaceSeconds.toFixed(1)}s por corte`
      : "cut pace n/d";

  return [
    reference.title,
    reference.category,
    reference.status,
    durationLabel,
    cutPaceLabel,
    `beat ${reference.beatIntensity}`,
    `pacing ${reference.pacing}`
  ].join(" / ");
}

export function summarizeEditingReferencePreset(preset: EditingReferencePresetRecord) {
  return [
    preset.name,
    preset.useCase,
    preset.cutPace ? `${preset.cutPace.toFixed(1)}s` : "cut pace n/d",
    `zoom ${preset.zoomStyle}`,
    `flash ${preset.flashStyle}`,
    `caption ${preset.captionStyle}`,
    `narration ${preset.narrationStyle}`
  ].join(" / ");
}

export function buildEditingStyleSummaryFromPreset(
  preset: EditingReferencePresetRecord
): EditingStyleSummary {
  return {
    presetId: preset.id,
    presetName: preset.name,
    useCase: preset.useCase,
    pacing: preset.pacing,
    cutPace: preset.cutPace,
    zoomStyle: preset.zoomStyle,
    flashStyle: preset.flashStyle,
    transitionStyle: preset.transitionStyle,
    captionStyle: preset.captionStyle,
    narrationStyle: preset.narrationStyle,
    musicStyle: preset.musicStyle,
    sfxStyle: preset.sfxStyle,
    hookStyle: preset.hookStyle,
    ctaStyle: preset.ctaStyle,
    microclipPlacement: preset.microclipPlacement,
    defaultShotDurationSeconds: preset.defaultShotDurationSeconds,
    recommendedMusicPresetId: preset.recommendedMusicPresetId,
    recommendedAudioMasteringPresetId:
      preset.recommendedAudioMasteringPresetId,
    recommendedNarrationVoicePackId: preset.recommendedNarrationVoicePackId,
    notes: preset.notes
  };
}

export function getEditingStyleIntensity(
  summary: Pick<EditingStyleSummary, "pacing" | "flashStyle" | "sfxStyle">
): EditingReferenceBeatIntensity {
  if (
    summary.pacing === "hyper" ||
    summary.flashStyle === "high" ||
    summary.sfxStyle === "high"
  ) {
    return "extreme";
  }

  if (
    summary.pacing === "fast" ||
    summary.flashStyle === "medium" ||
    summary.sfxStyle === "medium"
  ) {
    return "high";
  }

  if (summary.pacing === "slow") {
    return "low";
  }

  return "medium";
}
