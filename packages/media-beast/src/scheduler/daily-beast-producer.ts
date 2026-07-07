import type { MediaBeastCandidate } from "../providers/types.js";
import type { ChannelDNA } from "./channel-dna.js";

export interface DailyBeastShortPlan {
  channelId: string;
  channelName: string;
  slotIndex: number;
  candidateId: string | null;
  titleAngle: string;
  requiredReview: boolean;
  productionMode: "research_only" | "ready_after_manual_approval";
  notes: string[];
}

export interface DailyBeastProductionPlan {
  date: string;
  channelCount: number;
  totalShortsPlanned: number;
  shorts: DailyBeastShortPlan[];
  warnings: string[];
}

export interface GeneratedDailyBatchPlan {
  date: string;
  channelIds: string[];
  countPerChannel: number;
  totalSlots: number;
  slots: Array<{
    slotId: string;
    channelId: string;
    order: number;
    targetDurationSeconds: number;
    status: "needs_candidate" | "needs_manual_approval";
    requiredInputs: string[];
  }>;
  warnings: string[];
}

export interface DistributedDailyBeastPlan {
  date: string;
  countPerChannel: number;
  channelCount: number;
  totalAssignments: number;
  assignments: Array<{
    channelId: string;
    channelName: string;
    slotIndex: number;
    candidateId: string | null;
    status: "needs_candidate" | "needs_manual_approval";
    reason: string;
  }>;
  warnings: string[];
}

export function planDailyBeastProduction(input: {
  date: string;
  channels: ChannelDNA[];
  candidates: MediaBeastCandidate[];
}): DailyBeastProductionPlan {
  const shorts: DailyBeastShortPlan[] = [];

  for (const channel of input.channels) {
    const nicheCandidates = input.candidates.filter(
      (candidate) =>
        candidate.metadata.sourcePackHint === channel.niche ||
        channel.preferredProviders.includes(candidate.providerId)
    );

    for (let index = 0; index < channel.dailyShortTarget; index += 1) {
      const candidate = nicheCandidates[index % Math.max(nicheCandidates.length, 1)] ?? null;
      shorts.push({
        channelId: channel.id,
        channelName: channel.name,
        slotIndex: index + 1,
        candidateId: candidate?.id ?? null,
        titleAngle: candidate
          ? `${channel.name}: ${candidate.title}`
          : `${channel.name}: buscar candidato aprovado para ${channel.niche}`,
        requiredReview: true,
        productionMode: "ready_after_manual_approval",
        notes: [
          "Planejamento em escala nao importa assets automaticamente.",
          "Cada slot exige revisao de risco/licenca antes do render final."
        ]
      });
    }
  }

  return {
    date: input.date,
    channelCount: input.channels.length,
    totalShortsPlanned: shorts.length,
    shorts,
    warnings: [
      "50 canais x 5 shorts/dia exige fila editorial, fontes licenciadas e revisao humana.",
      "Discovery-only candidates podem planejar pauta, mas nao viram render sem aprovacao."
    ]
  };
}

export function generateDailyBatch(
  channelIds: string[],
  countPerChannel: number
): GeneratedDailyBatchPlan {
  const normalizedCount = Math.max(1, Math.min(20, Math.trunc(countPerChannel)));
  const date = new Date().toISOString().slice(0, 10);
  const slots = channelIds.flatMap((channelId) =>
    Array.from({ length: normalizedCount }, (_, index) => ({
      slotId: `${date}-${channelId}-${index + 1}`,
      channelId,
      order: index + 1,
      targetDurationSeconds: index % 2 === 0 ? 35 : 28,
      status: "needs_candidate" as const,
      requiredInputs: [
        "candidate approved by risk-policy",
        "manual source/license confirmation",
        "channel DNA",
        "render blueprint after approval"
      ]
    }))
  );

  return {
    date,
    channelIds,
    countPerChannel: normalizedCount,
    totalSlots: slots.length,
    slots,
    warnings: [
      "Batch planning does not download or render media.",
      "Every slot remains blocked until a candidate is manually approved.",
      "Use this plan as a production queue, not as an autoposting system."
    ]
  };
}

export function distributeDailyBeastPlans(input: {
  channels: ChannelDNA[];
  candidates: MediaBeastCandidate[];
  countPerChannel: number;
}): DistributedDailyBeastPlan {
  const normalizedCount = Math.max(1, Math.min(20, Math.trunc(input.countPerChannel)));
  const date = new Date().toISOString().slice(0, 10);
  const assignments = input.channels.flatMap((channel) => {
    const preferredCandidates = input.candidates.filter((candidate) =>
      channel.preferredProviders.includes(candidate.providerId)
    );

    return Array.from({ length: normalizedCount }, (_, index) => {
      const candidate =
        preferredCandidates[index % Math.max(preferredCandidates.length, 1)] ??
        input.candidates[index % Math.max(input.candidates.length, 1)] ??
        null;

      return {
        channelId: channel.id,
        channelName: channel.name,
        slotIndex: index + 1,
        candidateId: candidate?.id ?? null,
        status: candidate ? ("needs_manual_approval" as const) : ("needs_candidate" as const),
        reason: candidate
          ? "Candidate assigned but blocked until manual source/license approval."
          : "No candidate available for this slot."
      };
    });
  });

  return {
    date,
    countPerChannel: normalizedCount,
    channelCount: input.channels.length,
    totalAssignments: assignments.length,
    assignments,
    warnings: [
      "Assignments are scheduling hints only.",
      "No asset is downloaded, imported, rendered or published by this function.",
      "Manual approval remains required for every assigned candidate."
    ]
  };
}
