import type { MediaBeastCandidate, MediaBeastNiche } from "../providers/types.js";
import type { ChannelDNA } from "../scheduler/channel-dna.js";
import {
  hasConcreteCuriosity,
  type NarrationBeatDraft,
  type NarrationContentContext,
  type VideoNarrationHints
} from "./narration-curiosity-engine.js";
import type {
  RemixContentDomain,
  RemixEntityType,
  RemixStructuredContentDescription
} from "./remix-content-intelligence.js";
import type { RemixSceneRole } from "./remix-scene-restructure.js";
import type { RemixResearchDossier } from "./remix-research-bridge.js";
import type { RemixTargetStyle } from "./remix-types.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";

const NICHE_TO_TARGET_STYLE: Record<MediaBeastNiche, RemixTargetStyle> = {
  cinema: "dark_cinematic",
  comics: "comics",
  anime: "anime",
  true_crime: "true_crime",
  vintage_football: "vintage_football",
  bodybuilding: "bodybuilding",
  history: "documentary",
  science_curiosities: "documentary",
  generic_broll: "generic"
};

const NICHE_TO_DOMAIN: Record<MediaBeastNiche, RemixContentDomain> = {
  cinema: "horror",
  comics: "comics_superhero",
  anime: "anime",
  true_crime: "true_crime",
  vintage_football: "sports",
  bodybuilding: "generic",
  history: "documentary",
  science_curiosities: "science",
  generic_broll: "generic"
};

const HINT_DOMAIN_TO_TARGET: Partial<Record<RemixContentDomain, RemixTargetStyle>> = {
  comics_superhero: "comics",
  anime: "anime",
  true_crime: "true_crime",
  sports: "vintage_football",
  horror: "horror",
  documentary: "documentary",
  science: "documentary",
  gaming: "anime",
  generic: "generic"
};

function metadataString(
  metadata: MediaBeastCandidate["metadata"],
  key: string
): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectEntityNames(
  narrationContext: NarrationContentContext,
  videoHints: VideoNarrationHints | null
): string[] {
  const names = new Set<string>();
  if (narrationContext.primaryEntity) names.add(narrationContext.primaryEntity);
  for (const entity of narrationContext.secondaryEntities) {
    if (entity.trim()) names.add(entity.trim());
  }
  for (const entity of videoHints?.entities ?? []) {
    if (entity.trim()) names.add(entity.trim());
  }
  return [...names];
}

function inferEntityType(name: string, domain: RemixContentDomain): RemixEntityType {
  const lower = name.toLowerCase();
  if (domain === "comics_superhero" || domain === "anime" || domain === "gaming") {
    return "character";
  }
  if (domain === "sports") return "team";
  if (domain === "true_crime" || domain === "documentary") return "person";
  if (/\b(time|clube|fc)\b/i.test(lower)) return "team";
  return "character";
}

function toSceneRole(role: string): RemixSceneRole {
  const normalized = role.toLowerCase();
  if (normalized === "hook") return "hook";
  if (normalized === "climax") return "climax";
  if (normalized === "tension") return "tension";
  if (normalized === "cta" || normalized === "outro") return "outro";
  if (normalized === "evidence") return "evidence";
  return "context";
}

function buildEntities(
  names: string[],
  domain: RemixContentDomain
): RemixStructuredContentDescription["entities"] {
  return names.map((name, index) => ({
    id: `candidate-entity-${index}`,
    name,
    type: inferEntityType(name, domain),
    confidence: "high" as const,
    aliases: []
  }));
}

function buildSceneInsights(
  legacyBeats: NarrationBeatDraft[],
  videoHints: VideoNarrationHints | null,
  entities: string[]
): RemixStructuredContentDescription["sceneInsights"] {
  if (videoHints?.sceneAngles?.length) {
    return videoHints.sceneAngles.map((scene, index) => ({
      sceneId: `scene-${index + 1}`,
      order: index,
      role: toSceneRole(scene.role),
      focusEntity: scene.focusEntity ?? entities[0] ?? null,
      focusAction: videoHints.primaryAction ?? null,
      visualHint: scene.visualHint ?? scene.angle ?? "visual do assunto",
      narrationAngle: scene.angle ?? scene.visualHint ?? "ângulo editorial",
      energy: "medium" as const
    }));
  }

  const roleMap: Record<NarrationBeatDraft["role"], RemixSceneRole> = {
    hook: "hook",
    context: "context",
    tension: "tension",
    climax: "climax",
    cta: "outro"
  };

  return legacyBeats.map((beat, index) => ({
    sceneId: `legacy-${beat.role}-${index}`,
    order: index,
    role: roleMap[beat.role],
    focusEntity: entities[0] ?? null,
    focusAction: videoHints?.primaryAction ?? null,
    visualHint: beat.caption || beat.text.split(/\s+/).slice(0, 6).join(" "),
    narrationAngle: beat.curiosityTag || beat.role,
    energy: beat.role === "hook" || beat.role === "climax" ? ("high" as const) : ("medium" as const)
  }));
}

export function resolveTargetStyleFromNiche(
  niche: MediaBeastNiche | "generic",
  videoHints?: VideoNarrationHints | null
): RemixTargetStyle {
  if (videoHints?.domain) {
    return HINT_DOMAIN_TO_TARGET[videoHints.domain] ?? "documentary";
  }
  if (niche === "generic") return "generic";
  return NICHE_TO_TARGET_STYLE[niche] ?? "documentary";
}

export function buildRetentionContextFromCandidate(input: {
  candidate: MediaBeastCandidate;
  channelDNA: ChannelDNA;
  narrationContext: NarrationContentContext;
  legacyBeats: NarrationBeatDraft[];
  researchDossier?: RemixResearchDossier | null;
  maxDurationSeconds?: number;
}): VideoRemixAnalysis {
  const videoHints = input.narrationContext.videoHints;
  const contextNiche = input.narrationContext.niche;
  const resolvedNiche: MediaBeastNiche =
    contextNiche === "generic" ? input.channelDNA.niche : contextNiche;
  const domain =
    videoHints?.domain ?? NICHE_TO_DOMAIN[resolvedNiche] ?? "generic";

  const entityNames = collectEntityNames(input.narrationContext, videoHints);
  const climaxBeat = input.legacyBeats.find((beat) => beat.role === "climax");
  const tensionBeat = input.legacyBeats.find((beat) => beat.role === "tension");
  const hookBeat = input.legacyBeats.find((beat) => beat.role === "hook");

  const themeSummary =
    videoHints?.themeSummary ??
    videoHints?.summary ??
    metadataString(input.candidate.metadata, "remixThemeSummary") ??
    input.candidate.reasons[0] ??
    input.candidate.title;

  const curiosityAngle =
    videoHints?.curiosityAngle ??
    metadataString(input.candidate.metadata, "remixCuriosityAngle") ??
    (climaxBeat && hasConcreteCuriosity(climaxBeat.text) ? climaxBeat.text : null) ??
    (tensionBeat?.text.trim() || themeSummary);

  const narrativeBrief =
    videoHints?.narrativeBrief ??
    metadataString(input.candidate.metadata, "remixNarrativeBrief") ??
    themeSummary;

  const narrativeHook =
    videoHints?.narrativeHook ??
    metadataString(input.candidate.metadata, "remixNarrativeHook") ??
    hookBeat?.text ??
    input.candidate.title;

  const headline =
    videoHints?.headline ??
    metadataString(input.candidate.metadata, "remixContentHeadline") ??
    input.candidate.title;

  const primaryAction =
    videoHints?.primaryAction ??
    metadataString(input.candidate.metadata, "remixPrimaryAction") ??
    tensionBeat?.curiosityTag;

  const contextKeywords = [
    ...entityNames.map((name) => name.toLowerCase()),
    ...(videoHints?.contextKeywords ?? []),
    resolvedNiche,
    domain
  ].filter((entry, index, arr) => entry && arr.indexOf(entry) === index);

  const entities = buildEntities(
    entityNames.length > 0 ? entityNames : [input.narrationContext.subject],
    domain
  );

  const actions = primaryAction
    ? [
        {
          id: "candidate-action-0",
          label: primaryAction,
          verb: videoHints?.primaryActionVerb ?? "mostrar",
          confidence: "high" as const
        }
      ]
    : [];

  const sceneInsights = buildSceneInsights(input.legacyBeats, videoHints, entityNames);
  const duration = input.maxDurationSeconds ?? input.narrationContext.targetDurationSeconds;

  const contentIntelligence: RemixStructuredContentDescription = {
    headline,
    summary: themeSummary,
    narrativeBrief,
    narrativeHook,
    curiosityAngle,
    domain,
    entities,
    actions,
    setting: videoHints?.setting ?? null,
    mood: videoHints?.mood ?? input.narrationContext.emotion,
    differentiationGoals: ["retenção", "oralidade pt-br", "curiosidade concreta"],
    sceneInsights,
    visualSearchQueries: sceneInsights.map((scene) => scene.visualHint).slice(0, 4),
    comfyPromptFragments: entityNames.slice(0, 3),
    analysisVersion: "phase2-v2"
  };

  return {
    sourceDurationSeconds: duration,
    outputDurationSeconds: duration,
    probeMethod: "estimated",
    platform:
      input.narrationContext.platformHint === "youtube"
        ? "youtube"
        : input.narrationContext.platformHint === "tiktok"
          ? "tiktok"
          : "local",
    title: input.candidate.title,
    themeSummary,
    contextKeywords,
    mainScenes: [],
    narrativeArc: [themeSummary, curiosityAngle].filter(Boolean),
    analysisNotes: ["contexto sintetizado a partir de candidate + narration overlay"],
    contentIntelligence,
    researchDossier: input.researchDossier ?? null
  };
}