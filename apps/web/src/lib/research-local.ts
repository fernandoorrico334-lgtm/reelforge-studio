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
import type {
  ResearchAnalyzeResponse,
  ResearchDossier,
  ResearchDossierDetail,
  ResearchFact,
  ResearchHook,
  ResearchOutlineScene,
  ResearchSearchBundleResponse,
  ResearchSource,
  ResearchTimelineEvent
} from "./studio-types";

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

function buildHookDrafts(
  dossier: ResearchDossier,
  facts: Omit<ResearchFact, "id" | "dossierId" | "source" | "createdAt" | "updatedAt">[],
  timeline: Omit<ResearchTimelineEvent, "id" | "dossierId" | "source" | "createdAt" | "updatedAt">[]
): HookDraft[] {
  const hooks: HookDraft[] = [];

  if (timeline[0]) {
    hooks.push({
      text: `${timeline[0].title}: ${timeline[0].description}`,
      hookType: timeline[0].dateValue ? "timeline" : "mystery",
      strengthScore: 84,
      notes: "Abrir com cronologia curta e direta."
    });
  }

  const uncertain = facts.find(
    (fact) => fact.confidence === "likely" || fact.confidence === "disputed"
  );

  if (uncertain) {
    hooks.push({
      text: `Ainda ha um ponto em aberto: ${uncertain.claim}`,
      hookType: "contrast",
      strengthScore: 76,
      notes: "Bom para virar de contexto para tensao."
    });
  }

  if (facts[0]) {
    hooks.push({
      text: `O fato que puxa a narrativa: ${facts[0].claim}`,
      hookType: "revelation",
      strengthScore: 80,
      notes: "Hook principal de descoberta."
    });
  }

  if (hooks.length === 0) {
    hooks.push({
      text: `O que torna ${dossier.topic} tao marcante?`,
      hookType: "question",
      strengthScore: 68,
      notes: "Fallback local."
    });
  }

  return hooks;
}

export function buildLocalResearchSearchBundle(
  dossier: ResearchDossier
): ResearchSearchBundleResponse {
  return {
    dossierId: dossier.id,
    queries: generateSearchQueries(dossier.topic, {
      niche: dossier.niche,
      tone: dossier.tone,
      targetDuration: dossier.targetDuration
    }),
    links: generateGoogleSearchLinks(dossier.topic, {
      niche: dossier.niche,
      tone: dossier.tone,
      targetDuration: dossier.targetDuration
    }),
    checklist: generateSourceChecklist(dossier.topic, dossier.niche)
  };
}

export function buildLocalResearchAnalysis(
  detail: ResearchDossierDetail
): ResearchAnalyzeResponse {
  const approvedSources = detail.sources.filter(
    (source) => source.status === "approved" || source.status === "imported"
  );
  const extractedFacts = approvedSources.flatMap((source) =>
    extractFactCandidates(
      normalizeText([source.title, source.excerpt ?? "", source.notes ?? ""].join(" "))
    )
      .slice(0, 6)
      .map((fact, index) => ({
        id: `local-fact-${source.id}-${index + 1}`,
        dossierId: detail.dossier.id,
        sourceId: source.id,
        claim: fact.claim,
        factType: fact.factType,
        confidence: fact.confidence,
        dateValue: fact.dateValue ?? null,
        people: fact.people,
        places: fact.places,
        tags: fact.tags,
        notes: fact.notes ?? null,
        source,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
  );
  const facts = uniqueBy(extractedFacts, (fact) => fact.claim.toLowerCase());
  const extractedTimeline = approvedSources.flatMap((source) =>
    extractTimelineCandidates(
      normalizeText([source.title, source.excerpt ?? "", source.notes ?? ""].join(" "))
    )
      .slice(0, 5)
      .map((event, index) => ({
        id: `local-timeline-${source.id}-${index + 1}`,
        dossierId: detail.dossier.id,
        sourceId: source.id,
        title: event.title,
        description: event.description,
        dateValue: event.dateValue ?? null,
        order: index + 1,
        location: event.location ?? null,
        people: event.people,
        confidence: event.confidence,
        source,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
  );
  const timeline = uniqueBy(
    extractedTimeline,
    (event) => `${event.title.toLowerCase()}::${event.dateValue ?? ""}`
  ).map((event, index) => ({
    ...event,
    order: index + 1
  }));
  const hooksDrafts = buildHookDrafts(
    detail.dossier,
    facts.map((fact) => ({
      sourceId: fact.sourceId,
      claim: fact.claim,
      factType: fact.factType,
      confidence: fact.confidence,
      dateValue: fact.dateValue,
      people: fact.people,
      places: fact.places,
      tags: fact.tags,
      notes: fact.notes
    })),
    timeline.map((event) => ({
      sourceId: event.sourceId,
      title: event.title,
      description: event.description,
      dateValue: event.dateValue,
      order: event.order,
      location: event.location,
      people: event.people,
      confidence: event.confidence
    }))
  );
  const summary = buildResearchDossierSummary(
    {
      title: detail.dossier.title,
      topic: detail.dossier.topic,
      niche: detail.dossier.niche,
      tone: detail.dossier.tone,
      targetDuration: detail.dossier.targetDuration
    },
    facts.map((fact) => ({
      claim: fact.claim,
      factType: fact.factType,
      confidence: fact.confidence,
      dateValue: fact.dateValue,
      people: fact.people,
      places: fact.places,
      tags: fact.tags,
      notes: fact.notes
    })),
    timeline.map((event) => ({
      title: event.title,
      description: event.description,
      dateValue: event.dateValue,
      location: event.location,
      people: event.people,
      confidence: event.confidence
    }))
  );
  const outlineDrafts = buildOutlineFromResearch(
    {
      title: detail.dossier.title,
      topic: detail.dossier.topic,
      niche: detail.dossier.niche,
      tone: detail.dossier.tone,
      targetDuration: detail.dossier.targetDuration
    },
    facts.map((fact) => ({
      claim: fact.claim,
      factType: fact.factType,
      confidence: fact.confidence,
      dateValue: fact.dateValue,
      people: fact.people,
      places: fact.places,
      tags: fact.tags,
      notes: fact.notes
    })),
    timeline.map((event) => ({
      title: event.title,
      description: event.description,
      dateValue: event.dateValue,
      location: event.location,
      people: event.people,
      confidence: event.confidence
    })),
    hooksDrafts,
    {
      targetDuration: detail.dossier.targetDuration ?? 36
    }
  );
  const requirementDrafts = buildAssetRequirementsFromOutline(outlineDrafts);
  const assetRequirements = requirementDrafts.map((requirement, index) => ({
    id: `local-requirement-${index + 1}`,
    dossierId: detail.dossier.id,
    sceneRole: requirement.sceneRole,
    description: requirement.description,
    mediaType: requirement.mediaType,
    suggestedTags: requirement.suggestedTags,
    emotion: requirement.emotion,
    priority: requirement.priority,
    fulfilledAssetId: null,
    fulfilledAsset: null,
    visualSourceMode: "generated_only" as const,
    characterProfileId: null,
    generatedAssetId: null,
    generatedAsset: null,
    visualPrompt: null,
    generationStatus: null,
    generationProvider: null,
    mediaCollections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  const requirementMap = new Map(
    requirementDrafts.map((requirement, index) => [requirement.ref, assetRequirements[index]!])
  );
  const outline: ResearchOutlineScene[] = outlineDrafts.map((scene, index) => ({
    id: `local-outline-${index + 1}`,
    dossierId: detail.dossier.id,
    order: scene.order,
    role: scene.role,
    title: scene.title,
    narrationDraft: scene.narrationDraft,
    captionDraft: scene.captionDraft,
    emotion: scene.emotion,
    visualPreset: scene.visualPreset,
    assetRequirementId:
      scene.assetRequirementRef && requirementMap.get(scene.assetRequirementRef)
        ? requirementMap.get(scene.assetRequirementRef)!.id
        : null,
    assetRequirement:
      scene.assetRequirementRef ? requirementMap.get(scene.assetRequirementRef) ?? null : null,
    estimatedDuration: scene.estimatedDuration,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  const hooks: ResearchHook[] = hooksDrafts.map((hook, index) => ({
    id: `local-hook-${index + 1}`,
    dossierId: detail.dossier.id,
    text: hook.text,
    hookType: hook.hookType,
    strengthScore: hook.strengthScore ?? null,
    notes: hook.notes ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  const nextDetail: ResearchDossierDetail = {
    dossier: {
      ...detail.dossier,
      status: "ready_for_review",
      summary: summary.summary,
      narrativeAngle: summary.narrativeAngle,
      editorialNotes: summary.editorialNotes.join("\n"),
      safetyNotes: summary.safetyNotes.join("\n"),
      sourceCount: detail.sources.length,
      approvedSourceCount: approvedSources.length,
      factCount: facts.length,
      timelineCount: timeline.length,
      outlineSceneCount: outline.length,
      updatedAt: new Date().toISOString()
    },
    sources: detail.sources,
    facts,
    timeline,
    hooks,
    assetRequirements,
    outline
  };

  return {
    dossierId: detail.dossier.id,
    approvedSourceCount: approvedSources.length,
    factCount: facts.length,
    timelineCount: timeline.length,
    hookCount: hooks.length,
    assetRequirementCount: assetRequirements.length,
    outlineSceneCount: outline.length,
    safetyWarnings: summary.safetyNotes,
    detail: nextDetail
  };
}

