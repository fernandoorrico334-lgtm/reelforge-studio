import type { FastCutEditorPlan } from "./fast-cut-editor.js";
import type {
  RemixSceneRole,
  RemixSceneSegment,
  RemixSceneSourceSegment,
  RemixSceneStructure
} from "./remix-scene-restructure.js";

export type FastCutMicroSegment = {
  sceneId: string;
  order: number;
  role: RemixSceneRole;
  startSeconds: number;
  endSeconds: number;
  sourceSegment: RemixSceneSourceSegment;
  transitionIn: string;
  sfx: string;
  captionHint: string;
};

function findParentSegment(
  segments: RemixSceneSegment[],
  timeSeconds: number
): RemixSceneSegment {
  const match = segments.find(
    (segment) =>
      timeSeconds >= segment.startSeconds - 0.001 &&
      timeSeconds < segment.endSeconds - 0.001
  );
  return match ?? segments[segments.length - 1] ?? segments[0]!;
}

function sfxForTime(fastCutPlan: FastCutEditorPlan, timeSeconds: number): string {
  const cues = fastCutPlan.effectCues ?? [];
  const cue = cues.find((entry) => Math.abs(entry.timeSeconds - timeSeconds) < 0.08);
  return cue?.effect ?? "whoosh";
}

function transitionForIndex(
  fastCutPlan: FastCutEditorPlan,
  index: number
): string {
  const transitions = fastCutPlan.transitionSequence ?? [];
  if (transitions.length === 0) {
    return index % 2 === 0 ? "flash-cut" : "cut";
  }

  return (
    transitions[index]?.transition ??
    transitions[index % transitions.length]?.transition ??
    "cut"
  );
}

export function shouldMaterializeFastCuts(input: {
  cutTimes: number[];
  sceneSegmentCount: number;
  targetStyle: string;
  intensity: "medium" | "extreme";
}): boolean {
  if (input.cutTimes.length < 8) return false;
  if (input.cutTimes.length <= input.sceneSegmentCount) return false;
  if (input.intensity === "extreme") return true;
  return input.targetStyle === "comics" || input.targetStyle === "hype_sports";
}

export function buildFastCutMicroSegments(input: {
  durationSeconds: number;
  cutTimes: number[];
  sceneStructure: RemixSceneStructure;
  fastCutPlan: FastCutEditorPlan;
  minShotSeconds?: number;
}): FastCutMicroSegment[] {
  const minShot = input.minShotSeconds ?? 0.35;
  const segments = input.sceneStructure.segments;
  const sortedCuts = [...new Set(input.cutTimes)]
    .filter((time) => time > 0 && time < input.durationSeconds)
    .sort((left, right) => left - right);

  const boundaries = [0, ...sortedCuts, input.durationSeconds];
  const microSegments: FastCutMicroSegment[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startSeconds = Number((boundaries[index] ?? 0).toFixed(3));
    const endSeconds = Number((boundaries[index + 1] ?? input.durationSeconds).toFixed(3));
    if (endSeconds - startSeconds < minShot) continue;

    const parent = findParentSegment(segments, startSeconds + 0.01);
    microSegments.push({
      sceneId: `fastcut-${String(index + 1).padStart(3, "0")}`,
      order: index + 1,
      role: parent.role,
      startSeconds,
      endSeconds,
      sourceSegment:
        parent.sourceSegment === "original_clip" ? "broll_overlay" : parent.sourceSegment,
      transitionIn: transitionForIndex(input.fastCutPlan, index),
      sfx: sfxForTime(input.fastCutPlan, startSeconds),
      captionHint: parent.captionHint
    });
  }

  return microSegments;
}