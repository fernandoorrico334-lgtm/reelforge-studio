"use client";

import Link from "next/link";
import { suggestMusicPresetByContext } from "@reelforge/audio-engine";
import {
  buildVisualPrompt,
  type NegativePromptPackId,
  type VisualPromptPackId
} from "@reelforge/prompt-engine";
import { getTemplates } from "@reelforge/templates";
import { useEffect, useState } from "react";
import { AssetMediaPreview } from "./asset-media-preview";
import {
  buildResearchRequirementVisualPromptRequest,
  generateSceneNarrationRequest,
  buildSceneVisualPromptRequest,
  generateRequirementVisualRequest,
  generateSceneVisualRequest
} from "../lib/studio-api";
import type {
  CharacterProfile,
  ComfyWorkflowPack,
  DataSource,
  EditingReferencePreset,
  GeneratedAudioGalleryItem,
  GeneratedImageGalleryItem,
  ImageQualityPreset,
  NarrationProviderDescriptor,
  NarrationVoicePack,
  NegativePromptPack,
  ProjectScene,
  PromptVariantType,
  ResearchAssetRequirement,
  StudioChannel,
  StudioProject,
  VisualGenerationProvider,
  VisualGenerationProviderDescriptor,
  VisualPromptPack
} from "../lib/studio-types";
import { promptVariantTypes, templateIds } from "../lib/studio-types";

interface PromptLabRequirementOption {
  dossierId: string;
  dossierTitle: string;
  requirement: ResearchAssetRequirement;
  channelId: string | null;
  channel: StudioChannel | null;
}

interface PromptLabStudioProps {
  projects: StudioProject[];
  projectsSource: DataSource;
  channels: StudioChannel[];
  channelsSource: DataSource;
  characters: CharacterProfile[];
  charactersSource: DataSource;
  promptPacks: VisualPromptPack[];
  promptPacksSource: DataSource;
  negativePromptPacks: NegativePromptPack[];
  negativePromptPacksSource: DataSource;
  workflowPacks: ComfyWorkflowPack[];
  workflowPacksSource: DataSource;
  qualityPresets: ImageQualityPreset[];
  qualityPresetsSource: DataSource;
  editingReferencePresets: EditingReferencePreset[];
  editingReferencePresetsSource: DataSource;
  researchRequirements: PromptLabRequirementOption[];
  researchRequirementsSource: DataSource;
  visualGenerationProviders: VisualGenerationProviderDescriptor[];
  visualGenerationProvidersSource: DataSource;
  recentGeneratedImages: GeneratedImageGalleryItem[];
  recentGeneratedImagesSource: DataSource;
  narrationProviders: NarrationProviderDescriptor[];
  narrationProvidersSource: DataSource;
  narrationVoicePacks: NarrationVoicePack[];
  narrationVoicePacksSource: DataSource;
  recentGeneratedAudio: GeneratedAudioGalleryItem[];
  recentGeneratedAudioSource: DataSource;
}

function formatSourceLabel(value: DataSource) {
  return value === "api" ? "API local ativa" : "Mock local";
}

function formatTagLabel(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];
}

function resolveSceneEffectiveAsset(scene: ProjectScene) {
  return scene.generatedAsset ?? scene.asset ?? null;
}

export function PromptLabStudio({
  projects,
  projectsSource,
  channels,
  channelsSource,
  characters,
  charactersSource,
  promptPacks,
  promptPacksSource,
  negativePromptPacks,
  negativePromptPacksSource,
  workflowPacks,
  workflowPacksSource,
  qualityPresets,
  qualityPresetsSource,
  editingReferencePresets,
  editingReferencePresetsSource,
  researchRequirements,
  researchRequirementsSource,
  visualGenerationProviders,
  visualGenerationProvidersSource,
  recentGeneratedImages,
  recentGeneratedImagesSource,
  narrationProviders,
  narrationProvidersSource,
  narrationVoicePacks,
  narrationVoicePacksSource,
  recentGeneratedAudio,
  recentGeneratedAudioSource
}: PromptLabStudioProps) {
  const templates = getTemplates();
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [selectedSceneId, setSelectedSceneId] = useState(
    projects[0]?.scenes[0]?.id ?? ""
  );
  const [selectedRequirementId, setSelectedRequirementId] = useState(
    researchRequirements[0]?.requirement.id ?? ""
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedPromptPackId, setSelectedPromptPackId] = useState<
    VisualPromptPackId | ""
  >("");
  const [selectedNegativePromptPackId, setSelectedNegativePromptPackId] =
    useState<NegativePromptPackId | "">("");
  const [selectedVariantType, setSelectedVariantType] =
    useState<PromptVariantType | "">("");
  const [selectedWorkflowPackId, setSelectedWorkflowPackId] = useState(
    workflowPacks[0]?.id ?? "cinematic_story"
  );
  const [selectedEditingReferencePresetId, setSelectedEditingReferencePresetId] =
    useState(editingReferencePresets[0]?.id ?? "");
  const [selectedQualityPresetId, setSelectedQualityPresetId] = useState<string>(
    qualityPresets.find((preset) => preset.id === "standard")?.id ??
      qualityPresets[0]?.id ??
      "standard"
  );
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("txt2img-basic");
  const [selectedSeedMode, setSelectedSeedMode] = useState("reuse");
  const [selectedNarrationProviderId, setSelectedNarrationProviderId] = useState<
    NarrationProviderDescriptor["id"]
  >(
    narrationProviders.find((provider) => provider.id === "mock-tts")?.id ??
      narrationProviders[0]?.id ??
      "mock-tts"
  );
  const [selectedNarrationVoicePackId, setSelectedNarrationVoicePackId] = useState(
    narrationVoicePacks.find((voicePack) => voicePack.id === "documentary_ptbr")?.id ??
      narrationVoicePacks[0]?.id ??
      ""
  );
  const [editorialMicroclipSuggestion, setEditorialMicroclipSuggestion] =
    useState("");
  const [musicMoodHint, setMusicMoodHint] = useState("");
  const [narrationPreviewText, setNarrationPreviewText] = useState(
    projects[0]?.scenes[0]?.narrationText ??
      projects[0]?.scenes[0]?.captionText ??
      projects[0]?.script ??
      ""
  );
  const [lastGeneratedNarration, setLastGeneratedNarration] =
    useState<GeneratedAudioGalleryItem | null>(recentGeneratedAudio[0] ?? null);
  const [statusMessage, setStatusMessage] = useState(
    "Monte um contexto e gere um prompt premium reutilizavel."
  );

  const comfyProvider =
    visualGenerationProviders.find((provider) => provider.id === "comfyui-local") ??
    null;
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedScene =
    selectedProject?.scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  const selectedRequirementOption =
    researchRequirements.find(
      (entry) => entry.requirement.id === selectedRequirementId
    ) ?? null;
  const selectedRequirement = selectedRequirementOption?.requirement ?? null;
  const effectiveChannel =
    channels.find((channel) => channel.id === selectedChannelId) ??
    selectedProject?.channel ??
    selectedRequirementOption?.channel ??
    null;
  const effectiveCharacter =
    characters.find((character) => character.id === selectedCharacterId) ??
    characters.find(
      (character) =>
        character.id ===
        (selectedScene?.characterProfileId ??
          selectedRequirement?.characterProfileId ??
          "")
    ) ??
    null;
  const effectiveTemplateId =
    selectedTemplateId ||
    selectedProject?.templateId ||
    effectiveChannel?.defaultTemplate ||
    "";
  const effectiveSceneAsset = selectedScene
    ? resolveSceneEffectiveAsset(selectedScene)
    : null;
  const selectedWorkflowPack =
    workflowPacks.find((pack) => pack.id === selectedWorkflowPackId) ??
    workflowPacks.find((pack) => pack.id === "cinematic_story") ??
    workflowPacks[0] ??
    null;
  const selectedQualityPreset =
    qualityPresets.find((preset) => preset.id === selectedQualityPresetId) ??
    qualityPresets.find((preset) => preset.id === "standard") ??
    qualityPresets[0] ??
    null;
  const selectedEditingReferencePreset =
    editingReferencePresets.find(
      (preset) => preset.id === selectedEditingReferencePresetId
    ) ?? null;
  const suggestedMusicPreset = suggestMusicPresetByContext({
    templateId: effectiveTemplateId || null,
    tone:
      musicMoodHint ||
      effectiveChannel?.narrativeTone ||
      selectedScene?.emotion ||
      selectedRequirement?.emotion ||
      null
  });
  const preview = buildVisualPrompt({
    scene: selectedScene
      ? {
          id: selectedScene.id,
          title: selectedScene.title,
          narrationText: selectedScene.narrationText,
          captionText: selectedScene.captionText,
          emotion: selectedScene.emotion,
          visualPreset: selectedScene.visualPreset,
          energyLevel: selectedScene.energyLevel,
          visualPrompt: selectedScene.visualPrompt ?? null,
          negativePrompt: selectedScene.negativePrompt ?? null
        }
      : {
          id: "prompt-lab-draft",
          title: selectedRequirement?.description ?? "prompt lab concept frame",
          narrationText: selectedRequirement?.description ?? null,
          captionText: null,
          emotion: selectedRequirement?.emotion ?? null,
          visualPreset: effectiveChannel?.defaultVisualPreset ?? null,
          energyLevel: selectedRequirement?.priority ?? 72,
          visualPrompt: null,
          negativePrompt: null
        },
    project: selectedProject
      ? {
          id: selectedProject.id,
          title: selectedProject.title,
          script: selectedProject.script,
          format: selectedProject.format,
          templateId: selectedProject.templateId ?? null
        }
      : null,
    channel: effectiveChannel
      ? {
          id: effectiveChannel.id,
          name: effectiveChannel.name,
          niche: effectiveChannel.niche,
          visualStyle: effectiveChannel.visualStyle,
          narrativeTone: effectiveChannel.narrativeTone,
          defaultTemplate: effectiveChannel.defaultTemplate
        }
      : null,
    characterProfile: effectiveCharacter
      ? {
          id: effectiveCharacter.id,
          name: effectiveCharacter.name,
          franchise: effectiveCharacter.franchise,
          description: effectiveCharacter.description,
          basePrompt: effectiveCharacter.basePrompt,
          negativePrompt: effectiveCharacter.negativePrompt,
          styleNotes: effectiveCharacter.styleNotes,
          defaultVisualStyle: effectiveCharacter.defaultVisualStyle,
          tags: [...effectiveCharacter.tags],
          references: effectiveCharacter.references.map((reference) => ({
            title: reference.title,
            notes: reference.notes,
            referenceType: reference.referenceType,
            tags: reference.asset?.tags ? [...reference.asset.tags] : []
          }))
        }
      : null,
    researchAssetRequirement: selectedRequirement
      ? {
          id: selectedRequirement.id,
          description: selectedRequirement.description,
          suggestedTags: [...selectedRequirement.suggestedTags],
          emotion: selectedRequirement.emotion,
          mediaType: selectedRequirement.mediaType,
          sceneRole: selectedRequirement.sceneRole
        }
      : null,
    templateId: effectiveTemplateId || null,
    promptPackId: selectedPromptPackId
      ? selectedPromptPackId
      : (selectedWorkflowPack?.recommendedPromptPackId as VisualPromptPackId | undefined) ??
        null,
    negativePackId: selectedNegativePromptPackId
      ? selectedNegativePromptPackId
      : (selectedWorkflowPack?.recommendedNegativePromptPackId as NegativePromptPackId | undefined) ??
        null,
    variantType: selectedVariantType || null,
    supportTags: uniqueStrings([
      ...(effectiveSceneAsset?.tags ?? []),
      ...(selectedRequirement?.suggestedTags ?? []),
      ...(effectiveCharacter?.tags ?? [])
    ])
  });

  useEffect(() => {
    if (selectedProject && selectedSceneId) {
      const stillExists = selectedProject.scenes.some(
        (scene) => scene.id === selectedSceneId
      );

      if (!stillExists) {
        setSelectedSceneId(selectedProject.scenes[0]?.id ?? "");
      }
    }
  }, [selectedProject, selectedSceneId]);

  useEffect(() => {
    setNarrationPreviewText(
      selectedScene?.narrationText ??
        selectedScene?.captionText ??
        selectedProject?.script ??
        ""
    );
  }, [selectedProject?.script, selectedScene]);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(preview.prompt);
      setStatusMessage("Prompt premium copiado para a area de transferencia.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Nao foi possivel copiar o prompt nesta sessao."
      );
    }
  }

  async function handleApplyScenePrompt() {
    if (!selectedScene) {
      setStatusMessage("Selecione uma cena para aplicar o prompt premium.");
      return;
    }

    try {
      const result = await buildSceneVisualPromptRequest(selectedScene.id, {
        characterProfileId: effectiveCharacter?.id ?? null,
        promptPackId: preview.promptPack.id,
        negativePackId: preview.negativePromptPack.id,
        variantType: selectedVariantType || null
      });
      setStatusMessage(
        `Prompt premium aplicado na cena ${result.scene.order}. ${result.scene.title}.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha ao aplicar o prompt premium na cena."
      );
    }
  }

  async function handleApplyRequirementPrompt() {
    if (!selectedRequirement) {
      setStatusMessage(
        "Selecione um requirement de research para aplicar o prompt premium."
      );
      return;
    }

    try {
      const result = await buildResearchRequirementVisualPromptRequest(
        selectedRequirement.id,
        {
          characterProfileId: effectiveCharacter?.id ?? null,
          promptPackId: preview.promptPack.id,
          negativePackId: preview.negativePromptPack.id,
          variantType: selectedVariantType || null
        }
      );
      setStatusMessage(
        `Prompt premium aplicado no requirement ${result.requirement.description}.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha ao aplicar o prompt premium no requirement."
      );
    }
  }

  async function handleGenerateSceneVisual(provider: VisualGenerationProvider) {
    if (!selectedScene) {
      setStatusMessage("Selecione uma cena antes de gerar um visual.");
      return;
    }

    try {
      const result = await generateSceneVisualRequest(selectedScene.id, {
        provider,
        visualSourceMode:
          selectedScene.visualSourceMode ?? "generated_only",
        characterProfileId: effectiveCharacter?.id ?? null,
        workflowPackId: selectedWorkflowPack?.id ?? null,
        qualityPresetId: selectedQualityPreset?.id ?? "standard",
        workflowId: selectedWorkflowId || selectedWorkflowPack?.recommendedWorkflowId || "txt2img-basic",
        seedMode: selectedSeedMode as "random" | "fixed" | "reuse" | "increment",
        steps: selectedQualityPreset?.steps ?? null,
        cfg: selectedQualityPreset?.cfg ?? null,
        sampler: selectedQualityPreset?.sampler ?? null,
        scheduler: selectedQualityPreset?.scheduler ?? null,
        denoise: selectedQualityPreset?.denoise ?? null,
        width: selectedQualityPreset?.width ?? selectedWorkflowPack?.defaultWidth ?? 1080,
        height: selectedQualityPreset?.height ?? selectedWorkflowPack?.defaultHeight ?? 1920,
        seed: null,
        autoAttach: true
      });
      setStatusMessage(
        `Cena recebeu visual via ${provider}. Asset ${result.asset?.filename ?? "sem arquivo"} pronto. Revise em /generated-images.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : `Falha ao gerar visual da cena com ${provider}.`
      );
    }
  }

  async function handleGenerateNarrationPreview() {
    if (!selectedScene) {
      setStatusMessage("Selecione uma cena antes de gerar narracao.");
      return;
    }

    try {
      const result = await generateSceneNarrationRequest(selectedScene.id, {
        provider: selectedNarrationProviderId,
        voicePackId: selectedNarrationVoicePackId || null,
        text: narrationPreviewText.trim() || null,
        language: selectedProject?.channel.language ?? "pt-BR",
        autoAttach: true
      });

      setLastGeneratedNarration({
        job: result.job,
        asset: result.asset,
        scene: result.scene
          ? {
              id: result.scene.id,
              order: result.scene.order,
              title: result.scene.title,
              videoProjectId: selectedProject?.id ?? "",
              narrationText: result.scene.narrationText,
              duration: result.scene.duration,
              generatedNarrationAssetId: result.scene.generatedNarrationAssetId ?? null,
              narrationStatus: result.scene.narrationStatus ?? null,
              narrationProvider: result.scene.narrationProvider ?? null,
              narrationVoicePackId: result.scene.narrationVoicePackId ?? null
            }
          : null,
        project: selectedProject
          ? {
              id: selectedProject.id,
              title: selectedProject.title,
              status: selectedProject.status,
              channelId: selectedProject.channelId,
              channelName: selectedProject.channel.name,
              format: selectedProject.format
            }
          : null,
        metadata: result.job.metadata ?? null,
        previewUrl: result.asset?.id
          ? `/media/assets/${encodeURIComponent(result.asset.id)}`
          : null,
        isCurrentSceneNarration: true,
        isSceneEffectiveNarration: true
      });

      setStatusMessage(
        `Narracao local gerada com ${result.job.provider}. Asset ${result.asset?.filename ?? "sem arquivo"} pronto. Revise em /generated-audio.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha ao gerar narracao local."
      );
    }
  }

  async function handleGenerateRequirementVisual(
    provider: VisualGenerationProvider
  ) {
    if (!selectedRequirement) {
      setStatusMessage("Selecione um requirement antes de gerar um visual.");
      return;
    }

    try {
      const result = await generateRequirementVisualRequest(selectedRequirement.id, {
        provider,
        visualSourceMode:
          selectedRequirement.visualSourceMode ?? "generated_only",
        characterProfileId: effectiveCharacter?.id ?? null,
        workflowPackId: selectedWorkflowPack?.id ?? null,
        qualityPresetId: selectedQualityPreset?.id ?? "standard",
        workflowId: selectedWorkflowId || selectedWorkflowPack?.recommendedWorkflowId || "txt2img-basic",
        seedMode: selectedSeedMode as "random" | "fixed" | "reuse" | "increment",
        steps: selectedQualityPreset?.steps ?? null,
        cfg: selectedQualityPreset?.cfg ?? null,
        sampler: selectedQualityPreset?.sampler ?? null,
        scheduler: selectedQualityPreset?.scheduler ?? null,
        denoise: selectedQualityPreset?.denoise ?? null,
        width: selectedQualityPreset?.width ?? selectedWorkflowPack?.defaultWidth ?? 1080,
        height: selectedQualityPreset?.height ?? selectedWorkflowPack?.defaultHeight ?? 1920,
        seed: null,
        autoAttach: true
      });
      setStatusMessage(
        `Requirement recebeu visual via ${provider}. Asset ${result.asset?.filename ?? "sem arquivo"} pronto. Revise em /generated-images.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : `Falha ao gerar visual do requirement com ${provider}.`
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Prompt Lab
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              Prompt packs, variantes e contexto narrativo
            </h2>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-mist/70">
              Misture cena, canal, personagem, template e requirements de research
              para construir prompts premium antes de disparar mock visuals ou
              encaminhar o fluxo para o ComfyUI local.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.3rem] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Projetos
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(projectsSource)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Research
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(researchRequirementsSource)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Providers
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(visualGenerationProvidersSource)}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-5 rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
          {statusMessage}
        </p>
      </section>

      <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Generated Feed
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Ultimas geracoes saem daqui direto para a galeria
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-mist/68">
              Depois de gerar um visual, revise variacoes, favorite a melhor e
              promova a imagem escolhida em{" "}
              <Link href="/generated-images" className="text-signal underline-offset-4 hover:underline">
                /generated-images
              </Link>.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs text-mist/65">
            feed {formatSourceLabel(recentGeneratedImagesSource)}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {recentGeneratedImages.slice(0, 3).map((item) => (
            <Link
              key={item.job.id}
              href={item.project?.id ? `/projects/${item.project.id}` : "/generated-images"}
              className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4 transition hover:border-white/20"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-mist/45">
                {item.job.provider}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-white">
                {item.scene?.title ?? item.project?.title ?? item.job.id}
              </h3>
              <p className="mt-2 text-sm leading-7 text-mist/68">
                pack {String(item.metadata?.workflowPackId ?? "n/a")} / quality{" "}
                {String(item.metadata?.qualityPresetId ?? "n/a")}
              </p>
              <p className="mt-3 text-xs text-mist/45">
                generatedAssetId {item.job.generatedAssetId ?? "pendente"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="space-y-6 rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
              Contexto
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              Escolha a origem criativa
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Projeto</span>
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem projeto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Cena</span>
              <select
                value={selectedSceneId}
                onChange={(event) => setSelectedSceneId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem cena</option>
                {(selectedProject?.scenes ?? []).map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.order}. {scene.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Requirement de research
              </span>
              <select
                value={selectedRequirementId}
                onChange={(event) => setSelectedRequirementId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem requirement</option>
                {researchRequirements.map((entry) => (
                  <option key={entry.requirement.id} value={entry.requirement.id}>
                    {entry.dossierTitle} - {entry.requirement.description}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Personagem</span>
              <select
                value={selectedCharacterId}
                onChange={(event) => setSelectedCharacterId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Auto / sem personagem</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name} - {character.slug}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Canal</span>
              <select
                value={selectedChannelId}
                onChange={(event) => setSelectedChannelId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Auto / sem override</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Template</span>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Auto / sem override</option>
                {templates
                  .filter((template) =>
                    templateIds.includes(template.id)
                  )
                  .map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Prompt pack</span>
              <select
                value={selectedPromptPackId}
                onChange={(event) =>
                  setSelectedPromptPackId(
                    event.target.value as VisualPromptPackId | ""
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Auto ({preview.promptPack.name})</option>
                {promptPacks.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Negative pack
              </span>
              <select
                value={selectedNegativePromptPackId}
                onChange={(event) =>
                  setSelectedNegativePromptPackId(
                    event.target.value as NegativePromptPackId | ""
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">
                  Auto ({preview.negativePromptPack.name})
                </option>
                {negativePromptPacks.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Variante</span>
              <select
                value={selectedVariantType}
                onChange={(event) =>
                  setSelectedVariantType(event.target.value as PromptVariantType | "")
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Default</option>
                {promptVariantTypes.map((variant) => (
                  <option key={variant} value={variant}>
                    {formatTagLabel(variant)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Workflow pack
              </span>
              <select
                value={selectedWorkflowPackId}
                onChange={(event) => {
                  const pack = workflowPacks.find(
                    (entry) => entry.id === event.target.value
                  );
                  setSelectedWorkflowPackId(event.target.value);
                  if (pack) {
                    setSelectedWorkflowId(pack.recommendedWorkflowId);
                    setSelectedQualityPresetId(pack.defaultQualityPreset);
                    setSelectedSeedMode(pack.defaultSeedStrategy);
                  }
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {workflowPacks.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Quality</span>
              <select
                value={selectedQualityPresetId}
                onChange={(event) => setSelectedQualityPresetId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {qualityPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Editing preset
                </span>
                <select
                  value={selectedEditingReferencePresetId}
                  onChange={(event) =>
                    setSelectedEditingReferencePresetId(event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="">Sem preset editorial</option>
                  {editingReferencePresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Workflow</span>
                <input
                value={selectedWorkflowId}
                onChange={(event) => setSelectedWorkflowId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Seed mode</span>
              <select
                value={selectedSeedMode}
                onChange={(event) => setSelectedSeedMode(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {["random", "fixed", "reuse", "increment"].map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-mist/65">
              Microclip editorial sugerido
            </span>
            <input
              value={editorialMicroclipSuggestion}
              onChange={(event) =>
                setEditorialMicroclipSuggestion(event.target.value)
              }
              placeholder="ex.: chute forte, arrancada, comemoracao, close da evidencia"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
            />
          </label>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                  Channel / template
              </p>
              <p className="mt-2 text-sm text-white">
                {effectiveChannel?.name ?? "sem canal"}
              </p>
              <p className="mt-2 text-xs text-mist/60">
                template {effectiveTemplateId || "auto"} | canais{" "}
                {formatSourceLabel(channelsSource)} | characters{" "}
                {formatSourceLabel(charactersSource)}
              </p>
            </div>
            <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                Pack escolhido
              </p>
              <p className="mt-2 text-sm text-white">{preview.promptPack.name}</p>
              <p className="mt-2 text-xs text-mist/60">
                workflow {preview.promptPack.recommendedWorkflow} | provider{" "}
                {preview.promptPack.recommendedProvider}
              </p>
                <p className="mt-2 text-xs text-mist/60">
                  workflow pack {selectedWorkflowPack?.id ?? "auto"} / quality{" "}
                  {selectedQualityPreset?.id ?? "standard"}
                </p>
              </div>
              <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                  Preset editorial
                </p>
                <p className="mt-2 text-sm text-white">
                  {selectedEditingReferencePreset?.name ?? "Sem preset editorial"}
                </p>
                <p className="mt-2 text-xs text-mist/60">
                  {selectedEditingReferencePreset
                    ? `pace ${selectedEditingReferencePreset.pacing} / transicao ${selectedEditingReferencePreset.transitionStyle} / hook ${selectedEditingReferencePreset.hookStyle}`
                    : "Escolha um preset para alinhar ritmo, hook, caption e microclip."}
                </p>
                <p className="mt-2 text-xs text-mist/60">
                  source {formatSourceLabel(editingReferencePresetsSource)} / music{" "}
                  {selectedEditingReferencePreset?.recommendedMusicPresetId ?? "auto"}
                </p>
              </div>
              <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                  Planejamento editorial
              </p>
              <p className="mt-2 text-sm text-white">
                {editorialMicroclipSuggestion.trim() || "Sem sugestao de microclip"}
              </p>
              <p className="mt-2 text-xs text-mist/60">
                Campo apenas organizacional para lembrar inserts curtos locais no
                projeto editorial.
              </p>
            </div>
              <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                  Requirement extra
              </p>
              <p className="mt-2 text-sm text-white">
                {selectedRequirement?.description ?? "sem requirement"}
              </p>
              <p className="mt-2 text-xs text-mist/60">
                prompt packs {formatSourceLabel(promptPacksSource)} | negative packs{" "}
                {formatSourceLabel(negativePromptPacksSource)}
              </p>
                <p className="mt-2 text-xs text-mist/60">
                  workflow packs {formatSourceLabel(workflowPacksSource)} | quality{" "}
                  {formatSourceLabel(qualityPresetsSource)}
                </p>
              </div>
              <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                  Influencia editorial
                </p>
                <p className="mt-2 text-sm text-white">
                  {selectedEditingReferencePreset
                    ? `${selectedEditingReferencePreset.captionStyle} / ${selectedEditingReferencePreset.narrationStyle} / ${selectedEditingReferencePreset.musicStyle}`
                    : "Use o preset para direcionar caption, narracao e musica."}
                </p>
                <p className="mt-2 text-xs text-mist/60">
                  microclip{" "}
                  {selectedEditingReferencePreset?.microclipPlacement ?? "auto"} / CTA{" "}
                  {selectedEditingReferencePreset?.ctaStyle ?? "auto"} / notes{" "}
                  {selectedEditingReferencePreset?.notes ?? "n/d"}
                </p>
              </div>
            </div>
          </article>

        <article className="space-y-6 rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Preview premium
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Prompt final, variantes e score
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/72">
                pack {preview.promptPack.id}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/72">
                negative {preview.negativePromptPack.id}
              </span>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                score {preview.qualityAnalysis.overallScore}
              </span>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[1.1rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                Prompt final
              </p>
              <p className="mt-3 text-sm leading-7 text-mist/68">{preview.prompt}</p>
            </div>
            <div className="rounded-[1.1rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                Negative prompt
              </p>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                {preview.negativePrompt}
              </p>
            </div>
          </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                Prompt plan
              </p>
              <p className="mt-2 text-sm text-white">{preview.promptPlanSummary}</p>
            </div>
            <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                Faltas detectadas
              </p>
              <p className="mt-2 text-sm text-white">
                {preview.qualityAnalysis.missingElements.length > 0
                  ? preview.qualityAnalysis.missingElements.join(", ")
                  : "Nenhuma falta critica"}
              </p>
            </div>
              <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                  Sugestao principal
              </p>
              <p className="mt-2 text-sm text-white">
                {preview.qualityAnalysis.suggestions[0] ??
                  "Prompt equilibrado para gerar visual premium."}
                </p>
              </div>
            </div>

            {selectedEditingReferencePreset ? (
              <div className="rounded-[1.35rem] border border-[#f4c67a]/20 bg-[#f4c67a]/8 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                      Editing Reference Influence
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      {selectedEditingReferencePreset.name}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-mist/68">
                      {selectedEditingReferencePreset.description}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#f4c67a]/25 bg-[#f4c67a]/10 px-3 py-1 text-xs text-[#ffefc8]">
                    {selectedEditingReferencePreset.useCase}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                      Corte e energia
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {selectedEditingReferencePreset.pacing} / pace{" "}
                      {selectedEditingReferencePreset.cutPace
                        ? `${selectedEditingReferencePreset.cutPace.toFixed(1)}s`
                        : "n/d"}
                    </p>
                    <p className="mt-2 text-xs text-mist/60">
                      zoom {selectedEditingReferencePreset.zoomStyle} / flash{" "}
                      {selectedEditingReferencePreset.flashStyle}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                      Narrativa
                    </p>
                    <p className="mt-2 text-sm text-white">
                      hook {selectedEditingReferencePreset.hookStyle} / CTA{" "}
                      {selectedEditingReferencePreset.ctaStyle}
                    </p>
                    <p className="mt-2 text-xs text-mist/60">
                      narracao {selectedEditingReferencePreset.narrationStyle} / caption{" "}
                      {selectedEditingReferencePreset.captionStyle}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-mist/45">
                      Audio e inserts
                    </p>
                    <p className="mt-2 text-sm text-white">
                      musica {selectedEditingReferencePreset.musicStyle} / SFX{" "}
                      {selectedEditingReferencePreset.sfxStyle}
                    </p>
                    <p className="mt-2 text-xs text-mist/60">
                      microclip {selectedEditingReferencePreset.microclipPlacement} / voice{" "}
                      {selectedEditingReferencePreset.recommendedNarrationVoicePackId ?? "auto"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.35rem] border border-[#7be0ff]/20 bg-[#7be0ff]/8 p-4">
              <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleCopyPrompt();
                }}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-mist/80"
              >
                Copiar prompt
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleApplyScenePrompt();
                }}
                disabled={!selectedScene}
                className="rounded-full border border-signal/25 bg-signal/10 px-4 py-2 text-xs text-signal disabled:cursor-not-allowed disabled:opacity-45"
              >
                Aplicar a cena
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleApplyRequirementPrompt();
                }}
                disabled={!selectedRequirement}
                className="rounded-full border border-[#63ffe1]/25 bg-[#63ffe1]/10 px-4 py-2 text-xs text-[#c8fff3] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Aplicar ao requirement
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleGenerateSceneVisual("mock-svg");
                }}
                disabled={!selectedScene}
                className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-4 py-2 text-xs text-[#d8f8ff] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Gerar visual mock na cena
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleGenerateRequirementVisual("mock-svg");
                }}
                disabled={!selectedRequirement}
                className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-4 py-2 text-xs text-[#d8f8ff] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Gerar visual mock no requirement
              </button>
              {comfyProvider ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void handleGenerateSceneVisual("comfyui-local");
                    }}
                    disabled={!selectedScene || !comfyProvider.available}
                    className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-4 py-2 text-xs text-[#e2e8ff] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Gerar com ComfyUI na cena
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleGenerateRequirementVisual("comfyui-local");
                    }}
                    disabled={!selectedRequirement || !comfyProvider.available}
                    className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-4 py-2 text-xs text-[#e2e8ff] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Gerar com ComfyUI no requirement
                  </button>
                </>
              ) : null}
            </div>

            <p className="mt-4 text-xs leading-6 text-mist/60">
              ComfyUI {comfyProvider?.available ? "disponivel" : "opcional/offline"}.
              O mock provider continua sendo o baseline deterministico para preview
              e smoke 100% local.
            </p>
          </div>

          <div className="rounded-[1.35rem] border border-[#7be0ff]/20 bg-[#7be0ff]/8 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                  Music Preset Suggestion
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {suggestedMusicPreset.name}
                </h3>
                <p className="mt-2 text-sm leading-7 text-mist/68">
                  Template/tom sugerem o preset {suggestedMusicPreset.id} para o
                  proximo render.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/72">
                bpm{" "}
                {suggestedMusicPreset.bpmRange
                  ? `${suggestedMusicPreset.bpmRange.min}-${suggestedMusicPreset.bpmRange.max}`
                  : "livre"}
              </span>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm text-mist/65">Music mood hint</span>
              <input
                value={musicMoodHint}
                onChange={(event) => setMusicMoodHint(event.target.value)}
                placeholder="hype, dark, documentary, suspense..."
                className="w-full rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
          </div>

          <div className="rounded-[1.35rem] border border-[#7be0ff]/20 bg-[#7be0ff]/8 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                  Narration Preview
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Mock TTS e provider local opcional
                </h3>
                <p className="mt-2 text-sm leading-7 text-mist/68">
                  Gere uma narracao local para a cena atual e revise em{" "}
                  <Link href="/generated-audio" className="text-signal underline-offset-4 hover:underline">
                    /generated-audio
                  </Link>.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mist/72">
                providers {formatSourceLabel(narrationProvidersSource)} / packs{" "}
                {formatSourceLabel(narrationVoicePacksSource)}
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Provider</span>
                <select
                  value={selectedNarrationProviderId}
                  onChange={(event) =>
                    setSelectedNarrationProviderId(
                      event.target.value as NarrationProviderDescriptor["id"]
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {narrationProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} - {provider.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Voice pack</span>
                <select
                  value={selectedNarrationVoicePackId}
                  onChange={(event) => setSelectedNarrationVoicePackId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {narrationVoicePacks.map((voicePack) => (
                    <option key={voicePack.id} value={voicePack.id}>
                      {voicePack.name} - {voicePack.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm text-mist/65">Texto de narração</span>
              <textarea
                rows={4}
                value={narrationPreviewText}
                onChange={(event) => setNarrationPreviewText(event.target.value)}
                placeholder="Cole o texto ou use a cena selecionada."
                className="w-full rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleGenerateNarrationPreview();
                }}
                disabled={!selectedScene}
                className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-4 py-2 text-xs text-[#d8f8ff] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Gerar narração local
              </button>
            </div>

            {lastGeneratedNarration?.asset ? (
              <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-white/10">
                <div className="bg-black/20 p-4">
                  <p className="text-sm font-medium text-white">
                    Ultima narracao - {lastGeneratedNarration.job.provider}
                  </p>
                  <p className="mt-2 text-xs text-mist/60">
                    {lastGeneratedNarration.job.voicePackId ?? "n/a"} /{" "}
                    {lastGeneratedNarration.job.status} / feed{" "}
                    {formatSourceLabel(recentGeneratedAudioSource)}
                  </p>
                </div>
                <div className="border-t border-white/10">
                  {/* Asset preview already supports audio controls. */}
                  <div className="p-4">
                    <Link
                      href="/generated-audio"
                      className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-mist/75"
                    >
                      Abrir galeria de narrações
                    </Link>
                    <div className="overflow-hidden rounded-[1rem] border border-white/10">
                      <AssetMediaPreview
                        asset={lastGeneratedNarration.asset}
                        source="api"
                      />
                    </div>
                    <div className="mt-4">
                      <p className="text-xs text-mist/60">
                        jobs recentes {recentGeneratedAudio.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Variantes
              </p>
              <p className="text-xs text-mist/60">
                {preview.variants.length} variacoes deterministicas
              </p>
            </div>
            {preview.variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => setSelectedVariantType(variant.type)}
                className={`w-full rounded-[1.2rem] border p-4 text-left transition ${
                  selectedVariantType === variant.type
                    ? "border-signal/35 bg-signal/8"
                    : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{variant.title}</p>
                    <p className="mt-2 text-xs text-mist/55">{variant.type}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-mist/65">
                    score {variant.score}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-mist/68">
                  {variant.recommendedUse}
                </p>
              </button>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

