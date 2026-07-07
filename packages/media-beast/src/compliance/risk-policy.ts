import type {
  MediaBeastCandidate,
  MediaBeastLicenseStatus,
  MediaBeastRiskLevel
} from "../providers/types.js";

export interface MediaBeastRiskDecision {
  allowedForAutoImport: boolean;
  allowedForManualReview: boolean;
  riskLevel: MediaBeastRiskLevel;
  requiredActions: string[];
  notes: string[];
}

const blockedLicenseStatuses: MediaBeastLicenseStatus[] = ["restricted"];
const safeLicenseStatuses: MediaBeastLicenseStatus[] = [
  "public_domain",
  "creative_commons",
  "royalty_free",
  "owned"
];

export function evaluateCandidateRisk(
  candidate: MediaBeastCandidate
): MediaBeastRiskDecision {
  if (blockedLicenseStatuses.includes(candidate.licenseStatus)) {
    return {
      allowedForAutoImport: false,
      allowedForManualReview: false,
      riskLevel: "blocked",
      requiredActions: ["Discard or replace with a licensed source."],
      notes: ["Restricted candidates must not enter the asset pipeline."]
    };
  }

  if (safeLicenseStatuses.includes(candidate.licenseStatus)) {
    return {
      allowedForAutoImport: false,
      allowedForManualReview: true,
      riskLevel: candidate.riskLevel,
      requiredActions: [
        "Store source URL.",
        "Store license note.",
        "Require user confirmation before import."
      ],
      notes: [
        "Even low-risk media stays candidate-first in Media Beast V1."
      ]
    };
  }

  return {
    allowedForAutoImport: false,
    allowedForManualReview: true,
    riskLevel: candidate.riskLevel === "low" ? "medium" : candidate.riskLevel,
    requiredActions: [
      "Verify original rights holder.",
      "Confirm license before download/import.",
      "Prefer replacement with owned, public-domain or licensed material."
    ],
    notes: [
      "Unknown/editorial-only candidates can inform research but are not safe for automatic asset import.",
      "Heavy transformation does not remove copyright or platform-policy risk."
    ]
  };
}

export function assertCandidateFirstSafety(candidates: MediaBeastCandidate[]) {
  return candidates.map((candidate) => ({
    candidateId: candidate.id,
    providerId: candidate.providerId,
    ...evaluateCandidateRisk(candidate)
  }));
}

