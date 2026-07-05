export interface ProductionDiscoveryNicheProfile {
  id: string;
  name: string;
  description: string;
  defaultTemplates: string[];
  defaultTone: string;
  mediaNeeds: string[];
  safetyRules: string[];
  recommendedWorkflowPackId: string;
  recommendedMusicPresetId: string;
  recommendedAudioMasteringPresetId: string;
}

export interface ProductionDiscoveryPackage {
  id: string;
  topic: string;
  niche: string;
  title: string;
  angle: string | null;
  language: string;
  tone: string | null;
  targetDurationSeconds: number | null;
  status: string;
  researchDossierId: string | null;
  mediaCollectionIds: string[];
  suggestedTemplateId: string | null;
  suggestedEditingReferencePresetId: string | null;
  suggestedMusicPresetId: string | null;
  suggestedAudioMasteringPresetId: string | null;
  suggestedWorkflowPackId: string | null;
  summary: string | null;
  outline: Record<string, unknown>[];
  assetRequirements: Record<string, unknown>[];
  mediaCandidatesSummary: Record<string, unknown>[];
  warnings: string[];
  createdProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionDiscoveryCreatePayload {
  topic: string;
  niche: string;
  angle: string;
  language: string;
  tone: string;
  targetDurationSeconds: number;
}
