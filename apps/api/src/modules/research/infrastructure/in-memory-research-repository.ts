import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
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

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function sortOutline<T extends { order: number }>(items: T[]) {
  return [...items].sort((left, right) => left.order - right.order);
}

export function createInMemoryResearchRepository(): ResearchRepository {
  const state = getMemoryStudioState();

  function mapSource(sourceId: string): ResearchSource | null {
    const source = state.researchSources.find((entry) => entry.id === sourceId);

    return source ? { ...source } : null;
  }

  function mapAssetRequirement(requirementId: string): ResearchAssetRequirement | null {
    const requirement = state.researchAssetRequirements.find(
      (entry) => entry.id === requirementId
    );

    if (!requirement) {
      return null;
    }

    return {
      ...requirement,
      suggestedTags: [...requirement.suggestedTags],
      fulfilledAsset: requirement.fulfilledAssetId
        ? state.assets.find((asset) => asset.id === requirement.fulfilledAssetId) ?? null
        : null,
      generatedAsset: requirement.generatedAssetId
        ? state.assets.find((asset) => asset.id === requirement.generatedAssetId) ?? null
        : null,
      mediaCollections: state.mediaCollections.filter(
        (collection) => collection.assetRequirementId === requirement.id
      )
    };
  }

  function listMappedSources(dossierId: string) {
    return sortByCreatedAtDesc(
      state.researchSources
        .filter((source) => source.dossierId === dossierId)
        .map((source) => ({ ...source }))
    );
  }

  function listMappedFacts(dossierId: string): ResearchFact[] {
    return sortByCreatedAtDesc(
      state.researchFacts
        .filter((fact) => fact.dossierId === dossierId)
        .map((fact) => ({
          ...fact,
          people: [...fact.people],
          places: [...fact.places],
          tags: [...fact.tags],
          source: fact.sourceId ? mapSource(fact.sourceId) : null
        }))
    );
  }

  function listMappedTimelineEvents(dossierId: string): ResearchTimelineEvent[] {
    return [
      ...state.researchTimelineEvents
        .filter((event) => event.dossierId === dossierId)
        .map((event) => ({
          ...event,
          people: [...event.people],
          source: event.sourceId ? mapSource(event.sourceId) : null
        }))
    ].sort((left, right) => {
      const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });
  }

  function listMappedHooks(dossierId: string): ResearchHook[] {
    return sortByCreatedAtDesc(
      state.researchHooks
        .filter((hook) => hook.dossierId === dossierId)
        .map((hook) => ({ ...hook }))
    );
  }

  function listMappedAssetRequirements(dossierId: string): ResearchAssetRequirement[] {
    return sortByCreatedAtDesc(
      state.researchAssetRequirements
        .filter((requirement) => requirement.dossierId === dossierId)
        .map((requirement) => mapAssetRequirement(requirement.id))
        .filter(
          (requirement): requirement is ResearchAssetRequirement => requirement !== null
        )
    );
  }

  function listMappedOutlineScenes(dossierId: string): ResearchOutlineScene[] {
    return sortOutline(
      state.researchOutlineScenes
        .filter((scene) => scene.dossierId === dossierId)
        .map((scene) => ({
          ...scene,
          assetRequirement: scene.assetRequirementId
            ? mapAssetRequirement(scene.assetRequirementId)
            : null
        }))
    );
  }

  function mapDossier(dossierId: string): ResearchDossier | null {
    const dossier = state.researchDossiers.find((entry) => entry.id === dossierId);

    if (!dossier) {
      return null;
    }

    const sources = state.researchSources.filter((source) => source.dossierId === dossier.id);
    const facts = state.researchFacts.filter((fact) => fact.dossierId === dossier.id);
    const timeline = state.researchTimelineEvents.filter(
      (event) => event.dossierId === dossier.id
    );
    const outline = state.researchOutlineScenes.filter(
      (scene) => scene.dossierId === dossier.id
    );

    return {
      ...dossier,
      channel: dossier.channelId
        ? state.channels.find((channel) => channel.id === dossier.channelId) ?? null
        : null,
      sourceCount: sources.length,
      approvedSourceCount: sources.filter(
        (source) => source.status === "approved" || source.status === "imported"
      ).length,
      factCount: facts.length,
      timelineCount: timeline.length,
      outlineSceneCount: outline.length
    };
  }

  function mapDossierDetail(dossierId: string): ResearchDossierDetail | null {
    const dossier = mapDossier(dossierId);

    if (!dossier) {
      return null;
    }

    return {
      dossier,
      sources: listMappedSources(dossierId),
      facts: listMappedFacts(dossierId),
      timeline: listMappedTimelineEvents(dossierId),
      hooks: listMappedHooks(dossierId),
      assetRequirements: listMappedAssetRequirements(dossierId),
      outline: listMappedOutlineScenes(dossierId)
    };
  }

  function clearAnalysis(dossierId: string) {
    state.researchFacts = state.researchFacts.filter((fact) => fact.dossierId !== dossierId);
    state.researchTimelineEvents = state.researchTimelineEvents.filter(
      (event) => event.dossierId !== dossierId
    );
    state.researchHooks = state.researchHooks.filter((hook) => hook.dossierId !== dossierId);
    state.researchOutlineScenes = state.researchOutlineScenes.filter(
      (scene) => scene.dossierId !== dossierId
    );
    state.researchAssetRequirements = state.researchAssetRequirements.filter(
      (requirement) => requirement.dossierId !== dossierId
    );
  }

  return {
    async listDossiers() {
      return sortByCreatedAtDesc(
        state.researchDossiers
          .map((dossier) => mapDossier(dossier.id))
          .filter((dossier): dossier is ResearchDossier => dossier !== null)
      );
    },
    async getDossierById(id) {
      return mapDossierDetail(id);
    },
    async createDossier(input: CreateResearchDossierInput) {
      const timestamp = createTimestamp();
      const dossier = {
        id: createMemoryId("dossier"),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...input
      };

      state.researchDossiers.unshift(dossier);
      return mapDossier(dossier.id) as ResearchDossier;
    },
    async updateDossier(id: string, input: UpdateResearchDossierInput) {
      const index = state.researchDossiers.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return null;
      }

      const existing = state.researchDossiers[index];

      if (!existing) {
        return null;
      }

      state.researchDossiers[index] = {
        ...existing,
        ...input,
        updatedAt: createTimestamp()
      };

      return mapDossier(id);
    },
    async deleteDossier(id: string) {
      const index = state.researchDossiers.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return false;
      }

      state.researchDossiers.splice(index, 1);
      state.researchSources = state.researchSources.filter((entry) => entry.dossierId !== id);
      clearAnalysis(id);
      return true;
    },
    async listSources(dossierId: string) {
      return listMappedSources(dossierId);
    },
    async getSourceById(id: string) {
      return mapSource(id);
    },
    async createSource(input: CreateResearchSourceInput) {
      const timestamp = createTimestamp();
      const source = {
        id: createMemoryId("research-source"),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...input
      };

      state.researchSources.unshift(source);
      return { ...source };
    },
    async updateSource(id: string, input: UpdateResearchSourceInput) {
      const index = state.researchSources.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return null;
      }

      const existing = state.researchSources[index];

      if (!existing) {
        return null;
      }

      state.researchSources[index] = {
        ...existing,
        ...input,
        updatedAt: createTimestamp()
      };

      return mapSource(id);
    },
    async listFacts(dossierId: string) {
      return listMappedFacts(dossierId);
    },
    async listTimelineEvents(dossierId: string) {
      return listMappedTimelineEvents(dossierId);
    },
    async listHooks(dossierId: string) {
      return listMappedHooks(dossierId);
    },
    async getAssetRequirementById(id: string) {
      return mapAssetRequirement(id);
    },
    async listAssetRequirements(dossierId: string) {
      return listMappedAssetRequirements(dossierId);
    },
    async updateAssetRequirement(id, input) {
      const index = state.researchAssetRequirements.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return null;
      }

      const existing = state.researchAssetRequirements[index];

      if (!existing) {
        return null;
      }

      state.researchAssetRequirements[index] = {
        ...existing,
        ...input,
        fulfilledAssetId:
          "fulfilledAssetId" in input
            ? input.fulfilledAssetId ?? null
            : existing.fulfilledAssetId,
        visualSourceMode:
          "visualSourceMode" in input
            ? input.visualSourceMode ?? null
            : existing.visualSourceMode,
        characterProfileId:
          "characterProfileId" in input
            ? input.characterProfileId ?? null
            : existing.characterProfileId,
        generatedAssetId:
          "generatedAssetId" in input
            ? input.generatedAssetId ?? null
            : existing.generatedAssetId,
        visualPrompt:
          "visualPrompt" in input ? input.visualPrompt ?? null : existing.visualPrompt,
        generationStatus:
          "generationStatus" in input
            ? input.generationStatus ?? null
            : existing.generationStatus,
        generationProvider:
          "generationProvider" in input
            ? input.generationProvider ?? null
            : existing.generationProvider,
        updatedAt: createTimestamp()
      };

      return mapAssetRequirement(id);
    },
    async listOutlineScenes(dossierId: string) {
      return listMappedOutlineScenes(dossierId);
    },
    async replaceAnalysis(dossierId: string, input: ReplaceResearchArtifactsInput) {
      const dossierIndex = state.researchDossiers.findIndex((entry) => entry.id === dossierId);

      if (dossierIndex === -1) {
        return null;
      }

      const dossier = state.researchDossiers[dossierIndex];

      if (!dossier) {
        return null;
      }

      state.researchDossiers[dossierIndex] = {
        ...dossier,
        ...input.dossierPatch,
        updatedAt: createTimestamp()
      };

      clearAnalysis(dossierId);

      const requirementIdByRef = new Map<string, string>();

      for (const requirementInput of input.assetRequirements) {
        const requirementId = createMemoryId("research-requirement");
        const timestamp = createTimestamp();

        state.researchAssetRequirements.unshift({
          id: requirementId,
          dossierId,
          sceneRole: requirementInput.sceneRole ?? null,
          description: requirementInput.description,
          mediaType: requirementInput.mediaType,
          suggestedTags: [...requirementInput.suggestedTags],
          emotion: requirementInput.emotion ?? null,
          priority: requirementInput.priority ?? null,
          fulfilledAssetId: requirementInput.fulfilledAssetId ?? null,
          visualSourceMode: requirementInput.visualSourceMode ?? null,
          characterProfileId: requirementInput.characterProfileId ?? null,
          generatedAssetId: requirementInput.generatedAssetId ?? null,
          visualPrompt: requirementInput.visualPrompt ?? null,
          generationStatus: requirementInput.generationStatus ?? null,
          generationProvider: requirementInput.generationProvider ?? null,
          createdAt: timestamp,
          updatedAt: timestamp
        });

        if (requirementInput.ref) {
          requirementIdByRef.set(requirementInput.ref, requirementId);
        }
      }

      for (const factInput of input.facts) {
        const timestamp = createTimestamp();

        state.researchFacts.unshift({
          id: createMemoryId("research-fact"),
          dossierId,
          sourceId: factInput.sourceId ?? null,
          claim: factInput.claim,
          factType: factInput.factType,
          confidence: factInput.confidence,
          dateValue: factInput.dateValue ?? null,
          people: [...factInput.people],
          places: [...factInput.places],
          tags: [...factInput.tags],
          notes: factInput.notes ?? null,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      for (const timelineInput of input.timelineEvents) {
        const timestamp = createTimestamp();

        state.researchTimelineEvents.push({
          id: createMemoryId("research-timeline"),
          dossierId,
          sourceId: timelineInput.sourceId ?? null,
          title: timelineInput.title,
          description: timelineInput.description,
          dateValue: timelineInput.dateValue ?? null,
          order: timelineInput.order ?? null,
          location: timelineInput.location ?? null,
          people: [...timelineInput.people],
          confidence: timelineInput.confidence,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      for (const hookInput of input.hooks) {
        const timestamp = createTimestamp();

        state.researchHooks.unshift({
          id: createMemoryId("research-hook"),
          dossierId,
          text: hookInput.text,
          hookType: hookInput.hookType,
          strengthScore: hookInput.strengthScore ?? null,
          notes: hookInput.notes ?? null,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      for (const outlineInput of input.outlineScenes) {
        const timestamp = createTimestamp();

        state.researchOutlineScenes.push({
          id: createMemoryId("research-outline"),
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
          estimatedDuration: outlineInput.estimatedDuration ?? null,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      return mapDossierDetail(dossierId);
    }
  };
}
