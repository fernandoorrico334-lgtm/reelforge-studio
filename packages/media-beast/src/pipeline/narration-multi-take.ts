import { ProsodyInstructionCompiler } from "./prosody-instruction-compiler.js";
import type { PerformanceVariation, PlannedNarrationTake, SynthesisBlock } from "./voicebox-qwen-types.js";

const VARIATIONS: Record<SynthesisBlock["actingDirection"]["intent"], PerformanceVariation[]> = {
  hook: ["cinematic", "conversational", "urgent", "intimate", "impactful", "restrained"],
  context: ["conversational", "restrained"],
  mystery: ["restrained", "intimate", "cinematic", "conversational"],
  tension: ["restrained", "cinematic", "urgent", "intimate"],
  action: ["urgent", "cinematic", "impactful", "restrained"],
  reveal: ["cinematic", "impactful", "restrained", "intimate", "urgent", "conversational"],
  payoff: ["impactful", "cinematic", "restrained", "intimate", "conversational"],
  closing: ["intimate", "cinematic", "restrained", "impactful", "conversational", "urgent"],
};

const COUNT: Record<SynthesisBlock["actingDirection"]["intent"], number> = {
  hook: 6, context: 2, mystery: 4, tension: 4, action: 4, reveal: 6, payoff: 5, closing: 6,
};

export class MultiTakePlanner {
  constructor(private readonly compiler = new ProsodyInstructionCompiler()) {}

  plan(block: SynthesisBlock, baseSeed: number): PlannedNarrationTake[] {
    const variations = VARIATIONS[block.actingDirection.intent];
    return Array.from({ length: COUNT[block.actingDirection.intent] }, (_, index) => {
      const variation = variations[index % variations.length]!;
      return {
        id: `${block.id}-take-${index + 1}`,
        blockId: block.id,
        seed: baseSeed + index * 1009,
        variation,
        instruct: this.compiler.compile(block.actingDirection, variation),
        referenceSampleIds: [...block.referenceSampleIds],
        providerProfileId: block.providerProfileId,
      };
    });
  }
}
export type NarrationTakeGenerationResult = PlannedNarrationTake & {
  audioPath: string;
  generationId: string;
  engine: string;
  modelSize: string;
};

export class MultiTakeGenerator {
  async generate(input: {
    block: SynthesisBlock;
    takes: PlannedNarrationTake[];
    generateTake: (request: {
      text: string;
      profileId: string;
      seed: number;
      instruct: string;
      takeId: string;
    }) => Promise<{ audioPath: string; generationId: string; engine: string; modelSize: string }>;
  }): Promise<NarrationTakeGenerationResult[]> {
    const results: NarrationTakeGenerationResult[] = [];
    for (const take of input.takes) {
      const generated = await input.generateTake({
        text: input.block.text,
        profileId: take.providerProfileId,
        seed: take.seed,
        instruct: take.instruct,
        takeId: take.id,
      });
      results.push({ ...take, ...generated });
    }
    return results;
  }
}
