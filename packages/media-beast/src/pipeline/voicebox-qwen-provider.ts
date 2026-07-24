import type { TtsGenerationRequest, TtsGenerationResult, VoiceboxEngine, VoiceboxModelSize } from "./voicebox-qwen-types.js";

type VoiceboxHealth = {
  status: string;
  model_loaded?: boolean;
  gpu_available?: boolean;
  gpu_type?: string | null;
  vram_used_mb?: number | null;
  backend_type?: string | null;
};

type VoiceboxGeneration = {
  id: string;
  audio_path?: string | null;
  duration?: number | null;
  seed?: number | null;
  engine?: string | null;
  model_size?: string | null;
  instruct?: string | null;
  status: string;
  error?: string | null;
};

export type VoiceboxApiClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class VoiceboxApiClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly pollIntervalMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: VoiceboxApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.VOICEBOX_BASE_URL ?? "http://127.0.0.1:17493").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? Number(process.env.VOICEBOX_TIMEOUT_MS ?? 300_000);
    this.pollIntervalMs = options.pollIntervalMs ?? 750;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.#fetch(`${this.baseUrl}${path}`, { ...init, signal: init.signal ?? AbortSignal.timeout(this.timeoutMs) });
    const body = await response.text();
    if (!response.ok) throw new Error(`Voicebox ${init.method ?? "GET"} ${path} failed (${response.status}): ${body.slice(0, 800)}`);
    return (body ? JSON.parse(body) : {}) as T;
  }

  health() { return this.request<VoiceboxHealth>("/health"); }
  listProfiles() { return this.request<Array<Record<string, unknown>>>("/profiles"); }

  async downloadAudio(generationId: string) {
    const response = await this.#fetch(`${this.baseUrl}/audio/${encodeURIComponent(generationId)}`, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Voicebox audio download failed (${response.status}): ${body.slice(0, 800)}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async generate(request: TtsGenerationRequest) {
    const generation = await this.request<VoiceboxGeneration>("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: request.profileId,
        text: request.text,
        language: request.language,
        seed: request.seed,
        model_size: request.modelSize,
        engine: request.engine,
        instruct: request.engine === "qwen_custom_voice" ? request.instruct : undefined,
        personality: false,
        max_chunk_chars: request.maxChunkChars,
        crossfade_ms: request.crossfadeMs,
        normalize: false,
        effects_chain: [],
      }),
    });
    return this.waitForGeneration(generation);
  }

  async waitForGeneration(initial: VoiceboxGeneration) {
    const startedAt = Date.now();
    let current = initial;
    while (!["completed", "failed", "cancelled"].includes(current.status)) {
      if (Date.now() - startedAt > this.timeoutMs) throw new Error(`Voicebox generation '${current.id}' timed out after ${this.timeoutMs}ms.`);
      await delay(this.pollIntervalMs);
      current = await this.request<VoiceboxGeneration>(`/history/${encodeURIComponent(current.id)}`);
    }
    if (current.status !== "completed" || !current.audio_path) throw new Error(`Voicebox generation '${current.id}' ${current.status}: ${current.error ?? "audio path missing"}`);
    return current;
  }

  async unloadModel(engine: VoiceboxEngine, modelSize: VoiceboxModelSize) {
    const modelName = engine === "qwen_custom_voice" ? `qwen-custom-voice-${modelSize}` : `qwen-tts-${modelSize}`;
    return this.request<Record<string, unknown>>("/models/unload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_name: modelName }),
    });
  }
}

export class VoiceboxHealthCheck {
  constructor(private readonly client: VoiceboxApiClient) {}

  async inspect() {
    try {
      const health = await this.client.health();
      return { reachable: true, ready: health.status === "ok" || health.status === "healthy", ...health };
    } catch (error) {
      return { reachable: false, ready: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class SerialGpuGenerationQueue {
  #tail: Promise<unknown> = Promise.resolve();
  #pending = 0;

  get pending() { return this.#pending; }

  enqueue<T>(operation: () => Promise<T>) {
    this.#pending += 1;
    const result = this.#tail.then(operation, operation);
    this.#tail = result.finally(() => { this.#pending -= 1; });
    return result;
  }
}

export class VoiceboxQwenProvider {
  constructor(readonly client: VoiceboxApiClient, readonly queue = new SerialGpuGenerationQueue()) {}

  async generate(request: TtsGenerationRequest): Promise<TtsGenerationResult> {
    return this.queue.enqueue(async () => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const result = await this.client.generate(request);
          return {
            audioPath: result.audio_path!,
            sampleRate: 24_000,
            durationSec: result.duration ?? 0,
            seed: result.seed ?? request.seed,
            engine: result.engine ?? request.engine,
            modelSize: result.model_size ?? request.modelSize,
            instruct: request.instruct,
            profileId: request.profileId,
            generationId: result.id,
            instructApplied: request.engine === "qwen_custom_voice",
          };
        } catch (error) {
          lastError = error;
          if (attempt < 2) await delay(500);
        }
      }
      throw lastError;
    });
  }

  unloadBeforeRender(engine: VoiceboxEngine, modelSize: VoiceboxModelSize) {
    return this.queue.enqueue(() => this.client.unloadModel(engine, modelSize));
  }
}

export class QwenClonedVoiceProvider extends VoiceboxQwenProvider {
  generateCloned(request: Omit<TtsGenerationRequest, "engine">) {
    return this.generate({ ...request, engine: "qwen" });
  }
}

export class QwenPresetVoiceProvider extends VoiceboxQwenProvider {
  generatePreset(request: Omit<TtsGenerationRequest, "engine">) {
    return this.generate({ ...request, engine: "qwen_custom_voice" });
  }
}

