import type { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import { parseSerializedTags, type StudioAsset } from "../../assets/domain/asset.js";
import type { StudioChannel } from "../../channels/domain/channel.js";
import type { ResearchRepository } from "../application/research-repository.js";
import type {
  CreateResearchDossierInput,
  CreateResearchSourceInput,
  ResearchAssetRequirement,
  ResearchDossier,
  ResearchDossierDetail,
  ResearchFact,
  ResearchHook,
  ResearchOutlineScene,
  ResearchSource,
  ResearchTimelineEvent,
  ReplaceResearchArtifactsInput,
  UpdateResearchDossierInput,
  UpdateResearchSourceInput
} from "../domain/research.js";

interface PrismaResearchRepositoryOptions {
  prismaClient?: typeof defaultPrisma;
}

type PrismaResearchExecutor = Pick<
  typeof defaultPrisma,
  | "$transaction"
  | "researchDossier"
  | "researchSource"
  | "researchFact"
  | "researchTimelineEvent"
  | "researchHook"
  | "researchAssetRequirement"
  | "researchOutlineScene"
>;

function toIsoString(value: Date) {
  return value.toISOString();
}

function mapChannel(channel: {
  id: string;
  name: string;
  niche: string;
  language: string;
  visualStyle: string | null;
  narrativeTone: string | null;
  defaultTemplate: string | null;
  defaultRenderMode: StudioChannel["defaultRenderMode"];
  defaultRenderQuality: StudioChannel["defaultRenderQuality"];
  defaultAudioMood: string | null;
  defaultCaptionStyle: string | null;
  defaultVisualPreset: string | null;
  defaultMusicAssetId: string | null;
  defaultVoiceoverAssetId: string | null;
  defaultDurationTarget: number | null;
  defaultSceneDuration: number;
  preferredAssetCategories: string;
  preferredAssetTags: string;
  createdAt: Date;
  updatedAt: Date;
}): StudioChannel {
  return {
    id: channel.id,
    name: channel.name,
    niche: channel.niche,
    language: channel.language,
    visualStyle: channel.visualStyle,
    narrativeTone: channel.narrativeTone,
    defaultTemplate: channel.defaultTemplate as StudioChannel["defaultTemplate"],
    defaultRenderMode: channel.defaultRenderMode,
    defaultRenderQuality: channel.defaultRenderQuality,
    defaultAudioMood: channel.defaultAudioMood as StudioChannel["defaultAudioMood"],
    defaultCaptionStyle: channel.defaultCaptionStyle as StudioChannel["defaultCaptionStyle"],
    defaultVisualPreset: channel.defaultVisualPreset as StudioChannel["defaultVisualPreset"],
    defaultMusicAssetId: channel.defaultMusicAssetId,
    defaultVoiceoverAssetId: channel.defaultVoiceoverAssetId,
    defaultDurationTarget: channel.defaultDurationTarget,
    defaultSceneDuration: channel.defaultSceneDuration,
    preferredAssetCategories:
      parseSerializedTags(channel.preferredAssetCategories) as StudioChannel["preferredAssetCategories"],
    preferredAssetTags: parseSerializedTags(channel.preferredAssetTags),
    createdAt: toIsoString(channel.createdAt),
    updatedAt: toIsoString(channel.updatedAt)
  };
}

function mapAsset(asset: {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  type: StudioAsset["type"];
  category: StudioAsset["category"];
  franchise: string | null;
  character: string | null;
  emotion: StudioAsset["emotion"];
  tags: string;
  licenseType: string;
  copyrightRisk: StudioAsset["copyrightRisk"];
  recommendedUse: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  extension: string | null;
  fileSize: number | null;
  sourceProvider: string | null;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  sourceLicense: string | null;
  sourceLicenseUrl: string | null;
  downloadedAt: Date | null;
  collectionId: string | null;
  usageNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): StudioAsset {
  return {
    id: asset.id,
    filename: asset.filename,
    originalName: asset.originalName,
    path: asset.path,
    type: asset.type,
    category: asset.category,
    franchise: asset.franchise,
    character: asset.character,
    emotion: asset.emotion,
    tags: parseSerializedTags(asset.tags),
    licenseType: asset.licenseType,
    copyrightRisk: asset.copyrightRisk,
    recommendedUse: asset.recommendedUse,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
    extension: asset.extension,
    fileSize: asset.fileSize,
    sourceProvider: asset.sourceProvider,
    sourceUrl: asset.sourceUrl,
    sourceAuthor: asset.sourceAuthor,
    sourceLicense: asset.sourceLicense,
    sourceLicenseUrl: asset.sourceLicenseUrl,
    downloadedAt: asset.downloadedAt ? toIsoString(asset.downloadedAt) : null,
    collectionId: asset.collectionId,
    usageNotes: asset.usageNotes,
    createdAt: toIsoString(asset.createdAt),
    updatedAt: toIsoString(asset.updatedAt)
  };
}

function mapSource(source: {
  id: string;
  dossierId: string;
  title: string;
  url: string | null;
  provider: string;
  sourceType: ResearchSource["sourceType"];
  author: string | null;
  publishedAt: string | null;
  accessedAt: string | null;
  reliabilityScore: number | null;
  citationText: string | null;
  rawTextPath: string | null;
  excerpt: string | null;
  notes: string | null;
  status: ResearchSource["status"];
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ResearchSource {
  return {
    id: source.id,
    dossierId: source.dossierId,
    title: source.title,
    url: source.url,
    provider: source.provider,
    sourceType: source.sourceType,
    author: source.author,
    publishedAt: source.publishedAt,
    accessedAt: source.accessedAt,
    reliabilityScore: source.reliabilityScore,
    citationText: source.citationText,
    rawTextPath: source.rawTextPath,
    excerpt: source.excerpt,
    notes: source.notes,
    status: source.status,
    errorMessage: source.errorMessage,
    createdAt: toIsoString(source.createdAt),
    updatedAt: toIsoString(source.updatedAt)
  };
}

function mapFact(fact: {
  id: string;
  dossierId: string;
  sourceId: string | null;
  claim: string;
  factType: ResearchFact["factType"];
  confidence: ResearchFact["confidence"];
  dateValue: string | null;
  people: string | null;
  places: string | null;
  tags: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  source: Parameters<typeof mapSource>[0] | null;
}): ResearchFact {
  return {
    id: fact.id,
    dossierId: fact.dossierId,
    sourceId: fact.sourceId,
    claim: fact.claim,
    factType: fact.factType,
    confidence: fact.confidence,
    dateValue: fact.dateValue,
    people: parseSerializedTags(fact.people ?? "[]"),
    places: parseSerializedTags(fact.places ?? "[]"),
    tags: parseSerializedTags(fact.tags ?? "[]"),
    notes: fact.notes,
    source: fact.source ? mapSource(fact.source) : null,
    createdAt: toIsoString(fact.createdAt),
    updatedAt: toIsoString(fact.updatedAt)
  };
}

function mapTimelineEvent(event: {
  id: string;
  dossierId: string;
  sourceId: string | null;
  title: string;
  description: string;
  dateValue: string | null;
  order: number | null;
  location: string | null;
  people: string | null;
  confidence: ResearchTimelineEvent["confidence"];
  createdAt: Date;
  updatedAt: Date;
  source: Parameters<typeof mapSource>[0] | null;
}): ResearchTimelineEvent {
  return {
    id: event.id,
    dossierId: event.dossierId,
    sourceId: event.sourceId,
    title: event.title,
    description: event.description,
    dateValue: event.dateValue,
    order: event.order,
    location: event.location,
    people: parseSerializedTags(event.people ?? "[]"),
    confidence: event.confidence,
    source: event.source ? mapSource(event.source) : null,
    createdAt: toIsoString(event.createdAt),
    updatedAt: toIsoString(event.updatedAt)
  };
}

function mapHook(hook: {
  id: string;
  dossierId: string;
  text: string;
  hookType: ResearchHook["hookType"];
  strengthScore: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ResearchHook {
  return {
    id: hook.id,
    dossierId: hook.dossierId,
    text: hook.text,
    hookType: hook.hookType,
    strengthScore: hook.strengthScore,
    notes: hook.notes,
    createdAt: toIsoString(hook.createdAt),
    updatedAt: toIsoString(hook.updatedAt)
  };
}

function mapAssetRequirement(requirement: {
  id: string;
  dossierId: string;
  sceneRole: ResearchAssetRequirement["sceneRole"];
  description: string;
  mediaType: ResearchAssetRequirement["mediaType"];
  suggestedTags: string | null;
  emotion: ResearchAssetRequirement["emotion"];
  priority: number | null;
  fulfilledAssetId: string | null;
  visualSourceMode: ResearchAssetRequirement["visualSourceMode"];
  characterProfileId: string | null;
  generatedAssetId: string | null;
  visualPrompt: string | null;
  generationStatus: ResearchAssetRequirement["generationStatus"];
  generationProvider: string | null;
  createdAt: Date;
  updatedAt: Date;
  fulfilledAsset: Parameters<typeof mapAsset>[0] | null;
  generatedAsset?: Parameters<typeof mapAsset>[0] | null;
  mediaCollections?: Array<{
    id: string;
    name: string;
    channelId: string | null;
    projectId: string | null;
    dossierId: string | null;
    assetRequirementId: string | null;
    provider: string;
    query: string | null;
    sourcePath: string | null;
    mediaType: ResearchAssetRequirement["mediaCollections"][number]["mediaType"];
    status: ResearchAssetRequirement["mediaCollections"][number]["status"];
    targetCount: number | null;
    importedCount: number;
    rejectedCount: number;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): ResearchAssetRequirement {
  return {
    id: requirement.id,
    dossierId: requirement.dossierId,
    sceneRole: requirement.sceneRole,
    description: requirement.description,
    mediaType: requirement.mediaType,
    suggestedTags: parseSerializedTags(requirement.suggestedTags ?? "[]"),
    emotion: requirement.emotion,
    priority: requirement.priority,
    fulfilledAssetId: requirement.fulfilledAssetId,
    fulfilledAsset: requirement.fulfilledAsset ? mapAsset(requirement.fulfilledAsset) : null,
    visualSourceMode: requirement.visualSourceMode,
    characterProfileId: requirement.characterProfileId,
    generatedAssetId: requirement.generatedAssetId,
    generatedAsset: requirement.generatedAsset ? mapAsset(requirement.generatedAsset) : null,
    visualPrompt: requirement.visualPrompt,
    generationStatus: requirement.generationStatus,
    generationProvider:
      requirement.generationProvider as ResearchAssetRequirement["generationProvider"],
    mediaCollections:
      requirement.mediaCollections?.map((collection) => ({
        id: collection.id,
        name: collection.name,
        channelId: collection.channelId,
        projectId: collection.projectId,
        dossierId: collection.dossierId,
        assetRequirementId: collection.assetRequirementId,
        provider: collection.provider,
        query: collection.query,
        sourcePath: collection.sourcePath,
        mediaType: collection.mediaType,
        status: collection.status,
        targetCount: collection.targetCount,
        importedCount: collection.importedCount,
        rejectedCount: collection.rejectedCount,
        notes: collection.notes,
        createdAt: toIsoString(collection.createdAt),
        updatedAt: toIsoString(collection.updatedAt)
      })) ?? [],
    createdAt: toIsoString(requirement.createdAt),
    updatedAt: toIsoString(requirement.updatedAt)
  };
}

function mapOutlineScene(scene: {
  id: string;
  dossierId: string;
  order: number;
  role: ResearchOutlineScene["role"];
  title: string;
  narrationDraft: string;
  captionDraft: string | null;
  emotion: ResearchOutlineScene["emotion"];
  visualPreset: string | null;
  assetRequirementId: string | null;
  estimatedDuration: number | null;
  createdAt: Date;
  updatedAt: Date;
  assetRequirement: (Parameters<typeof mapAssetRequirement>[0] & {
    fulfilledAsset: Parameters<typeof mapAsset>[0] | null;
  }) | null;
}): ResearchOutlineScene {
  return {
    id: scene.id,
    dossierId: scene.dossierId,
    order: scene.order,
    role: scene.role,
    title: scene.title,
    narrationDraft: scene.narrationDraft,
    captionDraft: scene.captionDraft,
    emotion: scene.emotion,
    visualPreset: scene.visualPreset,
    assetRequirementId: scene.assetRequirementId,
    assetRequirement: scene.assetRequirement
      ? mapAssetRequirement(scene.assetRequirement)
      : null,
    estimatedDuration: scene.estimatedDuration,
    createdAt: toIsoString(scene.createdAt),
    updatedAt: toIsoString(scene.updatedAt)
  };
}

function mapDossier(
  dossier: {
    id: string;
    channelId: string | null;
    title: string;
    topic: string;
    niche: string | null;
    tone: string | null;
    targetDuration: number | null;
    status: ResearchDossier["status"];
    summary: string | null;
    narrativeAngle: string | null;
    editorialNotes: string | null;
    safetyNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
    channel: Parameters<typeof mapChannel>[0] | null;
    sources?: Array<{ status: ResearchSource["status"] }>;
    _count?: {
      sources: number;
      facts: number;
      timelineEvents: number;
      outlineScenes: number;
    };
  }
): ResearchDossier {
  const sources = dossier.sources ?? [];

  return {
    id: dossier.id,
    channelId: dossier.channelId,
    channel: dossier.channel ? mapChannel(dossier.channel) : null,
    title: dossier.title,
    topic: dossier.topic,
    niche: dossier.niche,
    tone: dossier.tone,
    targetDuration: dossier.targetDuration,
    status: dossier.status,
    summary: dossier.summary,
    narrativeAngle: dossier.narrativeAngle,
    editorialNotes: dossier.editorialNotes,
    safetyNotes: dossier.safetyNotes,
    sourceCount: dossier._count?.sources ?? sources.length,
    approvedSourceCount: sources.filter(
      (source) => source.status === "approved" || source.status === "imported"
    ).length,
    factCount: dossier._count?.facts ?? 0,
    timelineCount: dossier._count?.timelineEvents ?? 0,
    outlineSceneCount: dossier._count?.outlineScenes ?? 0,
    createdAt: toIsoString(dossier.createdAt),
    updatedAt: toIsoString(dossier.updatedAt)
  };
}

const dossierDetailArgs = {
  include: {
    channel: true,
    sources: {
      orderBy: {
        createdAt: "desc" as const
      }
    },
    facts: {
      orderBy: {
        createdAt: "desc" as const
      },
      include: {
        source: true
      }
    },
    timelineEvents: {
      orderBy: [{ order: "asc" as const }, { createdAt: "asc" as const }],
      include: {
        source: true
      }
    },
    hooks: {
      orderBy: {
        createdAt: "desc" as const
      }
    },
    assetRequirements: {
      orderBy: {
        createdAt: "desc" as const
      },
      include: {
        fulfilledAsset: true,
        generatedAsset: true,
        mediaCollections: true
      }
    },
    outlineScenes: {
      orderBy: {
        order: "asc" as const
      },
      include: {
        assetRequirement: {
          include: {
            fulfilledAsset: true,
            generatedAsset: true,
            mediaCollections: true
          }
        }
      }
    },
    _count: {
      select: {
        sources: true,
        facts: true,
        timelineEvents: true,
        outlineScenes: true
      }
    }
  }
} satisfies Prisma.ResearchDossierDefaultArgs;

const dossierDetailInclude = dossierDetailArgs.include;

type ResearchDossierDetailRecord = Prisma.ResearchDossierGetPayload<
  typeof dossierDetailArgs
>;

function mapDossierDetail(
  dossier: ResearchDossierDetailRecord
): ResearchDossierDetail {
  return {
    dossier: mapDossier(dossier),
    sources: dossier.sources.map(mapSource),
    facts: dossier.facts.map(mapFact),
    timeline: dossier.timelineEvents.map(mapTimelineEvent),
    hooks: dossier.hooks.map(mapHook),
    assetRequirements: dossier.assetRequirements.map(mapAssetRequirement),
    outline: dossier.outlineScenes.map(mapOutlineScene)
  };
}

function serializeUpdateDossierInput(input: UpdateResearchDossierInput) {
  const data: Prisma.ResearchDossierUncheckedUpdateInput = {};

  if ("channelId" in input) {
    data.channelId = input.channelId;
  }

  if ("title" in input) {
    data.title = input.title;
  }

  if ("topic" in input) {
    data.topic = input.topic;
  }

  if ("niche" in input) {
    data.niche = input.niche;
  }

  if ("tone" in input) {
    data.tone = input.tone;
  }

  if ("targetDuration" in input) {
    data.targetDuration = input.targetDuration;
  }

  if ("status" in input) {
    data.status = input.status;
  }

  if ("summary" in input) {
    data.summary = input.summary;
  }

  if ("narrativeAngle" in input) {
    data.narrativeAngle = input.narrativeAngle;
  }

  if ("editorialNotes" in input) {
    data.editorialNotes = input.editorialNotes;
  }

  if ("safetyNotes" in input) {
    data.safetyNotes = input.safetyNotes;
  }

  return data;
}

function serializeUpdateSourceInput(input: UpdateResearchSourceInput) {
  const data: Prisma.ResearchSourceUncheckedUpdateInput = {};

  if ("title" in input) {
    data.title = input.title;
  }

  if ("url" in input) {
    data.url = input.url;
  }

  if ("provider" in input) {
    data.provider = input.provider;
  }

  if ("sourceType" in input) {
    data.sourceType = input.sourceType;
  }

  if ("author" in input) {
    data.author = input.author;
  }

  if ("publishedAt" in input) {
    data.publishedAt = input.publishedAt;
  }

  if ("accessedAt" in input) {
    data.accessedAt = input.accessedAt;
  }

  if ("reliabilityScore" in input) {
    data.reliabilityScore = input.reliabilityScore;
  }

  if ("citationText" in input) {
    data.citationText = input.citationText;
  }

  if ("rawTextPath" in input) {
    data.rawTextPath = input.rawTextPath;
  }

  if ("excerpt" in input) {
    data.excerpt = input.excerpt;
  }

  if ("notes" in input) {
    data.notes = input.notes;
  }

  if ("status" in input) {
    data.status = input.status;
  }

  if ("errorMessage" in input) {
    data.errorMessage = input.errorMessage;
  }

  return data;
}

export function createPrismaResearchRepository({
  prismaClient = defaultPrisma
}: PrismaResearchRepositoryOptions = {}): ResearchRepository {
  return {
    async listDossiers() {
      const dossiers = await prismaClient.researchDossier.findMany({
        orderBy: {
          createdAt: "desc"
        },
        include: {
          channel: true,
          sources: {
            select: {
              status: true
            }
          },
          _count: {
            select: {
              sources: true,
              facts: true,
              timelineEvents: true,
              outlineScenes: true
            }
          }
        }
      });

      return dossiers.map(mapDossier);
    },
    async getDossierById(id) {
      const dossier = await prismaClient.researchDossier.findUnique({
        where: { id },
        include: dossierDetailInclude
      });

      return dossier ? mapDossierDetail(dossier) : null;
    },
    async createDossier(input: CreateResearchDossierInput) {
      const created = await prismaClient.researchDossier.create({
        data: input,
        include: {
          channel: true,
          sources: {
            select: {
              status: true
            }
          },
          _count: {
            select: {
              sources: true,
              facts: true,
              timelineEvents: true,
              outlineScenes: true
            }
          }
        }
      });

      return mapDossier(created);
    },
    async updateDossier(id: string, input: UpdateResearchDossierInput) {
      const existing = await prismaClient.researchDossier.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      const dossier = await prismaClient.researchDossier.update({
        where: { id },
        data: serializeUpdateDossierInput(input),
        include: {
          channel: true,
          sources: {
            select: {
              status: true
            }
          },
          _count: {
            select: {
              sources: true,
              facts: true,
              timelineEvents: true,
              outlineScenes: true
            }
          }
        }
      });

      return mapDossier(dossier);
    },
    async deleteDossier(id: string) {
      const existing = await prismaClient.researchDossier.findUnique({
        where: { id }
      });

      if (!existing) {
        return false;
      }

      await prismaClient.researchDossier.delete({
        where: { id }
      });

      return true;
    },
    async listSources(dossierId) {
      const sources = await prismaClient.researchSource.findMany({
        where: { dossierId },
        orderBy: { createdAt: "desc" }
      });

      return sources.map(mapSource);
    },
    async getSourceById(id) {
      const source = await prismaClient.researchSource.findUnique({
        where: { id }
      });

      return source ? mapSource(source) : null;
    },
    async createSource(input: CreateResearchSourceInput) {
      const source = await prismaClient.researchSource.create({
        data: input
      });

      return mapSource(source);
    },
    async updateSource(id: string, input: UpdateResearchSourceInput) {
      const existing = await prismaClient.researchSource.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      const source = await prismaClient.researchSource.update({
        where: { id },
        data: serializeUpdateSourceInput(input)
      });

      return mapSource(source);
    },
    async listFacts(dossierId) {
      const facts = await prismaClient.researchFact.findMany({
        where: { dossierId },
        orderBy: { createdAt: "desc" },
        include: {
          source: true
        }
      });

      return facts.map(mapFact);
    },
    async listTimelineEvents(dossierId) {
      const timelineEvents = await prismaClient.researchTimelineEvent.findMany({
        where: { dossierId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          source: true
        }
      });

      return timelineEvents.map(mapTimelineEvent);
    },
    async listHooks(dossierId) {
      const hooks = await prismaClient.researchHook.findMany({
        where: { dossierId },
        orderBy: { createdAt: "desc" }
      });

      return hooks.map(mapHook);
    },
    async getAssetRequirementById(id) {
      const requirement = await prismaClient.researchAssetRequirement.findUnique({
        where: { id },
        include: {
          fulfilledAsset: true,
          generatedAsset: true,
          mediaCollections: true
        }
      });

      return requirement ? mapAssetRequirement(requirement) : null;
    },
    async listAssetRequirements(dossierId) {
      const requirements = await prismaClient.researchAssetRequirement.findMany({
        where: { dossierId },
        orderBy: { createdAt: "desc" },
        include: {
          fulfilledAsset: true,
          generatedAsset: true,
          mediaCollections: true
        }
      });

      return requirements.map(mapAssetRequirement);
    },
    async updateAssetRequirement(id, input) {
      const existing = await prismaClient.researchAssetRequirement.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      const requirement = await prismaClient.researchAssetRequirement.update({
        where: { id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(input, "sceneRole")
            ? { sceneRole: input.sceneRole ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "description")
            ? { description: input.description }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "mediaType")
            ? { mediaType: input.mediaType }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "suggestedTags")
            ? { suggestedTags: JSON.stringify(input.suggestedTags ?? []) }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "emotion")
            ? { emotion: input.emotion ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "priority")
            ? { priority: input.priority ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "fulfilledAssetId")
            ? { fulfilledAssetId: input.fulfilledAssetId ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "visualSourceMode")
            ? { visualSourceMode: input.visualSourceMode ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "characterProfileId")
            ? { characterProfileId: input.characterProfileId ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "generatedAssetId")
            ? { generatedAssetId: input.generatedAssetId ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "visualPrompt")
            ? { visualPrompt: input.visualPrompt ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "generationStatus")
            ? { generationStatus: input.generationStatus ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "generationProvider")
            ? { generationProvider: input.generationProvider ?? null }
            : {})
        },
        include: {
          fulfilledAsset: true,
          generatedAsset: true,
          mediaCollections: true
        }
      });

      return mapAssetRequirement(requirement);
    },
    async listOutlineScenes(dossierId) {
      const outlineScenes = await prismaClient.researchOutlineScene.findMany({
        where: { dossierId },
        orderBy: { order: "asc" },
        include: {
          assetRequirement: {
            include: {
              fulfilledAsset: true,
              generatedAsset: true,
              mediaCollections: true
            }
          }
        }
      });

      return outlineScenes.map(mapOutlineScene);
    },
    async replaceAnalysis(dossierId: string, input: ReplaceResearchArtifactsInput) {
      const detail = await prismaClient.$transaction(async (transaction) => {
        const existing = await transaction.researchDossier.findUnique({
          where: { id: dossierId }
        });

        if (!existing) {
          return null;
        }

        await transaction.researchDossier.update({
          where: { id: dossierId },
          data: serializeUpdateDossierInput(input.dossierPatch)
        });

        await transaction.researchOutlineScene.deleteMany({
          where: { dossierId }
        });
        await transaction.researchAssetRequirement.deleteMany({
          where: { dossierId }
        });
        await transaction.researchHook.deleteMany({
          where: { dossierId }
        });
        await transaction.researchTimelineEvent.deleteMany({
          where: { dossierId }
        });
        await transaction.researchFact.deleteMany({
          where: { dossierId }
        });

        const requirementIdByRef = new Map<string, string>();

        for (const requirementInput of input.assetRequirements) {
          const createdRequirement = await transaction.researchAssetRequirement.create({
            data: {
              dossierId,
              sceneRole: requirementInput.sceneRole ?? null,
              description: requirementInput.description,
              mediaType: requirementInput.mediaType,
              suggestedTags: JSON.stringify(requirementInput.suggestedTags),
              emotion: requirementInput.emotion ?? null,
              priority: requirementInput.priority ?? null,
              fulfilledAssetId: requirementInput.fulfilledAssetId ?? null,
              visualSourceMode: requirementInput.visualSourceMode ?? null,
              characterProfileId: requirementInput.characterProfileId ?? null,
              generatedAssetId: requirementInput.generatedAssetId ?? null,
              visualPrompt: requirementInput.visualPrompt ?? null,
              generationStatus: requirementInput.generationStatus ?? null,
              generationProvider: requirementInput.generationProvider ?? null
            }
          });

          if (requirementInput.ref) {
            requirementIdByRef.set(requirementInput.ref, createdRequirement.id);
          }
        }

        for (const factInput of input.facts) {
          await transaction.researchFact.create({
            data: {
              dossierId,
              sourceId: factInput.sourceId ?? null,
              claim: factInput.claim,
              factType: factInput.factType,
              confidence: factInput.confidence,
              dateValue: factInput.dateValue ?? null,
              people: JSON.stringify(factInput.people),
              places: JSON.stringify(factInput.places),
              tags: JSON.stringify(factInput.tags),
              notes: factInput.notes ?? null
            }
          });
        }

        for (const timelineInput of input.timelineEvents) {
          await transaction.researchTimelineEvent.create({
            data: {
              dossierId,
              sourceId: timelineInput.sourceId ?? null,
              title: timelineInput.title,
              description: timelineInput.description,
              dateValue: timelineInput.dateValue ?? null,
              order: timelineInput.order ?? null,
              location: timelineInput.location ?? null,
              people: JSON.stringify(timelineInput.people),
              confidence: timelineInput.confidence
            }
          });
        }

        for (const hookInput of input.hooks) {
          await transaction.researchHook.create({
            data: {
              dossierId,
              text: hookInput.text,
              hookType: hookInput.hookType,
              strengthScore: hookInput.strengthScore ?? null,
              notes: hookInput.notes ?? null
            }
          });
        }

        for (const outlineInput of input.outlineScenes) {
          await transaction.researchOutlineScene.create({
            data: {
              dossierId,
              order: outlineInput.order,
              role: outlineInput.role,
              title: outlineInput.title,
              narrationDraft: outlineInput.narrationDraft,
              captionDraft: outlineInput.captionDraft ?? null,
              emotion: outlineInput.emotion ?? null,
              visualPreset: outlineInput.visualPreset ?? null,
              assetRequirementId: outlineInput.assetRequirementRef
                ? requirementIdByRef.get(outlineInput.assetRequirementRef) ?? null
                : null,
              estimatedDuration: outlineInput.estimatedDuration ?? null
            }
          });
        }

        return transaction.researchDossier.findUnique({
          where: { id: dossierId },
          include: dossierDetailInclude
        });
      });

      return detail ? mapDossierDetail(detail) : null;
    }
  };
}

