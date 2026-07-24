import { ProsodyInstructionCompiler } from "./prosody-instruction-compiler.js";
import { VoiceReferenceSelector } from "./voice-reference-store.js";
import type { ActingDirection, SynthesisBlock } from "./voicebox-qwen-types.js";

export type NarrationBeatForSynthesis = {
  id: string;
  text: string;
  estimatedDurationSec: number;
  actingDirection: ActingDirection;
  storyBlockId?: string;
};

function sameFamily(left: ActingDirection, right: ActingDirection) {
  const high = (value: ActingDirection) => ["action", "reveal", "payoff"].includes(value.intent);
  return left.intent === right.intent || high(left) === high(right);
}

export function buildNarrationSynthesisBlocks(input: {
  beats: NarrationBeatForSynthesis[];
  profileId: string;
  compiler: ProsodyInstructionCompiler;
  referenceSelector: VoiceReferenceSelector;
}): SynthesisBlock[] {
  if (!input.beats.length) return [];
  const groups: NarrationBeatForSynthesis[][] = [];
  for (const beat of input.beats) {
    const current = groups.at(-1);
    const duration = current?.reduce((sum, item) => sum + item.estimatedDurationSec, 0) ?? 0;
    const storyBoundary = Boolean(current?.length && beat.storyBlockId && current[0]?.storyBlockId !== beat.storyBlockId);
    const shouldBreak = Boolean(current?.length && (storyBoundary || duration + beat.estimatedDurationSec > 20 || (!sameFamily(current.at(-1)!.actingDirection, beat.actingDirection) && duration >= 8)));
    if (!current || shouldBreak) groups.push([beat]);
    else current.push(beat);
  }
  return groups.map((group, index) => {
    const direction = group.reduce((best, beat) => beat.actingDirection.intensity > best.intensity ? beat.actingDirection : best, group[0]!.actingDirection);
    const references = input.referenceSelector.select({ profileId: input.profileId, intent: direction.intent });
    return {
      id: `synthesis-block-${String(index + 1).padStart(2, "0")}`,
      beatIds: group.map((beat) => beat.id),
      text: group.map((beat) => beat.text.trim()).join(" "),
      actingDirection: direction,
      instruct: input.compiler.compile(direction),
      referenceSampleIds: references.samples.map((sample) => sample.id),
      providerProfileId: references.providerProfileId,
      estimatedDurationSec: Number(group.reduce((sum, beat) => sum + beat.estimatedDurationSec, 0).toFixed(3)),
    };
  });
}

