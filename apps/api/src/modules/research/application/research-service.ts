import {
  buildAssetRequirementsFromOutline,
  buildOutlineFromResearch,
  buildResearchDossierSummary,
  extractFactCandidates,
  extractTimelineCandidates,
  generateGoogleSearchLinks,
  generateSearchQueries,
  generateSourceChecklist,
  type HookDraft
} from "@reelforge/research-collector";
import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { ChannelRepository } from "../../channels/application/channel-repository.js";
import {
  applyChannelDefaultsToProject,
  getVideoProjectProductionChecklist
} from "../../production/application/production-service.js";
import {
  createProjectScene,
  createVideoProject,
  getVideoProjectById
} from "../../projects/application/project-service.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type { ResearchRepository } from "./research-repository.js";
import type {
  CreateProductionFromResearchInput,
  ManualResearchSourceInput,
  ResearchConnectorSearchInput,
  ResearchDossier,
  ResearchDossierDetail,
  ResearchSource,
  ResearchUrlFetchInput
} from "../domain/research.js";
import { buildResearchSafetyWarningList } from "../domain/research.js";
import {
  fetchPublicResearchUrl,
  searchWikipediaCandidates,
  searchWikidataCandidates
} from "../infrastructure/public-research-connectors.js";
import {
  readResearchSourceText,
  writeResearchSourceText
} from "../infrastructure/research-source-storage.js";

function buildDossierNotFoundError(dossierId: string) {
  return new NotFoundError(`Research dossier '${dossierId}' was not found.`);
}

function buildSourceNotFoundError(sourceId: string) {
  return new NotFoundError(`Research source '${sourceId}' was not found.`);
}

async function requireDossier(
  repository: ResearchRepository,
  dossierId: string
): Promise<ResearchDossierDetail> {
  const dossier = await repository.getDossierById(dossierId);

  if (!dossier) {
    throw buildDossierNotFoundError(dossierId);
  }

  return dossier;
}

async function requireSource(repository: ResearchRepository, sourceId: string) {
  const source = await repository.getSourceById(sourceId);

  if (!source) {
    throw buildSourceNotFoundError(sourceId);
  }

  return source;
}

async function ensureChannelExists(
  channelRepository: ChannelRepository,
  channelId: string | null
) {
  if (!channelId) {
    return null;
  }

  const channel = await channelRepository.getById(channelId);

  if (!channel) {
    throw new NotFoundError(`Channel '${channelId}' was not found.`);
  }

  return channel;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    const key = getKey(item);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function serializeNotes(lines: string[]) {
  return lines.filter(Boolean).join("\n");
}

function isApprovedResearchSource(source: ResearchSource) {
  return source.status === "approved" || source.status === "imported";
}

function buildTopicRiskFlags(dossier: ResearchDossier) {
  const text = `${dossier.topic} ${dossier.niche ?? ""} ${dossier.tone ?? ""}`.toLowerCase();
  const warnings: string[] = [];

  if (
    text.includes("crime") ||
    text.includes("assassin") ||
    text.includes("serial") ||
    text.includes("desaparec")
  ) {
    warnings.push(
      "Tema com sinais de true crime ou caso sensivel; reforcar ligacao entre afirmacoes e fontes."
    );
  }

  if (/(202[4-9]|203\d)/u.test(text) || text.includes("recente") || text.includes("em andamento")) {
    warnings.push(
      "O dossie parece recente ou sensivel; revisar linguagem e evitar conclusoes fechadas."
    );
  }

  return warnings;
}

async function buildSourceAnalysisText(source: ResearchSource) {
  const rawText = await readResearchSourceText(source.rawTextPath);

  return normalizeText(
    [
      source.title,
      source.excerpt ?? "",
      source.notes ?? "",
      rawText ?? ""
    ].join(" ")
  );
}

function buildHookDrafts(
  dossier: ResearchDossier,
  facts: Awaited<ReturnType<typeof analyzeApprovedSources>>["facts"],
  timeline: Awaited<ReturnType<typeof analyzeApprovedSources>>["timeline"]
): HookDraft[] {
  const hooks: HookDraft[] = [];

  if (timeline[0]) {
    hooks.push({
      text: `${timeline[0].title}: ${timeline[0].description}`,
      hookType: timeline[0].dateValue ? "timeline" : "mystery",
      strengthScore: 84,
      notes: "Abrir com cronologia curta e precisa."
    });
  }

  const uncertaintyFact = facts.find(
    (fact) => fact.confidence === "likely" || fact.confidence === "disputed"
  );

  if (uncertaintyFact) {
    hooks.push({
      text: `Mas ha um ponto que continua sem consenso: ${uncertaintyFact.claim}`,
      hookType: "contrast",
      strengthScore: 77,
      notes: "Bom para virar de contexto para tensao."
    });
  }

  if (facts[0]) {
    hooks.push({
      text: `O fato que muda a leitura do caso: ${facts[0].claim}`,
      hookType: "revelation",
      strengthScore: 80,
      notes: "Serve como linha principal do doc short."
    });
  }

  if (hooks.length === 0) {
    hooks.push({
      text: `O que torna ${dossier.topic} tao relevante hoje?`,
      hookType: "question",
      strengthScore: 68,
      notes: "Hook de fallback quando a base ainda esta rasa."
    });
  }

  return hooks;
}

async function analyzeApprovedSources(
  sources: ResearchSource[]
) {
  const facts = [];
  const timeline = [];

  for (const source of sources) {
    const text = await buildSourceAnalysisText(source);

    if (!text) {
      continue;
    }

    for (const fact of extractFactCandidates(text).slice(0, 8)) {
      facts.push({
        sourceId: source.id,
        claim: fact.claim,
        factType: fact.factType,
        confidence: source.id ? fact.confidence : "uncertain",
        dateValue: fact.dateValue ?? null,
        people: fact.people,
        places: fact.places,
        tags: fact.tags,
        notes: fact.notes
      });
    }

    for (const event of extractTimelineCandidates(text).slice(0, 6)) {
      timeline.push({
        sourceId: source.id,
        title: event.title,
        description: event.description,
        dateValue: event.dateValue ?? null,
        order: null,
        location: event.location ?? null,
        people: event.people,
        confidence: event.confidence
      });
    }
  }

  const uniqueFacts = uniqueBy(facts, (fact) => fact.claim.toLowerCase());
  const uniqueTimeline = uniqueBy(
    timeline,
    (event) => `${event.title.toLowerCase()}::${event.dateValue ?? ""}`
  ).map((event, index) => ({
    ...event,
    order: index + 1
  }));

  return {
    facts: uniqueFacts,
    timeline: uniqueTimeline
  };
}

async function createCandidateSources(
  repository: ResearchRepository,
  dossier: ResearchDossierDetail,
  drafts: Array<{
    title: string;
    url: string | null;
    provider: string;
    sourceType: ResearchSource["sourceType"];
    author: string | null;
    publishedAt: string | null;
    excerpt: string | null;
    notes: string | null;
    citationText: string | null;
    reliabilityScore: number | null;
  }>
) {
  const existingMatchKeys = new Set(
    dossier.sources.map((source) =>
      `${source.provider}::${source.title.toLowerCase()}::${source.url ?? ""}`
    )
  );
  const created: ResearchSource[] = [];

  for (const draft of drafts) {
    const matchKey = `${draft.provider}::${draft.title.toLowerCase()}::${draft.url ?? ""}`;

    if (existingMatchKeys.has(matchKey)) {
      continue;
    }

    existingMatchKeys.add(matchKey);
    created.push(
      await repository.createSource({
        dossierId: dossier.dossier.id,
        title: draft.title,
        url: draft.url,
        provider: draft.provider,
        sourceType: draft.sourceType,
        author: draft.author,
        publishedAt: draft.publishedAt,
        accessedAt: new Date().toISOString(),
        reliabilityScore: draft.reliabilityScore,
        citationText: draft.citationText,
        rawTextPath: null,
        excerpt: draft.excerpt,
        notes: draft.notes,
        status: "candidate",
        errorMessage: null
      })
    );
  }

  return created;
}

export async function listResearchDossiers(repository: ResearchRepository) {
  return repository.listDossiers();
}

export async function getResearchDossierById(
  repository: ResearchRepository,
  dossierId: string
) {
  return requireDossier(repository, dossierId);
}

export async function createResearchDossier(
  repository: ResearchRepository,
  channelRepository: ChannelRepository,
  input: Parameters<ResearchRepository["createDossier"]>[0]
) {
  await ensureChannelExists(channelRepository, input.channelId);
  return repository.createDossier(input);
}

export async function updateResearchDossier(
  repository: ResearchRepository,
  channelRepository: ChannelRepository,
  dossierId: string,
  input: Parameters<ResearchRepository["updateDossier"]>[1]
) {
  if ("channelId" in input) {
    await ensureChannelExists(channelRepository, input.channelId ?? null);
  }

  const updated = await repository.updateDossier(dossierId, input);

  if (!updated) {
    throw buildDossierNotFoundError(dossierId);
  }

  return updated;
}

export async function deleteResearchDossier(
  repository: ResearchRepository,
  dossierId: string
) {
  const deleted = await repository.deleteDossier(dossierId);

  if (!deleted) {
    throw buildDossierNotFoundError(dossierId);
  }
}

export async function generateDossierSearchQueryBundle(
  repository: ResearchRepository,
  dossierId: string
) {
  const dossier = await requireDossier(repository, dossierId);

  return {
    dossierId,
    queries: generateSearchQueries(dossier.dossier.topic, {
      niche: dossier.dossier.niche,
      tone: dossier.dossier.tone,
      targetDuration: dossier.dossier.targetDuration
    }),
    links: generateGoogleSearchLinks(dossier.dossier.topic, {
      niche: dossier.dossier.niche,
      tone: dossier.dossier.tone,
      targetDuration: dossier.dossier.targetDuration
    }),
    checklist: generateSourceChecklist(
      dossier.dossier.topic,
      dossier.dossier.niche
    )
  };
}

export async function addManualResearchSource(
  repository: ResearchRepository,
  dossierId: string,
  input: ManualResearchSourceInput
) {
  await requireDossier(repository, dossierId);

  return repository.createSource({
    dossierId,
    title: input.title,
    url: input.url,
    provider: input.provider ?? "manual",
    sourceType: input.sourceType,
    author: input.author,
    publishedAt: input.publishedAt,
    accessedAt: new Date().toISOString(),
    reliabilityScore: input.reliabilityScore,
    citationText: input.citationText,
    rawTextPath: null,
    excerpt: input.excerpt,
    notes: input.notes,
    status: "candidate",
    errorMessage: null
  });
}

export async function fetchResearchSourceFromPublicUrl(
  repository: ResearchRepository,
  dossierId: string,
  input: ResearchUrlFetchInput
) {
  await requireDossier(repository, dossierId);
  const fetched = await fetchPublicResearchUrl(input.url, input.notes);
  const created = await repository.createSource({
    dossierId,
    title: input.title ?? fetched.title,
    url: fetched.url,
    provider: fetched.provider,
    sourceType: fetched.sourceType,
    author: fetched.author,
    publishedAt: fetched.publishedAt,
    accessedAt: new Date().toISOString(),
    reliabilityScore: fetched.reliabilityScore,
    citationText: fetched.citationText,
    rawTextPath: null,
    excerpt: fetched.excerpt,
    notes: fetched.notes,
    status: fetched.status,
    errorMessage: fetched.errorMessage
  });

  if (fetched.rawText) {
    const rawTextPath = await writeResearchSourceText(
      dossierId,
      created.id,
      fetched.rawText
    );
    return (await repository.updateSource(created.id, {
      rawTextPath
    })) as ResearchSource;
  }

  return created;
}

export async function searchWikipediaResearchSources(
  repository: ResearchRepository,
  dossierId: string,
  input: ResearchConnectorSearchInput
) {
  const dossier = await requireDossier(repository, dossierId);

  try {
    const drafts = await searchWikipediaCandidates(
      input.query ?? dossier.dossier.topic,
      input.limit
    );

    return {
      dossierId,
      createdSources: await createCandidateSources(repository, dossier, drafts),
      warning: null
    };
  } catch (error) {
    return {
      dossierId,
      createdSources: [],
      warning:
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Wikipedia connector unavailable."
    };
  }
}

export async function searchWikidataResearchSources(
  repository: ResearchRepository,
  dossierId: string,
  input: ResearchConnectorSearchInput
) {
  const dossier = await requireDossier(repository, dossierId);

  try {
    const drafts = await searchWikidataCandidates(
      input.query ?? dossier.dossier.topic,
      input.limit
    );

    return {
      dossierId,
      createdSources: await createCandidateSources(repository, dossier, drafts),
      warning: null
    };
  } catch (error) {
    return {
      dossierId,
      createdSources: [],
      warning:
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Wikidata connector unavailable."
    };
  }
}

export async function listResearchSources(
  repository: ResearchRepository,
  dossierId: string
) {
  await requireDossier(repository, dossierId);
  return repository.listSources(dossierId);
}

export async function getResearchSourceById(
  repository: ResearchRepository,
  sourceId: string
) {
  return requireSource(repository, sourceId);
}

export async function approveResearchSource(
  repository: ResearchRepository,
  sourceId: string
) {
  await requireSource(repository, sourceId);
  return (await repository.updateSource(sourceId, {
    status: "approved",
    errorMessage: null
  })) as ResearchSource;
}

export async function rejectResearchSource(
  repository: ResearchRepository,
  sourceId: string
) {
  await requireSource(repository, sourceId);
  return (await repository.updateSource(sourceId, {
    status: "rejected"
  })) as ResearchSource;
}

export async function analyzeResearchDossier(
  repository: ResearchRepository,
  dossierId: string
) {
  const dossier = await requireDossier(repository, dossierId);
  const approvedSources = dossier.sources.filter(isApprovedResearchSource);

  if (approvedSources.length === 0) {
    throw new ValidationError(
      "Approve or import at least one research source before running analysis."
    );
  }

  const extracted = await analyzeApprovedSources(approvedSources);
  const hooks = buildHookDrafts(dossier.dossier, extracted.facts, extracted.timeline);
  const dossierSummary = buildResearchDossierSummary(
    {
      title: dossier.dossier.title,
      topic: dossier.dossier.topic,
      niche: dossier.dossier.niche,
      tone: dossier.dossier.tone,
      targetDuration: dossier.dossier.targetDuration
    },
    extracted.facts.map((fact) => ({
      claim: fact.claim,
      factType: fact.factType,
      confidence: fact.confidence,
      dateValue: fact.dateValue,
      people: fact.people,
      places: fact.places,
      tags: fact.tags,
      notes: fact.notes
    })),
    extracted.timeline.map((event) => ({
      title: event.title,
      description: event.description,
      dateValue: event.dateValue,
      location: event.location,
      people: event.people,
      confidence: event.confidence
    }))
  );
  const outline = buildOutlineFromResearch(
    {
      title: dossier.dossier.title,
      topic: dossier.dossier.topic,
      niche: dossier.dossier.niche,
      tone: dossier.dossier.tone,
      targetDuration: dossier.dossier.targetDuration
    },
    extracted.facts.map((fact) => ({
      claim: fact.claim,
      factType: fact.factType,
      confidence: fact.confidence,
      dateValue: fact.dateValue,
      people: fact.people,
      places: fact.places,
      tags: fact.tags,
      notes: fact.notes
    })),
    extracted.timeline.map((event) => ({
      title: event.title,
      description: event.description,
      dateValue: event.dateValue,
      location: event.location,
      people: event.people,
      confidence: event.confidence
    })),
    hooks,
    {
      targetDuration: dossier.dossier.targetDuration ?? 36
    }
  );
  const assetRequirements = buildAssetRequirementsFromOutline(outline);
  const safetyWarnings = [
    ...buildTopicRiskFlags(dossier.dossier),
    ...buildResearchSafetyWarningList(
      dossierSummary.summary,
      outline.map((scene) => scene.narrationDraft)
    )
  ];
  const detail = await repository.replaceAnalysis(dossierId, {
    dossierPatch: {
      status: "ready_for_review",
      summary: dossierSummary.summary,
      narrativeAngle: dossierSummary.narrativeAngle,
      editorialNotes: serializeNotes(dossierSummary.editorialNotes),
      safetyNotes: serializeNotes([
        ...dossierSummary.safetyNotes,
        ...safetyWarnings
      ])
    },
    facts: extracted.facts,
    timelineEvents: extracted.timeline,
    hooks: hooks.map((hook) => ({
      text: hook.text,
      hookType: hook.hookType,
      strengthScore: hook.strengthScore,
      notes: hook.notes
    })),
    assetRequirements: assetRequirements.map((requirement) => ({
      ref: requirement.ref,
      sceneRole: requirement.sceneRole,
      description: requirement.description,
      mediaType: requirement.mediaType,
      suggestedTags: requirement.suggestedTags,
      emotion: requirement.emotion,
      priority: requirement.priority,
      fulfilledAssetId: null,
      visualSourceMode: null,
      characterProfileId: null,
      generatedAssetId: null,
      visualPrompt: null,
      generationStatus: null,
      generationProvider: null
    })),
    outlineScenes: outline.map((scene) => ({
      order: scene.order,
      role: scene.role,
      title: scene.title,
      narrationDraft: scene.narrationDraft,
      captionDraft: scene.captionDraft,
      emotion: scene.emotion,
      visualPreset: scene.visualPreset,
      assetRequirementRef: scene.assetRequirementRef,
      estimatedDuration: scene.estimatedDuration
    }))
  });

  if (!detail) {
    throw buildDossierNotFoundError(dossierId);
  }

  return {
    dossierId,
    approvedSourceCount: approvedSources.length,
    factCount: detail.facts.length,
    timelineCount: detail.timeline.length,
    hookCount: detail.hooks.length,
    assetRequirementCount: detail.assetRequirements.length,
    outlineSceneCount: detail.outline.length,
    safetyWarnings,
    detail
  };
}

export async function listResearchFacts(
  repository: ResearchRepository,
  dossierId: string
) {
  await requireDossier(repository, dossierId);
  return repository.listFacts(dossierId);
}

export async function listResearchTimeline(
  repository: ResearchRepository,
  dossierId: string
) {
  await requireDossier(repository, dossierId);
  return repository.listTimelineEvents(dossierId);
}

export async function listResearchHooks(
  repository: ResearchRepository,
  dossierId: string
) {
  await requireDossier(repository, dossierId);
  return repository.listHooks(dossierId);
}

export async function listResearchAssetRequirements(
  repository: ResearchRepository,
  dossierId: string
) {
  await requireDossier(repository, dossierId);
  return repository.listAssetRequirements(dossierId);
}

export async function listResearchOutlineScenes(
  repository: ResearchRepository,
  dossierId: string
) {
  await requireDossier(repository, dossierId);
  return repository.listOutlineScenes(dossierId);
}

export async function createProductionFromResearchDossier(
  researchRepository: ResearchRepository,
  projectRepository: ProjectRepository,
  channelRepository: ChannelRepository,
  assetRepository: AssetRepository,
  dossierId: string,
  input: CreateProductionFromResearchInput
) {
  const detail = await requireDossier(researchRepository, dossierId);

  if (!detail.dossier.channelId) {
    throw new ValidationError(
      "Research dossier needs a channel before creating a production."
    );
  }

  const channel = await ensureChannelExists(
    channelRepository,
    detail.dossier.channelId
  );

  if (!channel) {
    throw new ValidationError(
      "Research dossier needs a valid channel before creating a production."
    );
  }

  if (detail.outline.length === 0) {
    throw new ValidationError(
      "Run dossier analysis before creating a production."
    );
  }

  const script = detail.outline
    .sort((left, right) => left.order - right.order)
    .map((scene) => scene.narrationDraft)
    .join("\n\n");
  const createdProject = await createVideoProject(
    projectRepository,
    channelRepository,
    assetRepository,
    {
      title: input.title ?? detail.dossier.title,
      status: input.status,
      channelId: detail.dossier.channelId,
      script,
      durationTarget: detail.dossier.targetDuration,
      format: input.format,
      templateId: null,
      defaultCaptionStyle: channel.defaultCaptionStyle ?? null,
      backgroundMusicAssetId: null,
      voiceoverAssetId: null,
      audioMood: channel.defaultAudioMood ?? null,
      musicVolume: 0.18,
      voiceVolume: 1,
      sfxVolume: 0.7,
      enableAudioDucking: false,
      duckingLevel: 0.35
    }
  );

  let scenesCreated = 0;

  for (const outlineScene of detail.outline.sort((left, right) => left.order - right.order)) {
    await createProjectScene(projectRepository, assetRepository, createdProject.id, {
      order: outlineScene.order,
      title: outlineScene.title,
      narrationText: outlineScene.narrationDraft,
      captionText: outlineScene.captionDraft,
      duration: outlineScene.estimatedDuration,
      emotion: outlineScene.emotion,
      assetId: outlineScene.assetRequirement?.fulfilledAssetId ?? null,
      generatedAssetId: outlineScene.assetRequirement?.generatedAssetId ?? null,
      characterProfileId: outlineScene.assetRequirement?.characterProfileId ?? null,
      sfxAssetId: null,
      sfxStartTime: 0,
      sfxVolume: 0.7,
      visualPreset: outlineScene.visualPreset,
      visualSourceMode: outlineScene.assetRequirement?.visualSourceMode ?? null,
      visualPrompt: outlineScene.assetRequirement?.visualPrompt ?? null,
      negativePrompt: null,
      visualRecipe: null,
      generationStatus: outlineScene.assetRequirement?.generationStatus ?? null,
      generationProvider: outlineScene.assetRequirement?.generationProvider ?? null,
      generationSeed: null,
      transition: null,
      captionStyle: channel.defaultCaptionStyle ?? null,
      captionPosition: null,
      captionEmphasisWords: [],
      energyLevel: null
    });
    scenesCreated += 1;
  }

  const defaultsResult = await applyChannelDefaultsToProject(
    projectRepository,
    channelRepository,
    assetRepository,
    createdProject.id
  );
  const project = await getVideoProjectById(projectRepository, createdProject.id);
  const checklist = await getVideoProjectProductionChecklist(
    projectRepository,
    channelRepository,
    createdProject.id
  );

  return {
    dossierId,
    projectId: createdProject.id,
    scenesCreated,
    project,
    defaultsApplied: defaultsResult.projectFieldsApplied,
    checklist: checklist.checklist
  };
}

