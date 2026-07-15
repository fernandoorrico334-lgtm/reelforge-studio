import type { ComicShortProductionPlan, ComicShortScenePlan } from "./comic-shorts-factory.js";

export type ComicNarrationDoctorTone = "viral_human" | "documentary_hype";

export type ComicPanelNarrationAlignment = {
  score: number;
  visualActionMatched: boolean;
  characterMatched: boolean;
  conflictMatched: boolean;
  payoffMatched: boolean;
  evidenceReasons: string[];
  warnings: string[];
};

export type ComicNarrationDoctorResult = {
  directorId: "comic_narration_doctor_v1";
  sceneOrder: number;
  panelId: string;
  role: ComicShortScenePlan["role"];
  narrationBefore: string;
  narrationAfter: string;
  captionAfter: string;
  hookType: "shock" | "threat" | "mystery" | "payoff";
  speechNotes: string;
  panelAlignment: ComicPanelNarrationAlignment;
};

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function subjectFromTitle(title: string): string {
  return title
    .replace(/^(luta|curiosidade|revelacao|origem|transformacao|relacao|humor|cliffhanger|momento visual):\s*/i, "")
    .trim() || title;
}

function firstUsefulText(scene: ComicShortScenePlan): string | null {
  const samples = scene.panelVisualEvidence?.textSamples?.map(cleanText).filter((sample) => sample.length > 3) ?? [];
  return samples[0] ?? null;
}

function actionLabel(scene: ComicShortScenePlan): string {
  const raw = cleanText(scene.panelVisualEvidence?.strongestActionLabel ?? "");
  if (/fight|attack|impact|boom|luta|golpe|hit/i.test(raw)) return "o impacto";
  if (/transform|origin|reveal|origem/i.test(raw)) return "a transformacao";
  if (/threat|pose|danger|perigo/i.test(raw)) return "a ameaca";
  return raw ? "a acao" : "o detalhe visual";
}

function hasVisualAction(scene: ComicShortScenePlan): boolean {
  const evidence = scene.panelVisualEvidence;
  if (!evidence) return false;
  const storyFunction = String(evidence.storyFunction).toLowerCase();
  return (
    evidence.evidenceCounts.actions > 0 ||
    evidence.evidenceCounts.soundEffects > 0 ||
    Boolean(evidence.strongestActionLabel) ||
    /action|fight|climax|impact|transformation|reveal|attack|battle/.test(storyFunction)
  );
}

function hasCharacter(scene: ComicShortScenePlan): boolean {
  const evidence = scene.panelVisualEvidence;
  return Boolean(evidence && evidence.evidenceCounts.characters > 0 && evidence.confidence.characters >= 0.45);
}

function hasConflict(scene: ComicShortScenePlan): boolean {
  const evidence = scene.panelVisualEvidence;
  const relationship = String(evidence?.strongestRelationshipType ?? "").toLowerCase();
  const storyFunction = String(evidence?.storyFunction ?? "").toLowerCase();
  return /conflict|host|rival|threat|enemy|versus/.test(relationship) || /climax|action|reveal|transformation/.test(storyFunction);
}

function buildAlignment(scene: ComicShortScenePlan, narration: string): ComicPanelNarrationAlignment {
  const evidenceReasons: string[] = [];
  const warnings: string[] = [];
  const visualActionMatched = hasVisualAction(scene) && /(impacto|golpe|acao|ameaca|virada|explod|luta|transformacao|detalhe visual)/i.test(narration);
  const characterMatched = hasCharacter(scene) && /(ele|ela|eles|personagem|vilao|heroi|monstro|ameaca|figura)/i.test(narration);
  const conflictMatched = hasConflict(scene) && /(conflito|contra|ameaca|perigo|luta|domina|vira|pressiona|vence|perde)/i.test(narration);
  const payoffMatched = scene.role !== "payoff" || /(por isso|fecha|pergunta|proxima|resultado|consequencia)/i.test(narration);

  if (visualActionMatched) evidenceReasons.push("narration_mentions_visual_action");
  if (characterMatched) evidenceReasons.push("narration_mentions_visible_character");
  if (conflictMatched) evidenceReasons.push("narration_mentions_conflict_or_threat");
  if (payoffMatched) evidenceReasons.push("narration_respects_payoff_role");
  if (!visualActionMatched) warnings.push("narration_may_not_reference_panel_action");
  if (!characterMatched) warnings.push("narration_may_not_anchor_visible_character");
  if (!conflictMatched && scene.role !== "context") warnings.push("narration_may_miss_conflict");

  const score = Math.round(Math.max(0, Math.min(100,
    40 +
      (visualActionMatched ? 22 : 0) +
      (characterMatched ? 18 : 0) +
      (conflictMatched ? 15 : 0) +
      (payoffMatched ? 5 : 0) -
      warnings.length * 5
  )));

  return { score, visualActionMatched, characterMatched, conflictMatched, payoffMatched, evidenceReasons, warnings };
}

function captionFromNarration(narration: string, scene: ComicShortScenePlan): string {
  if (scene.role === "hook") return "OLHA ESSE PAINEL";
  if (scene.role === "climax") return "A VIRADA ACONTECE AQUI";
  if (scene.role === "payoff") return "E ISSO MUDA TUDO";
  const words = narration
    .replace(/[.,!?;:]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 5)
    .map((word) => word.toUpperCase());
  return words.length >= 3 ? words.join(" ") : "REPARA NESSE DETALHE";
}

export function doctorComicSceneNarration(input: {
  scene: ComicShortScenePlan;
  short: ComicShortProductionPlan;
  tone?: ComicNarrationDoctorTone;
}): ComicNarrationDoctorResult {
  const scene = input.scene;
  const subject = subjectFromTitle(input.short.title);
  const action = actionLabel(scene);
  const sample = firstUsefulText(scene);
  const hookType: ComicNarrationDoctorResult["hookType"] =
    scene.role === "hook" ? "shock" : scene.role === "climax" ? "threat" : scene.role === "payoff" ? "payoff" : "mystery";

  let narrationAfter: string;
  if (scene.role === "hook") {
    narrationAfter = `Olha esse painel com calma: nao e so ${action}. Ele ja entrega por que ${subject} vira uma ameaca muito maior.`;
  } else if (scene.role === "context") {
    narrationAfter = sample
      ? `Antes da pancada, a pagina planta uma pista no texto: "${sample.slice(0, 70)}". Isso muda como voce le a cena.`
      : `Antes da pancada, a composicao segura o olhar no personagem certo e prepara o perigo sem explicar demais.`;
  } else if (scene.role === "development") {
    narrationAfter = `Agora repara no enquadramento: ${action} nao aparece por acaso. A cena esta empurrando a tensao para o proximo corte.`;
  } else if (scene.role === "climax") {
    narrationAfter = `Aqui e a virada. O quadro coloca o conflito na sua cara, e esse e o ponto em que o short precisa explodir.`;
  } else {
    narrationAfter = `E por isso esse trecho funciona: ele fecha a consequencia da cena, mas deixa uma pergunta perfeita para o proximo short.`;
  }

  narrationAfter = cleanText(narrationAfter);
  const panelAlignment = buildAlignment(scene, narrationAfter);
  return {
    directorId: "comic_narration_doctor_v1",
    sceneOrder: scene.order,
    panelId: scene.panelId,
    role: scene.role,
    narrationBefore: scene.narration,
    narrationAfter,
    captionAfter: captionFromNarration(narrationAfter, scene),
    hookType,
    speechNotes: "Ler como criador humano: frase natural, leve suspense, enfase no detalhe visivel e sem soar como resumo de Wikipedia.",
    panelAlignment
  };
}

export function doctorComicShortNarration(input: {
  short: ComicShortProductionPlan;
  tone?: ComicNarrationDoctorTone;
}): {
  directorId: "comic_narration_doctor_v1";
  averagePanelAlignmentScore: number;
  sceneCount: number;
  scenes: ComicNarrationDoctorResult[];
  warnings: string[];
} {
  const scenes = input.short.scenes.map((scene) => doctorComicSceneNarration({
    scene,
    short: input.short,
    ...(input.tone ? { tone: input.tone } : {})
  }));
  const averagePanelAlignmentScore = scenes.length
    ? Math.round(scenes.reduce((sum, scene) => sum + scene.panelAlignment.score, 0) / scenes.length)
    : 0;
  return {
    directorId: "comic_narration_doctor_v1",
    averagePanelAlignmentScore,
    sceneCount: scenes.length,
    scenes,
    warnings: scenes.flatMap((scene) => scene.panelAlignment.warnings.map((warning) => `scene_${scene.sceneOrder}:${warning}`))
  };
}
