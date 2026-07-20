import type { ComicStoryMinerReport } from "./comic-story-miner.js";
import type { ComicStoryArcV2 } from "./comic-story-arc-miner-v2.js";
import type { ComicArcScriptBeat, ComicArcScriptDoctorV2Result } from "./comic-arc-script-doctor-v2.js";
import { evaluateComicShortFinalQualityGate, type ComicShortFinalQaReport } from "./comic-short-final-quality-gate.js";
import { buildComicIssueNarrativeMap, type ComicIssueNarrativeMap } from "./comic-issue-narrative-map.js";
import { directComicArcVisualPlan, type ComicArcVisualDirection } from "./comic-arc-visual-director.js";
import { runComicPanelBattleTest, type ComicPanelBattleTestReport } from "./comic-panel-battle-test.js";
import { buildComicBeatTimingPlan, type ComicBeatTimingPlan } from "./comic-beat-timing-plan.js";
import { evaluateComicNarrationHumanizerGate, type ComicNarrationHumanizerGate } from "./comic-narration-humanizer-gate.js";
import { buildComicCaptionImpactPlan, type ComicCaptionImpactPlan } from "./comic-caption-impact-director.js";
import { checkComicPanelContinuity, type ComicPanelContinuityReport } from "./comic-panel-continuity-checker.js";
import { evaluateComicPostRenderCropQa, type ComicPostRenderCropQaReport } from "./comic-post-render-crop-qa.js";
import { evaluateComicNarrativeContinuityHardGate, type ComicNarrativeContinuityHardGate } from "./comic-narrative-continuity-hard-gate.js";
import { selectComicNarrativeSequence, type ComicSequenceSelectorReport } from "./comic-sequence-selector.js";
import type { ComicStoryMinerPanelRef } from "./comic-story-miner.js";
import type {
  ComicProjectBridgeEmotion,
  ComicProjectBridgeProjectInput,
  ComicProjectBridgeSceneInput,
  ComicProjectPanelAssetManifestEntry
} from "./comic-project-bridge.js";

export type ComicArcProjectBuilderV2Payload = {
  source: "comic-arc-project-builder-v2";
  generatedAt: string;
  arcId: string;
  scriptDoctorId: "comic_arc_script_doctor_v2";
  channelId: string;
  project: ComicProjectBridgeProjectInput;
  scenes: ComicProjectBridgeSceneInput[];
  panelAssetManifest: ComicProjectPanelAssetManifestEntry[];
  renderBlueprintHints: {
    source: "comic_arc_project_builder_v2";
    storyArc: ComicStoryArcV2;
    script: ComicArcScriptDoctorV2Result;
    selectedBeats: ComicArcScriptBeat[];
    targetDurationSeconds: number;
    sourcePages: number[];
    panelIds: string[];
    candidateFirst: true;
    finalQualityGate: ComicShortFinalQaReport;
    arcVisualPlan: ReturnType<typeof directComicArcVisualPlan>;
    panelBattleTest: ComicPanelBattleTestReport;
    beatTimingPlan: ComicBeatTimingPlan;
    narrationHumanizerGate: ComicNarrationHumanizerGate;
    captionImpactPlan: ComicCaptionImpactPlan;
    panelContinuityReport: ComicPanelContinuityReport;
    postRenderCropQa: ComicPostRenderCropQaReport;
    narrativeContinuityHardGate: ComicNarrativeContinuityHardGate;
    sequenceSelector: ComicSequenceSelectorReport;
    storyStrengthGate: ReturnType<typeof storyStrengthGate>;
    readerSafePanelAssets?: Array<{
      sceneOrder: number;
      panelId: string;
      assetId: string;
      readerSafeImagePath: string;
      outputWidth: 1080;
      outputHeight: 1920;
      intent: string;
    }>;
    readerSafeMaterializationReport?: unknown;
    issueNarrativeMap?: ComicIssueNarrativeMap;
    selectedStoryCandidateId?: string | null;
  };
  qualityChecklist: Array<{
    id: string;
    label: string;
    status: "ready" | "needs_review" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

export type ComicArcBatchProjectBuilderV2Payload = {
  source: "comic-arc-batch-project-builder-v2";
  generatedAt: string;
  channelId: string;
  projectCount: number;
  projects: ComicArcProjectBuilderV2Payload[];
  warnings: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

type BuildComicArcProjectPayloadV2Input = {
  arc: ComicStoryArcV2;
  script: ComicArcScriptDoctorV2Result;
  channelId: string;
  templateId?: string | null;
  editingReferencePresetId?: string | null;
  titlePrefix?: string;
  panelsById?: Map<string, ComicStoryMinerPanelRef>;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 0);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

const META_NARRATION_PATTERN = /\b(shorts?|video|conteudo|viral|render|frame)\b|rende short|segura o short|vende a ideia|prova visual/i;

function displayName(value: string | undefined | null, fallback = "a historia"): string {
  if (!value) return fallback;
  const normalized = value.replace(/_/g, " ").toLowerCase().trim();
  if (normalized === "justice league" || normalized === "liga da justica" || normalized === "liga da justiça") return "Liga da Justiça";
  if (normalized === "superman") return "Superman";
  if (normalized === "godzilla") return "Godzilla";
  if (normalized === "kong") return "Kong";
  if (normalized === "batman") return "Batman";
  if (normalized === "wonder woman") return "Mulher-Maravilha";
  if (normalized === "flash") return "Flash";
  if (normalized === "green lantern") return "Lanterna Verde";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const COMIC_CREDIT_OCR_PATTERN = /\b(writer|artist|colorist|letterer|editor|variant\s+cover|cover\s+artist|designer|translation|traducao|roteiro|arte|cores|letras|dc\s+comics|copyright|all\s+rights|brian\s+buccellato|christian\s+duce|luis\s+guerrero|richard\s+starkings|francesco\s+mattina|dan\s+mora)\b/i;

function cleanOcrQuote(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\p{L}\p{N}?!.,:;"' \-]/gu, " ").replace(/\s+/g, " ").trim();
  if (COMIC_CREDIT_OCR_PATTERN.test(cleaned)) return null;
  if (cleaned.length < 12 || cleaned.length > 100) return null;
  const letters = (cleaned.match(/\p{L}/gu) ?? []).length;
  const noisy = (cleaned.match(/[0-9#|/\\_=+<>~]/g) ?? []).length;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 4) return null;
  const shortWordCount = words.filter((word) => word.replace(/[^\p{L}]/gu, "").length <= 2).length;
  const averageWordLength = letters / Math.max(1, words.length);
  if (shortWordCount >= 2 || averageWordLength < 3.8) return null;
  if (letters / Math.max(1, cleaned.length) < 0.62) return null;
  if (noisy > 1) return null;
  return cleaned;
}
function panelDialogue(panel: ComicStoryMinerPanelRef | undefined): string | null {
  const runtime = panel as (ComicStoryMinerPanelRef & { localEvidence?: { dialogue?: string[]; narrationBoxes?: string[]; detectedText?: string[]; soundEffects?: string[]; actions?: string[] } }) | undefined;
  const text = panel?.localDialogue?.[0]
    ?? panel?.localNarrationBoxes?.[0]
    ?? runtime?.localEvidence?.dialogue?.[0]
    ?? runtime?.localEvidence?.narrationBoxes?.[0]
    ?? panel?.visualCropEvidence?.textSamples?.[0]
    ?? runtime?.localEvidence?.detectedText?.[0];
  return cleanOcrQuote(text ? text.replace(/\s+/g, " ").trim().slice(0, 140) : null);
}

function panelAction(panel: ComicStoryMinerPanelRef | undefined): string | null {
  const runtime = panel as (ComicStoryMinerPanelRef & { localEvidence?: { actions?: string[]; soundEffects?: string[] } }) | undefined;
  const raw = panel?.visualCropEvidence?.strongestActionLabel
    ?? panel?.soundEffects?.[0]
    ?? runtime?.localEvidence?.actions?.[0]
    ?? runtime?.localEvidence?.soundEffects?.[0]
    ?? panel?.visualCropEvidence?.storyFunction
    ?? null;
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/_/g, " ").trim();
  if (!normalized || ["unknown", "splash", "rural scene", "hero presence", "mystical speech"].includes(normalized)) return null;
  if (normalized.includes("duo presence") || normalized.includes("duo visible")) return "os dois lados finalmente batem de frente";
  if (normalized.includes("blast")) return "o disparo corta o ar como uma sentença";
  if (normalized.includes("fight") || normalized.includes("battle")) return "a luta toma conta de tudo";
  if (normalized.includes("hit") || normalized.includes("impact")) return "o impacto muda o rumo da batalha";
  if (normalized.includes("run") || normalized.includes("cross")) return "o movimento rasga a tensão em segundos";
  return normalized;
}

function roleForSequenceIndex(index: number, total: number, fallback: ComicArcScriptBeat["role"]): ComicArcScriptBeat["role"] {
  if (index === 0) return "hook";
  if (index === 1) return "setup";
  if (index >= total - 1) return "payoff";
  if (index >= total - 3) return "climax";
  if (fallback === "hook" || fallback === "setup" || fallback === "payoff") return "tension";
  return fallback;
}

function captionForSequenceRole(role: ComicArcScriptBeat["role"], panel: ComicStoryMinerPanelRef | undefined): string {
  const action = panelAction(panel);
  if (role === "hook") return "A AMEACA APARECE";
  if (role === "setup") return panelDialogue(panel) ? "OLHA O QUE ELES PERCEBEM" : "O CONTEXTO MUDA TUDO";
  if (role === "climax") return action ? "O IMPACTO CHEGA" : "A ESCALA EXPLODE";
  if (role === "payoff") return "E AGORA?";
  return action ? "A TENSAO SOBE" : "A HISTORIA AVANCA";
}

function storyNarrationForPanel(input: {
  arc: ComicStoryArcV2;
  panel: ComicStoryMinerPanelRef | undefined;
  role: ComicArcScriptBeat["role"];
  index: number;
  total: number;
  fallback: string;
}): string {
  const main = displayName(input.arc.characters[0], "Liga da Justiça");
  const mainLead = main === "Liga da Justiça" ? "A Liga da Justiça" : main;
  const mainObject = main === "Liga da Justiça" ? "a Liga da Justiça" : main;
  const second = displayName(input.arc.characters[1], "Godzilla");
  const action = panelAction(input.panel);
  const progress = input.total <= 1 ? 0 : input.index / Math.max(1, input.total - 1);
  const pick = (lines: string[]) => lines[Math.abs(input.index) % lines.length]!;

  if (input.role === "hook") {
    return pick([
      `${mainLead} achava que ainda existia controle... até ${second} transformar a crise em um desastre impossível de ignorar.`,
      `Tudo começa como mais uma emergência para ${mainObject}. Só que dessa vez, o problema tem o tamanho de ${second}.`,
      `Ninguém ali entende ainda, mas essa não é uma missão comum. É o começo de uma colisão entre heróis e monstros.`
    ]);
  }

  if (input.role === "setup") {
    return pick([
      `O clima parece calmo por um instante, mas por baixo da conversa já existe algo prestes a quebrar.`,
      `Antes da pancadaria, vem o pior tipo de silêncio: aquele em que todo mundo sente que alguma coisa está errada.`,
      `Os heróis tentam ler a situação, mas a ameaça já está grande demais para caber em qualquer plano.`
    ]);
  }

  if (input.role === "climax") {
    if (action) {
      return pick([
        `Então vem o choque: ${action}, e a cidade inteira parece prender a respiração.`,
        `${action}. Nesse momento, a luta deixa de ser estratégia e vira sobrevivência.`,
        `Quando ${action}, a Liga percebe que força bruta talvez não resolva nada.`
      ]);
    }
    return pick([
      `A partir daqui, a história para de respirar: o perigo cresce e os heróis ficam sem tempo para pensar.`,
      `O confronto toma conta de tudo, e cada decisão parece pequena perto do tamanho de ${second}.`,
      `Agora a escala explode; não é mais sobre vencer bonito, é sobre impedir que tudo desabe.`,
      `A pressão chega no limite, e ${mainObject} entende que o desastre já começou.`,
      `O impacto muda tudo: se eles errarem agora, a cidade inteira paga o preço.`,
      `${second} deixa de ser uma ameaça distante e vira o centro absoluto do caos.`
    ]);
  }

  if (input.role === "payoff") {
    return pick([
      `E o trecho fecha com uma pergunta impossível de largar: se a Liga já está no limite, o que acontece quando ${second} avançar de verdade?`,
      `No fim, a sensação é uma só: eles sobreviveram ao primeiro choque... mas a guerra ainda nem começou.`,
      `E é aí que a história prende de vez, porque agora não é mais sobre parar ${second}; é sobre descobrir se alguém consegue.`
    ]);
  }

  if (action && progress >= 0.35) {
    return pick([
      `${action}, e a tensão vira impacto antes que alguém consiga reagir.`,
      `${action}; a ameaça deixa de ser teoria e passa a esmagar tudo ao redor.`,
      `${action}, mostrando que a crise já passou do ponto de controle.`,
      `${action}; agora cada segundo parece empurrar os heróis para uma escolha pior.`
    ]);
  }

  if (progress < 0.28) {
    return pick([
      `Os heróis ainda estão montando o tabuleiro: dúvidas, pressa e uma ameaça que ninguém mediu direito.`,
      `O caos fica suspenso por alguns segundos, como se todo mundo tentasse entender o que acabou de aparecer.`,
      `Antes da pancadaria, fica claro o detalhe mais perigoso: ninguém sabe o tamanho real do problema.`,
      `Tudo parece pequeno demais diante do que está chegando, e essa é exatamente a armadilha.`
    ]);
  }

  if (progress < 0.52) {
    return pick([
      `A tensão cresce sem pedir licença, e qualquer escolha errada pode custar caro.`,
      `Agora a história começa a apertar: não tem resposta fácil, não tem plano perfeito, só pressão subindo.`,
      `${mainLead} é empurrada para mais perto do confronto, enquanto ${second} vira uma presença impossível de ignorar.`,
      `O perigo para de ser uma ideia distante; ele está ali, crescendo diante dos heróis.`,
      `A cada nova decisão, fica mais claro que ninguém está preparado para uma ameaça desse tamanho.`
    ]);
  }

  if (progress < 0.74) {
    return pick([
      `O ritmo acelera, e a ameaça não espera ninguém se preparar.`,
      `A partir daqui, tudo fica mais físico: o espaço diminui, a cidade pesa, e os heróis perdem margem.`,
      `O perigo muda de escala, e o que parecia uma missão vira uma tentativa desesperada de conter o inevitável.`,
      `Cada nova imagem deixa a mesma sensação: o desastre está avançando mais rápido que a solução.`
    ]);
  }

  const cleanFallback = input.fallback.trim();
  if (cleanFallback && !META_NARRATION_PATTERN.test(cleanFallback) && !/\bpagina\b|\bpage\b|\bbalao\b|\bwriter\b|\bartist\b|\bhq\b|\bquadro\b|\bcorte\b/i.test(cleanFallback)) return cleanFallback;
  return pick([
    `O monstro avança, os heróis recuam, e tudo ganha aquele gosto de desastre chegando.`,
    `Nesse ponto, a promessa fica clara: não é uma luta comum, é uma colisão de mundos.`,
    `A sequência fecha o cerco e prepara o momento em que ${mainObject} vai precisar encarar ${second} de verdade.`
  ]);
}
function sanitizeBeatNarration(input: { arc: ComicStoryArcV2; beat: ComicArcScriptBeat; panel: ComicStoryMinerPanelRef | undefined; index: number; total: number }): ComicArcScriptBeat {
  const narrationText = META_NARRATION_PATTERN.test(input.beat.narrationText)
    ? storyNarrationForPanel({ arc: input.arc, panel: input.panel, role: input.beat.role, index: input.index, total: input.total, fallback: input.beat.narrationText })
    : input.beat.narrationText;
  return {
    ...input.beat,
    narrationText,
    captionText: META_NARRATION_PATTERN.test(input.beat.captionText) ? captionForSequenceRole(input.beat.role, input.panel) : input.beat.captionText
  };
}

function avoidLikelyReaderSafeDuplicates(input: {
  panelIds: string[];
  panelsById: Map<string, ComicStoryMinerPanelRef>;
}): string[] {
  const pagePanelCounts = new Map<number, number>();
  for (const panel of input.panelsById.values()) {
    pagePanelCounts.set(panel.pageNumber, (pagePanelCounts.get(panel.pageNumber) ?? 0) + 1);
  }
  const selectedByPage = new Map<number, string[]>();
  for (const panelId of input.panelIds) {
    const panel = input.panelsById.get(panelId);
    if (!panel) continue;
    selectedByPage.set(panel.pageNumber, [...(selectedByPage.get(panel.pageNumber) ?? []), panelId]);
  }
  const removed = new Set<string>();
  for (const [pageNumber, pagePanelIds] of selectedByPage.entries()) {
    const totalPanelsOnPage = pagePanelCounts.get(pageNumber) ?? pagePanelIds.length;
    if (totalPanelsOnPage <= 2 && pagePanelIds.length > 1) {
      const scored = pagePanelIds.map((panelId) => {
        const panel = input.panelsById.get(panelId);
        const dialogue = panelDialogue(panel) ? 12 : 0;
        const action = panelAction(panel) ? 18 : 0;
        const panelOrderMatch = panelId.match(/panel(\d+)/i);
        const order = panelOrderMatch ? Number(panelOrderMatch[1]) : 0;
        return { panelId, score: dialogue + action + order };
      }).sort((left, right) => right.score - left.score);
      const keep = scored[0]?.panelId;
      for (const panelId of pagePanelIds) {
        if (panelId !== keep) removed.add(panelId);
      }
    }
  }
  const filtered = input.panelIds.filter((panelId) => !removed.has(panelId));
  return filtered.length >= 8 ? filtered : input.panelIds;
}
function expandScriptWithNarrativeSequence(input: {
  arc: ComicStoryArcV2;
  script: ComicArcScriptDoctorV2Result;
  sequenceSelector: ComicSequenceSelectorReport;
  panelsById: Map<string, ComicStoryMinerPanelRef>;
}): ComicArcScriptDoctorV2Result {
  const sequence = input.sequenceSelector.selectedCandidate;
  const rawSelectedPanelIds = sequence?.panelSequence.filter((panelId) => input.panelsById.has(panelId)) ?? [];
  const selectedPanelIds = avoidLikelyReaderSafeDuplicates({ panelIds: rawSelectedPanelIds, panelsById: input.panelsById });
  if (selectedPanelIds.length < Math.max(7, input.script.beats.length + 2)) {
    const beats = input.script.beats.map((beat, index) => sanitizeBeatNarration({
      arc: input.arc,
      beat,
      panel: input.panelsById.get(beat.panelId),
      index,
      total: input.script.beats.length
    }));
    return {
      ...input.script,
      beats,
      fullNarration: beats.map((beat) => beat.narrationText).join(" "),
      warnings: unique([...input.script.warnings, "comic_meta_narration_sanitized"])
    };
  }
  const sourceBeats = input.script.beats.length ? input.script.beats : [];
  const maxSequenceScenes = input.arc.pages.length >= 15 ? 18 : 12;
  const beats = selectedPanelIds.slice(0, maxSequenceScenes).map((panelId, index, all): ComicArcScriptBeat => {
    const source = sourceBeats[Math.min(sourceBeats.length - 1, Math.round((index / Math.max(1, all.length - 1)) * Math.max(0, sourceBeats.length - 1)))] ?? sourceBeats[0];
    const panel = input.panelsById.get(panelId);
    const role = roleForSequenceIndex(index, all.length, source?.role ?? "tension");
    const base: ComicArcScriptBeat = source ? { ...source, role, panelId, pageNumber: panel?.pageNumber ?? source.pageNumber } : {
      role,
      panelId,
      pageNumber: panel?.pageNumber ?? input.arc.pages[0] ?? 1,
      narrationText: "",
      captionText: "",
      delivery: { energy: role === "hook" || role === "climax" ? "extreme" : "high", pace: role === "setup" ? "controlled" : "fast", pauseAfterMs: role === "climax" ? 140 : role === "payoff" ? 180 : 70, emphasisWords: [], voiceNote: "Narrar como historia em progresso, nao como resumo." },
      purpose: "keep_retention" as ComicArcScriptBeat["purpose"],
      evidenceReason: "expanded_from_sequence_panel"
    };
    return {
      ...base,
      narrationText: storyNarrationForPanel({ arc: input.arc, panel, role, index, total: all.length, fallback: source?.narrationText ?? "" }),
      captionText: index === all.length - 3 ? "A PRESSAO ESTOURA" : index === all.length - 2 ? "O IMPACTO CHEGA" : captionForSequenceRole(role, panel),
      delivery: {
        ...base.delivery,
        energy: role === "hook" || role === "climax" ? "extreme" : "high",
        pace: role === "setup" ? "controlled" : "fast",
        pauseAfterMs: role === "climax" ? 140 : role === "payoff" ? 180 : 70,
        voiceNote: `${base.delivery.voiceNote} ExpandedSequence: contar a HQ em ordem, sem voltar pagina.`
      },
      evidenceReason: `${base.evidenceReason}; expanded_sequence_panel=${panelId}`
    };
  });
  return {
    ...input.script,
    beats,
    fullNarration: beats.map((beat) => beat.narrationText).join(" "),
    estimatedDurationSeconds: Math.max(30, Math.min(60, beats.length * 4)),
    warnings: unique([...input.script.warnings, "comic_sequence_expanded_for_story_progression", "comic_meta_narration_sanitized"])
  };
}
function applyHumanizedNarration(input: {
  script: ComicArcScriptDoctorV2Result;
  humanizerGate: ComicNarrationHumanizerGate;
}): ComicArcScriptDoctorV2Result {
  const rewriteByRole = new Map(input.humanizerGate.beatRewrites.map((rewrite) => [rewrite.beatRole, rewrite]));
  const beats = input.script.beats.map((beat) => {
    const rewrite = rewriteByRole.get(beat.role);
    const suggested = rewrite?.suggested.trim();
    if (!rewrite || !suggested || rewrite.reason === "line_already_human_enough") return beat;
    return {
      ...beat,
      narrationText: suggested,
      delivery: {
        ...beat.delivery,
        pauseAfterMs: input.humanizerGate.voiceDirection.pauseMap.find((pause) => pause.afterBeatRole === beat.role)?.pauseMs ?? beat.delivery.pauseAfterMs,
        voiceNote: `${beat.delivery.voiceNote} Humanizer: ${input.humanizerGate.voiceDirection.tone}; ${rewrite.reason}.`
      }
    };
  });
  return {
    ...input.script,
    beats,
    fullNarration: beats.map((beat) => beat.narrationText).join(" "),
    warnings: unique([
      ...input.script.warnings,
      ...(input.humanizerGate.beatRewrites.some((rewrite) => rewrite.reason !== "line_already_human_enough") ? ["comic_humanized_rewrites_applied"] : [])
    ])
  };
}

function emotionForBeat(beat: ComicArcScriptBeat, arc: ComicStoryArcV2): ComicProjectBridgeEmotion {
  if (beat.role === "hook" || beat.role === "climax") return "EPIC";
  if (beat.role === "tension") return "TENSE";
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return "MYSTERIOUS";
  if (arc.type === "comic_absurdity") return "JOYFUL";
  if (arc.type === "unlikely_alliance") return "CURIOUS";
  return "NEUTRAL";
}

function visualPresetForArc(arc: ComicStoryArcV2): string {
  if (arc.type === "hero_vs_kaiju_showdown" || arc.type === "battle_escalation") return "epic";
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return "mystery";
  if (arc.type === "comic_absurdity") return "action";
  if (arc.type === "unlikely_alliance" || arc.type === "character_turning_point") return "drama";
  return "epic";
}

function musicPresetForArc(arc: ComicStoryArcV2): string {
  if (arc.type === "hero_vs_kaiju_showdown" || arc.type === "battle_escalation") return "cinematic_epic";
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return "true_crime_dark";
  if (arc.type === "comic_absurdity") return "viral_fast_cut";
  return "documentary_clean";
}

function audioMoodForArc(arc: ComicStoryArcV2): string {
  if (arc.type === "hero_vs_kaiju_showdown" || arc.type === "battle_escalation") return "epic";
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return "suspense";
  if (arc.type === "comic_absurdity") return "hype";
  return "documentary";
}

function captionStyleForArc(arc: ComicStoryArcV2): string {
  if (arc.type === "hero_vs_kaiju_showdown" || arc.type === "battle_escalation") return "sports_hype";
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return "true_crime_dark";
  return "comic_bold";
}

function transitionForBeat(beat: ComicArcScriptBeat): string {
  if (beat.role === "payoff") return "page_tear_hold";
  return "page_tear";
}

function durationPlan(beats: ComicArcScriptBeat[], targetDurationSeconds: number): number[] {
  if (beats.length === 0) return [];
  const minSceneSeconds = 3.2;
  const maxSceneSeconds = 4;
  const target = Math.min(Math.max(30, targetDurationSeconds), beats.length * maxSceneSeconds);
  const weights = beats.map((beat) => {
    if (beat.role === "hook") return 1.05;
    if (beat.role === "setup") return 1;
    if (beat.role === "tension") return 1.08;
    if (beat.role === "climax") return 1.15;
    return 0.98;
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const raw = weights.map((weight) => Math.max(minSceneSeconds, Math.min(maxSceneSeconds, (target * weight) / weightTotal)));
  let diff = target - raw.reduce((sum, value) => sum + value, 0);
  let guard = 0;
  while (Math.abs(diff) > 0.05 && guard < 200) {
    const index = guard % raw.length;
    const current = raw[index] ?? minSceneSeconds;
    if (diff > 0 && current < maxSceneSeconds) {
      const delta = Math.min(0.1, diff, maxSceneSeconds - current);
      raw[index] = current + delta;
      diff -= delta;
    } else if (diff < 0 && current > minSceneSeconds) {
      const delta = Math.min(0.1, -diff, current - minSceneSeconds);
      raw[index] = current - delta;
      diff += delta;
    }
    guard += 1;
  }
  return raw.map((value) => Number(value.toFixed(2)));
}

function beatTitle(beat: ComicArcScriptBeat, order: number): string {
  const role = beat.role.replace(/_/g, " ");
  return `Cena ${order}: ${role}`;
}

type CaptionPosition = "center" | "lower-third" | "top" | "bottom";

function safeCaptionPosition(value: string | undefined, fallback: CaptionPosition): CaptionPosition {
  if (value === "center" || value === "lower-third" || value === "top" || value === "bottom") return value;
  return fallback;
}

function visualPromptForBeat(beat: ComicArcScriptBeat, arc: ComicStoryArcV2, visualDirection?: ComicArcVisualDirection): string {
  return [
    `Use o painel autorizado ${beat.panelId} como imagem principal da cena.`,    `Pagina fonte: ${beat.pageNumber}.`,    `Historia do short: ${arc.title}.`,    `Papel narrativo: ${beat.role}.`,    `Objetivo da narracao: ${beat.purpose}.`,    `Foque no elemento que prova esta frase: ${beat.narrationText}`,    visualDirection?.renderInstruction ?? "Enquadramento vertical 9:16, zoom dinamico no rosto, balao, impacto ou reacao mais importante.",
    "Nao inventar evento, personagem ou acao fora da HQ; usar somente material autorizado/importado."
  ].join(" ");
}

function visualRecipeForBeat(beat: ComicArcScriptBeat, arc: ComicStoryArcV2, script: ComicArcScriptDoctorV2Result, visualDirection?: ComicArcVisualDirection, timingScene?: ComicBeatTimingPlan["scenes"][number], premiumDirectives?: { humanizedRewrite?: ComicNarrationHumanizerGate["beatRewrites"][number] | undefined; captionCue?: ComicCaptionImpactPlan["cues"][number] | undefined; continuityCut?: ComicPanelContinuityReport["continuityCuts"][number] | undefined; continuityBridge?: ComicPanelContinuityReport["bridgeNarrationHints"][number] | undefined; cropQaScene?: ComicPostRenderCropQaReport["sceneReports"][number] | undefined }): string {
  return safeJson({
    source: "comic-arc-project-builder-v2",
    arcId: arc.id,
    arcType: arc.type,
    scriptDoctorId: script.doctorId,
    scriptScore: script.overallScore,
    panelId: beat.panelId,
    pageNumber: beat.pageNumber,
    role: beat.role,
    narrationPurpose: beat.purpose,
    delivery: beat.delivery,
    evidenceReason: beat.evidenceReason,
    arcVisualDirection: visualDirection ?? null,
    beatTiming: timingScene ?? null,
    premiumDirectives: premiumDirectives ?? null,
    captionRenderPlan: premiumDirectives?.captionCue ?? null,
    continuityInstruction: premiumDirectives?.continuityCut ?? null,
    cropQaInstruction: premiumDirectives?.cropQaScene ?? null,
    comicDynamicEditing: {
      maxVisualHoldSeconds: timingScene?.maxVisualHoldSeconds ?? 4,
      transitionStyle: timingScene?.cutStyle === "hold_reveal" ? "page_tear_hold" : "page_tear",
      motionPolicy: "anchored_zoom_no_shake",
      focusTarget: visualDirection?.primaryTarget ?? "story_evidence",
      anchorPoint: visualDirection?.anchorPoint ?? { x: 0.5, y: 0.5 },
      cameraMove: visualDirection?.cameraMove ?? "context_slow_push",
      startScale: visualDirection?.startScale ?? 1.02,
      endScale: visualDirection?.endScale ?? 1.12,
      pageTearEverySeconds: timingScene?.maxVisualHoldSeconds ?? 4,
      note: "Nao deixar tela parada mais de 4s; usar rasgo de pagina e zoom ancorado no balao/rosto/acao citado pela narracao."
    },
    viewerPromise: arc.viewerPromise,
    payoff: arc.payoff,
    requiresManualPanelImport: true,
    requiresManualApproval: true
  });
}

function storyStrengthGate(input: {
  arc: ComicStoryArcV2;
  script: ComicArcScriptDoctorV2Result;
  finalQualityGate: ComicShortFinalQaReport;
  panelBattleTest: ComicPanelBattleTestReport;
  narrativeContinuityHardGate: ComicNarrativeContinuityHardGate;
  sequenceSelector: ComicSequenceSelectorReport;
}): { status: "ready" | "needs_review" | "blocked"; score: number; blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const sequence = input.sequenceSelector.selectedCandidate;
  if (!sequence) blockers.push("story_sequence_missing");
  if (sequence && sequence.score < 70) blockers.push(`story_sequence_score_too_low:${sequence.score}`);
  else if (sequence && sequence.score < 82) warnings.push(`story_sequence_score_needs_review:${sequence.score}`);
  const sequenceWarnings = input.sequenceSelector.warnings.join("|");
  if (/missing_payoff|missing_visual_conflict|missing_opening_context/i.test(sequenceWarnings)) blockers.push("story_sequence_missing_beginning_conflict_or_payoff");
  if (/crop_score_low|material_score_low/i.test(sequenceWarnings)) warnings.push("story_sequence_visual_material_needs_review");
  if (input.arc.overallScore < 74) blockers.push(`arc_story_score_too_low:${input.arc.overallScore}`);
  else if (input.arc.overallScore < 82) warnings.push(`arc_story_score_needs_review:${input.arc.overallScore}`);
  if (input.script.retentionScore < 66) blockers.push(`retention_score_too_low:${input.script.retentionScore}`);
  else if (input.script.retentionScore < 80) warnings.push(`retention_score_needs_review:${input.script.retentionScore}`);
  if (input.panelBattleTest.averageSelectedScore < 72) blockers.push(`panel_battle_score_too_low:${input.panelBattleTest.averageSelectedScore}`);
  else if (input.panelBattleTest.averageSelectedScore < 82) warnings.push(`panel_battle_score_needs_review:${input.panelBattleTest.averageSelectedScore}`);
  if (input.narrativeContinuityHardGate.status !== "passed") blockers.push("narrative_hard_gate_blocked");
  if (input.finalQualityGate.status === "rejected") blockers.push("final_quality_gate_rejected");
  if (input.finalQualityGate.status === "needs_review") warnings.push("final_quality_gate_needs_review");

  let score = 0;
  score += input.arc.overallScore * 0.22;
  score += input.script.retentionScore * 0.16;
  score += input.script.humanScore * 0.12;
  score += (sequence?.score ?? 0) * 0.2;
  score += input.panelBattleTest.averageSelectedScore * 0.16;
  score += input.narrativeContinuityHardGate.score * 0.1;
  score += input.finalQualityGate.score * 0.04;
  score -= blockers.length * 18;
  score -= warnings.length * 6;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    status: blockers.length > 0 ? "blocked" : warnings.length <= 1 && score >= 82 ? "ready" : "needs_review",
    score,
    blockers,
    warnings
  };
}

function arcWithSelectedCandidateContext(input: { arc: ComicStoryArcV2; candidate: NonNullable<ReturnType<typeof buildComicIssueNarrativeMap>["storyCandidates"][number]> | null | undefined }): ComicStoryArcV2 {
  if (!input.candidate) return input.arc;
  const overlapsPanel = input.arc.panelIds.some((panelId) => input.candidate?.panelIds.includes(panelId));
  const overlapsPage = input.arc.pages.some((page) => input.candidate?.pages.includes(page));
  const sameArc = input.candidate.source === "story_arc_v2" && input.candidate.id.endsWith(input.arc.id);
  return {
    ...input.arc,
    pages: unique([...input.candidate.pages]).sort((left, right) => left - right),
    panelIds: unique([...input.candidate.panelIds]),
    characters: unique([...input.candidate.characters, ...input.arc.characters]),
    themes: unique([...input.candidate.themes, ...input.arc.themes]),
    recommendedDurationSeconds: Math.max(30, input.arc.recommendedDurationSeconds, input.candidate.estimatedDurationSeconds),
    reasons: unique([...input.arc.reasons, "selected_issue_story_candidate_context_applied", "selected_candidate_pages_take_priority"]),
    warnings: unique([...input.arc.warnings, ...input.candidate.warnings.map((warning) => `selected_candidate:${warning}`)])
  };
}

function selectedCandidateProjectBonus(project: ComicArcProjectBuilderV2Payload, selectedCandidate: NonNullable<ReturnType<typeof buildComicIssueNarrativeMap>["storyCandidates"][number]> | null | undefined): number {
  if (!selectedCandidate) return 0;
  const arc = project.renderBlueprintHints.storyArc;
  const panelOverlap = arc.panelIds.filter((panelId) => selectedCandidate.panelIds.includes(panelId)).length;
  const pageOverlap = arc.pages.filter((page) => selectedCandidate.pages.includes(page)).length;
  const sameArc = selectedCandidate.source === "story_arc_v2" && selectedCandidate.id.endsWith(arc.id);
  return (sameArc ? 3500 : 0) + panelOverlap * 80 + pageOverlap * 40;
}
function projectStorySelectionScore(project: ComicArcProjectBuilderV2Payload): number {
  const gate = project.renderBlueprintHints.narrativeContinuityHardGate;
  const storyGate = project.renderBlueprintHints.storyStrengthGate;
  const sequence = project.renderBlueprintHints.sequenceSelector.selectedCandidate;
  const statusBonus = storyGate.status === "ready" ? 5000 : storyGate.status === "needs_review" ? 1200 : 0;
  const hardGateBonus = gate.status === "passed" ? 900 : 0;
  const finalGateBonus = project.renderBlueprintHints.finalQualityGate.status === "passed" ? 600 : project.renderBlueprintHints.finalQualityGate.status === "needs_review" ? 150 : 0;
  return statusBonus + hardGateBonus + finalGateBonus + storyGate.score * 24 + (sequence?.score ?? 0) * 9 + project.renderBlueprintHints.panelBattleTest.averageSelectedScore * 7 + project.renderBlueprintHints.storyArc.overallScore * 5 + project.renderBlueprintHints.script.retentionScore * 4;
}
function buildScenes(input: { arc: ComicStoryArcV2; script: ComicArcScriptDoctorV2Result; targetDurationSeconds: number; arcVisualPlan: ReturnType<typeof directComicArcVisualPlan>; beatTimingPlan: ComicBeatTimingPlan; narrationHumanizerGate: ComicNarrationHumanizerGate; captionImpactPlan: ComicCaptionImpactPlan; panelContinuityReport: ComicPanelContinuityReport; postRenderCropQa: ComicPostRenderCropQaReport }): ComicProjectBridgeSceneInput[] {
  const durations = durationPlan(input.script.beats, input.targetDurationSeconds);
  const visualPreset = visualPresetForArc(input.arc);
  const longStoryReaderSafeMode = input.arc.pages.length >= 15;
  const captionStyle = longStoryReaderSafeMode ? "comic_reader_safe_subtle" : captionStyleForArc(input.arc);
  return input.script.beats.map((beat, index) => {
    const visualDirection = input.arcVisualPlan.scenes.find((scene) => scene.panelId === beat.panelId && scene.beatRole === beat.role);
    const timingScene = input.beatTimingPlan.scenes.find((scene) => scene.panelId === beat.panelId && scene.beatRole === beat.role);
    const captionCue = input.captionImpactPlan.cues.find((cue) => cue.panelId === beat.panelId && cue.beatRole === beat.role);
    const continuityCut = input.panelContinuityReport.continuityCuts[index - 1];
    const continuityBridge = input.panelContinuityReport.bridgeNarrationHints[index - 1];
    const cropQaScene = input.postRenderCropQa.sceneReports.find((scene) => scene.panelId === beat.panelId && scene.beatRole === beat.role);
    const humanizedRewrite = input.narrationHumanizerGate.beatRewrites.find((rewrite) => rewrite.beatRole === beat.role);
    return {
      order: index + 1,
      title: beatTitle(beat, index + 1),
      narrationText: beat.narrationText,
      captionText: captionCue?.text ?? beat.captionText,
      duration: durations[index] ?? 6,
      emotion: emotionForBeat(beat, input.arc),
      assetId: null,
      generatedAssetId: null,
      generatedNarrationAssetId: null,
      characterProfileId: null,
      sfxAssetId: null,
      sfxStartTime: beat.role === "hook" || beat.role === "climax" ? 0.15 : 0,
      sfxVolume: beat.role === "hook" || beat.role === "climax" ? 0.88 : 0.68,
      visualPreset,
      visualSourceMode: "asset_only",
      visualPrompt: visualPromptForBeat(beat, input.arc, visualDirection),
      negativePrompt: "Nao inventar personagens, nao alterar a HQ, nao usar imagem externa sem aprovacao, nao cortar rosto ou balao importante.",
      visualRecipe: visualRecipeForBeat(beat, input.arc, input.script, visualDirection, timingScene, { humanizedRewrite, captionCue, continuityCut, continuityBridge, cropQaScene }),
      generationStatus: null,
      generationProvider: null,
      generationSeed: null,
      transition: transitionForBeat(beat),
      captionStyle,
      captionPosition: longStoryReaderSafeMode ? "bottom" : safeCaptionPosition(captionCue?.safeZone, beat.role === "hook" || beat.role === "climax" ? "center" : "lower-third"),
      captionEmphasisWords: captionCue?.emphasisWords ?? beat.delivery.emphasisWords,
      energyLevel: beat.role === "hook" || beat.role === "climax" ? 9 : beat.role === "tension" ? 8 : 7,
      narrationStatus: null,
      narrationProvider: null,
      narrationVoicePackId: input.arc.type === "hero_vs_kaiju_showdown" || input.arc.type === "battle_escalation" ? "story_epic_ptbr" : "documentary_ptbr"
    };
  });
}
function buildProject(input: BuildComicArcProjectPayloadV2Input, targetDurationSeconds: number): ComicProjectBridgeProjectInput {
  const prefix = input.titlePrefix ? `${input.titlePrefix.trim()} ` : "";
  const musicPresetId = musicPresetForArc(input.arc);
  return {
    title: `${prefix}${input.script.title}`.trim(),
    status: "SCENE_PLANNING",
    channelId: input.channelId,
    script: [
      `SHORT EXTRAIDO DE ARCO DE HQ: ${input.script.title}`,      `Tipo de arco: ${input.arc.type}`,      `Promessa: ${input.arc.viewerPromise}`,      `Payoff: ${input.arc.payoff}`,      "",
      input.script.beats.map((beat, index) => `${index + 1}. ${beat.narrationText}`).join("\n"),
      "",
      "Observacao: payload candidate-first; importar paineis e aprovar manualmente antes de renderizar."
    ].join("\n"),
    durationTarget: targetDurationSeconds,
    format: "9:16",
    templateId: input.templateId ?? "comic_story_premium",
    editingReferencePresetId: input.editingReferencePresetId ?? "builtin-comic-viral-reference-antman",
    editingStyleSummary: null,
    defaultCaptionStyle: input.arc.pages.length >= 15 ? "comic_reader_safe_subtle" : captionStyleForArc(input.arc),
    backgroundMusicAssetId: null,
    musicPresetId,
    voiceoverAssetId: null,
    audioMood: audioMoodForArc(input.arc),
    musicVolume: musicPresetId === "cinematic_epic" || musicPresetId === "viral_fast_cut" ? 0.24 : 0.16,
    voiceVolume: 1,
    sfxVolume: 0.78,
    enableAudioDucking: true,
    duckingLevel: 0.4
  };
}

function buildManifest(beats: ComicArcScriptBeat[], arc: ComicStoryArcV2): ComicProjectPanelAssetManifestEntry[] {
  return beats.map((beat, index) => ({
    sceneOrder: index + 1,
    panelId: beat.panelId,
    panelImagePath: null,
    sourcePageNumber: beat.pageNumber,
    recommendedAssetCategory: "PANEL",
    recommendedAssetType: "IMAGE",
    recommendedTags: [
      "comic-panel",
      "comic-arc-v2",
      `arc:${arc.id}`,      `arc-type:${arc.type}`,      `role:${beat.role}`,      `page:${beat.pageNumber}`
    ],
    importRequired: true
  }));
}

function checklist(input: { arc: ComicStoryArcV2; script: ComicArcScriptDoctorV2Result; scenes: ComicProjectBridgeSceneInput[]; targetDurationSeconds: number; finalQualityGate: ComicShortFinalQaReport; panelBattleTest: ComicPanelBattleTestReport; narrationHumanizerGate: ComicNarrationHumanizerGate; captionImpactPlan: ComicCaptionImpactPlan; panelContinuityReport: ComicPanelContinuityReport; postRenderCropQa: ComicPostRenderCropQaReport; narrativeContinuityHardGate: ComicNarrativeContinuityHardGate; sequenceSelector: ComicSequenceSelectorReport; storyStrengthGate: ReturnType<typeof storyStrengthGate> }): ComicArcProjectBuilderV2Payload["qualityChecklist"] {
  return [
    {
      id: "manual_rights_review",
      label: "Direitos e uso autorizado revisados",
      status: "needs_review",
      detail: "Confirme que a HQ e os paineis podem ser usados no canal antes de importar assets ou renderizar."
    },
    {
      id: "arc_story_ready",
      label: "Arco narrativo pronto para short",
      status: input.arc.readyForShort ? "ready" : "needs_review",
      detail: `score=${input.arc.overallScore}; beats=${input.arc.beats.length}; type=${input.arc.type}.`
    },
    {
      id: "script_voiceover_ready",
      label: "Script pronto para narracao",
      status: input.script.readyForVoiceover ? "ready" : "needs_review",
      detail: `score=${input.script.overallScore}; human=${input.script.humanScore}; retention=${input.script.retentionScore}.`
    },
    {
      id: "minimum_duration_30s",
      label: "Duracao minima de 30 segundos",
      status: input.targetDurationSeconds >= 30 ? "ready" : "blocked",
      detail: `target=${input.targetDurationSeconds}s; scenes=${input.scenes.length}.`
    },
    {
      id: "comic_final_quality_gate",
      label: "Final QA de historia, paineis e narracao",
      status: input.finalQualityGate.status === "passed" ? "ready" : input.finalQualityGate.status === "rejected" ? "blocked" : "needs_review",
      detail: `score=${input.finalQualityGate.score}/${input.finalQualityGate.minimumScore}; blockers=${input.finalQualityGate.blockers.join(",") || "none"}; warnings=${input.finalQualityGate.warnings.join(",") || "none"}.`
    },
    {
      id: "story_strength_gate",
      label: "Historia forte o bastante para short",
      status: input.storyStrengthGate.status,
      detail: `score=${input.storyStrengthGate.score}; blockers=${input.storyStrengthGate.blockers.join(",") || "none"}; warnings=${input.storyStrengthGate.warnings.join(",") || "none"}.`
    },
    {
      id: "comic_sequence_selector",
      label: "Sequencia narrativa continua escolhida",
      status: input.sequenceSelector.selectedCandidate && input.sequenceSelector.selectedCandidate.score >= 78 ? "ready" : input.sequenceSelector.selectedCandidate ? "needs_review" : "blocked",
      detail: input.sequenceSelector.selectedCandidate
        ? `score=${input.sequenceSelector.selectedCandidate.score}; pages=${input.sequenceSelector.selectedCandidate.pageSequence.join(">")}; panels=${input.sequenceSelector.selectedCandidate.panelSequence.join(",")}; warnings=${input.sequenceSelector.warnings.join(",") || "none"}.`
        : `no_sequence_selected; warnings=${input.sequenceSelector.warnings.join(",") || "none"}.`
    },
    {
      id: "panel_battle_test",
      label: "Paineis testados contra alternativas",
      status: input.panelBattleTest.averageSelectedScore >= 78 ? "ready" : input.panelBattleTest.averageSelectedScore >= 68 ? "needs_review" : "blocked",
      detail: `score=${input.panelBattleTest.averageSelectedScore}; improved=${input.panelBattleTest.improvedBeatCount}; selected=${input.panelBattleTest.selectedPanelIds.join(",")}.`
    },
    {
      id: "narration_humanizer_gate",
      label: "Narracao humana e especifica",
      status: input.narrationHumanizerGate.status === "passed" ? "ready" : input.narrationHumanizerGate.status === "rejected" ? "blocked" : "needs_review",
      detail: `score=${input.narrationHumanizerGate.score}; oral=${input.narrationHumanizerGate.oralFlowScore}; specific=${input.narrationHumanizerGate.specificityScore}; generic=${input.narrationHumanizerGate.genericSignals.length}.`
    },
    {
      id: "caption_impact_director",
      label: "Legendas com punch e zona segura",
      status: input.captionImpactPlan.averageImpactScore >= 84 && input.captionImpactPlan.warnings.length === 0 ? "ready" : "needs_review",
      detail: `score=${input.captionImpactPlan.averageImpactScore}; cues=${input.captionImpactPlan.cueCount}; warnings=${input.captionImpactPlan.warnings.join(",") || "none"}.`
    },
    {
      id: "panel_continuity_checker",
      label: "Continuidade visual da historia",
      status: input.panelContinuityReport.status === "passed" ? "ready" : input.panelContinuityReport.status === "rejected" ? "blocked" : "needs_review",
      detail: `score=${input.panelContinuityReport.score}; sequence=${input.panelContinuityReport.roleSequence.join(">")}; warnings=${input.panelContinuityReport.warnings.join(",") || "none"}.`
    },
    {
      id: "post_render_crop_qa",
      label: "QA de crop, legenda e foco visual",
      status: input.postRenderCropQa.status === "passed" ? "ready" : input.postRenderCropQa.status === "rejected" ? "blocked" : "needs_review",
      detail: `score=${input.postRenderCropQa.score}; overlap=${input.postRenderCropQa.captionOverlapRiskCount}; weakFocus=${input.postRenderCropQa.weakFocusCount}.`
    },
    {
      id: "scene_structure",
      label: "Hook, tensao, climax e payoff planejados",
      status: input.scenes.length >= 4 && input.script.beats.some((beat) => beat.role === "hook") && input.script.beats.some((beat) => beat.role === "climax") ? "ready" : "needs_review",
      detail: `roles=${input.script.beats.map((beat) => beat.role).join(",")}.`
    },
    {
      id: "narrative_continuity_hard_gate",
      label: "Historia em ordem, sem voltar paginas",
      status: input.narrativeContinuityHardGate.status === "passed" ? "ready" : "blocked",
      detail: `score=${input.narrativeContinuityHardGate.score}/${input.narrativeContinuityHardGate.minimumScore}; pages=${input.narrativeContinuityHardGate.pageSequence.join(">")}; repeated=${input.narrativeContinuityHardGate.repeatedPanelCount}; backward=${input.narrativeContinuityHardGate.backwardPageJumpCount}; blockers=${input.narrativeContinuityHardGate.blockers.join(",") || "none"}.`
    },
    {
      id: "panel_assets_required",
      label: "Paineis precisam ser importados como assets",
      status: "needs_review",
      detail: "O builder escolhe os paineis e cenas, mas nao importa imagens nem inicia render automaticamente."
    },
    {
      id: "render_not_auto_started",
      label: "Render bloqueado ate aprovacao manual",
      status: "needs_review",
      detail: "Candidate-first ativo: revisar historia, paineis e direitos antes do render final."
    }
  ];
}

export function buildComicArcProjectPayloadV2(input: BuildComicArcProjectPayloadV2Input): ComicArcProjectBuilderV2Payload {
  let targetDurationSeconds = Math.max(30, input.script.estimatedDurationSeconds, input.arc.recommendedDurationSeconds);
  const panelsById = input.panelsById ?? new Map();
  const sequenceSelector = selectComicNarrativeSequence({
    arc: input.arc,
    script: input.script,
    panelsById,
    maxWindowPages: Math.max(20, input.arc.pages.length),
    minWindowPages: input.arc.pages.length >= 15 ? 15 : 1,
    minPanels: input.arc.pages.length >= 15 ? 12 : Math.min(8, Math.max(3, panelsById.size || input.arc.panelIds.length || input.script.beats.length)),
    maxPanels: input.arc.pages.length >= 15 ? Math.min(18, Math.max(15, panelsById.size || input.arc.panelIds.length || input.script.beats.length)) : Math.min(12, Math.max(8, panelsById.size || input.arc.panelIds.length || input.script.beats.length))
  });
  const panelBattleTest = runComicPanelBattleTest({
    arc: input.arc,
    script: input.script,
    panelsById,
    preferredPanelIds: sequenceSelector.selectedCandidate?.panelSequence,
    preferredBeatPanelIds: sequenceSelector.selectedCandidate?.suggestedBeatPanelIds
  });
  const preHumanizedScript: ComicArcScriptDoctorV2Result = { ...input.script, beats: panelBattleTest.optimizedBeats };
  const preHumanizerGate = evaluateComicNarrationHumanizerGate({ arc: input.arc, script: preHumanizedScript });
  const humanizedScript = applyHumanizedNarration({ script: preHumanizedScript, humanizerGate: preHumanizerGate });
  const optimizedScript = expandScriptWithNarrativeSequence({ arc: input.arc, script: humanizedScript, sequenceSelector, panelsById });
  targetDurationSeconds = Math.max(input.arc.pages.length >= 15 ? 40 : 30, Math.min(Math.max(targetDurationSeconds, input.arc.pages.length >= 15 ? 40 : 30), optimizedScript.beats.length * 4));
  const arcVisualPlan = directComicArcVisualPlan({
    arc: input.arc,
    scriptBeats: optimizedScript.beats,
    panelsById
  });
  const durations = durationPlan(optimizedScript.beats, targetDurationSeconds);
  const beatTimingPlan = buildComicBeatTimingPlan({ beats: optimizedScript.beats, durations, visualDirections: arcVisualPlan.scenes });
  const narrationHumanizerGate = evaluateComicNarrationHumanizerGate({ arc: input.arc, script: optimizedScript });
  const captionImpactPlan = buildComicCaptionImpactPlan({ beats: optimizedScript.beats, timingPlan: beatTimingPlan, visualDirections: arcVisualPlan.scenes });
  const panelContinuityReport = checkComicPanelContinuity({ arc: input.arc, beats: optimizedScript.beats, visualDirections: arcVisualPlan.scenes });
  const postRenderCropQa = evaluateComicPostRenderCropQa({
    visualDirections: arcVisualPlan.scenes,
    captionImpactPlan,
    longStoryReaderSafeMode: input.arc.pages.length >= 15
  });
  const scenes = buildScenes({ arc: input.arc, script: optimizedScript, targetDurationSeconds, arcVisualPlan, beatTimingPlan, narrationHumanizerGate: preHumanizerGate, captionImpactPlan, panelContinuityReport, postRenderCropQa });
  const project = buildProject({ ...input, script: optimizedScript }, scenes.reduce((sum, scene) => sum + (scene.duration ?? 0), 0));
  const panelAssetManifest = buildManifest(optimizedScript.beats, input.arc);
  const finalQualityGate = evaluateComicShortFinalQualityGate({
    arc: input.arc,
    script: optimizedScript,
    scenes,
    panelAssetManifest,
    targetDurationSeconds: project.durationTarget ?? targetDurationSeconds,
    arcVisualPlan,
    longStoryReaderSafeMode: input.arc.pages.length >= 15
  });
  const narrativeContinuityHardGate = evaluateComicNarrativeContinuityHardGate({
    beats: optimizedScript.beats,
    panelBattleTest,
    panelContinuityReport,
    postRenderCropQa,
    finalQualityGate,
    allowReaderSafeWideContext: input.arc.pages.length >= 15
  });
  const storyGate = storyStrengthGate({
    arc: input.arc,
    script: optimizedScript,
    finalQualityGate,
    panelBattleTest,
    narrativeContinuityHardGate,
    sequenceSelector
  });
  const warnings = unique([
    ...input.arc.warnings,
    ...optimizedScript.warnings,
    ...panelBattleTest.warnings,
    "comic_arc_project_builder_v2_applied",
    "candidate_first_payload_only",
    "manual_panel_asset_import_required",
    "manual_approval_required_before_render",
    "no_assets_imported_automatically",
    "no_render_started_automatically",
    `comic_final_quality_gate:${finalQualityGate.status}`,
    `comic_arc_visual_alignment:${arcVisualPlan.averagePanelNarrationAlignmentScore}`,
    `comic_sequence_selector:${sequenceSelector.selectedCandidate?.score ?? 0}`,
    ...sequenceSelector.warnings.map((warning) => `comic_sequence_selector_warning:${warning}`),
    `comic_story_strength_gate:${storyGate.status}:${storyGate.score}`,
    ...storyGate.blockers.map((blocker) => `story_strength_blocker:${blocker}`),
    ...storyGate.warnings.map((warning) => `story_strength_warning:${warning}`),
    `comic_panel_battle_test:${panelBattleTest.averageSelectedScore}`,
    `comic_beat_timing:${beatTimingPlan.averagePacingScore}`,
    `comic_narration_humanizer:${narrationHumanizerGate.score}`,
    `comic_caption_impact:${captionImpactPlan.averageImpactScore}`,
    `comic_panel_continuity:${panelContinuityReport.score}`,
    `comic_post_render_crop_qa:${postRenderCropQa.score}`,
    `comic_narrative_continuity_hard_gate:${narrativeContinuityHardGate.status}:${narrativeContinuityHardGate.score}`,
    ...narrativeContinuityHardGate.blockers.map((blocker) => `narrative_hard_gate_blocker:${blocker}`)
  ]);
  return {
    source: "comic-arc-project-builder-v2",
    generatedAt: new Date().toISOString(),
    arcId: input.arc.id,
    scriptDoctorId: input.script.doctorId,
    channelId: input.channelId,
    project,
    scenes,
    panelAssetManifest,
    renderBlueprintHints: {
      source: "comic_arc_project_builder_v2",
      storyArc: input.arc,
      script: optimizedScript,
      selectedBeats: optimizedScript.beats,
      targetDurationSeconds: project.durationTarget ?? targetDurationSeconds,
      sourcePages: input.arc.pages,
      panelIds: input.arc.panelIds,
      candidateFirst: true,
      finalQualityGate,
      arcVisualPlan,
      panelBattleTest,
      beatTimingPlan,
      narrationHumanizerGate,
      captionImpactPlan,
      panelContinuityReport,
      postRenderCropQa,
      narrativeContinuityHardGate,
      sequenceSelector,
      storyStrengthGate: storyGate
    },
    qualityChecklist: checklist({ arc: input.arc, script: optimizedScript, scenes, targetDurationSeconds: project.durationTarget ?? targetDurationSeconds, finalQualityGate, panelBattleTest, narrationHumanizerGate, captionImpactPlan, panelContinuityReport, postRenderCropQa, narrativeContinuityHardGate, sequenceSelector, storyStrengthGate: storyGate }),
    warnings,
    candidateFirst: true,
    requiresManualApproval: true
  };
}

export function buildComicArcProjectsFromMinerV2(input: {
  report: ComicStoryMinerReport;
  channelId: string;
  maxProjects?: number;
  templateId?: string | null;
  editingReferencePresetId?: string | null;
  titlePrefix?: string;
  storyCandidateId?: string | null;
}): ComicArcBatchProjectBuilderV2Payload {
  const arcReport = input.report.storyArcMinerV2;
  const warnings: string[] = [];
  if (!arcReport) warnings.push("story_arc_miner_v2_missing");
  const issueNarrativeMap = buildComicIssueNarrativeMap(input.report);
  const selectedStoryCandidateId = input.storyCandidateId ?? issueNarrativeMap.productionStrategy.firstShortId ?? null;

  const arcs = arcReport?.arcs ?? [];
  const scripts = arcReport?.scriptDoctor.recommendedScripts.length
    ? arcReport.scriptDoctor.recommendedScripts
    : arcReport?.scriptDoctor.scripts ?? [];
  const arcById = new Map(arcs.map((arc) => [arc.id, arc]));
  const panelsById = new Map(input.report.opportunities.flatMap((opportunity) => opportunity.panels.map((panel) => [panel.panelId, panel] as const)));
  const selectedCandidate = selectedStoryCandidateId
    ? issueNarrativeMap.storyCandidates.find((candidate) => candidate.id === selectedStoryCandidateId)
    : null;
  const selectedPanelIds = new Set(selectedCandidate?.panelIds ?? []);
  const selectedPages = new Set(selectedCandidate?.pages ?? []);
  const sortedScripts = [...scripts].sort((left, right) => {
    if (!selectedCandidate) return 0;
    const leftArc = arcById.get(left.arcId);
    const rightArc = arcById.get(right.arcId);
    const scoreArc = (arc: typeof leftArc) => {
      if (!arc) return 0;
      let score = 0;
      for (const panelId of arc.panelIds) if (selectedPanelIds.has(panelId)) score += 12;
      for (const page of arc.pages) if (selectedPages.has(page)) score += 3;
      if (arc.characters.some((character) => selectedCandidate.characters.includes(character))) score += 8;
      if (arc.themes.some((theme) => selectedCandidate.themes.includes(theme))) score += 6;
      if (selectedCandidate.source === "story_arc_v2" && selectedCandidate.id.endsWith(arc.id)) score += 80;
      return score;
    };
    return scoreArc(rightArc) - scoreArc(leftArc);
  });
  if (selectedCandidate) warnings.push(`issue_narrative_map_selected_story:${selectedCandidate.id}`);
  if (selectedStoryCandidateId && !selectedCandidate) warnings.push(`issue_narrative_map_story_candidate_not_found:${selectedStoryCandidateId}`);
  const maxProjects = Math.max(1, Math.min(input.maxProjects ?? sortedScripts.length, sortedScripts.length || 1));
  const candidateProjects = sortedScripts
    .flatMap((script) => {
      const arc = arcById.get(script.arcId);
      if (!arc) {
        warnings.push(`missing_arc_for_script:${script.arcId}`);
        return [];
      }
      const projectArc = arcWithSelectedCandidateContext({ arc, candidate: selectedCandidate });
      const scopedPanelsById = selectedCandidate
        ? new Map([...panelsById.entries()].filter(([panelId]) => selectedCandidate.panelIds.includes(panelId)))
        : panelsById;
      return [buildComicArcProjectPayloadV2({
        arc: projectArc,
        script,
        channelId: input.channelId,
        ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        ...(input.editingReferencePresetId !== undefined ? { editingReferencePresetId: input.editingReferencePresetId } : {}),
        ...(input.titlePrefix !== undefined ? { titlePrefix: input.titlePrefix } : {}),
        panelsById: scopedPanelsById.size > 0 ? scopedPanelsById : panelsById
      })];
    })
    .map((project) => ({
      ...project,
      renderBlueprintHints: {
        ...project.renderBlueprintHints,
        issueNarrativeMap,
        selectedStoryCandidateId
      },
      warnings: unique([
        ...project.warnings,
        "issue_narrative_map_applied",
        ...(selectedCandidate ? [`selected_story_candidate:${selectedCandidate.id}`] : [])
      ])
    }))
    .sort((left, right) => {
      const leftStoryGate = left.renderBlueprintHints.storyStrengthGate;
      const rightStoryGate = right.renderBlueprintHints.storyStrengthGate;
      return selectedCandidateProjectBonus(right, selectedCandidate) - selectedCandidateProjectBonus(left, selectedCandidate)
        || projectStorySelectionScore(right) - projectStorySelectionScore(left)
        || rightStoryGate.score - leftStoryGate.score
        || right.renderBlueprintHints.storyArc.overallScore - left.renderBlueprintHints.storyArc.overallScore;
    });
  const projects = candidateProjects.slice(0, maxProjects);
  if (candidateProjects.length > 0 && projects.every((project) => project.renderBlueprintHints.narrativeContinuityHardGate.status !== "passed")) {
    warnings.push("narrative_hard_gate:no_candidate_passed");
  }
  if (candidateProjects.length > 0 && projects.every((project) => project.renderBlueprintHints.storyStrengthGate.status === "blocked")) {
    warnings.push("story_strength_gate:no_candidate_ready_for_render");
  }
  if (projects.length === 0) warnings.push("no_comic_arc_projects_generated");

  return {
    source: "comic-arc-batch-project-builder-v2",
    generatedAt: new Date().toISOString(),
    channelId: input.channelId,
    projectCount: projects.length,
    projects,
    warnings: unique([
      ...warnings,
      ...(arcReport?.warnings ?? []),
      "candidate_first_payload_only",
      "issue_narrative_map_applied",
      "no_assets_imported_automatically",
      "no_render_started_automatically"
    ]),
    candidateFirst: true,
    requiresManualApproval: true
  };
}
