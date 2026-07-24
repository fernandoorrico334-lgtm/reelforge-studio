export type VoiceboxEngine = "qwen" | "qwen_custom_voice";
export type VoiceboxModelSize = "1.7B" | "0.6B";

export type TtsGenerationRequest = {
  text: string;
  language: "pt";
  engine: VoiceboxEngine;
  modelSize: VoiceboxModelSize;
  profileId: string;
  seed: number;
  instruct: string;
  normalize: false;
  maxChunkChars: number;
  crossfadeMs: number;
};

export type TtsGenerationResult = {
  audioPath: string;
  sampleRate: number;
  durationSec: number;
  seed: number;
  engine: string;
  modelSize: string;
  instruct: string;
  profileId: string;
  generationId: string;
  instructApplied: boolean;
};

export type ActingIntent = "hook" | "context" | "mystery" | "tension" | "action" | "reveal" | "payoff" | "closing";

export type ActingDirection = {
  intent: ActingIntent;
  emotion: string;
  intensity: number;
  energy: number;
  rate: number;
  emphasisWords: string[];
  endingContour: "fall" | "rise" | "suspend" | "impact";
  subtext: string;
  deliveryGoal: string;
};

export type VoiceReferenceStyle = "neutral" | "conversational" | "mystery" | "tension" | "action" | "reveal" | "emotional" | "cliffhanger";

export type VoiceReferenceSample = {
  id: string;
  profileId: string;
  audioPath: string;
  transcript: string;
  style: VoiceReferenceStyle;
  qualityScore: number;
  noiseScore: number;
  clippingDetected: boolean;
  durationSec: number;
  sha256: string;
};

export type VoiceProfile = {
  id: string;
  name: string;
  language: "pt";
  consentConfirmed: boolean;
  ownerLabel: string;
  defaultVoiceboxProfileId: string;
  voiceboxProfileIdsByStyle?: Partial<Record<VoiceReferenceStyle, string>>;
  sampleIds: string[];
};

export type SynthesisBlock = {
  id: string;
  beatIds: string[];
  text: string;
  actingDirection: ActingDirection;
  instruct: string;
  referenceSampleIds: string[];
  providerProfileId: string;
  estimatedDurationSec: number;
};

export type PerformanceVariation = "restrained" | "cinematic" | "conversational" | "urgent" | "intimate" | "impactful";

export type PlannedNarrationTake = {
  id: string;
  blockId: string;
  seed: number;
  variation: PerformanceVariation;
  instruct: string;
  referenceSampleIds: string[];
  providerProfileId: string;
};

export type TakeScore = {
  semanticAccuracy: number;
  pronunciationScore: number;
  actingMatch: number;
  naturalness: number;
  audioQuality: number;
  timbreSimilarity: number;
  pauseQuality: number;
  pitchVariation: number;
  energyVariation: number;
};

export type TransitionScore = {
  fromTakeId: string;
  toTakeId: string;
  timbreContinuity: number;
  pitchContinuity: number;
  energyContinuity: number;
  emotionalProgression: number;
  pauseCompatibility: number;
};

export type ScoredNarrationTake = PlannedNarrationTake & { audioPath: string; score: TakeScore };

export type PronunciationMemory = {
  word: string;
  engine: string;
  profileId: string;
  successfulInput: string;
  rejectedInputs: string[];
  confidence: number;
};
