"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  createProductionFromScriptRequest,
  runEditorialShortPackRequest,
  runOneClickProductionRequest,
  importRemixAssetsRequest,
  runRemixVideoRequest
} from "../lib/studio-api";
import type {
  EditorialShortPackResponse,
  MediaBeastCandidateSummary,
  MediaBeastNichePresetSummary,
  OneClickProductionResponse,
  StudioChannel,
  VideoRemixPlanResponse
} from "../lib/studio-types";

type BeastStudioMode = "new" | "remix";

const PRESET_DEFAULTS: Record<
  string,
  { musicPresetId: string; voicePackId: string; targetStyle: string; channelNiche: string }
> = {
  serial_killers: {
    channelNiche: "true crime",
    musicPresetId: "true_crime_dark",
    voicePackId: "true_crime_dark_ptbr",
    targetStyle: "true_crime"
  },
  futebol_antigo: {
    channelNiche: "football",
    musicPresetId: "football_hype",
    voicePackId: "sports_hype_ptbr",
    targetStyle: "hype_sports"
  },
  quadrinhos_classicos: {
    channelNiche: "comics",
    musicPresetId: "cinematic_epic",
    voicePackId: "documentary_ptbr",
    targetStyle: "documentary"
  },
  cinema_horror: {
    channelNiche: "horror cinema",
    musicPresetId: "true_crime_dark",
    voicePackId: "true_crime_dark_ptbr",
    targetStyle: "horror"
  },
  fisiculturismo: {
    channelNiche: "bodybuilding",
    musicPresetId: "cinematic_epic",
    voicePackId: "documentary_ptbr",
    targetStyle: "documentary"
  },
  historia_obscura: {
    channelNiche: "history",
    musicPresetId: "documentary_clean",
    voicePackId: "true_crime_dark_ptbr",
    targetStyle: "documentary"
  }
};

const PROVIDER_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  pinterest: "Pinterest",
  "old-forums": "Fóruns / artigos",
  flickr: "Fotos (Flickr)",
  "trend-scanner": "Tendências",
  "community-miner": "Comunidades",
  youtube: "YouTube / arquivo",
  "google-images": "Fotos (Google)",
  "internet-archive": "Internet Archive",
  reddit: "Reddit",
  "generic-web": "Web"
};

function isVideoReference(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || /^[a-zA-Z]:\\/.test(trimmed) || /\.(mp4|mov|webm|mkv)$/i.test(trimmed);
}

function detectRemixPlatform(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) return "YouTube";
  if (trimmed.includes("tiktok.com")) return "TikTok";
  if (trimmed.includes("instagram.com")) return "Instagram";
  if (trimmed.includes("facebook.com") || trimmed.includes("fb.watch")) return "Facebook";
  if (trimmed.includes("twitter.com") || trimmed.includes("x.com")) return "X";
  if (trimmed.includes("vimeo.com")) return "Vimeo";
  if (trimmed.includes("reddit.com")) return "Reddit";
  if (isVideoReference(trimmed) && !/^https?:\/\//i.test(trimmed)) return "Arquivo local";
  return null;
}

const SCENE_ROLE_LABELS: Record<string, string> = {
  hook: "Gancho",
  context: "Contexto",
  evidence: "Evidência",
  tension: "Tensão",
  climax: "Clímax",
  outro: "Fechamento"
};

const SOURCE_SEGMENT_LABELS: Record<string, string> = {
  original_clip: "Trecho original",
  comfy_insert: "Insert ComfyUI",
  comfy_reconstruction: "Reconstrução ComfyUI",
  broll_overlay: "B-roll gerado"
};

function getRemixVariations(plan: VideoRemixPlanResponse): VideoRemixPlanResponse[] {
  return [plan, ...(plan.alternativePlans ?? [])];
}

function resolveChannel(channels: StudioChannel[], presetId: string) {
  const niche = PRESET_DEFAULTS[presetId]?.channelNiche.toLowerCase() ?? "";
  return channels.find((c) => c.niche.toLowerCase().includes(niche)) ?? channels[0] ?? null;
}

function SourceCard({ candidate }: { candidate: MediaBeastCandidateSummary }) {
  const lens = candidate.metadata?.temporalLens;
  const lensLabel =
    lens === "past" ? "Arquivo" : lens === "future" ? "Ângulo" : "Atual";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white">{candidate.title}</p>
          <p className="mt-1 text-xs text-mist/55">
            {PROVIDER_LABELS[candidate.providerId] ?? candidate.providerId} · {lensLabel} · score{" "}
            {candidate.score}
          </p>
        </div>
      </div>
      <a
        href={candidate.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block text-sm text-signal hover:underline"
      >
        Abrir fonte
      </a>
    </div>
  );
}

export function BeastStudio({
  channels,
  initialPresets
}: {
  channels: StudioChannel[];
  initialPresets: MediaBeastNichePresetSummary[];
}) {
  const [presetId, setPresetId] = useState(initialPresets[0]?.id ?? "serial_killers");
  const [studioMode, setStudioMode] = useState<BeastStudioMode>("new");
  const [theme, setTheme] = useState("");
  const [videoPath, setVideoPath] = useState("");
  const [remixContext, setRemixContext] = useState("");
  const [variationCount, setVariationCount] = useState(2);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [importedRemixAssets, setImportedRemixAssets] = useState<
    NonNullable<VideoRemixPlanResponse["assetDiscovery"]["importedAssets"]>
  >([]);
  const [assetImportMessage, setAssetImportMessage] = useState<string | null>(null);
  const [pack, setPack] = useState<EditorialShortPackResponse | null>(null);
  const [remixPlan, setRemixPlan] = useState<VideoRemixPlanResponse | null>(null);
  const [result, setResult] = useState<OneClickProductionResponse | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [planApproved, setPlanApproved] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAngles, setShowAngles] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedPreset = useMemo(
    () => initialPresets.find((p) => p.id === presetId) ?? null,
    [initialPresets, presetId]
  );

  const runtimeDefaults = PRESET_DEFAULTS[presetId] ?? PRESET_DEFAULTS.serial_killers!;
  const detectedPlatform = useMemo(() => detectRemixPlatform(videoPath), [videoPath]);
  const remixVariations = useMemo(
    () => (remixPlan ? getRemixVariations(remixPlan) : []),
    [remixPlan]
  );
  const activeRemixPlan = remixVariations[selectedVariationIndex] ?? remixPlan;

  async function ensureProjectId(script: string) {
    if (projectId) return projectId;
    const channel = resolveChannel(channels, presetId);
    if (!channel) throw new Error("Crie um canal antes de usar o Beast Studio.");

    const scriptLines = script.split("\n").filter(Boolean).slice(0, 5);

    const created = await createProductionFromScriptRequest({
      title: `Beast · ${theme.trim().slice(0, 64)}`,
      channelId: channel.id,
      script: scriptLines.join("\n"),
      durationTarget: 35,
      sceneDuration: 7,
      maxScenes: 5,
      format: "9:16",
      status: "DRAFT",
      autoCreateScenes: true,
      autoSuggestAssets: false,
      applyChannelDefaults: true,
      autoAssignAssets: false
    });
    setProjectId(created.project.id);
    return created.project.id;
  }

  function handleGenerate() {
    setError(null);
    setPlanApproved(false);
    setRightsConfirmed(false);
    setPack(null);
    setRemixPlan(null);
    setSelectedVariationIndex(0);
    setSelectedCandidateIds([]);
    setImportedRemixAssets([]);
    setAssetImportMessage(null);
    setResult(null);
    setShowAngles(false);

    const query = theme.trim();
    const source = videoPath.trim();

    if (studioMode === "new" && !query) {
      setError("Digite o tema do short.");
      return;
    }
    if (studioMode === "remix" && !source) {
      setError("Cole o link do Short, Reel ou TikTok para remix.");
      return;
    }

    startTransition(async () => {
      try {
        if (studioMode === "remix") {
          const isUrl = /^https?:\/\//i.test(source);
          const remix = await runRemixVideoRequest({
            ...(isUrl ? { sourceUrl: source } : { inputVideoPath: source }),
            targetStyle: runtimeDefaults.targetStyle,
            intensity: selectedPreset?.defaultIntensity ?? "extreme",
            addNarration: true,
            durationTarget: 40,
            language: "pt-BR",
            autoDownload: isUrl,
            maxDownloadDurationSeconds: 60,
            enableAssetDiscovery: true,
            executeAssetDiscovery: true,
            variationCount,
            ...(remixContext.trim() ? { captionText: remixContext.trim() } : {})
          });

          setRemixPlan(remix);
          setSelectedVariationIndex(0);
          setImportedRemixAssets([]);
          setAssetImportMessage(null);
          setSelectedCandidateIds(
            remix.assetDiscovery.imageSearch.defaultSelectedCandidateIds ??
              remix.assetDiscovery.imageSearch.candidates
                ?.filter((candidate) => candidate.defaultSelected)
                .map((candidate) => candidate.candidateId) ??
              []
          );

          const script = (
            remix.narrationPlan?.suggestedScript ??
            remix.captionPlan.scenes.map((s) => s.captionText).join("\n")
          )
            .split("\n")
            .filter(Boolean)
            .slice(0, 5)
            .join("\n");
          const nextProjectId = await ensureProjectId(script);

          const plan = await runOneClickProductionRequest(nextProjectId, {
            mode: "dry_run",
            remixMode: "remix",
            sourceUrl: isUrl ? source : null,
            inputVideoPath: isUrl ? null : source,
            targetStyle: runtimeDefaults.targetStyle,
            intensity: remix.intensity,
            addNarration: true,
            durationTarget: remix.durationSeconds,
            newMusicPreset: remix.musicPlan.musicPresetId,
            captionText: remix.captionPlan.scenes.map((s) => s.captionText).join(" | "),
            defaults: {
              voicePackId: runtimeDefaults.voicePackId,
              musicPresetId: remix.musicPlan.musicPresetId,
              audioMasteringPresetId: remix.musicPlan.masteringPresetId
            },
            providerStrategy: {
              visualProvider: "comfyui-local",
              fallbackVisualProvider: "mock-svg",
              narrationProvider: "mock-tts"
            },
            options: {
              generateMissingNarration: true,
              generateMissingVisuals: true,
              selectMusic: true,
              buildBeatSyncPlan: true,
              useEditorialMicroclips: true,
              createRenderJob: false,
              runRender: false
            }
          });

          setResult(plan);
          return;
        }

        const editorial = await runEditorialShortPackRequest({
          query,
          nichePresetId: presetId,
          durationSeconds: 35,
          targetCandidateCount: 8,
          language: "pt-BR"
        });

        setPack(editorial);

        const lead = editorial.displayCandidates[0] ?? null;
        const nextProjectId = await ensureProjectId(editorial.narrationScript);

        const plan = await runOneClickProductionRequest(nextProjectId, {
          mode: "dry_run",
          remixMode: "new",
          targetStyle: runtimeDefaults.targetStyle,
          intensity: selectedPreset?.defaultIntensity ?? "extreme",
          addNarration: true,
          durationTarget: 35,
          newMusicPreset: editorial.music.presetId,
          captionText: editorial.captions.join(" | "),
          beastCandidate: lead,
          defaults: {
            voicePackId: editorial.voicePackId,
            musicPresetId: editorial.music.presetId,
            audioMasteringPresetId: editorial.music.presetId,
            qualityPresetId: "standard",
            workflowPackId: editorial.music.presetId
          },
          providerStrategy: {
            visualProvider: "comfyui-local",
            fallbackVisualProvider: "mock-svg",
            narrationProvider: "mock-tts"
          },
          options: {
            generateMissingNarration: true,
            generateMissingVisuals: true,
            selectMusic: true,
            buildBeatSyncPlan: true,
            useEditorialMicroclips: true,
            createRenderJob: false,
            runRender: false
          }
        });

        setResult(plan);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  function toggleCandidateSelection(candidateId: string) {
    setSelectedCandidateIds((current) => {
      const maxSelectable = activeRemixPlan?.assetDiscovery.importPlan?.maxSelectable ?? 6;
      if (current.includes(candidateId)) {
        return current.filter((id) => id !== candidateId);
      }
      if (current.length >= maxSelectable) {
        return current;
      }
      return [...current, candidateId];
    });
  }

  function handleImportSelectedAssets() {
    if (!activeRemixPlan) return;

    const candidates = activeRemixPlan.assetDiscovery.imageSearch.candidates ?? [];
    const selected = candidates.filter((candidate) =>
      selectedCandidateIds.includes(candidate.candidateId)
    );

    if (!selected.length) {
      setAssetImportMessage("Selecione pelo menos um asset para importar.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await importRemixAssetsRequest({
          remixId: activeRemixPlan.remixId,
          candidates: selected,
          contentContext: {
            headline: remixPlan?.videoAnalysis.contentIntelligence?.headline,
            domain: remixPlan?.videoAnalysis.contentIntelligence?.domain,
            entities: remixPlan?.videoAnalysis.contentIntelligence?.entities.map(
              (entity) => entity.name
            )
          },
          sceneRoles: activeRemixPlan.sceneStructure.segments.map((segment) => segment.role)
        });

        setImportedRemixAssets(result.importedAssets);
        setAssetImportMessage(
          result.failedCount
            ? `${result.importedCount} asset(s) importado(s), ${result.failedCount} falha(s).`
            : `${result.importedCount} asset(s) importado(s) para storage/assets/remix-imports.`
        );
        if (result.errors.length) {
          setError(result.errors.map((item) => item.message).join(" "));
        }
      } catch (caught) {
        setAssetImportMessage(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  function handleRender() {
    if (!projectId) return;
    if (studioMode === "new" && !pack) return;
    if (studioMode === "remix" && !activeRemixPlan) return;
    if (!planApproved || !rightsConfirmed) {
      setError("Marque a aprovação do plano e a confirmação de direitos antes de renderizar.");
      return;
    }

    startTransition(async () => {
      try {
        const source = videoPath.trim();
        const isUrl = /^https?:\/\//i.test(source);

        const stagedVideoPath =
          activeRemixPlan?.sourceResolution.localPath ?? activeRemixPlan?.inputVideoPath ?? null;

        const remixPayload =
          studioMode === "remix" && activeRemixPlan
            ? {
                ...(stagedVideoPath
                  ? { inputVideoPath: stagedVideoPath, sourceUrl: null }
                  : isUrl
                    ? { sourceUrl: source, inputVideoPath: null }
                    : { inputVideoPath: source, sourceUrl: null }),
                targetStyle: activeRemixPlan.targetStyle,
                intensity: activeRemixPlan.intensity,
                addNarration: true,
                durationTarget: activeRemixPlan.durationSeconds,
                newMusicPreset: activeRemixPlan.musicPlan.musicPresetId,
                captionText: activeRemixPlan.captionPlan.scenes.map((s) => s.captionText).join(" | ")
              }
            : {
                beastCandidate: pack?.displayCandidates[0] ?? null,
                durationTarget: 35,
                newMusicPreset: pack?.music.presetId ?? null
              };

        const response = await runOneClickProductionRequest(projectId!, {
          mode: "render",
          remixMode: studioMode,
          ...remixPayload,
          planApproved: true,
          rightsConfirmed: true,
          approvedRemixAssetIds: importedRemixAssets.map((asset) => asset.assetId),
          runWorkerOnce: true,
          defaults: {
            voicePackId: pack?.voicePackId ?? runtimeDefaults.voicePackId,
            musicPresetId:
              activeRemixPlan?.musicPlan.musicPresetId ??
              pack?.music.presetId ??
              runtimeDefaults.musicPresetId,
            audioMasteringPresetId:
              activeRemixPlan?.musicPlan.masteringPresetId ??
              pack?.music.presetId ??
              runtimeDefaults.musicPresetId
          },
          providerStrategy: {
            visualProvider: "mock-svg",
            fallbackVisualProvider: "mock-svg",
            narrationProvider: "mock-tts"
          },
          options: {
            generateMissingNarration: true,
            generateMissingVisuals: true,
            selectMusic: true,
            buildBeatSyncPlan: true,
            useEditorialMicroclips: true,
            createRenderJob: true,
            runRender: true,
            runWorkerOnce: true
          }
        });
        setResult(response);

        const failedStep = response.steps.find((step) => step.status === "failed");
        if (failedStep) {
          setError(failedStep.message);
        } else if (!response.renderJobId && response.status !== "completed") {
          setError(
            response.warnings.join(" ") ||
              "Render não concluiu. Verifique se a API está com DATA_BACKEND=prisma."
          );
        } else if (!response.outputPath && response.renderJobId) {
          setError(
            "RenderJob criado, mas o MP4 ainda não está pronto. Confira o worker ou tente novamente."
          );
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-white">Beast Studio</h1>
        <p className="mt-2 text-sm text-mist/65">
          Remix de URL pública ou tema novo → análise, narração reescrita e remix até 45s.
        </p>
      </header>

      <section className="space-y-3 rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
        {studioMode === "new" ? (
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Ex.: massacre de Columbine"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-base text-white outline-none focus:border-signal/40"
          />
        ) : null}
        <select
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white"
        >
          {initialPresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStudioMode("new")}
            className={`flex-1 rounded-xl py-2 text-sm ${studioMode === "new" ? "bg-signal/15 text-white" : "bg-white/5 text-mist/70"}`}
          >
            Criar novo
          </button>
          <button
            type="button"
            onClick={() => setStudioMode("remix")}
            className={`flex-1 rounded-xl py-2 text-sm ${studioMode === "remix" ? "bg-signal/15 text-white" : "bg-white/5 text-mist/70"}`}
          >
            Remixar vídeo
          </button>
        </div>
        {studioMode === "remix" ? (
          <div className="space-y-2">
            <input
              value={videoPath}
              onChange={(e) => setVideoPath(e.target.value)}
              placeholder="Cole o link: YouTube Shorts, TikTok, Instagram Reels..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-base text-white outline-none focus:border-signal/40"
            />
            <input
              value={remixContext}
              onChange={(e) => setRemixContext(e.target.value)}
              placeholder="Contexto opcional: ex. Deadpool vs Venom, Messi gol de falta..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-signal/40"
            />
            <select
              value={variationCount}
              onChange={(e) => setVariationCount(Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white"
            >
              <option value={1}>1 variação de remix</option>
              <option value={2}>2 variações de remix</option>
              <option value={3}>3 variações de remix</option>
            </select>
            {detectedPlatform ? (
              <p className="text-xs text-signal">
                Plataforma detectada: {detectedPlatform} — download automático via yt-dlp
              </p>
            ) : (
              <p className="text-xs text-mist/50">
                Suporta YouTube, TikTok, Instagram, Facebook, X, Vimeo e Reddit
              </p>
            )}
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full rounded-2xl bg-signal py-4 font-semibold text-black disabled:opacity-60"
        >
          {isPending
            ? studioMode === "remix"
              ? "Baixando e planejando remix..."
              : "Estudando o caso..."
            : studioMode === "remix"
              ? "Baixar URL e planejar remix (máx. 45s)"
              : "Gerar short editorial"}
        </button>
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p>
      ) : null}

      {remixPlan && activeRemixPlan ? (
        <div className="space-y-6">
          <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Candidate-first: o vídeo foi baixado para staging, mas o render só libera após sua
            aprovação manual de direitos.
          </p>

          {remixVariations.length > 1 ? (
            <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-medium text-white">Variações de remix ({remixVariations.length})</h2>
              <p className="mt-1 text-xs text-mist/50">
                Cada variação usa estilo, narração e assets ligeiramente diferentes para o mesmo vídeo.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {remixVariations.map((variation, index) => (
                  <button
                    key={variation.remixId}
                    type="button"
                    onClick={() => setSelectedVariationIndex(index)}
                    className={`rounded-xl px-4 py-2 text-sm ${
                      selectedVariationIndex === index
                        ? "bg-signal/20 text-white ring-1 ring-signal/40"
                        : "bg-white/5 text-mist/70"
                    }`}
                  >
                    {variation.variationLabel ?? `Variação ${index + 1}`}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <h2 className="text-lg font-medium text-white">Análise inteligente (Fase 2)</h2>
            <p className="mt-2 text-sm font-medium text-white">
              {remixPlan.videoAnalysis.contentIntelligence?.headline ?? remixPlan.videoAnalysis.themeSummary}
            </p>
            <p className="mt-2 text-sm leading-7 text-mist/85">
              {remixPlan.videoAnalysis.contentIntelligence?.summary ?? remixPlan.videoAnalysis.themeSummary}
            </p>
            <p className="mt-2 text-xs text-mist/55">
              Domínio: {remixPlan.videoAnalysis.contentIntelligence?.domain ?? "generic"} · Tom:{" "}
              {remixPlan.videoAnalysis.contentIntelligence?.mood ?? "editorial"}
            </p>
            <p className="mt-2 text-xs text-mist/55">
              Fonte: {remixPlan.videoAnalysis.sourceDurationSeconds}s ({remixPlan.videoAnalysis.probeMethod}) →
              remix: {activeRemixPlan.durationSeconds}s (máx. 45s) · {activeRemixPlan.variationLabel}
            </p>
            {remixPlan.videoAnalysis.contentIntelligence?.entities?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {remixPlan.videoAnalysis.contentIntelligence.entities.map((entity) => (
                  <span
                    key={entity.id}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/80"
                  >
                    {entity.name}
                    {entity.franchise ? ` · ${entity.franchise}` : ""}
                  </span>
                ))}
              </div>
            ) : null}
            {remixPlan.videoAnalysis.contentIntelligence?.actions?.length ? (
              <p className="mt-2 text-xs text-mist/50">
                Ações: {remixPlan.videoAnalysis.contentIntelligence.actions.map((a) => a.label).join(", ")}
              </p>
            ) : null}
            {remixPlan.videoAnalysis.contextKeywords.length > 0 ? (
              <p className="mt-2 text-xs text-mist/50">
                Palavras-chave: {remixPlan.videoAnalysis.contextKeywords.join(", ")}
              </p>
            ) : null}
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <h2 className="text-lg font-medium text-white">Fonte baixada</h2>
            <p className="mt-2 text-sm text-white">{remixPlan.inputVideoTitle}</p>
            <p className="mt-1 text-xs text-mist/55">
              {remixPlan.sourceResolution.platform} ·{" "}
              {remixPlan.sourceResolution.kind === "public_url" ? "URL pública" : "arquivo local"}
            </p>
            {remixPlan.sourceResolution.download ? (
              <p className="mt-2 text-xs text-mist/60">
                {Math.round((remixPlan.sourceResolution.download.fileSizeBytes ?? 0) / 1024)} KB ·{" "}
                {remixPlan.sourceResolution.download.durationSeconds ?? "?"}s · download limitado a 60s
              </p>
            ) : null}
            {remixPlan.sourceResolution.sourceUrl ? (
              <a
                href={remixPlan.sourceResolution.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm text-signal hover:underline"
              >
                Abrir link original
              </a>
            ) : null}
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <h2 className="text-lg font-medium text-white">
              Nova estrutura de cenas ({activeRemixPlan.sceneStructure.totalScenes})
            </h2>
            <p className="mt-1 text-xs text-mist/50">
              {activeRemixPlan.aggressiveTransform.enabled
                ? `Transformação agressiva · ${activeRemixPlan.aggressiveTransform.comfyVariationCount} variações ComfyUI · ${Math.round(activeRemixPlan.sceneStructure.originalFootprintRatio * 100)}% do original`
                : "Reestruturação editorial"}
            </p>
            <div className="mt-4 space-y-2">
              {activeRemixPlan.sceneStructure.segments.map((segment) => (
                <div
                  key={segment.sceneId}
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      {segment.order}. {SCENE_ROLE_LABELS[segment.role] ?? segment.role}
                    </p>
                    <span className="text-xs text-mist/50">
                      {segment.startSeconds}s–{segment.endSeconds}s
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-mist/60">
                    {SOURCE_SEGMENT_LABELS[segment.sourceSegment] ?? segment.sourceSegment} ·{" "}
                    {segment.transitionIn}
                    {segment.comfyVariationId ? ` · ${segment.comfyVariationId}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {activeRemixPlan.narrationPlan ? (
            <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-medium text-white">Narração reescrita</h2>
              <p className="mt-1 text-xs text-mist/50">
                Voz: {activeRemixPlan.narrationPlan.voicePackHint} · adaptada a {activeRemixPlan.durationSeconds}s
              </p>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-mist/85">
                {activeRemixPlan.narrationPlan.suggestedScript}
              </p>
            </section>
          ) : null}

          <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <h2 className="text-lg font-medium text-white">Assets visuais do remix</h2>
            <p className="mt-1 text-xs text-mist/50">
              Fontes: {activeRemixPlan.assetDiscovery.imageSearch.providerIds.join(", ") || "—"} · até{" "}
              {activeRemixPlan.assetDiscovery.importPlan?.maxSelectable ?? 6} selecionáveis · ComfyUI:{" "}
              {activeRemixPlan.assetDiscovery.comfyui.variationCount}
            </p>
            {activeRemixPlan.assetDiscovery.imageSearch.queries.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-mist/70">
                {activeRemixPlan.assetDiscovery.imageSearch.queries.slice(0, 4).map((query) => (
                  <li key={query}>· {query}</li>
                ))}
              </ul>
            ) : null}
            {activeRemixPlan.assetDiscovery.imageSearch.candidates?.length ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-mist/55">
                  Selecione os assets aprovados. Após importar, eles entram em storage/assets/remix-imports e
                  serão usados nas cenas do remix.
                </p>
                {activeRemixPlan.assetDiscovery.imageSearch.candidates.slice(0, 8).map((candidate) => {
                  const checked = selectedCandidateIds.includes(candidate.candidateId);
                  return (
                    <label
                      key={candidate.candidateId}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-xs ${
                        checked
                          ? "border-signal/40 bg-signal/10"
                          : "border-white/10 bg-white/[0.02]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCandidateSelection(candidate.candidateId)}
                        className="mt-1 accent-signal"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">{candidate.title}</p>
                        <p className="mt-1 text-mist/50">
                          {candidate.providerId} · qualidade {candidate.qualityScore ?? candidate.score} ·{" "}
                          {candidate.purpose}
                          {candidate.recommended ? " · recomendado" : ""}
                        </p>
                      </div>
                    </label>
                  );
                })}
                <button
                  type="button"
                  onClick={handleImportSelectedAssets}
                  disabled={isPending || selectedCandidateIds.length === 0}
                  className="mt-2 w-full rounded-xl border border-signal/30 bg-signal/10 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isPending
                    ? "Importando assets..."
                    : `Importar ${selectedCandidateIds.length} asset(s) selecionado(s)`}
                </button>
              </div>
            ) : null}
            {assetImportMessage ? (
              <p className="mt-3 text-xs text-signal">{assetImportMessage}</p>
            ) : null}
            {importedRemixAssets.length > 0 ? (
              <div className="mt-4 space-y-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                <p className="text-sm font-medium text-emerald-100">
                  Assets importados para o remix ({importedRemixAssets.length})
                </p>
                {importedRemixAssets.map((asset) => (
                  <div key={asset.assetId} className="text-xs text-emerald-50/85">
                    · {asset.sceneRole ?? "cena"} → {asset.localPath} ({asset.importMethod})
                  </div>
                ))}
              </div>
            ) : null}
            {activeRemixPlan.assetDiscovery.comfyui.contextualPrompts?.length ? (
              <ul className="mt-4 space-y-2 text-xs text-mist/65">
                {activeRemixPlan.assetDiscovery.comfyui.contextualPrompts.slice(0, 3).map((prompt) => (
                  <li key={prompt.variationId} className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <span className="text-mist/50">{prompt.variationId}:</span> {prompt.positivePrompt.slice(0, 120)}
                    ...
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <h2 className="text-lg font-medium text-white">Música recomendada</h2>
            <p className="mt-2 text-sm text-white">{activeRemixPlan.musicPlan.musicPresetName}</p>
            <p className="mt-1 text-xs text-mist/50">{activeRemixPlan.musicPlan.musicPresetId}</p>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <h2 className="text-lg font-medium text-white">
              Variações ComfyUI ({activeRemixPlan.visualPlan.comfyVariations.length})
            </h2>
            <ul className="mt-3 space-y-2">
              {activeRemixPlan.visualPlan.comfyVariations.slice(0, 6).map((variation) => (
                <li key={variation.variationId} className="text-xs text-mist/70">
                  {variation.variationId} · {variation.workflowId} · {variation.sourceMixMode}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-[1.75rem] border border-amber-400/20 bg-amber-400/5 p-5">
            <p className="text-xs leading-6 text-amber-100/80">
              O render só inicia após aprovação explícita. Você é responsável por direitos autorais,
              termos da plataforma e permissão de remix do vídeo original.
            </p>
            <label className="flex items-start gap-3 text-sm text-mist/80">
              <input
                type="checkbox"
                checked={planApproved}
                onChange={() => setPlanApproved((value) => !value)}
                className="mt-1 accent-signal"
              />
              Aprovo o plano de remix (roteiro, cortes, música, legendas e variações visuais)
            </label>
            <label className="flex items-start gap-3 text-sm text-mist/80">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={() => setRightsConfirmed((value) => !value)}
                className="mt-1 accent-signal"
              />
              Confirmo que tenho direitos ou permissão explícita para remixar e publicar este conteúdo
            </label>
            {planApproved && rightsConfirmed ? (
              <button
                type="button"
                onClick={handleRender}
                disabled={isPending}
                className="w-full rounded-2xl border border-signal/30 bg-signal/10 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {isPending ? "Criando RenderJob..." : "Aprovar e Renderizar"}
              </button>
            ) : null}
            {result?.renderJobId ? (
              <p className="text-sm text-signal">
                RenderJob criado:{" "}
                <Link href={`/projects/${projectId}`} className="underline">
                  {result.renderJobId}
                </Link>
              </p>
            ) : null}
            {result?.outputPath ? (
              <p className="text-sm text-emerald-300/90">
                MP4 pronto: <span className="font-mono text-xs">{result.outputPath}</span>
              </p>
            ) : result?.status === "partial" && result?.renderJobId ? (
              <p className="text-xs text-amber-200/70">
                RenderJob enfileirado — o worker pode ainda estar processando.
              </p>
            ) : null}
            {projectId ? (
              <Link href={`/projects/${projectId}`} className="block text-center text-sm text-signal">
                Abrir projeto
              </Link>
            ) : null}
          </section>

          {remixPlan.warnings.length > 0 ? (
            <p className="text-xs leading-6 text-amber-200/70">{remixPlan.warnings.slice(0, 3).join(" ")}</p>
          ) : null}
        </div>
      ) : null}

      {pack ? (
        <div className="space-y-6">
          {pack.topicCaseId ? (
            <p className="rounded-xl border border-signal/20 bg-signal/10 px-4 py-2 text-sm text-signal">
              Caso reconhecido: <strong>{pack.topicCaseId}</strong> — roteiro factual embutido
            </p>
          ) : null}

          <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <h2 className="text-lg font-medium text-white">Narração pronta (~35s)</h2>
            <p className="mt-1 text-xs text-mist/50">
              Voz: {pack.voicePackLabel} · {pack.voiceStyle}
            </p>
            <p className="mt-4 whitespace-pre-line text-sm leading-8 text-mist/85">{pack.narrationScript}</p>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <h2 className="text-lg font-medium text-white">Legendas emotivas (tela inferior)</h2>
            <p className="mt-1 text-xs text-mist/50">Uma a cada ~7s — impacto visual + gancho</p>
            <ul className="mt-4 space-y-3">
              {pack.captions.map((line, index) => (
                <li
                  key={line}
                  className="rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-transparent px-4 py-4 text-center text-base font-medium tracking-wide text-white"
                >
                  <span className="mr-2 text-xs text-mist/40">{index + 1}.</span>
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <h2 className="text-lg font-medium text-white">Música de fundo</h2>
            <p className="mt-2 text-sm text-white">{pack.music.name}</p>
            <p className="mt-2 text-sm leading-7 text-mist/70">{pack.music.moodReason}</p>
            <p className="mt-2 text-xs text-mist/50">{pack.music.copyrightSafePath}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-white">
              Fotos e fontes ({pack.displayCandidates.length})
            </h2>
            <p className="text-xs text-mist/50">
              Google Imagens, Internet Archive, YouTube e artigos — sem Flickr vazio.
            </p>
            <div className="space-y-2">
              {pack.displayCandidates.map((candidate) => (
                <SourceCard key={candidate.id} candidate={candidate} />
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <button
              type="button"
              onClick={() => setShowAngles((v) => !v)}
              className="text-sm text-signal"
            >
              {showAngles ? "Ocultar" : "Ver"} {pack.shortAngleCount} ideias de shorts deste caso
            </button>
            {showAngles ? (
              <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm text-mist/75">
                {pack.shortAngles.map((angle) => (
                  <li key={angle} className="border-b border-white/5 pb-2">
                    {angle}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="space-y-3 rounded-[1.75rem] border border-amber-400/20 bg-amber-400/5 p-5">
            <p className="text-xs leading-6 text-amber-100/80">
              O render só inicia após aprovação explícita e confirmação de direitos sobre fontes e conteúdo.
            </p>
            <label className="flex items-start gap-3 text-sm text-mist/80">
              <input
                type="checkbox"
                checked={planApproved}
                onChange={() => setPlanApproved((value) => !value)}
                className="mt-1 accent-signal"
              />
              Aprovo roteiro, fontes visuais e música para produção
            </label>
            <label className="flex items-start gap-3 text-sm text-mist/80">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={() => setRightsConfirmed((value) => !value)}
                className="mt-1 accent-signal"
              />
              Confirmo direitos ou permissão para usar e publicar o material deste short
            </label>
            {planApproved && rightsConfirmed ? (
              <button
                type="button"
                onClick={handleRender}
                disabled={isPending}
                className="w-full rounded-2xl border border-signal/30 bg-signal/10 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {isPending ? "Criando RenderJob..." : "Aprovar e Renderizar"}
              </button>
            ) : null}
            {result?.renderJobId ? (
              <p className="text-sm text-signal">
                RenderJob criado:{" "}
                <Link href={`/projects/${projectId}`} className="underline">
                  {result.renderJobId}
                </Link>
              </p>
            ) : null}
            {result?.outputPath ? (
              <p className="text-sm text-emerald-300/90">
                MP4 pronto: <span className="font-mono text-xs">{result.outputPath}</span>
              </p>
            ) : result?.status === "partial" && result?.renderJobId ? (
              <p className="text-xs text-amber-200/70">
                RenderJob enfileirado — o worker pode ainda estar processando.
              </p>
            ) : null}
            {projectId ? (
              <Link href={`/projects/${projectId}`} className="block text-center text-sm text-signal">
                Abrir projeto
              </Link>
            ) : null}
          </section>

          {pack.sensitivityNotes.length > 0 ? (
            <p className="text-xs leading-6 text-amber-200/70">
              {pack.sensitivityNotes.join(" ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {result?.warnings?.[0] ? (
        <p className="text-xs text-mist/50">{result.warnings[0]}</p>
      ) : null}
    </div>
  );
}