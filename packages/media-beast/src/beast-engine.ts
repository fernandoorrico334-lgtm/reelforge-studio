import { assertCandidateFirstSafety } from "./compliance/risk-policy.js";
import { buildFastCutEditorPlan } from "./pipeline/fast-cut-editor.js";
import {
  buildChannelNarrationOverlay,
  buildNarrationOverlayPlan
} from "./pipeline/narration-overlay.js";
import { buildMediaBeastTransformPlan } from "./pipeline/transform-pipeline.js";
import { generatePremiumReel } from "./pipeline/premium-reel-producer.js";
import {
  remixExistingVideo,
  remixVideoFromSource,
  type VideoRemixOptions,
  type VideoRemixSourceInput
} from "./pipeline/video-remixer.js";
import {
  buildVisualTransformerPlan,
  transformVisual
} from "./pipeline/visual-transformer.js";
import { enrichAndScoreCandidates } from "./discovery/candidate-enrichment.js";
import { listMediaBeastProviders } from "./providers/index.js";
import { buildKeywordBase, extractKeywordsFromQuery } from "./providers/provider-utils.js";
import type {
  MediaBeastCandidate,
  MediaBeastNiche,
  MediaBeastProviderId,
  MediaBeastSearchQuery
} from "./providers/types.js";
import { createChannelDNA, type ChannelDNA } from "./scheduler/channel-dna.js";
import {
  generateDailyBatch,
  planDailyBeastProduction
} from "./scheduler/daily-beast-producer.js";

export interface MediaBeastRunInput extends MediaBeastSearchQuery {
  providerIds?: MediaBeastProviderId[];
  enrichCandidates?: boolean;
  minCandidateScore?: number;
}

export interface MediaBeastRunResult {
  query: MediaBeastSearchQuery;
  candidates: MediaBeastCandidate[];
  safetyReview: ReturnType<typeof assertCandidateFirstSafety>;
  transformPlans: ReturnType<typeof buildMediaBeastTransformPlan>[];
  warnings: string[];
}

export interface BeastModeDiscoveryInput {
  query: string;
  niches: MediaBeastNiche[];
  targetCount: number;
  language?: string;
  providerIds?: MediaBeastProviderId[];
}

export interface BeastModeDiscoveryResult {
  candidates: MediaBeastCandidate[];
  safetyReview: ReturnType<typeof assertCandidateFirstSafety>;
  transformPlans: ReturnType<typeof buildMediaBeastTransformPlan>[];
  dailyProductionPlan: ReturnType<typeof planDailyBeastProduction>;
  warnings: string[];
}

export interface BeastReelTransformResult {
  candidate: MediaBeastCandidate;
  channelDNA: ChannelDNA;
  safetyReview: ReturnType<typeof assertCandidateFirstSafety>[number];
  transformPlan: ReturnType<typeof buildMediaBeastTransformPlan>;
  visualPlan: ReturnType<typeof buildVisualTransformerPlan>;
  narrationPlan: ReturnType<typeof buildNarrationOverlayPlan>;
  fastCutPlan: ReturnType<typeof buildFastCutEditorPlan>;
  renderEligibility: {
    canRenderAutomatically: false;
    canRenderAfterManualApproval: boolean;
    reason: string;
  };
}

export interface BeastDiscoverAndTransformResult extends BeastModeDiscoveryResult {
  channelDNA: ChannelDNA;
  reelPlans: BeastReelTransformResult[];
  dailyBatch: ReturnType<typeof generateDailyBatch>;
}

export class MediaBeastEngine {
  async discover(input: MediaBeastRunInput): Promise<MediaBeastRunResult> {
    const enabledProviders = listMediaBeastProviders().filter((provider) => {
      if (!provider.descriptor.enabled) {
        return false;
      }

      if (!input.providerIds || input.providerIds.length === 0) {
        return true;
      }

      return input.providerIds.includes(provider.descriptor.id);
    });

    const candidateGroups = await Promise.all(
      enabledProviders.map((provider) => provider.searchCandidates(input))
    );
    const rawCandidates = candidateGroups.flat();
    const shouldEnrich = input.enrichCandidates !== false;
    const enrichment = shouldEnrich
      ? await enrichAndScoreCandidates(rawCandidates, {
          query: buildKeywordBase(input),
          minScore: input.minCandidateScore ?? 12,
          enrichRemote: true
        })
      : {
          candidates: rawCandidates.sort((left, right) => right.score - left.score),
          warnings: [] as string[]
        };
    const candidates = enrichment.candidates;

    return {
      query: input,
      candidates,
      safetyReview: assertCandidateFirstSafety(candidates),
      transformPlans: candidates.map((candidate) =>
        buildMediaBeastTransformPlan(candidate)
      ),
      warnings: [
        "Media Beast V1 is discovery and planning only.",
        "No provider auto-downloads or imports media.",
        "Do not use transformation to bypass platform policies, content fingerprints, bans or copyright systems.",
        "Scale targets such as many channels per day require rights-safe asset supply, review queues and platform-compliant publishing.",
        ...enrichment.warnings
      ]
    };
  }

  async discoverAndPlan(
    query: string,
    niches: MediaBeastNiche[],
    targetCount: number
  ): Promise<BeastModeDiscoveryResult>;
  async discoverAndPlan(
    input: BeastModeDiscoveryInput
  ): Promise<BeastModeDiscoveryResult>;
  async discoverAndPlan(
    queryOrInput: string | BeastModeDiscoveryInput,
    niches: MediaBeastNiche[] = ["generic_broll"],
    targetCount = 10
  ): Promise<BeastModeDiscoveryResult> {
    const input =
      typeof queryOrInput === "string"
        ? {
            query: queryOrInput,
            niches,
            targetCount
          }
        : queryOrInput;
    const keywords = extractKeywordsFromQuery(input.query);

    const runs = await Promise.all(
      input.niches.map((niche) => {
        const runInput: MediaBeastRunInput = {
          niche,
          keywords,
          language: input.language ?? "pt-BR",
          maxCandidates: Math.max(3, Math.ceil(input.targetCount / input.niches.length)),
          enrichCandidates: true,
          minCandidateScore: 10
        };

        if (input.providerIds) {
          runInput.providerIds = input.providerIds;
        }

        return this.discover(runInput);
      })
    );

    const candidates = runs
      .flatMap((run) => run.candidates)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.targetCount);
    const safetyReview = assertCandidateFirstSafety(candidates);
    const transformPlans = candidates.map((candidate) =>
      buildMediaBeastTransformPlan(candidate)
    );
    const channels = input.niches.map((niche, index) =>
      createChannelDNA({
        id: `beast-channel-${index + 1}`,
        name: `Beast ${niche.replace(/_/g, " ")}`,
        niche,
        dailyShortTarget: 5
      })
    );

    return {
      candidates,
      safetyReview,
      transformPlans,
      dailyProductionPlan: planDailyBeastProduction({
        date: new Date().toISOString().slice(0, 10),
        channels,
        candidates
      }),
      warnings: [
        "Beast Mode increases planning coverage, not automatic copying.",
        "All providers remain candidate-first; final render requires manual source approval.",
        "Variation and fast-cut plans are for original/editorial polish, not policy evasion."
      ]
    };
  }

  generatePremiumReel(
    candidate: MediaBeastCandidate,
    channelDNA: ChannelDNA,
    options?: {
      intensity?: "medium" | "extreme";
      durationSeconds?: number;
    }
  ) {
    return generatePremiumReel({
      candidate,
      channelDNA,
      ...options
    });
  }

  async remixExistingVideo(inputVideoPath: string, options: VideoRemixOptions) {
    return remixExistingVideo(inputVideoPath, options);
  }

  async remixVideoFromSource(source: VideoRemixSourceInput, options: VideoRemixOptions) {
    return remixVideoFromSource(source, options);
  }

  transformForReel(
    candidate: MediaBeastCandidate,
    channelDNA: ChannelDNA,
    intensity?: "medium" | "extreme"
  ): BeastReelTransformResult {
    const safetyReview = assertCandidateFirstSafety([candidate])[0];
    const canRenderAfterManualApproval =
      Boolean(safetyReview?.allowedForManualReview) &&
      safetyReview?.riskLevel !== "blocked";
    const visualPlan = transformVisual(
      candidate,
      channelDNA,
      intensity ?? (channelDNA.riskTolerance === "low" ? "medium" : "extreme")
    );

    return {
      candidate,
      channelDNA,
      safetyReview: safetyReview ?? {
        candidateId: candidate.id,
        providerId: candidate.providerId,
        allowedForAutoImport: false,
        allowedForManualReview: false,
        riskLevel: "blocked",
        requiredActions: ["Review candidate risk policy."],
        notes: ["Risk policy did not return a decision."]
      },
      transformPlan: buildMediaBeastTransformPlan(candidate),
      visualPlan,
      narrationPlan: buildChannelNarrationOverlay(candidate, channelDNA, 35),
      fastCutPlan: buildFastCutEditorPlan({
        durationSeconds: 35,
        energy: channelDNA.niche === "vintage_football" ? "extreme" : "high",
        visualPlan,
        emotion:
          channelDNA.niche === "vintage_football"
            ? "hype"
            : channelDNA.niche === "true_crime"
              ? "dark"
              : "curious"
      }),
      renderEligibility: {
        canRenderAutomatically: false,
        canRenderAfterManualApproval,
        reason: canRenderAfterManualApproval
          ? "Candidate can feed a render plan only after manual source approval."
          : "Candidate is blocked or needs replacement before render."
      }
    };
  }

  async discoverAndTransform(
    query: string,
    niches: MediaBeastNiche[],
    targetCount: number,
    channelDNA: ChannelDNA,
    intensity: "medium" | "extreme" = "medium"
  ): Promise<BeastDiscoverAndTransformResult> {
    const discovery = await this.discoverAndPlan(query, niches, targetCount);
    const reelPlans = discovery.candidates.map((candidate) =>
      this.transformForReel(candidate, channelDNA, intensity)
    );

    return {
      ...discovery,
      channelDNA,
      reelPlans,
      dailyBatch: generateDailyBatch([channelDNA.id], Math.max(1, targetCount)),
      warnings: [
        ...discovery.warnings,
        "discoverAndTransform returns production plans only; no download, render or publish side effect is performed.",
        "Render remains blocked until manual risk-policy approval."
      ]
    };
  }
}

export function createMediaBeastEngine() {
  return new MediaBeastEngine();
}
