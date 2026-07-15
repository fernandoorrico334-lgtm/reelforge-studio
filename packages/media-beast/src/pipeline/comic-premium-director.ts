import { directComicCaptionNarration, type ComicCaptionNarrationDirectorReport } from "./comic-caption-narration-director.js";
import { directComicSmartCrops, type ComicSmartCropDirectorReport } from "./comic-smart-crop-director.js";
import {
  evaluateComicShortQualityGate,
  type ComicShortProductionPlan,
  type ComicShortScenePlan
} from "./comic-shorts-factory.js";

export type ComicPremiumDirectorProfile = "comic_viral_reference_antman" | "balanced_comic_story";

export type ComicPremiumSceneDirection = {
  sceneOrder: number;
  panelId: string;
  retentionGoal: "instant_hook" | "context_lock" | "curiosity_gap" | "impact_peak" | "payoff_snap";
  narrationBefore: string;
  narrationAfter: string;
  captionBefore: string;
  captionAfter: string;
  recommendedDurationSeconds: number;
  zoomPreset: "face_focus" | "action_center" | "text_safe_push" | "wide_context" | "impact_detail";
  cropInstruction: string;
  captionInstruction: string;
  sfxCue: "bass_hit" | "whoosh" | "riser" | "flash_hit" | "none";
  transition: ComicShortScenePlan["transition"];
  energyLevel: number;
};

export type ComicPremiumDirectorReport = {
  profileId: ComicPremiumDirectorProfile;
  referencePresetId: "builtin-comic-viral-reference-antman";
  targetCutPaceSeconds: number;
  targetDurationSeconds: number;
  narrationStyle: "hype_documentary";
  captionStyleId: "sports_hype" | "comic_pop";
  musicPresetId: "viral_fast_cut";
  audioMasteringPresetId: "viral_fast_cut";
  sceneDirections: ComicPremiumSceneDirection[];
  captionNarration: ComicCaptionNarrationDirectorReport;
  smartCrop: ComicSmartCropDirectorReport;
  qualityScore: number;
  warnings: string[];
  nextImprovements: string[];
};

export type ComicPremiumDirectorResult = {
  short: ComicShortProductionPlan;
  report: ComicPremiumDirectorReport;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const MIN_PREMIUM_COMIC_SHORT_DURATION_SECONDS = 30;

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripWeakOpeners(value: string): string {
  return cleanText(value)
    .replace(/^a hq entrega\s+/i, "")
    .replace(/^nesta cena,?\s+/i, "")
    .replace(/^aqui,?\s+/i, "");
}

function roleGoal(role: ComicShortScenePlan["role"]): ComicPremiumSceneDirection["retentionGoal"] {
  if (role === "hook") return "instant_hook";
  if (role === "context") return "context_lock";
  if (role === "development") return "curiosity_gap";
  if (role === "climax") return "impact_peak";
  return "payoff_snap";
}

function sentenceForScene(scene: ComicShortScenePlan, short: ComicShortProductionPlan): string {
  const base = stripWeakOpeners(scene.narration || short.title);
  const subject = short.title.replace(/^(luta|curiosidade|revelacao|origem|transformacao|relacao|humor|cliffhanger):\s*/i, "");

  if (scene.role === "hook") {
    if (short.category === "fight" || short.category === "transformation") {
      return `Esse momento parece simples, mas ele muda totalmente a luta de ${subject}.`;
    }
    if (short.category === "reveal" || short.category === "cliffhanger") {
      return `O detalhe que quase passa batido aqui revela o verdadeiro perigo de ${subject}.`;
    }
    return `Tem um detalhe nessa HQ que transforma ${subject} em um short inteiro.`;
  }

  if (scene.role === "context") {
    return `Antes do impacto, a pagina prepara o conflito com uma pista visual que segura a atencao.`;
  }

  if (scene.role === "development") {
    return base.length > 120
      ? `${base.slice(0, 116).replace(/[,;:]?\s+\S*$/, "")}... e isso aumenta a tensao.`
      : `${base} E e aqui que a cena comeca a virar.`;
  }

  if (scene.role === "climax") {
    return `A virada esta nesse painel: e o ponto em que a historia deixa de ser contexto e vira impacto.`;
  }

  return `Por isso esse trecho funciona tao bem: ele fecha a ideia e deixa vontade de ver a proxima pagina.`;
}

function captionFromNarration(value: string, role: ComicShortScenePlan["role"]): string {
  const cleaned = cleanText(value)
    .replace(/^esse momento parece simples, mas /i, "")
    .replace(/^antes do impacto,?\s*/i, "")
    .replace(/^por isso /i, "");
  const words = cleaned.split(" ").filter(Boolean);
  const maxWords = role === "hook" || role === "climax" ? 7 : 9;
  const caption = words.slice(0, maxWords).join(" ").replace(/[.,;:]$/g, "");
  return caption.toUpperCase();
}

function durationForRole(role: ComicShortScenePlan["role"], original: number): number {
  const target = role === "hook" ? 4.4 : role === "context" ? 6.2 : role === "development" ? 7.0 : role === "climax" ? 5.6 : 6.0;
  return Number(clamp(Math.max(original, target), 3.8, 8.5).toFixed(1));
}

function enforceMinimumDirectedDuration(scenes: ComicShortScenePlan[]): ComicShortScenePlan[] {
  const total = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (total >= MIN_PREMIUM_COMIC_SHORT_DURATION_SECONDS || scenes.length === 0) return scenes;
  const weights: Record<ComicShortScenePlan["role"], number> = {
    hook: 0.85,
    context: 1.05,
    development: 1.25,
    climax: 1,
    payoff: 1.05
  };
  const totalWeight = scenes.reduce((sum, scene) => sum + weights[scene.role], 0);
  let remaining = MIN_PREMIUM_COMIC_SHORT_DURATION_SECONDS - total;
  const expanded = scenes.map((scene) => {
    const add = remaining > 0 ? (MIN_PREMIUM_COMIC_SHORT_DURATION_SECONDS - total) * (weights[scene.role] / totalWeight) : 0;
    const durationSeconds = Number(clamp(scene.durationSeconds + add, 3.8, 9.5).toFixed(1));
    remaining -= durationSeconds - scene.durationSeconds;
    return { ...scene, durationSeconds };
  });
  const expandedTotal = expanded.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (expandedTotal >= MIN_PREMIUM_COMIC_SHORT_DURATION_SECONDS) return expanded;
  const last = expanded[expanded.length - 1];
  if (!last) return expanded;
  return expanded.map((scene, index) => index === expanded.length - 1
    ? { ...scene, durationSeconds: Number((scene.durationSeconds + (MIN_PREMIUM_COMIC_SHORT_DURATION_SECONDS - expandedTotal)).toFixed(1)) }
    : scene);
}

function zoomForScene(scene: ComicShortScenePlan): ComicPremiumSceneDirection["zoomPreset"] {
  if (scene.role === "hook") return "impact_detail";
  if (scene.role === "climax") return "action_center";
  if (scene.role === "context") return "wide_context";
  if (scene.caption.length > 58) return "text_safe_push";
  return "face_focus";
}

function cropInstructionForZoom(zoom: ComicPremiumSceneDirection["zoomPreset"], scene: ComicShortScenePlan): string {
  if (zoom === "impact_detail") return "Comecar em detalhe forte do painel e abrir levemente em 0.4s.";
  if (zoom === "action_center") return "Centralizar a acao principal, punch zoom no primeiro terco e micro shake no impacto.";
  if (zoom === "wide_context") return "Mostrar contexto amplo por poucos frames e empurrar para o personagem dominante.";
  if (zoom === "text_safe_push") return "Preservar balao/recordatorio legivel e usar push-in lento sem cortar texto.";
  return `Focar rosto/corpo dominante do painel ${scene.panelId}, com parallax suave.`;
}

function sfxForScene(scene: ComicShortScenePlan): ComicPremiumSceneDirection["sfxCue"] {
  if (scene.role === "hook") return "bass_hit";
  if (scene.role === "development") return "whoosh";
  if (scene.role === "climax") return "flash_hit";
  if (scene.role === "context") return "riser";
  return "none";
}

function transitionForScene(scene: ComicShortScenePlan): ComicShortScenePlan["transition"] {
  if (scene.role === "hook" || scene.role === "climax") return "flash";
  if (scene.role === "development") return "whoosh";
  return "cut";
}

function energyForScene(scene: ComicShortScenePlan): number {
  if (scene.role === "hook" || scene.role === "climax") return 10;
  if (scene.role === "development") return 8;
  if (scene.role === "context") return 7;
  return 6;
}

function directionForScene(scene: ComicShortScenePlan, short: ComicShortProductionPlan): ComicPremiumSceneDirection {
  const narrationAfter = sentenceForScene(scene, short);
  const captionAfter = captionFromNarration(narrationAfter, scene.role);
  const zoomPreset = zoomForScene({ ...scene, caption: captionAfter });
  return {
    sceneOrder: scene.order,
    panelId: scene.panelId,
    retentionGoal: roleGoal(scene.role),
    narrationBefore: scene.narration,
    narrationAfter,
    captionBefore: scene.caption,
    captionAfter,
    recommendedDurationSeconds: durationForRole(scene.role, scene.durationSeconds),
    zoomPreset,
    cropInstruction: cropInstructionForZoom(zoomPreset, scene),
    captionInstruction:
      scene.role === "hook" || scene.role === "climax"
        ? "Legenda central curta, palavra-chave em amarelo, entrada punch-in e sombra forte."
        : "Legenda lower-third curta, no maximo duas linhas, trocar junto com o corte.",
    sfxCue: sfxForScene(scene),
    transition: transitionForScene(scene),
    energyLevel: energyForScene(scene)
  };
}

function scoreDirections(directions: ComicPremiumSceneDirection[], warnings: string[]): number {
  let score = 72;
  if (directions.some((scene) => scene.retentionGoal === "instant_hook")) score += 8;
  if (directions.some((scene) => scene.retentionGoal === "impact_peak")) score += 8;
  if (directions.every((scene) => scene.captionAfter.length <= 72)) score += 6;
  if (directions.every((scene) => scene.recommendedDurationSeconds >= 3.8 && scene.recommendedDurationSeconds <= 8.5)) score += 6;
  score -= warnings.length * 5;
  return clamp(score, 0, 100);
}

export function applyComicPremiumDirector(input: {
  short: ComicShortProductionPlan;
  profileId?: ComicPremiumDirectorProfile;
}): ComicPremiumDirectorResult {
  const profileId = input.profileId ?? "comic_viral_reference_antman";
  const captionNarration = directComicCaptionNarration({ short: input.short });
  const directions = input.short.scenes.map((scene) => directionForScene(scene, input.short));
  const smartCrop = directComicSmartCrops({ short: input.short, premiumDirections: directions });
  const warnings: string[] = [...input.short.warnings];
  if (input.short.qualityReport.panelCoverage < 1) warnings.push("premium_director:missing_panel_paths");
  if (!input.short.qualityReport.hasClimax) warnings.push("premium_director:missing_climax");
  if (captionNarration.averageCaptionQualityScore < 70) warnings.push("premium_director:caption_quality_below_target");
  if (smartCrop.averageConfidenceScore < 78) warnings.push("premium_director:smart_crop_below_target");

  const rawDirectedScenes: ComicShortScenePlan[] = input.short.scenes.map((scene) => {
    const direction = directions.find((entry) => entry.sceneOrder === scene.order)!;
    const captionNarrationScene = captionNarration.scenes.find((entry) => entry.sceneOrder === scene.order);
    return {
      ...scene,
      durationSeconds: direction.recommendedDurationSeconds,
      narration: captionNarrationScene?.narrationText ?? direction.narrationAfter,
      caption: captionNarrationScene?.captionText ?? direction.captionAfter,
      transition: direction.transition,
      motion:
        direction.zoomPreset === "impact_detail"
          ? "punch_zoom"
          : direction.zoomPreset === "action_center"
            ? "impact_cut"
            : direction.zoomPreset === "wide_context"
              ? "slow_push"
              : "panel_pan"
    };
  });

  const directedScenes = enforceMinimumDirectedDuration(rawDirectedScenes);
  if (directedScenes.reduce((sum, scene) => sum + scene.durationSeconds, 0) < MIN_PREMIUM_COMIC_SHORT_DURATION_SECONDS) {
    warnings.push("premium_director:duration_below_30s_after_distribution");
  }

  const directedShort: ComicShortProductionPlan = {
    ...input.short,
    scenes: directedScenes,
    estimatedDurationSeconds: directedScenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    narrationScript: directedScenes.map((scene) => scene.narration).join(" "),
    captionStyleId: "sports_hype",
    cinematicPresetId: input.short.category === "reveal" || input.short.category === "cliffhanger" ? "mystery" : "action",
    audioMasteringPresetId: "viral_fast_cut",
    musicPresetId: "viral_fast_cut",
    zoomPlan: directions.map((direction) => ({
      sceneOrder: direction.sceneOrder,
      panelId: direction.panelId,
      zoomPreset: direction.zoomPreset,
      reason: `${direction.retentionGoal}:${direction.cropInstruction}`
    })),
    approvalChecklist: [
      ...input.short.approvalChecklist,
      "Revisar se a narra??o premium continua fiel aos paineis.",
      "Confirmar se o zoom semantico nao corta balao importante.",
      "Validar captions curtas e timing agressivo antes do render.",
      "Confirmar que o render final preserva minimo de 30 segundos."
    ],
    qualityReport: {
      ...input.short.qualityReport,
      narrationLineCount: directedScenes.length,
      warnings
    },
    warnings
  };

  directedShort.qualityGate = evaluateComicShortQualityGate(directedShort);

  return {
    short: directedShort,
    report: {
      profileId,
      referencePresetId: "builtin-comic-viral-reference-antman",
      targetCutPaceSeconds: 0.9,
      targetDurationSeconds: directedShort.estimatedDurationSeconds,
      narrationStyle: "hype_documentary",
      captionStyleId: "sports_hype",
      musicPresetId: "viral_fast_cut",
      audioMasteringPresetId: "viral_fast_cut",
      sceneDirections: directions,
      captionNarration,
      smartCrop,
      qualityScore: scoreDirections(directions, warnings),
      warnings,
      nextImprovements: [
        "Comparar render final contra reference DNA em corte medio, caption density e loudness.",
        "Adicionar crop detector por rosto/acao/balao para executar o zoom semantico automaticamente.",
        "Adicionar beat sync de SFX por sceneDirection.sfxCue.",
        "Comparar retencao de shorts de 30-45s contra cortes ultracurtos para encontrar o ponto ideal.",
        "Renderizar captionCues por palavra/frase curta em vez de legenda unica por cena."
      ]
    }
  };
}
