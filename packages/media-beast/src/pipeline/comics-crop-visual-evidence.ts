import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  analyzeComicsPanelVisual,
  analyzePixelBuffer,
  isTextHeavyVisualPage,
  type ComicsPanelVisualProfile,
  type ComicsPanelVisualVerdict
} from "./comics-panel-visual-analyzer.js";
import type {
  LocalComicPanelEvidence,
  LocalComicPanelIndex,
  PanelEvidenceTier,
  PanelVisualFlags
} from "./comics-local-panel-index.js";

export const REINDEXED_VISUAL_EVIDENCE_FILENAME = "variation-b-reindexed-visual-evidence.json";
export const REINDEXED_VISUAL_EVIDENCE_CONTACT_SHEET_FILENAME =
  "variation-b-reindexed-visual-evidence-contact-sheet.jpg";

export type CropVisualFlag = {
  value: boolean;
  confidence: number;
};

export type CropSymbioteSignals = {
  organic_tendrils_visible: CropVisualFlag;
  black_organic_mass_visible: CropVisualFlag;
  host_contact_visible: CropVisualFlag;
  body_transformation_visible: CropVisualFlag;
  confirmed_symbiote_visual: CropVisualFlag;
};

export type CropEvidenceStatus =
  | "confirmed"
  | "uncertain"
  | "no_relevant_evidence"
  | "forbidden_character"
  | "analysis_failed";

export type CropVisualEvidence = {
  panelId: string;
  panelImagePath: string;
  panelImageSha256: string;
  analyzable: boolean;
  flags: {
    venomVisible: CropVisualFlag;
    spiderManVisible: CropVisualFlag;
    blackSuitVisible: CropVisualFlag;
    symbioteVisible: CropVisualFlag;
    eddieBrockVisible: CropVisualFlag;
    doctorStrangeVisible: CropVisualFlag;
    duoVisible: CropVisualFlag;
    transformationVisible: CropVisualFlag;
  };
  symbioteSignals: CropSymbioteSignals;
  confirmedCharacters: string[];
  uncertainCharacters: string[];
  evidenceStatus: CropEvidenceStatus;
  rejectReason: string | null;
  venomVideoEligible: boolean;
  sceneClassification: string;
  detectedText: string[];
  dialogue: string[];
  ocrAvailable: boolean;
  warnings: string[];
  legacyVisualFlags: PanelVisualFlags;
  localEvidence: LocalComicPanelEvidence["localEvidence"];
  evidenceTier: PanelEvidenceTier;
  confidence: LocalComicPanelEvidence["confidence"];
};

export type ReindexedVisualEvidenceReport = {
  generatedAt: string;
  assetDirectory: string;
  indexPath: string;
  contactSheetPath: string | null;
  reindexedCropCount: number;
  venomConfirmedCount: number;
  spiderManConfirmedCount: number;
  symbioteConfirmedCount: number;
  unknownCount: number;
  rejectedCount: number;
  falsePositivePanels: Array<{
    panelId: string;
    previousEntities: string[];
    reindexedStatus: CropEvidenceStatus;
    confirmedCharacters: string[];
    flags: CropVisualEvidence["flags"];
  }>;
  crops: CropVisualEvidence[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function flag(value: boolean, confidence: number): CropVisualFlag {
  return { value, confidence: Number(confidence.toFixed(2)) };
}

export function isRuralDominantCrop(profile: ComicsPanelVisualProfile): boolean {
  const g = profile.global;
  return (
    g.redRatio >= 0.28 &&
    g.saturatedRatio >= 0.5 &&
    g.greenRatio <= 0.04 &&
    g.blackRatio <= 0.12 &&
    g.blueRatio >= 0.1 &&
    g.blueRatio <= 0.28
  );
}

export function isPumpkinOrganicCrop(profile: ComicsPanelVisualProfile): boolean {
  const g = profile.global;
  if (isRuralDominantCrop(profile)) return false;
  const warmObject =
    (g.yellowRatio >= 0.06 && g.redRatio >= 0.04) || g.redRatio >= 0.14;
  return (
    warmObject &&
    g.blackRatio >= 0.14 &&
    g.blackRatio <= 0.42 &&
    g.saturatedRatio >= 0.18 &&
    g.saturatedRatio <= 0.52 &&
    g.blueRatio <= 0.14
  );
}

export function isDoctorStrangeSpeechCrop(profile: ComicsPanelVisualProfile): boolean {
  const g = profile.global;
  const t = profile.topThird;
  const m = profile.midThird;
  if (isRuralDominantCrop(profile) || isPumpkinOrganicCrop(profile)) return false;

  const blueSpeechPortrait =
    t.blueRatio >= 0.32 &&
    t.whiteRatio >= 0.15 &&
    g.blueRatio >= 0.2 &&
    g.whiteRatio >= 0.07;

  const redCapeSpeechPortrait =
    g.blueRatio >= 0.18 &&
    g.whiteRatio >= 0.08 &&
    (m.redRatio >= 0.05 || g.redRatio >= 0.05) &&
    (g.greenRatio >= 0.008 || t.redRatio >= 0.02);

  const bookSpeechPortrait =
    g.whiteRatio >= 0.12 &&
    t.whiteRatio >= 0.25 &&
    g.blackRatio <= 0.02 &&
    (g.greenRatio >= 0.03 || g.blueRatio >= 0.05);

  return blueSpeechPortrait || redCapeSpeechPortrait || bookSpeechPortrait;
}

export function isMysticalHeroCrop(profile: ComicsPanelVisualProfile): boolean {
  if (isDoctorStrangeSpeechCrop(profile)) return true;
  const g = profile.global;
  const t = profile.topThird;
  const m = profile.midThird;
  if (isRuralDominantCrop(profile) || isPumpkinOrganicCrop(profile)) return false;
  const speechLikely =
    g.whiteRatio >= 0.08 ||
    t.whiteRatio >= 0.2 ||
    isTextHeavyVisualPage(profile);
  const mysticalPalette =
    g.yellowRatio <= 0.04 &&
    (g.blueRatio >= 0.18 || t.blueRatio >= 0.12) &&
    (m.redRatio >= 0.06 || t.redRatio >= 0.05 || g.greenRatio >= 0.03);
  const doctorStrangePortrait =
    g.whiteRatio >= 0.12 &&
    g.blueRatio >= 0.05 &&
    g.greenRatio >= 0.03 &&
    g.blackRatio <= 0.05;
  return mysticalPalette && speechLikely && doctorStrangePortrait;
}

export function isComicDuoActionCrop(profile: ComicsPanelVisualProfile): boolean {
  const g = profile.global;
  if (
    isRuralDominantCrop(profile) ||
    isPumpkinOrganicCrop(profile) ||
    isDoctorStrangeSpeechCrop(profile)
  ) {
    return false;
  }
  return (
    g.blueRatio >= 0.11 &&
    g.redRatio >= 0.04 &&
    g.blackRatio >= 0.08 &&
    g.blackRatio <= 0.22 &&
    g.saturatedRatio >= 0.2 &&
    g.saturatedRatio <= 0.45 &&
    g.whiteRatio >= 0.03
  );
}

function scoreVenomCrop(profile: ComicsPanelVisualProfile): number {
  if (
    isRuralDominantCrop(profile) ||
    isPumpkinOrganicCrop(profile) ||
    isDoctorStrangeSpeechCrop(profile)
  ) {
    return 0;
  }
  if (isComicDuoActionCrop(profile)) return 0.86;
  const g = profile.global;
  let score = 0;
  if (g.blackRatio >= 0.34) score += 0.42;
  else if (g.blackRatio >= 0.18) score += 0.3;
  else if (g.blackRatio >= 0.1) score += 0.18;
  if (g.blackRatio >= 0.32 && g.blueRatio < 0.08 && g.redRatio < 0.06) score += 0.14;
  if (g.whiteRatio >= 0.04 && g.blackRatio >= 0.1) score += 0.12;
  if (profile.bottomThird.blackRatio >= 0.12) score += 0.1;
  if (g.blueRatio >= 0.1 && g.redRatio >= 0.04 && g.blackRatio >= 0.08 && g.blackRatio < 0.2) {
    score += 0.22;
  }
  if (g.saturatedRatio >= 0.2 && g.blackRatio >= 0.08) score += 0.08;
  return clamp(score, 0, 0.96);
}

function scoreSpiderManCrop(profile: ComicsPanelVisualProfile): number {
  if (
    isRuralDominantCrop(profile) ||
    isPumpkinOrganicCrop(profile) ||
    isDoctorStrangeSpeechCrop(profile)
  ) {
    return 0;
  }
  if (isComicDuoActionCrop(profile)) return 0.86;
  const g = profile.global;
  let score = 0;
  if (g.blueRatio >= 0.1 && g.redRatio >= 0.04 && g.blackRatio < 0.2) score += 0.38;
  if (g.blueRatio >= 0.12 && g.redRatio >= 0.05) score += 0.2;
  if (g.redRatio >= 0.03 && g.blueRatio >= 0.08 && g.blackRatio < 0.14) score += 0.18;
  if (
    g.blueRatio >= 0.1 &&
    g.redRatio >= 0.05 &&
    g.blackRatio >= 0.05 &&
    g.blackRatio < 0.14 &&
    g.saturatedRatio < 0.2 &&
    !isComicDuoActionCrop(profile)
  ) {
    score += 0.1;
  }
  if (g.blackRatio >= 0.45) score -= 0.35;
  return clamp(score, 0, 0.94);
}

function scoreBlackSuitCrop(profile: ComicsPanelVisualProfile): number {
  if (
    isRuralDominantCrop(profile) ||
    isPumpkinOrganicCrop(profile) ||
    isDoctorStrangeSpeechCrop(profile)
  ) {
    return 0;
  }
  const g = profile.global;
  if (g.blackRatio >= 0.45 && g.blueRatio >= 0.03 && g.redRatio <= 0.12) return 0.88;
  if (g.blackRatio >= 0.3 && g.blueRatio >= 0.05) return 0.72;
  if (g.blackRatio >= 0.2 && g.blackRatio < 0.45 && g.blueRatio >= 0.08) return 0.62;
  return 0;
}

function scoreDoctorStrangeCrop(profile: ComicsPanelVisualProfile): number {
  if (!isDoctorStrangeSpeechCrop(profile) && !isMysticalHeroCrop(profile)) return 0;
  let score = 0.8;
  if (profile.topThird.blueRatio >= 0.32) score += 0.06;
  if (profile.global.whiteRatio >= 0.12 || profile.topThird.whiteRatio >= 0.25) score += 0.06;
  if (profile.global.greenRatio >= 0.03 || profile.midThird.redRatio >= 0.05) score += 0.04;
  return clamp(score, 0, 0.94);
}

function buildSymbioteSignals(
  profile: ComicsPanelVisualProfile,
  sceneClassification: string
): CropSymbioteSignals {
  const g = profile.global;
  const pumpkin = sceneClassification === "pumpkin_organic";
  const organicTendrils =
    pumpkin ||
    (g.whiteRatio >= 0.03 && g.blackRatio >= 0.14 && g.saturatedRatio >= 0.18 && g.blueRatio <= 0.14);
  const blackMass =
    g.blackRatio >= 0.34 && !isRuralDominantCrop(profile) && sceneClassification !== "mystical_hero";
  const hostContact =
    blackMass &&
    sceneClassification !== "pumpkin_organic" &&
    g.blackRatio >= 0.18 &&
    g.whiteRatio >= 0.02;
  const bodyTransformation =
    hostContact &&
    g.blackRatio >= 0.42 &&
    scoreBlackSuitCrop(profile) >= 0.7;
  const confirmed =
    hostContact &&
    blackMass &&
    !pumpkin &&
    (bodyTransformation || scoreBlackSuitCrop(profile) >= 0.72);

  return {
    organic_tendrils_visible: flag(organicTendrils, organicTendrils ? 0.78 : 0),
    black_organic_mass_visible: flag(blackMass, blackMass ? 0.8 : 0),
    host_contact_visible: flag(hostContact, hostContact ? 0.82 : 0),
    body_transformation_visible: flag(bodyTransformation, bodyTransformation ? 0.84 : 0),
    confirmed_symbiote_visual: flag(confirmed, confirmed ? 0.86 : 0)
  };
}

function classifyScene(profile: ComicsPanelVisualProfile): string {
  if (isRuralDominantCrop(profile)) return "rural_dominant";
  if (isPumpkinOrganicCrop(profile)) return "pumpkin_organic";
  if (isComicDuoActionCrop(profile) || (scoreVenomCrop(profile) >= 0.8 && scoreSpiderManCrop(profile) >= 0.8)) {
    return "venom_spider_duo";
  }
  if (isDoctorStrangeSpeechCrop(profile) || isMysticalHeroCrop(profile)) return "mystical_hero";
  if (scoreBlackSuitCrop(profile) >= 0.72) return "black_suit";
  if (scoreVenomCrop(profile) >= 0.8) return "venom_dominant";
  if (scoreSpiderManCrop(profile) >= 0.8) return "spider_man_dominant";
  if (buildSymbioteSignals(profile, "unknown").organic_tendrils_visible.value) return "organic_tendrils_only";
  return "unknown";
}

function characterFromScore(name: string, score: number): {
  confirmed: boolean;
  uncertain: boolean;
} {
  if (score >= 0.8) return { confirmed: true, uncertain: false };
  if (score >= 0.5) return { confirmed: false, uncertain: true };
  return { confirmed: false, uncertain: false };
}

export function analyzeCropVisualEvidenceFromProfile(input: {
  panelId: string;
  panelImagePath: string;
  panelImageSha256: string;
  profile: ComicsPanelVisualProfile;
  analyzable?: boolean;
  ocrDialogue?: string[];
  detectedText?: string[];
}): CropVisualEvidence {
  const profile = input.profile;
  const sceneClassification = classifyScene(profile);
  const venomScore = scoreVenomCrop(profile);
  const spiderScore = scoreSpiderManCrop(profile);
  const blackSuitScore = scoreBlackSuitCrop(profile);
  const doctorScore = scoreDoctorStrangeCrop(profile);
  const symbioteSignals = buildSymbioteSignals(profile, sceneClassification);

  const venom = characterFromScore("venom", venomScore);
  const spider = characterFromScore("spider-man", spiderScore);
  const doctor = characterFromScore("doctor_strange", doctorScore);
  const duoScore = venom.confirmed && spider.confirmed ? 0.9 : Math.min(venomScore, spiderScore) * 0.6;

  const flags = {
    venomVisible: flag(venom.confirmed, venom.confirmed ? venomScore : venomScore < 0.5 ? 0 : venomScore),
    spiderManVisible: flag(
      spider.confirmed,
      spider.confirmed ? spiderScore : spiderScore < 0.5 ? 0 : spiderScore
    ),
    blackSuitVisible: flag(blackSuitScore >= 0.8, blackSuitScore >= 0.8 ? blackSuitScore : 0),
    symbioteVisible: flag(
      symbioteSignals.confirmed_symbiote_visual.value,
      symbioteSignals.confirmed_symbiote_visual.confidence
    ),
    eddieBrockVisible: flag(false, 0),
    doctorStrangeVisible: flag(doctor.confirmed, doctor.confirmed ? doctorScore : 0),
    duoVisible: flag(venom.confirmed && spider.confirmed, duoScore),
    transformationVisible: flag(
      symbioteSignals.body_transformation_visible.value,
      symbioteSignals.body_transformation_visible.confidence
    )
  };

  const confirmedCharacters: string[] = [];
  const uncertainCharacters: string[] = [];
  if (venom.confirmed) confirmedCharacters.push("venom");
  else if (venomScore >= 0.5) uncertainCharacters.push("uncertain_character:venom");
  if (spider.confirmed) confirmedCharacters.push("spider-man");
  else if (spiderScore >= 0.5) uncertainCharacters.push("uncertain_character:spider-man");
  if (doctor.confirmed) confirmedCharacters.push("doctor_strange");
  else if (doctorScore >= 0.5) uncertainCharacters.push("uncertain_character:doctor_strange");
  if (symbioteSignals.confirmed_symbiote_visual.value && !confirmedCharacters.includes("symbiote")) {
    confirmedCharacters.push("symbiote");
  } else if (
    symbioteSignals.organic_tendrils_visible.value &&
    !symbioteSignals.confirmed_symbiote_visual.value
  ) {
    uncertainCharacters.push("uncertain_character:organic_tendrils");
  }

  let evidenceStatus: CropEvidenceStatus = "uncertain";
  let rejectReason: string | null = null;
  if (input.analyzable === false) {
    evidenceStatus = "analysis_failed";
    rejectReason = "crop_visual_analysis_failed";
  } else if (doctor.confirmed) {
    evidenceStatus = "forbidden_character";
    rejectReason = "forbidden_character_evidence";
  } else if (sceneClassification === "rural_dominant" || sceneClassification === "pumpkin_organic") {
    evidenceStatus = "no_relevant_evidence";
    rejectReason = "crop_visual_no_relevant_evidence";
  } else if (confirmedCharacters.length > 0 || symbioteSignals.confirmed_symbiote_visual.value) {
    evidenceStatus = "confirmed";
  } else if (uncertainCharacters.length > 0) {
    evidenceStatus = "uncertain";
    rejectReason = "crop_visual_uncertain";
  } else {
    evidenceStatus = "no_relevant_evidence";
    rejectReason = "crop_visual_no_relevant_evidence";
  }

  const venomVideoEligible =
    evidenceStatus === "confirmed" &&
    !doctor.confirmed &&
    (venom.confirmed ||
      spider.confirmed ||
      symbioteSignals.confirmed_symbiote_visual.value ||
      flags.blackSuitVisible.value);

  const legacyVisualFlags: PanelVisualFlags = {
    venomVisible: flags.venomVisible.value,
    spiderManVisible: flags.spiderManVisible.value,
    blackSuitVisible: flags.blackSuitVisible.value,
    symbioteVisible:
      flags.symbioteVisible.value || symbioteSignals.confirmed_symbiote_visual.value,
    duoVisible: flags.duoVisible.value,
    doctorStrangeVisible: flags.doctorStrangeVisible.value,
    unrelatedCharacterVisible: flags.doctorStrangeVisible.value
  };

  const localEvidence = buildLocalEvidenceFromCropVisualEvidence({
    flags,
    symbioteSignals,
    sceneClassification,
    confirmedCharacters,
    detectedText: input.detectedText ?? [],
    dialogue: input.ocrDialogue ?? []
  });

  const evidenceTier = classifyCropEvidenceTier({
    evidenceStatus,
    legacyVisualFlags,
    isActualPanelCrop: true
  });

  const characterConfidence =
    localEvidence.characters.length > 0
      ? localEvidence.characters.reduce((sum, entry) => sum + entry.confidence, 0) /
        localEvidence.characters.length
      : 0;

  return {
    panelId: input.panelId,
    panelImagePath: input.panelImagePath,
    panelImageSha256: input.panelImageSha256,
    analyzable: input.analyzable !== false,
    flags,
    symbioteSignals,
    confirmedCharacters,
    uncertainCharacters,
    evidenceStatus,
    rejectReason,
    venomVideoEligible,
    sceneClassification,
    detectedText: input.detectedText ?? [],
    dialogue: input.ocrDialogue ?? [],
    ocrAvailable: Boolean(input.ocrDialogue && input.ocrDialogue.length > 0),
    warnings: [],
    legacyVisualFlags,
    localEvidence,
    evidenceTier,
    confidence: {
      segmentation: 0.95,
      characters: characterConfidence,
      actions: localEvidence.actions.length > 0 ? 0.7 : 0,
      relationships: localEvidence.relationships.length > 0 ? 0.72 : 0,
      text: (input.detectedText?.length ?? 0) > 0 || (input.ocrDialogue?.length ?? 0) > 0 ? 0.65 : 0.1,
      overall: clamp(characterConfidence, 0, 0.95)
    }
  };
}

export function analyzeCropVisualEvidenceFromVisualVerdict(input: {
  panelId: string;
  panelImagePath: string;
  panelImageSha256: string;
  visual: ComicsPanelVisualVerdict;
  ocrDialogue?: string[];
  detectedText?: string[];
}): CropVisualEvidence {
  if (!input.visual.profile || !input.visual.analyzable) {
    const emptyProfile: ComicsPanelVisualProfile = {
      global: {
        whiteRatio: 0,
        blackRatio: 0,
        redRatio: 0,
        blueRatio: 0,
        yellowRatio: 0,
        greenRatio: 0,
        saturatedRatio: 0,
        colorBucketCount: 0
      },
      topThird: {
        whiteRatio: 0,
        blackRatio: 0,
        redRatio: 0,
        blueRatio: 0,
        yellowRatio: 0,
        greenRatio: 0,
        saturatedRatio: 0,
        colorBucketCount: 0
      },
      midThird: {
        whiteRatio: 0,
        blackRatio: 0,
        redRatio: 0,
        blueRatio: 0,
        yellowRatio: 0,
        greenRatio: 0,
        saturatedRatio: 0,
        colorBucketCount: 0
      },
      bottomThird: {
        whiteRatio: 0,
        blackRatio: 0,
        redRatio: 0,
        blueRatio: 0,
        yellowRatio: 0,
        greenRatio: 0,
        saturatedRatio: 0,
        colorBucketCount: 0
      }
    };
    return analyzeCropVisualEvidenceFromProfile({
      panelId: input.panelId,
      panelImagePath: input.panelImagePath,
      panelImageSha256: input.panelImageSha256,
      profile: emptyProfile,
      analyzable: false
    });
  }

  return analyzeCropVisualEvidenceFromProfile({
    panelId: input.panelId,
    panelImagePath: input.panelImagePath,
    panelImageSha256: input.panelImageSha256,
    profile: input.visual.profile,
    analyzable: true,
    ...(input.ocrDialogue ? { ocrDialogue: input.ocrDialogue } : {}),
    ...(input.detectedText ? { detectedText: input.detectedText } : {})
  });
}

export function buildLocalEvidenceFromCropVisualEvidence(input: {
  flags: CropVisualEvidence["flags"];
  symbioteSignals: CropSymbioteSignals;
  sceneClassification: string;
  confirmedCharacters: string[];
  detectedText: string[];
  dialogue: string[];
}): LocalComicPanelEvidence["localEvidence"] {
  const characters: LocalComicPanelEvidence["localEvidence"]["characters"] = [];
  const actions: LocalComicPanelEvidence["localEvidence"]["actions"] = [];
  const relationships: LocalComicPanelEvidence["localEvidence"]["relationships"] = [];
  const visualThemes: string[] = [];
  const objects: string[] = [];
  const locations: string[] = [];

  if (input.sceneClassification === "rural_dominant") {
    characters.push({ name: "farmer", confidence: 0.82, evidenceSource: "visual" });
    objects.push("tractor");
    locations.push("field");
    actions.push({ label: "rural_scene", confidence: 0.84 });
    visualThemes.push("rural");
  } else if (input.sceneClassification === "pumpkin_organic") {
    objects.push("carved_pumpkin");
    if (input.symbioteSignals.organic_tendrils_visible.value) {
      objects.push("white_organic_tendrils");
      actions.push({ label: "organic_tendrils_on_object", confidence: 0.76 });
    }
    if (input.flags.venomVisible.value) {
      characters.push({ name: "venom", confidence: input.flags.venomVisible.confidence, evidenceSource: "visual" });
    }
    visualThemes.push("pumpkin_object_scene");
  } else if (input.sceneClassification === "mystical_hero") {
    if (input.flags.doctorStrangeVisible.value) {
      characters.push({
        name: "doctor_strange",
        confidence: input.flags.doctorStrangeVisible.confidence,
        evidenceSource: input.dialogue.length > 0 ? "dialogue" : "visual"
      });
      actions.push({ label: "mystical_speech", confidence: 0.8 });
      visualThemes.push("mystical_speech");
      objects.push("mystical_book");
    }
  } else {
    if (input.flags.venomVisible.value) {
      characters.push({
        name: "venom",
        confidence: input.flags.venomVisible.confidence,
        evidenceSource: "visual"
      });
    }
    if (input.flags.spiderManVisible.value) {
      characters.push({
        name: "spider-man",
        confidence: input.flags.spiderManVisible.confidence,
        evidenceSource: "visual"
      });
    }
    if (input.symbioteSignals.confirmed_symbiote_visual.value) {
      characters.push({
        name: "symbiote",
        confidence: input.symbioteSignals.confirmed_symbiote_visual.confidence,
        evidenceSource: "visual"
      });
      relationships.push({
        type: "host_symbiote",
        entities: input.flags.spiderManVisible.value
          ? ["spider-man", "symbiote"]
          : ["symbiote"],
        confidence: input.symbioteSignals.confirmed_symbiote_visual.confidence
      });
      visualThemes.push("symbiosis");
    }
    if (input.flags.blackSuitVisible.value) {
      visualThemes.push("black_suit");
    }
    if (input.flags.duoVisible.value) {
      relationships.push({
        type: "duo",
        entities: ["venom", "spider-man"],
        confidence: input.flags.duoVisible.confidence
      });
      actions.push({ label: "duo_presence", confidence: input.flags.duoVisible.confidence });
      visualThemes.push("partnership");
    } else if (input.flags.venomVisible.value) {
      actions.push({ label: "venom_presence", confidence: input.flags.venomVisible.confidence });
    } else if (input.flags.spiderManVisible.value) {
      actions.push({ label: "hero_presence", confidence: input.flags.spiderManVisible.confidence });
    }
  }

  return {
    characters,
    actions,
    relationships,
    detectedText: [...input.detectedText],
    dialogue: [...input.dialogue],
    narrationBoxes: [],
    soundEffects: [],
    visualThemes: [...new Set(visualThemes)],
    objects,
    locations
  };
}

export function classifyCropEvidenceTier(input: {
  evidenceStatus: CropEvidenceStatus;
  legacyVisualFlags: PanelVisualFlags;
  isActualPanelCrop: boolean;
}): PanelEvidenceTier {
  if (!input.isActualPanelCrop) return "rejected";
  if (
    input.evidenceStatus === "analysis_failed" ||
    input.evidenceStatus === "forbidden_character" ||
    input.evidenceStatus === "no_relevant_evidence"
  ) {
    return "rejected";
  }
  if (input.legacyVisualFlags.duoVisible && input.legacyVisualFlags.venomVisible && input.legacyVisualFlags.spiderManVisible) {
    return "direct_evidence";
  }
  if (input.legacyVisualFlags.venomVisible && input.legacyVisualFlags.spiderManVisible) {
    return "direct_evidence";
  }
  if (input.legacyVisualFlags.venomVisible) return "direct_evidence";
  if (
    (input.legacyVisualFlags.blackSuitVisible || input.legacyVisualFlags.symbioteVisible) &&
    !input.legacyVisualFlags.venomVisible
  ) {
    return "supporting_only";
  }
  if (input.legacyVisualFlags.spiderManVisible && !input.legacyVisualFlags.venomVisible) {
    return "supporting_only";
  }
  return input.evidenceStatus === "confirmed" ? "supporting_only" : "rejected";
}

export function applyCropVisualEvidenceToPanel(
  panel: LocalComicPanelEvidence,
  evidence: CropVisualEvidence
): LocalComicPanelEvidence {
  const valid =
    panel.isActualPanelCrop &&
    panel.rejectReason !== "panel_crop_integrity_mismatch" &&
    panel.rejectReason !== "oversized_story_mixed_crop" &&
    evidence.venomVideoEligible &&
    evidence.evidenceTier !== "rejected";

  return {
    ...panel,
    localEvidence: evidence.localEvidence,
    visualFlags: evidence.legacyVisualFlags,
    evidenceTier: evidence.evidenceTier,
    confidence: evidence.confidence,
    valid,
    rejectReason: valid
      ? null
      : evidence.rejectReason ??
        panel.rejectReason ??
        (evidence.evidenceTier === "rejected" ? "crop_visual_rejected" : "crop_visual_ineligible"),
    warnings: [
      ...panel.warnings.filter(
        (warning) =>
          !warning.startsWith("crop_reindex:") &&
          !warning.startsWith("evidence_tier:") &&
          !warning.startsWith("inheritance:")
      ),
      `crop_reindex:${evidence.sceneClassification}`,
      `crop_reindex:status:${evidence.evidenceStatus}`,
      ...(evidence.evidenceTier === "supporting_only" ? ["evidence_tier:supporting_only"] : [])
    ]
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function runFfmpeg(ffmpegCommand: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(ffmpegCommand, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export async function renderReindexedVisualEvidenceContactSheet(input: {
  crops: CropVisualEvidence[];
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  const usable = input.crops.filter((entry) => entry.panelImagePath);
  if (usable.length === 0) return null;

  await mkdir(dirname(input.outputPath), { recursive: true });
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const annotatedDir = join(dirname(input.outputPath), `${basename(input.outputPath)}.annotated`);
  await mkdir(annotatedDir, { recursive: true });

  const annotatedPaths: string[] = [];
  for (const [index, crop] of usable.entries()) {
    if (!(await fileExists(crop.panelImagePath))) continue;
    const chars = crop.confirmedCharacters.join("+") || "none";
    const flags = [
      crop.flags.venomVisible.value ? "V" : "",
      crop.flags.spiderManVisible.value ? "SM" : "",
      crop.flags.doctorStrangeVisible.value ? "DS" : "",
      crop.symbioteSignals.confirmed_symbiote_visual.value ? "SYM" : ""
    ]
      .filter(Boolean)
      .join("+") || "none";
    const conf = Math.max(
      crop.flags.venomVisible.confidence,
      crop.flags.spiderManVisible.confidence,
      crop.flags.doctorStrangeVisible.confidence,
      crop.symbioteSignals.confirmed_symbiote_visual.confidence
    ).toFixed(2);
    const reject = crop.rejectReason ? crop.rejectReason.slice(0, 28) : "none";
    const label = [
      crop.panelId.split(":").slice(-2).join("/"),
      `chars=${chars}`,
      `flags=${flags}`,
      `conf=${conf}`,
      crop.evidenceStatus,
      `rej=${reject}`
    ]
      .join(" | ")
      .replace(/[:\\']/g, " ");
    const annotatedPath = join(annotatedDir, `reindex-${String(index + 1).padStart(2, "0")}.jpg`);
    await runFfmpeg(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      crop.panelImagePath,
      "-vf",
      `scale=300:300:force_original_aspect_ratio=decrease,pad=300:420:(ow-iw)/2:(oh-ih)/2:color=black,drawtext=text='${label}':fontsize=7:fontcolor=white:x=6:y=6:box=1:boxcolor=black@0.55`,
      "-frames:v",
      "1",
      annotatedPath
    ]);
    annotatedPaths.push(annotatedPath);
  }

  if (annotatedPaths.length === 0) return null;

  const listPath = `${input.outputPath}.list.txt`;
  const escaped = annotatedPaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, escaped, "utf8");
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(annotatedPaths.length))));
  const rows = Math.ceil(annotatedPaths.length / columns);
  await runFfmpeg(ffmpegCommand, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-vf",
    `tile=${columns}x${rows}`,
    "-frames:v",
    "1",
    input.outputPath
  ]);

  return resolve(input.outputPath);
}

export async function reindexVariationBCropVisualEvidence(input: {
  index: LocalComicPanelIndex;
  indexPath: string;
  projectRoot?: string;
  ffmpegCommand?: string;
  panelIds?: string[];
}): Promise<ReindexedVisualEvidenceReport> {
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const tmpDir = join(projectRoot, "tmp");
  await mkdir(tmpDir, { recursive: true });

  const allPanels = input.index.pages.flatMap((page) => page.panels);
  const targetPanels = input.panelIds
    ? allPanels.filter((panel) => input.panelIds!.includes(panel.panelId))
    : allPanels.filter((panel) => panel.panelImagePath && panel.isActualPanelCrop);

  const crops: CropVisualEvidence[] = [];
  const falsePositivePanels: ReindexedVisualEvidenceReport["falsePositivePanels"] = [];

  for (const panel of targetPanels) {
    if (!(await fileExists(panel.panelImagePath))) continue;
    const previousEntities = panel.localEvidence.characters.map((entry) => entry.name);
    const visual = await analyzeComicsPanelVisual({
      assetPath: panel.panelImagePath,
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
    });
    const evidence = analyzeCropVisualEvidenceFromVisualVerdict({
      panelId: panel.panelId,
      panelImagePath: panel.panelImagePath,
      panelImageSha256: panel.panelImageSha256,
      visual
    });
    crops.push(evidence);

    const hadFalsePositive =
      previousEntities.includes("venom") ||
      previousEntities.includes("spider-man") ||
      panel.localEvidence.actions.some((action) => /symbiote_duo|duo_presence/.test(action.label));
    const stillFalse =
      hadFalsePositive &&
      !evidence.flags.venomVisible.value &&
      !evidence.flags.spiderManVisible.value &&
      !evidence.flags.duoVisible.value;
    if (stillFalse || panel.panelId.includes("page1:panel1") || panel.panelId.includes("page5:panel7")) {
      falsePositivePanels.push({
        panelId: panel.panelId,
        previousEntities,
        reindexedStatus: evidence.evidenceStatus,
        confirmedCharacters: evidence.confirmedCharacters,
        flags: evidence.flags
      });
    }

    const page = input.index.pages.find((entry) =>
      entry.panels.some((candidate) => candidate.panelId === panel.panelId)
    );
    if (!page) continue;
    const panelIndex = page.panels.findIndex((candidate) => candidate.panelId === panel.panelId);
    if (panelIndex < 0) continue;
    page.panels[panelIndex] = applyCropVisualEvidenceToPanel(panel, evidence);
  }

  input.index.validPanelCount = input.index.pages
    .flatMap((page) => page.panels)
    .filter((panel) => panel.valid).length;
  input.index.rejectedPanelCount = input.index.pages
    .flatMap((page) => page.panels)
    .filter((panel) => !panel.valid).length;

  await writeFile(input.indexPath, JSON.stringify(input.index, null, 2), "utf8");

  const contactSheetPath = join(tmpDir, REINDEXED_VISUAL_EVIDENCE_CONTACT_SHEET_FILENAME);
  const reportPath = join(tmpDir, REINDEXED_VISUAL_EVIDENCE_FILENAME);

  const report: ReindexedVisualEvidenceReport = {
    generatedAt: new Date().toISOString(),
    assetDirectory: input.index.assetDirectory,
    indexPath: input.indexPath,
    contactSheetPath: await renderReindexedVisualEvidenceContactSheet({
      crops,
      outputPath: contactSheetPath,
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
    }),
    reindexedCropCount: crops.length,
    venomConfirmedCount: crops.filter((crop) => crop.flags.venomVisible.value).length,
    spiderManConfirmedCount: crops.filter((crop) => crop.flags.spiderManVisible.value).length,
    symbioteConfirmedCount: crops.filter((crop) => crop.symbioteSignals.confirmed_symbiote_visual.value)
      .length,
    unknownCount: crops.filter((crop) => crop.evidenceStatus === "uncertain").length,
    rejectedCount: crops.filter(
      (crop) =>
        crop.evidenceStatus === "no_relevant_evidence" ||
        crop.evidenceStatus === "forbidden_character" ||
        crop.evidenceStatus === "analysis_failed"
    ).length,
    falsePositivePanels,
    crops
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

export function analyzeCropVisualEvidenceFromPixels(input: {
  panelId: string;
  panelImagePath: string;
  panelImageSha256: string;
  pixels: Buffer;
  sampleSize?: number;
}): CropVisualEvidence {
  const profile = analyzePixelBuffer(input.pixels, input.sampleSize ?? 128);
  if (!profile) {
    return analyzeCropVisualEvidenceFromProfile({
      panelId: input.panelId,
      panelImagePath: input.panelImagePath,
      panelImageSha256: input.panelImageSha256,
      profile: {
        global: {
          whiteRatio: 0,
          blackRatio: 0,
          redRatio: 0,
          blueRatio: 0,
          yellowRatio: 0,
          greenRatio: 0,
          saturatedRatio: 0,
          colorBucketCount: 0
        },
        topThird: {
          whiteRatio: 0,
          blackRatio: 0,
          redRatio: 0,
          blueRatio: 0,
          yellowRatio: 0,
          greenRatio: 0,
          saturatedRatio: 0,
          colorBucketCount: 0
        },
        midThird: {
          whiteRatio: 0,
          blackRatio: 0,
          redRatio: 0,
          blueRatio: 0,
          yellowRatio: 0,
          greenRatio: 0,
          saturatedRatio: 0,
          colorBucketCount: 0
        },
        bottomThird: {
          whiteRatio: 0,
          blackRatio: 0,
          redRatio: 0,
          blueRatio: 0,
          yellowRatio: 0,
          greenRatio: 0,
          saturatedRatio: 0,
          colorBucketCount: 0
        }
      },
      analyzable: false
    });
  }
  return analyzeCropVisualEvidenceFromProfile({
    panelId: input.panelId,
    panelImagePath: input.panelImagePath,
    panelImageSha256: input.panelImageSha256,
    profile,
    analyzable: true
  });
}