import {
  buildDiscoveryTitle,
  buildDiscoveryWarnings,
  buildCandidateProviderPlan,
  buildNicheDossier,
  buildNicheResearchQueries,
  buildVisualRequirementsFromDossier,
  getDiscoveryMediaProviders,
  getDiscoverySourcePacks,
  getNicheProfileById,
  getNicheProfiles
} from "../../../../../../packages/production-discovery-engine/src/index.js";
import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { ChannelRepository } from "../../channels/application/channel-repository.js";
import type { IntakeRepository } from "../../intake/application/intake-repository.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type { ResearchRepository } from "../../research/application/research-repository.js";
import type { ProductionDiscoveryRepository } from "./production-discovery-repository.js";
import type { ProductionDiscoveryPackage } from "../domain/production-discovery.js";

export interface ProductionDiscoveryDependencies {
  assetRepository: AssetRepository;
  channelRepository: ChannelRepository;
  intakeRepository: IntakeRepository;
  projectRepository: ProjectRepository;
  productionDiscoveryRepository: ProductionDiscoveryRepository;
  researchRepository: ResearchRepository;
}

export interface CreateProductionDiscoveryInput {
  topic: string;
  niche: string;
  angle: string | null;
  language: string;
  tone: string | null;
  targetDurationSeconds: number;
}

function requirementMediaType(value: unknown) {
  switch (value) {
    case "video":
    case "microclip":
      return "video" as const;
    case "document":
      return "document" as const;
    case "sfx":
      return "reference" as const;
    default:
      return "image" as const;
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function requirePackage(
  repository: ProductionDiscoveryRepository,
  id: string
) {
  const item = await repository.getById(id);
  if (!item) {
    throw new NotFoundError(`Production discovery package '${id}' was not found.`);
  }

  return item;
}

async function ensureDiscoveryChannel(
  channelRepository: ChannelRepository,
  pkg: ProductionDiscoveryPackage
) {
  const channels = await channelRepository.list();
  const existing =
    channels.find((channel) => channel.niche.toLowerCase() === pkg.niche.toLowerCase()) ??
    channels.find((channel) => channel.name.toLowerCase().includes("discovery")) ??
    channels[0];

  if (existing) {
    return existing;
  }

  return channelRepository.create({
    name: "Production Discovery",
    niche: pkg.niche,
    language: pkg.language,
    visualStyle: "editorial cinematic",
    narrativeTone: pkg.tone ?? "informative",
    defaultTemplate: null,
    defaultRenderMode: "cinematic_v2",
    defaultRenderQuality: "standard",
    defaultAudioMood: null,
    defaultCaptionStyle: null,
    defaultVisualPreset: null,
    defaultMusicAssetId: null,
    defaultVoiceoverAssetId: null,
    defaultDurationTarget: pkg.targetDurationSeconds,
    defaultSceneDuration: 5,
    preferredAssetCategories: ["REFERENCE"],
    preferredAssetTags: [pkg.niche, "production-discovery"]
  });
}

function buildRequirementCandidateSummary(
  collectionId: string,
  requirement: Record<string, unknown>,
  candidateIds: string[]
) {
  return {
    collectionId,
    requirementId: requirement.id,
    sceneOrder: requirement.sceneOrder,
    mediaType: requirement.mediaType,
    candidateIds,
    requiresUserReview: true,
    status: "pending_review"
  };
}

function toCopyrightRisk(value: string | null | undefined) {
  switch (value) {
    case "low":
      return "LOW" as const;
    case "medium":
    case "editorial_only":
      return "MEDIUM" as const;
    case "high":
    case "restricted":
      return "HIGH" as const;
    case "unknown":
    default:
      return "UNKNOWN" as const;
  }
}

export function listProductionDiscoveryNiches() {
  return getNicheProfiles();
}

export function listProductionDiscoveryProviders() {
  return getDiscoveryMediaProviders();
}

export function listProductionDiscoverySourcePacks() {
  return getDiscoverySourcePacks();
}

export async function createProductionDiscoveryPackage(
  dependencies: ProductionDiscoveryDependencies,
  input: CreateProductionDiscoveryInput
) {
  const profile = getNicheProfileById(input.niche);
  const title = buildDiscoveryTitle(input.topic, profile);
  const warnings = buildDiscoveryWarnings(profile);

  return dependencies.productionDiscoveryRepository.create({
    topic: input.topic,
    niche: profile.id,
    title,
    angle: input.angle,
    language: input.language,
    tone: input.tone ?? profile.defaultTone,
    targetDurationSeconds: input.targetDurationSeconds,
    status: "draft",
    researchDossierId: null,
    mediaCollectionIds: [],
    suggestedTemplateId: profile.defaultTemplates[0] ?? null,
    suggestedEditingReferencePresetId: profile.recommendedEditingPresetUseCase,
    suggestedMusicPresetId: profile.recommendedMusicPresetId,
    suggestedAudioMasteringPresetId: profile.recommendedAudioMasteringPresetId,
    suggestedWorkflowPackId: profile.recommendedWorkflowPackId,
    summary: `Pacote candidate-first para ${input.topic}.`,
    outline: [],
    assetRequirements: [],
    mediaCandidatesSummary: [],
    warnings,
    createdProjectId: null
  });
}

export async function runProductionDiscoveryResearch(
  dependencies: ProductionDiscoveryDependencies,
  packageId: string
) {
  const pkg = await requirePackage(dependencies.productionDiscoveryRepository, packageId);
  const profile = getNicheProfileById(pkg.niche);
  const dossier = buildNicheDossier({
    topic: pkg.topic,
    niche: pkg.niche,
    angle: pkg.angle,
    language: pkg.language
  });
  const queries = buildNicheResearchQueries({
    topic: pkg.topic,
    niche: pkg.niche,
    angle: pkg.angle,
    language: pkg.language
  });

  const channel = await ensureDiscoveryChannel(dependencies.channelRepository, pkg);
  const researchDossier = await dependencies.researchRepository.createDossier({
    channelId: channel.id,
    title: dossier.title,
    topic: pkg.topic,
    niche: profile.id,
    tone: pkg.tone ?? profile.defaultTone,
    targetDuration: pkg.targetDurationSeconds,
    status: "researching",
    summary: dossier.summary,
    narrativeAngle: pkg.angle,
    editorialNotes: `Research queries: ${queries.researchQueries.join(" | ")}`,
    safetyNotes: dossier.editorialSafety.join(" | ")
  });

  await dependencies.researchRepository.replaceAnalysis(researchDossier.id, {
    dossierPatch: {
      status: "ready_for_review",
      summary: dossier.summary,
      narrativeAngle: pkg.angle,
      editorialNotes: `Research queries: ${queries.researchQueries.join(" | ")}`,
      safetyNotes: dossier.editorialSafety.join(" | ")
    },
    facts: dossier.facts.map((fact) => ({
      sourceId: null,
      claim: fact.claim,
      factType: "context",
      confidence: fact.confidence === "confirmed" ? "confirmed" : "uncertain",
      dateValue: null,
      people: [],
      places: [],
      tags: [profile.id],
      notes: "Gerado deterministicamente pelo Production Discovery."
    })),
    timelineEvents: dossier.timeline.map((event) => ({
      sourceId: null,
      title: event.title,
      description: event.description,
      dateValue: null,
      order: event.order,
      location: null,
      people: [],
      confidence: "uncertain"
    })),
    hooks: [
      {
        text: dossier.outline[0]?.narrationDraft ?? `Por que ${pkg.topic} importa agora?`,
        hookType: "question",
        strengthScore: 82,
        notes: "Hook deterministicamente sugerido."
      }
    ],
    assetRequirements: [],
    outlineScenes: dossier.outline.map((scene) => ({
      order: scene.order,
      role:
        scene.role === "cta"
          ? "cta"
          : scene.role === "climax"
            ? "climax"
            : scene.role === "resolution"
              ? "resolution"
              : scene.order === 1
                ? "hook"
                : "context",
      title: scene.title,
      narrationDraft: scene.narrationDraft,
      captionDraft: scene.captionDraft,
      emotion: scene.emotion as never,
      visualPreset: profile.id === "football" ? "action" : "mystery",
      assetRequirementRef: null,
      estimatedDuration: scene.estimatedDuration
    }))
  });

  return dependencies.productionDiscoveryRepository.update(packageId, {
    status: "researching",
    researchDossierId: researchDossier.id,
    summary: dossier.summary,
    outline: dossier.outline as unknown as Record<string, unknown>[],
    warnings: [...pkg.warnings, ...dossier.editorialSafety]
  });
}

export async function buildProductionDiscoveryAssetRequirements(
  dependencies: ProductionDiscoveryDependencies,
  packageId: string
) {
  const pkg = await requirePackage(dependencies.productionDiscoveryRepository, packageId);
  const profile = getNicheProfileById(pkg.niche);
  const dossier = buildNicheDossier({
    topic: pkg.topic,
    niche: pkg.niche,
    angle: pkg.angle,
    language: pkg.language
  });
  const requirements = buildVisualRequirementsFromDossier(dossier, profile);

  return dependencies.productionDiscoveryRepository.update(packageId, {
    assetRequirements: requirements as unknown as Record<string, unknown>[],
    status: "researching",
    warnings: [
      ...pkg.warnings,
      "Visual requirements criados. Midias externas continuam pendentes de revisao."
    ]
  });
}

export async function searchProductionDiscoveryMediaCandidates(
  dependencies: ProductionDiscoveryDependencies,
  packageId: string
) {
  const pkg = await requirePackage(dependencies.productionDiscoveryRepository, packageId);
  const requirements = pkg.assetRequirements.length > 0
    ? pkg.assetRequirements
    : (await buildProductionDiscoveryAssetRequirements(dependencies, packageId))?.assetRequirements ?? [];

  const collections: string[] = [...pkg.mediaCollectionIds];
  const summaries: Record<string, unknown>[] = [];

  for (const requirement of requirements) {
    const mediaType = requirementMediaType(requirement.mediaType);
    const suggestedQueries = stringArray(requirement.suggestedQueries);
    const query = suggestedQueries[0] ?? `${pkg.topic} ${String(requirement.mediaType ?? "media")}`;
    const collection = await dependencies.intakeRepository.createCollection({
      name: `Discovery ${pkg.niche}: ${String(requirement.visualNeedDescription ?? pkg.topic)}`.slice(0, 120),
      channelId: null,
      projectId: null,
      dossierId: pkg.researchDossierId,
      assetRequirementId: null,
      provider: "production-discovery",
      query,
      sourcePath: null,
      mediaType,
      status: "ready_for_review",
      targetCount: 1,
      importedCount: 0,
      rejectedCount: 0,
      notes: "Candidate-first: revisar antes de importar."
    });

    const localAssets = await dependencies.assetRepository.list({
      type: mediaType === "video" ? "VIDEO" : mediaType === "document" ? "DOCUMENT" : "IMAGE"
    });
    const localAsset = localAssets.find((asset) =>
      stringArray(requirement.suggestedTags).some((tag) =>
        asset.tags.some((assetTag) => assetTag.toLowerCase().includes(tag.toLowerCase()))
      )
    );

    const providerPlan = buildCandidateProviderPlan({
      niche: pkg.niche,
      requirement: {
        mediaType: String(requirement.mediaType ?? mediaType) as never,
        importance: String(requirement.importance ?? "medium") as never
      },
      limit: 3
    });
    const candidates = [];

    for (const plan of providerPlan) {
      const isLocalCandidate = plan.providerId === "local-library" && localAsset;
      const candidate = await dependencies.intakeRepository.createCandidate({
        collectionId: collection.id,
        provider: plan.providerId,
        originalPath: isLocalCandidate ? localAsset.path : null,
        title: isLocalCandidate
          ? `Local candidate: ${localAsset.originalName}`
          : `${plan.providerName}: ${String(requirement.visualNeedDescription ?? pkg.topic)}`,
        previewUrl: isLocalCandidate
          ? `/media/assets/${localAsset.id}`
          : plan.previewUrl,
        downloadUrl: null,
        sourceUrl: plan.sourceUrl,
        sourceAuthor: isLocalCandidate ? localAsset.sourceAuthor ?? null : plan.providerName,
        sourceLicense: isLocalCandidate
          ? localAsset.sourceLicense ?? "unknown"
          : plan.defaultLicenseStatus,
        sourceLicenseUrl: isLocalCandidate ? localAsset.sourceLicenseUrl ?? null : null,
        mediaType,
        detectedType: String(requirement.mediaType ?? mediaType),
        suggestedCategory: mediaType === "video" ? "BROLL" : "REFERENCE",
        suggestedTags: stringArray(requirement.suggestedTags),
        suggestedCharacter: null,
        suggestedProject: pkg.title,
        width: isLocalCandidate ? localAsset.width ?? null : null,
        height: isLocalCandidate ? localAsset.height ?? null : null,
        duration: isLocalCandidate ? localAsset.duration ?? null : null,
        fileSize: isLocalCandidate ? localAsset.fileSize ?? null : null,
        extension: isLocalCandidate ? localAsset.extension ?? null : null,
        mimeType: isLocalCandidate ? localAsset.mimeType ?? null : null,
        category: mediaType === "video" ? "BROLL" : "REFERENCE",
        franchise: null,
        character: null,
        emotion: null,
        tags: [
          "production-discovery",
          pkg.niche,
          "requires-review",
          `provider:${plan.providerId}`,
          `source-pack:${plan.sourcePackId}`,
          `score:${plan.score}`
        ],
        copyrightRisk: isLocalCandidate
          ? localAsset.copyrightRisk ?? "UNKNOWN"
          : toCopyrightRisk(plan.defaultRiskLevel),
        recommendedUse:
          plan.warning ?? "Revisar licenca, preview, score e motivo antes de importar.",
        usageNotes: JSON.stringify({
          candidateFirst: true,
          noAutoImport: true,
          source: plan.providerId,
          license: plan.defaultLicenseStatus,
          risk: plan.defaultRiskLevel,
          score: plan.score,
          reason: plan.reason,
          requiresApiKey: plan.requiresApiKey,
          discoveryOnly: plan.discoveryOnly,
          importSupported: plan.importSupported,
          warning: plan.warning
        }),
        status: "pending",
        assetId: null,
        errorMessage: null,
        contentHash: null
      });

      candidates.push(candidate);
    }

    collections.push(collection.id);
    summaries.push(
      buildRequirementCandidateSummary(
        collection.id,
        requirement,
        candidates.map((candidate) => candidate.id)
      )
    );
  }

  return dependencies.productionDiscoveryRepository.update(packageId, {
    status: "media_searching",
    mediaCollectionIds: Array.from(new Set(collections)),
    mediaCandidatesSummary: summaries,
    warnings: [
      ...pkg.warnings,
      "Candidatos criados como pending; nenhum asset foi importado automaticamente."
    ]
  });
}

export async function createProjectFromProductionDiscovery(
  dependencies: ProductionDiscoveryDependencies,
  packageId: string
) {
  const pkg = await requirePackage(dependencies.productionDiscoveryRepository, packageId);
  const channel = await ensureDiscoveryChannel(dependencies.channelRepository, pkg);

  if (pkg.outline.length === 0) {
    throw new ValidationError("Run research before creating a project.");
  }

  const project = await dependencies.projectRepository.create({
    title: pkg.title,
    status: "DRAFT",
    channelId: channel.id,
    script: pkg.summary,
    durationTarget: pkg.targetDurationSeconds,
    format: "9:16",
    templateId: pkg.suggestedTemplateId,
    editingReferencePresetId: pkg.suggestedEditingReferencePresetId,
    editingStyleSummary: null,
    defaultCaptionStyle: null,
    backgroundMusicAssetId: null,
    musicPresetId: pkg.suggestedMusicPresetId,
    voiceoverAssetId: null,
    audioMood: null,
    musicVolume: null,
    voiceVolume: null,
    sfxVolume: null,
    enableAudioDucking: null,
    duckingLevel: null
  });

  for (const scene of pkg.outline) {
    const order = Number(scene.order ?? 1);
    await dependencies.projectRepository.createScene(project.id, {
      title: String(scene.title ?? `Cena ${order}`),
      narrationText: String(scene.narrationDraft ?? ""),
      captionText: String(scene.captionDraft ?? ""),
      duration: Number(scene.estimatedDuration ?? 5),
      emotion: String(scene.emotion ?? "MYSTERIOUS") as never,
      assetId: null,
      generatedAssetId: null,
      generatedNarrationAssetId: null,
      characterProfileId: null,
      sfxAssetId: null,
      sfxStartTime: null,
      sfxVolume: null,
      visualPreset: pkg.niche === "football" ? "action" : "mystery",
      visualSourceMode: "fallback_generated",
      visualPrompt: `${pkg.topic}: ${String(scene.title ?? "")}`,
      negativePrompt: null,
      visualRecipe: JSON.stringify({
        source: "production-discovery",
        packageId: pkg.id,
        niche: pkg.niche,
        nextActions: [
          "review_media_candidates",
          "generate_images",
          "generate_narration",
          "attach_microclips",
          "render"
        ]
      }),
      generationStatus: null,
      generationProvider: null,
      generationSeed: null,
      transition: "cut",
      captionStyle: null,
      captionPosition: null,
      captionEmphasisWords: [],
      energyLevel: pkg.niche === "football" ? 88 : 64,
      narrationStatus: null,
      narrationProvider: null,
      narrationVoicePackId: null
    });
  }

  return dependencies.productionDiscoveryRepository.update(packageId, {
    status: "project_created",
    createdProjectId: project.id,
    warnings: [
      ...pkg.warnings,
      "Projeto criado. Candidatos de midia continuam pendentes de revisao."
    ]
  });
}

export async function listProductionDiscoveryPackages(
  repository: ProductionDiscoveryRepository
) {
  return repository.list();
}

export async function getProductionDiscoveryPackage(
  repository: ProductionDiscoveryRepository,
  packageId: string
) {
  return requirePackage(repository, packageId);
}
