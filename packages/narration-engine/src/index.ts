import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const narrationProviderIds = [
  "mock-tts",
  "windows-sapi-local",
  "f5-tts-local"
] as const;

export type NarrationProviderId = (typeof narrationProviderIds)[number];

export interface NarrationProviderDescriptor {
  id: NarrationProviderId;
  name: string;
  description: string;
  available: boolean;
  enabled: boolean;
  requiresWindows: boolean;
  offline: boolean;
  status: "ready" | "disabled" | "unavailable";
  reason: string | null;
  baseUrl?: string | null;
}

export interface VoicePack {
  id: string;
  name: string;
  description: string;
  language: string;
  tone: string;
  rate: number;
  pitch: number | null;
  volume: number;
  recommendedUse: string;
  safetyNotes: string;
}

export interface NarrationSceneLike {
  id?: string | null;
  title: string;
  narrationText?: string | null;
  captionText?: string | null;
}

export interface NarrationProjectLike {
  id?: string | null;
  title: string;
  script?: string | null;
  language?: string | null;
}

export interface NarrationPlanInput {
  provider?: NarrationProviderId | null;
  voicePackId?: string | null;
  language?: string | null;
  text: string;
  sampleRate?: number | null;
  seed?: number | null;
}

export interface NarrationPlan {
  provider: NarrationProviderId;
  voicePack: VoicePack;
  language: string;
  text: string;
  normalizedText: string;
  sampleRate: number;
  estimatedDurationSeconds: number;
  seed: number;
}

export interface GeneratedNarrationAudio {
  wavBuffer: Buffer;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  seed: number;
}

export interface WindowsSapiGenerationInput extends NarrationPlanInput {
  outputAbsolutePath: string;
  timeoutMs?: number | null;
}

export interface F5TtsGenerationInput extends NarrationPlanInput {
  outputAbsolutePath?: string | null;
  baseUrl?: string | null;
  timeoutMs?: number | null;
}

export interface NarrationJobSummaryInput {
  id: string;
  sceneId: string | null;
  videoProjectId: string | null;
  provider: string;
  voicePackId: string | null;
  status: string;
  generatedAssetId: string | null;
  outputPath: string | null;
  errorMessage: string | null;
}

const voicePacks: VoicePack[] = [
  {
    id: "narrator_clean_ptbr",
    name: "Narrador Clean PT-BR",
    description: "Locucao limpa e neutra para explicacoes diretas.",
    language: "pt-BR",
    tone: "clean",
    rate: -1,
    pitch: null,
    volume: 90,
    recommendedUse: "Explicacoes gerais, demos e cortes informativos.",
    safetyNotes: "Nao representa voz real especifica."
  },
  {
    id: "documentary_ptbr",
    name: "Documentary PT-BR",
    description: "Cadencia documental mais pausada para contexto e fatos.",
    language: "pt-BR",
    tone: "documentary",
    rate: -2,
    pitch: null,
    volume: 92,
    recommendedUse: "Docu-style, lore e explicacoes investigativas.",
    safetyNotes: "Mantem timbre generico e neutro."
  },
  {
    id: "true_crime_dark_ptbr",
    name: "True Crime Dark PT-BR",
    description: "Cadencia densa para misterio e narrativas sombrias.",
    language: "pt-BR",
    tone: "dark",
    rate: -3,
    pitch: -1,
    volume: 94,
    recommendedUse: "True crime, horror leve e suspense documental.",
    safetyNotes: "Nao imita narradores reconheciveis."
  },
  {
    id: "story_epic_ptbr",
    name: "Story Epic PT-BR",
    description: "Ritmo mais energico para viradas e revelacoes.",
    language: "pt-BR",
    tone: "epic",
    rate: 0,
    pitch: 1,
    volume: 96,
    recommendedUse: "Lore heroico, games e storytelling com energia.",
    safetyNotes: "Uso generico, sem personagem real."
  },
  {
    id: "sports_hype_ptbr",
    name: "Sports Hype PT-BR",
    description: "Ataque mais rapido para highlights e hype.",
    language: "pt-BR",
    tone: "hype",
    rate: 1,
    pitch: 1,
    volume: 96,
    recommendedUse: "Clipes esportivos, chamadas e energia alta.",
    safetyNotes: "Evita assinatura vocal de apresentadores reais."
  },
  {
    id: "calm_explainer_ptbr",
    name: "Calm Explainer PT-BR",
    description: "Narracao suave para fluxo calmo e didatico.",
    language: "pt-BR",
    tone: "calm",
    rate: -2,
    pitch: null,
    volume: 88,
    recommendedUse: "Explicadores, historia e contexto longo.",
    safetyNotes: "Timbre abstrato e generico."
  }
];

function escapePowerShellString(value: string) {
  return value.replaceAll("'", "''");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function deterministicSeed(text: string) {
  let acc = 5381;

  for (const char of text) {
    acc = (acc * 33 + char.charCodeAt(0)) % 2_147_483_647;
  }

  return Math.max(acc, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDefaultVoicePack() {
  return voicePacks[0] as VoicePack;
}

function estimateDurationSeconds(text: string, rate: number) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return 0.8;
  }

  const words = normalized.split(" ").filter(Boolean).length;
  const punctuationPauses =
    (normalized.match(/[.,;:!?]/g) ?? []).length * 0.12;
  const baseWordsPerSecond = clamp(2.2 + rate * 0.08, 1.4, 3.2);
  return Math.max(words / baseWordsPerSecond + punctuationPauses, 1.2);
}

function encodePcm16Wav(samples: Int16Array, sampleRate: number, channels = 1) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(samples[index] ?? 0, 44 + index * 2);
  }

  return buffer;
}

function parseWavInfo(buffer: Buffer) {
  if (buffer.length < 44) {
    throw new Error("Invalid WAV buffer: header too short.");
  }

  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const dataSize = buffer.readUInt32LE(40);
  const bytesPerSample = 2;
  const frameCount = dataSize / Math.max(channels * bytesPerSample, 1);
  const durationSeconds = frameCount / Math.max(sampleRate, 1);

  return {
    channels,
    sampleRate,
    durationSeconds
  };
}

function toWordTone(word: string, voicePack: VoicePack, seed: number) {
  let acc = seed % 97;

  for (const char of word) {
    acc = (acc + char.charCodeAt(0) * 7) % 197;
  }

  const base = 180 + acc;
  const pitchShift = (voicePack.pitch ?? 0) * 18;
  return clamp(base + pitchShift, 110, 520);
}

export function getNarrationProviders(options: {
  windowsSapiEnabled?: boolean;
  f5TtsEnabled?: boolean;
  f5TtsBaseUrl?: string | null;
  platform?: NodeJS.Platform;
} = {}) {
  const platform = options.platform ?? process.platform;
  const windowsReady = platform === "win32";
  const sapiEnabled = options.windowsSapiEnabled ?? false;
  const f5Enabled = options.f5TtsEnabled ?? false;
  const f5BaseUrl = normalizeF5TtsBaseUrl(options.f5TtsBaseUrl);

  return [
    {
      id: "mock-tts",
      name: "Mock TTS Offline",
      description:
        "Gera WAV deterministico com tons e pausas para validar o pipeline local.",
      available: true,
      enabled: true,
      requiresWindows: false,
      offline: true,
      status: "ready" as const,
      reason: null
    },
    {
      id: "windows-sapi-local",
      name: "Windows SAPI Local",
      description:
        "Usa a voz instalada no Windows sem depender de API externa.",
      available: windowsReady && sapiEnabled,
      enabled: sapiEnabled,
      requiresWindows: true,
      offline: true,
      status: windowsReady
        ? sapiEnabled
          ? ("ready" as const)
          : ("disabled" as const)
        : ("unavailable" as const),
      reason: windowsReady
        ? sapiEnabled
          ? null
          : "Ative NARRATION_WINDOWS_SAPI_ENABLED=true para expor o provider."
        : "Provider disponivel apenas em Windows."
    },
    {
      id: "f5-tts-local",
      name: "F5-TTS Local",
      description:
        "Provider premium opcional via servidor/bridge F5-TTS local. Nao usa API externa nem clona vozes reais.",
      available: f5Enabled,
      enabled: f5Enabled,
      requiresWindows: false,
      offline: true,
      status: f5Enabled ? ("ready" as const) : ("disabled" as const),
      reason: f5Enabled
        ? null
        : "Ative F5_TTS_ENABLED=true e configure F5_TTS_BASE_URL para usar o provider.",
      baseUrl: f5BaseUrl
    }
  ] satisfies NarrationProviderDescriptor[];
}

export function getVoicePacks() {
  return [...voicePacks];
}

export function getVoicePackById(id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return voicePacks.find((voicePack) => voicePack.id === id) ?? null;
}

export function buildNarrationTextFromScene(
  scene: NarrationSceneLike,
  project: NarrationProjectLike | null = null
) {
  const sceneNarration = normalizeText(scene.narrationText ?? "");

  if (sceneNarration) {
    return sceneNarration;
  }

  const caption = normalizeText(scene.captionText ?? "");

  if (caption) {
    return caption;
  }

  const projectScript = normalizeText(project?.script ?? "");

  if (projectScript) {
    return `${scene.title}. ${projectScript}`;
  }

  return normalizeText(scene.title);
}

export function buildNarrationPlan(input: NarrationPlanInput): NarrationPlan {
  const text = normalizeText(input.text);

  if (!text) {
    throw new Error("Narration text is required.");
  }

  const voicePack = getVoicePackById(input.voicePackId) ?? getDefaultVoicePack();
  const sampleRate = clamp(Math.round(input.sampleRate ?? 22_050), 8_000, 48_000);
  const provider = input.provider ?? "mock-tts";
  const seed = input.seed ?? deterministicSeed(`${voicePack.id}:${text}`);

  return {
    provider,
    voicePack,
    language: input.language?.trim() || voicePack.language,
    text,
    normalizedText: text,
    sampleRate,
    estimatedDurationSeconds: estimateDurationSeconds(text, voicePack.rate),
    seed
  };
}

export function generateMockNarrationWav(
  input: NarrationPlanInput
): GeneratedNarrationAudio {
  const plan = buildNarrationPlan(input);
  const words = plan.normalizedText.split(" ").filter(Boolean);
  const sampleCount = Math.max(
    Math.ceil(plan.estimatedDurationSeconds * plan.sampleRate),
    plan.sampleRate
  );
  const samples = new Int16Array(sampleCount);
  const amplitude = clamp(plan.voicePack.volume / 100, 0.25, 1) * 0.22;
  const pauseSamples = Math.floor(plan.sampleRate * 0.04);
  let cursor = Math.floor(plan.sampleRate * 0.08);

  for (const word of words) {
    const tone = toWordTone(word, plan.voicePack, plan.seed);
    const wordSamples = Math.max(
      Math.floor(
        plan.sampleRate *
          clamp(0.09 + word.length * 0.018 - plan.voicePack.rate * 0.002, 0.06, 0.28)
      ),
      1
    );

    for (
      let frame = 0;
      frame < wordSamples && cursor + frame < sampleCount;
      frame += 1
    ) {
      const attack = Math.min(frame / Math.max(wordSamples * 0.16, 1), 1);
      const release = Math.min(
        (wordSamples - frame) / Math.max(wordSamples * 0.18, 1),
        1
      );
      const envelope = Math.max(Math.min(attack, release), 0);
      const wobble = 1 + 0.035 * Math.sin((2 * Math.PI * frame) / 880);
      const sample =
        Math.sin((2 * Math.PI * tone * wobble * (cursor + frame)) / plan.sampleRate) *
        32767 *
        amplitude *
        envelope;
      samples[cursor + frame] = Math.round(sample);
    }

    cursor += wordSamples + pauseSamples;

    if (cursor >= sampleCount) {
      break;
    }
  }

  const wavBuffer = encodePcm16Wav(samples, plan.sampleRate, 1);

  return {
    wavBuffer,
    durationSeconds: sampleCount / plan.sampleRate,
    sampleRate: plan.sampleRate,
    channels: 1,
    seed: plan.seed
  };
}

export async function generateWindowsSapiNarrationWav(
  input: WindowsSapiGenerationInput
): Promise<GeneratedNarrationAudio> {
  if (process.platform !== "win32") {
    throw new Error("windows-sapi-local is available only on Windows.");
  }

  const planInput: NarrationPlanInput = {
    provider: "windows-sapi-local",
    text: input.text
  };

  if (input.voicePackId !== undefined) {
    planInput.voicePackId = input.voicePackId;
  }

  if (input.language !== undefined) {
    planInput.language = input.language;
  }

  if (input.sampleRate !== undefined) {
    planInput.sampleRate = input.sampleRate;
  }

  if (input.seed !== undefined) {
    planInput.seed = input.seed;
  }

  const plan = buildNarrationPlan(planInput);
  const command = [
    "Add-Type -AssemblyName System.Speech",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    `$synth.Rate = ${plan.voicePack.rate}`,
    `$synth.Volume = ${clamp(Math.round(plan.voicePack.volume), 0, 100)}`,
    `$synth.SetOutputToWaveFile('${escapePowerShellString(input.outputAbsolutePath)}')`,
    `$synth.Speak('${escapePowerShellString(plan.normalizedText)}')`,
    "$synth.Dispose()"
  ].join("; ");

  await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-Command", command],
    {
      timeout: input.timeoutMs ?? 300_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    }
  );

  const wavBuffer = await readFile(input.outputAbsolutePath);
  const info = parseWavInfo(wavBuffer);

  return {
    wavBuffer,
    durationSeconds: info.durationSeconds,
    sampleRate: info.sampleRate,
    channels: info.channels,
    seed: plan.seed
  };
}

function normalizeF5TtsBaseUrl(value: string | null | undefined) {
  const baseUrl = (value ?? process.env.F5_TTS_BASE_URL ?? "http://127.0.0.1:7860")
    .trim()
    .replace(/\/+$/, "");

  return baseUrl || "http://127.0.0.1:7860";
}

async function readF5TtsResponseAudio(response: Response, baseUrl: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `F5-TTS local request failed (${response.status}): ${
        message.trim() || response.statusText
      }`
    );
  }

  if (contentType.includes("audio/") || contentType.includes("application/octet-stream")) {
    return Buffer.from(await response.arrayBuffer());
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        wavBase64?: string;
        audioBase64?: string;
        outputPath?: string;
        audioUrl?: string;
      }
    | null;

  if (!payload) {
    throw new Error("F5-TTS local response did not contain audio.");
  }

  const base64 = payload.wavBase64 ?? payload.audioBase64;

  if (base64) {
    return Buffer.from(base64, "base64");
  }

  if (payload.outputPath) {
    return readFile(payload.outputPath);
  }

  if (payload.audioUrl) {
    const audioUrl = payload.audioUrl.startsWith("http")
      ? payload.audioUrl
      : `${baseUrl}/${payload.audioUrl.replace(/^\/+/, "")}`;
    const audioResponse = await fetch(audioUrl);
    return readF5TtsResponseAudio(audioResponse, baseUrl);
  }

  throw new Error("F5-TTS local response is missing wavBase64, audioBase64, outputPath or audioUrl.");
}

export async function generateF5TtsNarrationWav(
  input: F5TtsGenerationInput
): Promise<GeneratedNarrationAudio> {
  const planInput: NarrationPlanInput = {
    provider: "f5-tts-local",
    text: input.text
  };

  if (input.voicePackId !== undefined) {
    planInput.voicePackId = input.voicePackId;
  }

  if (input.language !== undefined) {
    planInput.language = input.language;
  }

  if (input.sampleRate !== undefined) {
    planInput.sampleRate = input.sampleRate;
  }

  if (input.seed !== undefined) {
    planInput.seed = input.seed;
  }

  const plan = buildNarrationPlan(planInput);
  const baseUrl = normalizeF5TtsBaseUrl(input.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? Number(process.env.F5_TTS_TIMEOUT_MS ?? 300_000)
  );

  try {
    const response = await fetch(`${baseUrl}/synthesize`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        text: plan.normalizedText,
        language: plan.language,
        voicePackId: plan.voicePack.id,
        voicePackTone: plan.voicePack.tone,
        rate: plan.voicePack.rate,
        pitch: plan.voicePack.pitch,
        volume: plan.voicePack.volume,
        sampleRate: plan.sampleRate,
        seed: plan.seed,
        safety: {
          allowVoiceCloning: false,
          allowRealPersonImitation: false,
          voicePolicy: "generic-local-voice-only"
        }
      }),
      signal: controller.signal
    });
    const wavBuffer = await readF5TtsResponseAudio(response, baseUrl);
    const info = parseWavInfo(wavBuffer);

    return {
      wavBuffer,
      durationSeconds: info.durationSeconds,
      sampleRate: info.sampleRate,
      channels: info.channels,
      seed: plan.seed
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function summarizeNarrationJob(job: NarrationJobSummaryInput) {
  return [
    `job ${job.id}`,
    `status=${job.status}`,
    `provider=${job.provider}`,
    job.voicePackId ? `voicePack=${job.voicePackId}` : null,
    job.sceneId ? `scene=${job.sceneId}` : null,
    job.videoProjectId ? `project=${job.videoProjectId}` : null,
    job.generatedAssetId ? `asset=${job.generatedAssetId}` : null,
    job.outputPath ? `wav=${job.outputPath}` : null,
    job.errorMessage ? `error=${job.errorMessage}` : null
  ]
    .filter((part): part is string => Boolean(part))
    .join(" | ");
}
