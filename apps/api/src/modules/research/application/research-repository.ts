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
  UpdateResearchAssetRequirementInput,
  UpdateResearchDossierInput,
  UpdateResearchSourceInput
} from "../domain/research.js";

export interface ResearchRepository {
  listDossiers(): Promise<ResearchDossier[]>;
  getDossierById(id: string): Promise<ResearchDossierDetail | null>;
  createDossier(input: CreateResearchDossierInput): Promise<ResearchDossier>;
  updateDossier(
    id: string,
    input: UpdateResearchDossierInput
  ): Promise<ResearchDossier | null>;
  deleteDossier(id: string): Promise<boolean>;
  listSources(dossierId: string): Promise<ResearchSource[]>;
  getSourceById(id: string): Promise<ResearchSource | null>;
  createSource(input: CreateResearchSourceInput): Promise<ResearchSource>;
  updateSource(
    id: string,
    input: UpdateResearchSourceInput
  ): Promise<ResearchSource | null>;
  listFacts(dossierId: string): Promise<ResearchFact[]>;
  listTimelineEvents(dossierId: string): Promise<ResearchTimelineEvent[]>;
  listHooks(dossierId: string): Promise<ResearchHook[]>;
  getAssetRequirementById(id: string): Promise<ResearchAssetRequirement | null>;
  listAssetRequirements(dossierId: string): Promise<ResearchAssetRequirement[]>;
  updateAssetRequirement(
    id: string,
    input: UpdateResearchAssetRequirementInput
  ): Promise<ResearchAssetRequirement | null>;
  listOutlineScenes(dossierId: string): Promise<ResearchOutlineScene[]>;
  replaceAnalysis(
    dossierId: string,
    input: ReplaceResearchArtifactsInput
  ): Promise<ResearchDossierDetail | null>;
}

