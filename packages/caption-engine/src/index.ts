export const captionStyleIds = [
  "bold_impact",
  "premium_yellow",
  "anime_punch",
  "documentary_clean",
  "horror_whisper",
  "comic_pop",
  "sports_hype"
] as const;

export type CaptionStyleId = (typeof captionStyleIds)[number];

export const captionPositions = [
  "top",
  "center",
  "lower-third",
  "bottom",
  "split"
] as const;

export type CaptionPosition = (typeof captionPositions)[number];

export type CaptionTextTransform = "none" | "uppercase" | "capitalize";

export type CaptionAnimationSpeed = "calm" | "balanced" | "aggressive";

export type CaptionReadingSpeedStatus = "slow" | "good" | "fast" | "too_fast";

export type CaptionEmotionTag =
  | "NEUTRAL"
  | "CURIOUS"
  | "EPIC"
  | "MYSTERIOUS"
  | "DARK"
  | "TENSE"
  | "JOYFUL"
  | "SAD";

export interface CaptionOutline {
  color: string;
  width: number;
  blur: number;
}

export interface CaptionShadow {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  opacity: number;
}

export interface CaptionBackground {
  enabled: boolean;
  color: string;
  opacity: number;
  paddingX: number;
  paddingY: number;
  radius: number;
}

export interface CaptionAnimation {
  entry: string;
  emphasis: string;
  exit: string;
  speed: CaptionAnimationSpeed;
}

export interface CaptionStyle {
  id: CaptionStyleId;
  name: string;
  description: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textTransform: CaptionTextTransform;
  position: CaptionPosition;
  maxCharsPerLine: number;
  maxLines: number;
  outline: CaptionOutline;
  shadow: CaptionShadow;
  background: CaptionBackground;
  animation: CaptionAnimation;
  emphasisMode: string;
}

export interface CaptionReadingSpeedEstimate {
  characters: number;
  words: number;
  duration: number;
  estimatedCharactersPerSecond: number;
  readingSpeedStatus: CaptionReadingSpeedStatus;
}

export interface CaptionQualityAnalysis extends CaptionReadingSpeedEstimate {
  lineWarnings: string[];
  durationWarnings: string[];
  impactScore: number;
  suggestions: string[];
}

export interface CaptionExportSceneInput {
  order: number;
  captionText: string | null;
  duration: number | null;
  captionStyle?: string | null;
}

export interface CaptionExportProjectInput {
  title?: string;
  scenes: CaptionExportSceneInput[];
}

function cloneOutline(outline: CaptionOutline): CaptionOutline {
  return { ...outline };
}

function cloneShadow(shadow: CaptionShadow): CaptionShadow {
  return { ...shadow };
}

function cloneBackground(background: CaptionBackground): CaptionBackground {
  return { ...background };
}

function cloneAnimation(animation: CaptionAnimation): CaptionAnimation {
  return { ...animation };
}

function cloneCaptionStyle(style: CaptionStyle): CaptionStyle {
  return {
    ...style,
    outline: cloneOutline(style.outline),
    shadow: cloneShadow(style.shadow),
    background: cloneBackground(style.background),
    animation: cloneAnimation(style.animation)
  };
}

const captionStyleRegistry: Record<CaptionStyleId, CaptionStyle> = {
  bold_impact: {
    id: "bold_impact",
    name: "Bold Impact",
    description:
      "Legenda de alto impacto para hooks curtos, com peso visual e punch imediato.",
    fontFamily: "Anton, Bebas Neue, sans-serif",
    fontSize: 66,
    fontWeight: "900",
    textTransform: "uppercase",
    position: "center",
    maxCharsPerLine: 18,
    maxLines: 2,
    outline: {
      color: "#050505",
      width: 6,
      blur: 0
    },
    shadow: {
      color: "#000000",
      offsetX: 0,
      offsetY: 10,
      blur: 18,
      opacity: 0.48
    },
    background: {
      enabled: false,
      color: "#000000",
      opacity: 0,
      paddingX: 0,
      paddingY: 0,
      radius: 0
    },
    animation: {
      entry: "punch-in",
      emphasis: "scale-hit",
      exit: "snap-out",
      speed: "aggressive"
    },
    emphasisMode: "keyword-bursts"
  },
  premium_yellow: {
    id: "premium_yellow",
    name: "Premium Yellow",
    description:
      "Estilo amarelo editorial para reels premium com leitura limpa e contraste forte.",
    fontFamily: "Montserrat, Arial, sans-serif",
    fontSize: 58,
    fontWeight: "800",
    textTransform: "uppercase",
    position: "lower-third",
    maxCharsPerLine: 22,
    maxLines: 2,
    outline: {
      color: "#101010",
      width: 5,
      blur: 0
    },
    shadow: {
      color: "#000000",
      offsetX: 0,
      offsetY: 8,
      blur: 12,
      opacity: 0.38
    },
    background: {
      enabled: false,
      color: "#000000",
      opacity: 0,
      paddingX: 0,
      paddingY: 0,
      radius: 0
    },
    animation: {
      entry: "slide-up",
      emphasis: "color-flash",
      exit: "fade-soft",
      speed: "balanced"
    },
    emphasisMode: "contrast-highlight"
  },
  anime_punch: {
    id: "anime_punch",
    name: "Anime Punch",
    description:
      "Legenda energetica com contorno grosso e timing expressivo para lore, batalhas e twists.",
    fontFamily: "Bangers, Impact, sans-serif",
    fontSize: 64,
    fontWeight: "900",
    textTransform: "uppercase",
    position: "split",
    maxCharsPerLine: 16,
    maxLines: 3,
    outline: {
      color: "#140707",
      width: 7,
      blur: 0
    },
    shadow: {
      color: "#000000",
      offsetX: 0,
      offsetY: 12,
      blur: 20,
      opacity: 0.52
    },
    background: {
      enabled: true,
      color: "#a21caf",
      opacity: 0.18,
      paddingX: 14,
      paddingY: 8,
      radius: 14
    },
    animation: {
      entry: "impact-pop",
      emphasis: "panel-shake",
      exit: "ink-smear",
      speed: "aggressive"
    },
    emphasisMode: "manga-keywords"
  },
  documentary_clean: {
    id: "documentary_clean",
    name: "Documentary Clean",
    description:
      "Lower-third elegante para narracao analitica, documentarios e conteudo explicativo.",
    fontFamily: "Source Sans Pro, Helvetica, sans-serif",
    fontSize: 48,
    fontWeight: "700",
    textTransform: "none",
    position: "lower-third",
    maxCharsPerLine: 28,
    maxLines: 2,
    outline: {
      color: "#0f172a",
      width: 2,
      blur: 0
    },
    shadow: {
      color: "#020617",
      offsetX: 0,
      offsetY: 6,
      blur: 10,
      opacity: 0.26
    },
    background: {
      enabled: true,
      color: "#020617",
      opacity: 0.56,
      paddingX: 18,
      paddingY: 10,
      radius: 18
    },
    animation: {
      entry: "fade-up",
      emphasis: "underline-pulse",
      exit: "fade-soft",
      speed: "calm"
    },
    emphasisMode: "editorial-underlines"
  },
  horror_whisper: {
    id: "horror_whisper",
    name: "Horror Whisper",
    description:
      "Legenda sombria e contida para atmosferas de medo, true crime e revelacoes inquietantes.",
    fontFamily: "Cormorant Garamond, Georgia, serif",
    fontSize: 52,
    fontWeight: "700",
    textTransform: "uppercase",
    position: "bottom",
    maxCharsPerLine: 24,
    maxLines: 2,
    outline: {
      color: "#09090b",
      width: 3,
      blur: 0
    },
    shadow: {
      color: "#000000",
      offsetX: 0,
      offsetY: 10,
      blur: 22,
      opacity: 0.62
    },
    background: {
      enabled: true,
      color: "#0f0f12",
      opacity: 0.42,
      paddingX: 16,
      paddingY: 12,
      radius: 20
    },
    animation: {
      entry: "creep-in",
      emphasis: "flicker",
      exit: "smoke-fade",
      speed: "balanced"
    },
    emphasisMode: "uneasy-whispers"
  },
  comic_pop: {
    id: "comic_pop",
    name: "Comic Pop",
    description:
      "Balanco vibrante com cara de pagina impressa para quadrinhos, reviews e humor visual.",
    fontFamily: "Luckiest Guy, Impact, sans-serif",
    fontSize: 60,
    fontWeight: "900",
    textTransform: "uppercase",
    position: "center",
    maxCharsPerLine: 18,
    maxLines: 2,
    outline: {
      color: "#111827",
      width: 6,
      blur: 0
    },
    shadow: {
      color: "#111827",
      offsetX: 0,
      offsetY: 8,
      blur: 14,
      opacity: 0.34
    },
    background: {
      enabled: true,
      color: "#f59e0b",
      opacity: 0.18,
      paddingX: 12,
      paddingY: 8,
      radius: 18
    },
    animation: {
      entry: "burst-in",
      emphasis: "comic-stamp",
      exit: "flash-cut",
      speed: "aggressive"
    },
    emphasisMode: "onomatopoeia"
  },
  sports_hype: {
    id: "sports_hype",
    name: "Sports Hype",
    description:
      "Legenda de arena com punch limpo, boa leitura e energia para highlights e narracoes competitivas.",
    fontFamily: "Oswald, Arial Narrow, sans-serif",
    fontSize: 62,
    fontWeight: "800",
    textTransform: "uppercase",
    position: "lower-third",
    maxCharsPerLine: 20,
    maxLines: 2,
    outline: {
      color: "#04111d",
      width: 5,
      blur: 0
    },
    shadow: {
      color: "#000000",
      offsetX: 0,
      offsetY: 8,
      blur: 16,
      opacity: 0.42
    },
    background: {
      enabled: true,
      color: "#0f172a",
      opacity: 0.32,
      paddingX: 16,
      paddingY: 10,
      radius: 999
    },
    animation: {
      entry: "scoreboard-rise",
      emphasis: "pulse-hit",
      exit: "wipe-fast",
      speed: "aggressive"
    },
    emphasisMode: "play-by-play"
  }
};

const captionStyleByTemplate: Record<string, CaptionStyleId> = {
  anime_dark: "anime_punch",
  comic_drama: "comic_pop",
  game_epic: "bold_impact",
  mystery_doc: "documentary_clean",
  history_dark: "documentary_clean",
  sports_hype: "sports_hype",
  true_crime: "horror_whisper",
  cinematic_story: "premium_yellow",
  "cinematic-story": "premium_yellow",
  "kinetic-reveal": "comic_pop"
};

function normalizeSpaces(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeCandidate(value: string) {
  return value.trim().replaceAll("-", "_").toLowerCase();
}

function isCaptionStyleId(value: string): value is CaptionStyleId {
  return captionStyleIds.includes(value as CaptionStyleId);
}

function applyTextTransform(
  text: string,
  transform: CaptionTextTransform
) {
  if (transform === "uppercase") {
    return text.toUpperCase();
  }

  if (transform === "capitalize") {
    return text.replace(/\b\w/g, (character) => character.toUpperCase());
  }

  return text;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function formatSrtTimestamp(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const milliseconds = Math.round((safeSeconds % 1) * 1000);
  const wholeSeconds = Math.floor(safeSeconds);
  const seconds = wholeSeconds % 60;
  const minutes = Math.floor(wholeSeconds / 60) % 60;
  const hours = Math.floor(wholeSeconds / 3600);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(
    3,
    "0"
  )}`;
}

function formatAssTimestamp(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const centiseconds = Math.round((safeSeconds % 1) * 100);
  const wholeSeconds = Math.floor(safeSeconds);
  const seconds = wholeSeconds % 60;
  const minutes = Math.floor(wholeSeconds / 60) % 60;
  const hours = Math.floor(wholeSeconds / 3600);

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}.${String(centiseconds).padStart(2, "0")}`;
}

function normalizeDuration(duration: number | null | undefined) {
  if (typeof duration !== "number" || Number.isNaN(duration) || duration <= 0) {
    return 3;
  }

  return duration;
}

function escapeAssText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}");
}

function mapReadingSpeedStatus(charactersPerSecond: number): CaptionReadingSpeedStatus {
  if (charactersPerSecond <= 6) {
    return "slow";
  }

  if (charactersPerSecond <= 12) {
    return "good";
  }

  if (charactersPerSecond <= 16) {
    return "fast";
  }

  return "too_fast";
}

function buildImpactScore(
  text: string,
  style: CaptionStyle,
  readingSpeedStatus: CaptionReadingSpeedStatus,
  lineWarnings: string[],
  durationWarnings: string[]
) {
  let score = 58;

  if (style.textTransform === "uppercase") {
    score += 8;
  }

  if (style.animation.speed === "aggressive") {
    score += 10;
  } else if (style.animation.speed === "balanced") {
    score += 6;
  } else {
    score += 2;
  }

  if (/[!?]/.test(text)) {
    score += 6;
  }

  if (text.length >= 10 && text.length <= 42) {
    score += 8;
  }

  if (readingSpeedStatus === "good") {
    score += 10;
  } else if (readingSpeedStatus === "slow") {
    score += 2;
  } else if (readingSpeedStatus === "fast") {
    score -= 6;
  } else {
    score -= 16;
  }

  score -= lineWarnings.length * 8;
  score -= durationWarnings.length * 6;

  return clamp(Math.round(score), 0, 100);
}

export function getCaptionStyles(): CaptionStyle[] {
  return captionStyleIds.map((styleId) => cloneCaptionStyle(captionStyleRegistry[styleId]));
}

export function getCaptionStyleById(
  id: string | null | undefined
): CaptionStyle | null {
  if (typeof id !== "string" || id.trim().length === 0) {
    return null;
  }

  const normalized = normalizeCandidate(id);

  if (!isCaptionStyleId(normalized)) {
    return null;
  }

  return cloneCaptionStyle(captionStyleRegistry[normalized]);
}

export function splitCaptionIntoLines(
  text: string,
  style: Pick<CaptionStyle, "maxCharsPerLine" | "maxLines" | "textTransform">
): string[] {
  const normalizedText = applyTextTransform(normalizeSpaces(text), style.textTransform);

  if (!normalizedText) {
    return [];
  }

  const words = normalizedText.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= style.maxCharsPerLine || currentLine.length === 0) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= style.maxLines) {
    return lines;
  }

  return [
    ...lines.slice(0, style.maxLines - 1),
    lines.slice(style.maxLines - 1).join(" ")
  ];
}

export function estimateReadingSpeed(
  text: string,
  duration: number | null | undefined
): CaptionReadingSpeedEstimate {
  const normalizedText = normalizeSpaces(text);
  const characters = normalizedText.length;
  const words = normalizedText ? normalizedText.split(" ").length : 0;
  const safeDuration = normalizeDuration(duration);
  const estimatedCharactersPerSecond =
    characters === 0
      ? 0
      : roundToSingleDecimal(characters / safeDuration);

  return {
    characters,
    words,
    duration: safeDuration,
    estimatedCharactersPerSecond,
    readingSpeedStatus: mapReadingSpeedStatus(estimatedCharactersPerSecond)
  };
}

export function analyzeCaptionQuality(
  text: string,
  duration: number | null | undefined,
  style: Pick<
    CaptionStyle,
    "id" | "maxCharsPerLine" | "maxLines" | "textTransform" | "animation"
  >
): CaptionQualityAnalysis {
  const normalizedText = normalizeSpaces(text);
  const speedEstimate = estimateReadingSpeed(normalizedText, duration);
  const lines = splitCaptionIntoLines(normalizedText, style);
  const lineWarnings: string[] = [];
  const durationWarnings: string[] = [];
  const suggestions: string[] = [];

  if (!normalizedText) {
    lineWarnings.push("Legenda vazia nesta cena.");
    suggestions.push("Defina uma legenda curta para reforcar a narrativa da cena.");
  }

  lines.forEach((line, index) => {
    if (line.length > style.maxCharsPerLine) {
      lineWarnings.push(
        `Linha ${index + 1} excede o limite de ${style.maxCharsPerLine} caracteres.`
      );
    }
  });

  if (lines.length > style.maxLines) {
    lineWarnings.push(
      `A legenda excede o maximo de ${style.maxLines} linhas recomendado pelo estilo.`
    );
  }

  if (duration === null || duration === undefined || duration <= 0) {
    durationWarnings.push(
      "A cena nao possui duracao valida; a leitura da legenda pode ficar incorreta."
    );
  } else if (duration < 1.4 && normalizedText.length > 0) {
    durationWarnings.push(
      "A duracao da cena esta muito curta para uma leitura confortavel."
    );
  } else if (duration > 7.5 && normalizedText.length > 0) {
    durationWarnings.push(
      "A legenda pode ficar tempo demais na tela e perder impacto."
    );
  }

  if (speedEstimate.readingSpeedStatus === "too_fast") {
    suggestions.push(
      "Reduza a quantidade de texto ou aumente a duracao da cena para melhorar a leitura."
    );
  } else if (speedEstimate.readingSpeedStatus === "fast") {
    suggestions.push(
      "Considere cortar uma ou duas palavras para deixar a leitura mais premium."
    );
  } else if (speedEstimate.readingSpeedStatus === "slow" && normalizedText.length > 0) {
    suggestions.push(
      "A legenda pode suportar um pouco mais de informacao sem perder legibilidade."
    );
  }

  if (lineWarnings.length > 0) {
    suggestions.push("Quebre a legenda em frases mais curtas para preservar o punch visual.");
  }

  if (durationWarnings.length > 0) {
    suggestions.push("Ajuste o tempo da cena para alinhar leitura e impacto.");
  }

  const impactScore = buildImpactScore(
    normalizedText,
    {
      ...style,
      animation: cloneAnimation(style.animation)
    } as CaptionStyle,
    speedEstimate.readingSpeedStatus,
    lineWarnings,
    durationWarnings
  );

  return {
    ...speedEstimate,
    lineWarnings,
    durationWarnings,
    impactScore,
    suggestions: [...new Set(suggestions)]
  };
}

export function suggestCaptionStyleByTemplate(
  templateId: string | null | undefined
): CaptionStyle {
  const normalized = typeof templateId === "string" ? normalizeCandidate(templateId) : "";
  const mappedId = captionStyleByTemplate[normalized] ?? "premium_yellow";
  return cloneCaptionStyle(captionStyleRegistry[mappedId]);
}

export function suggestCaptionStyleByEmotion(
  emotion: CaptionEmotionTag | null | undefined
): CaptionStyle {
  switch (emotion) {
    case "EPIC":
      return cloneCaptionStyle(captionStyleRegistry.bold_impact);
    case "CURIOUS":
      return cloneCaptionStyle(captionStyleRegistry.premium_yellow);
    case "MYSTERIOUS":
      return cloneCaptionStyle(captionStyleRegistry.documentary_clean);
    case "DARK":
      return cloneCaptionStyle(captionStyleRegistry.horror_whisper);
    case "TENSE":
      return cloneCaptionStyle(captionStyleRegistry.bold_impact);
    case "JOYFUL":
      return cloneCaptionStyle(captionStyleRegistry.comic_pop);
    case "SAD":
      return cloneCaptionStyle(captionStyleRegistry.documentary_clean);
    case "NEUTRAL":
      return cloneCaptionStyle(captionStyleRegistry.premium_yellow);
    default:
      return cloneCaptionStyle(captionStyleRegistry.premium_yellow);
  }
}

export function generateSrt(project: CaptionExportProjectInput): string {
  const orderedScenes = [...project.scenes].sort((left, right) => left.order - right.order);
  let cursor = 0;
  const blocks: string[] = [];

  orderedScenes.forEach((scene, index) => {
    const captionText = normalizeSpaces(scene.captionText ?? "");
    const duration = normalizeDuration(scene.duration);
    const start = cursor;
    const end = cursor + duration;
    cursor = end;

    if (!captionText) {
      return;
    }

    const style =
      getCaptionStyleById(scene.captionStyle) ??
      cloneCaptionStyle(captionStyleRegistry.premium_yellow);
    const lines = splitCaptionIntoLines(captionText, style);

    blocks.push(
      `${index + 1}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}\n${lines.join(
        "\n"
      )}`
    );
  });

  return blocks.join("\n\n");
}

export function generateAssSubtitle(
  project: CaptionExportProjectInput,
  captionStyle: CaptionStyle | string
): string {
  const resolvedStyle =
    typeof captionStyle === "string"
      ? getCaptionStyleById(captionStyle)
      : cloneCaptionStyle(captionStyle);
  const style = resolvedStyle ?? cloneCaptionStyle(captionStyleRegistry.premium_yellow);
  const orderedScenes = [...project.scenes].sort((left, right) => left.order - right.order);
  const alignmentByPosition: Record<CaptionPosition, number> = {
    top: 8,
    center: 5,
    "lower-third": 2,
    bottom: 2,
    split: 5
  };

  let cursor = 0;
  const dialogueRows: string[] = [];

  orderedScenes.forEach((scene) => {
    const captionText = normalizeSpaces(scene.captionText ?? "");
    const duration = normalizeDuration(scene.duration);
    const start = cursor;
    const end = cursor + duration;
    cursor = end;

    if (!captionText) {
      return;
    }

    const lines = splitCaptionIntoLines(captionText, style)
      .map((line) => escapeAssText(line))
      .join("\\N");

    dialogueRows.push(
      `Dialogue: 0,${formatAssTimestamp(start)},${formatAssTimestamp(end)},Default,,0,0,0,,${lines}`
    );
  });

  return [
    "[Script Info]",
    `Title: ${project.title ?? "ReelForge Caption Export"}`,
    "ScriptType: v4.00+",
    "PlayResX: 1080",
    "PlayResY: 1920",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${style.fontFamily},${style.fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H64000000,${
      style.fontWeight >= "700" ? -1 : 0
    },0,0,0,100,100,0,0,1,${style.outline.width},${Math.max(
      style.shadow.blur / 6,
      1
    )},${alignmentByPosition[style.position]},60,60,${
      style.position === "top" ? 100 : style.position === "center" ? 640 : 180
    },1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogueRows
  ].join("\n");
}

export const captionStyles = getCaptionStyles();

