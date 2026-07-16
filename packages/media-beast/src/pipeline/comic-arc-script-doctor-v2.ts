import type { ComicStoryArcV2, ComicStoryArcV2Beat } from "./comic-story-arc-miner-v2.js";

export type ComicArcScriptBeat = {
  role: ComicStoryArcV2Beat["role"];
  panelId: string;
  pageNumber: number;
  narrationText: string;
  captionText: string;
  delivery: {
    energy: "high" | "extreme";
    pace: "fast" | "controlled";
    pauseAfterMs: number;
    emphasisWords: string[];
    voiceNote: string;
  };
  purpose: ComicStoryArcV2Beat["narrationJob"];
  evidenceReason: string;
};

export type ComicArcScriptDoctorV2Result = {
  doctorId: "comic_arc_script_doctor_v2";
  arcId: string;
  title: string;
  hookLine: string;
  fullNarration: string;
  beats: ComicArcScriptBeat[];
  estimatedDurationSeconds: number;
  humanScore: number;
  retentionScore: number;
  storyClarityScore: number;
  payoffScore: number;
  overallScore: number;
  readyForVoiceover: boolean;
  warnings: string[];
  nextImprovements: string[];
};

export type ComicArcScriptDoctorV2Report = {
  doctorId: "comic_arc_script_doctor_v2";
  generatedAt: string;
  scriptCount: number;
  readyScriptCount: number;
  averageScore: number;
  scripts: ComicArcScriptDoctorV2Result[];
  recommendedScripts: ComicArcScriptDoctorV2Result[];
  warnings: string[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function noAccent(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function display(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Godzilla", "Godzilla")
    .replace("Kong", "Kong")
    .replace("Superman", "Superman")
    .replace("Batman", "Batman");
}

function mainSubject(arc: ComicStoryArcV2): string {
  return display(arc.characters[0] ?? arc.themes[0] ?? arc.title);
}

function secondSubject(arc: ComicStoryArcV2): string | null {
  return arc.characters[1] ? display(arc.characters[1]) : null;
}

function hookLine(arc: ComicStoryArcV2): string {
  const main = mainSubject(arc);
  const second = secondSubject(arc);
  if (arc.type === "hero_vs_kaiju_showdown") return second ? `${main} contra ${second} parece absurdo... ate a HQ fazer isso funcionar.` : `${main} entra numa cena grande demais pra ser ignorada.`;
  if (arc.type === "battle_escalation") return second ? `${main} e ${second} comecam num conflito simples... mas a pagina escala rapido.` : `Essa luta parece so mais uma pancada, mas a virada vem muito rapido.`;
  if (arc.type === "hidden_reveal") return `Tem uma pista nessa HQ que muda tudo quando voce percebe.`;
  if (arc.type === "unlikely_alliance") return second ? `${main} e ${second} nao deveriam funcionar juntos, e e isso que deixa a cena boa.` : `Essa relacao parece errada, mas a HQ usa isso como tensao.`;
  if (arc.type === "comic_absurdity") return `Esse momento e tao absurdo que so quadrinho conseguiria vender serio.`;
  if (arc.type === "visual_curiosity") return `Quase ninguem repararia nesse detalhe da pagina de primeira.`;
  return `Esse e o ponto em que a historia muda de direcao.`;
}

function beatText(arc: ComicStoryArcV2, beat: ComicStoryArcV2Beat): string {
  const main = mainSubject(arc);
  const second = secondSubject(arc) ?? "a ameaca";
  if (beat.role === "hook") return hookLine(arc);
  if (beat.role === "setup") {
    if (arc.type === "hero_vs_kaiju_showdown") return `Antes do impacto, a HQ precisa vender escala: ${main} nao esta olhando para um inimigo comum.`;
    if (arc.type === "hidden_reveal") return `O truque esta no contexto: a pagina entrega a pista antes de explicar.`;
    return `Primeiro, a cena te coloca no lugar certo: quem esta em perigo, quem segura a tensao e por que isso importa.`;
  }
  if (beat.role === "tension") {
    if (arc.type === "unlikely_alliance") return `A tensao cresce porque ninguem aqui parece confiar de verdade em ninguem.`;
    return `Agora a leitura muda: o quadro comeca a empurrar tudo para uma consequencia maior.`;
  }
  if (beat.role === "climax") {
    if (arc.type === "battle_escalation" || arc.type === "hero_vs_kaiju_showdown") return `Aqui e o corte forte: ${main} e ${second} viram uma imagem que segura o short sozinha.`;
    return `Aqui vem a virada: o detalhe deixa de ser contexto e vira o ponto principal.`;
  }
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return `E por isso esse detalhe vale um short: ele muda o jeito que voce le a cena inteira.`;
  return `E o melhor e que esse payoff ainda deixa uma pergunta perfeita para o proximo corte.`;
}

function captionFor(text: string, beat: ComicStoryArcV2Beat): string {
  if (beat.role === "hook") return "ISSO PARECE ABSURDO";
  if (beat.role === "setup") return "MAS OLHA O CONTEXTO";
  if (beat.role === "tension") return "A TENSAO SOBE";
  if (beat.role === "climax") return "A VIRADA ESTA AQUI";
  const words = text.replace(/[.,!?;:]/g, "").split(/\s+/).filter((word) => word.length > 2).slice(0, 5);
  return words.length ? words.join(" ").toUpperCase() : "E ISSO MUDA TUDO";
}

function emphasisWords(text: string, arc: ComicStoryArcV2): string[] {
  const normalized = noAccent(text);
  const preferred = [
    ...arc.characters,
    ...arc.themes,
    "impacto",
    "virada",
    "pista",
    "ameaca",
    "escala",
    "short"
  ];
  return [...new Set(preferred)]
    .map((word) => display(word))
    .filter((word) => normalized.includes(noAccent(word)) || ["Impacto", "Virada", "Pista"].includes(word))
    .slice(0, 4);
}

function buildBeat(arc: ComicStoryArcV2, beat: ComicStoryArcV2Beat): ComicArcScriptBeat {
  const text = clean(beatText(arc, beat));
  return {
    role: beat.role,
    panelId: beat.panelId,
    pageNumber: beat.pageNumber,
    narrationText: text,
    captionText: captionFor(text, beat),
    delivery: {
      energy: beat.role === "hook" || beat.role === "climax" ? "extreme" : "high",
      pace: beat.role === "setup" ? "controlled" : "fast",
      pauseAfterMs: beat.role === "climax" ? 140 : beat.role === "payoff" ? 180 : 70,
      emphasisWords: emphasisWords(text, arc),
      voiceNote: beat.role === "hook"
        ? "Abrir como criador contando algo insano, sem soar narrador formal."
        : beat.role === "climax"
          ? "Subir energia e atacar a palavra de impacto."
          : "Falar natural, frase curta, como explicando para amigo curioso."
    },
    purpose: beat.narrationJob,
    evidenceReason: beat.reason
  };
}

function estimateDuration(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(30, Math.min(58, Math.round(words / 2.65)));
}

function genericPenalty(text: string): number {
  const normalized = noAccent(text);
  const generic = [
    "essa sequencia tem forca visual",
    "poucos paineis",
    "leitura rapida",
    "neste painel",
    "aqui vemos",
    "o corte mostra",
    "essa cena"
  ];
  return generic.filter((phrase) => normalized.includes(phrase)).length * 12;
}

function scoreScript(input: { arc: ComicStoryArcV2; beats: ComicArcScriptBeat[]; fullNarration: string }) {
  const wordCount = input.fullNarration.split(/\s+/).filter(Boolean).length;
  const hasQuestionOrCuriosity = /\?|pista|detalhe|absurdo|virada|por isso|quando voce percebe/i.test(input.fullNarration);
  const hasPayoff = input.beats.some((beat) => beat.role === "payoff") && /por isso|payoff|pergunta|muda|proximo|inteira/i.test(input.fullNarration);
  const hasConcreteSubject = input.arc.characters.some((character) => noAccent(input.fullNarration).includes(noAccent(display(character))));
  const humanScore = clampScore(82 - genericPenalty(input.fullNarration) + (hasQuestionOrCuriosity ? 8 : 0) + (wordCount >= 70 ? 6 : 0));
  const retentionScore = clampScore(input.arc.retentionScore * 0.55 + (hasQuestionOrCuriosity ? 22 : 8) + (input.beats.length >= 4 ? 12 : 0));
  const storyClarityScore = clampScore(input.arc.storyCompletenessScore * 0.58 + (hasConcreteSubject ? 16 : 4) + (input.beats.length >= 4 ? 16 : 0));
  const payoffScore = clampScore((hasPayoff ? 80 : 52) + (input.beats.some((beat) => beat.role === "climax") ? 10 : 0));
  const overallScore = clampScore(humanScore * 0.3 + retentionScore * 0.28 + storyClarityScore * 0.22 + payoffScore * 0.2);
  return { humanScore, retentionScore, storyClarityScore, payoffScore, overallScore };
}

export function doctorComicStoryArcScriptV2(arc: ComicStoryArcV2): ComicArcScriptDoctorV2Result {
  const beats = arc.beats.map((beat) => buildBeat(arc, beat));
  const hook = beats[0]?.narrationText ?? hookLine(arc);
  const fullNarration = clean(beats.map((beat) => beat.narrationText).join(" "));
  const estimatedDurationSeconds = Math.max(arc.minimumDurationSeconds, estimateDuration(fullNarration));
  const scores = scoreScript({ arc, beats, fullNarration });
  const warnings: string[] = [];
  if (beats.length < 4) warnings.push("script_arc_has_too_few_beats");
  if (estimatedDurationSeconds < 30) warnings.push("script_duration_below_30_seconds");
  if (scores.humanScore < 78) warnings.push("script_sounds_too_generic");
  if (scores.payoffScore < 76) warnings.push("script_payoff_needs_stronger_close");
  if (!arc.readyForShort) warnings.push("source_arc_not_marked_ready_for_short");

  return {
    doctorId: "comic_arc_script_doctor_v2",
    arcId: arc.id,
    title: arc.title,
    hookLine: hook,
    fullNarration,
    beats,
    estimatedDurationSeconds,
    humanScore: scores.humanScore,
    retentionScore: scores.retentionScore,
    storyClarityScore: scores.storyClarityScore,
    payoffScore: scores.payoffScore,
    overallScore: scores.overallScore,
    readyForVoiceover: scores.overallScore >= 78 && estimatedDurationSeconds >= 30 && beats.length >= 4,
    warnings,
    nextImprovements: [
      "Use actual OCR balloon text as optional quote lines when confidence is high.",
      "Add per-channel voice/personality variants for the same arc.",
      "Score generated narration against rendered panel contact sheet before voiceover."
    ]
  };
}

export function doctorComicStoryArcScriptsV2(input: { arcs: ComicStoryArcV2[] }): ComicArcScriptDoctorV2Report {
  const scripts = input.arcs.map((arc) => doctorComicStoryArcScriptV2(arc)).sort((left, right) => right.overallScore - left.overallScore);
  const averageScore = scripts.length ? Math.round(scripts.reduce((sum, script) => sum + script.overallScore, 0) / scripts.length) : 0;
  const warnings: string[] = [];
  if (scripts.length === 0) warnings.push("no_arc_scripts_generated");
  if (scripts.every((script) => !script.readyForVoiceover)) warnings.push("no_arc_script_ready_for_voiceover");
  return {
    doctorId: "comic_arc_script_doctor_v2",
    generatedAt: new Date().toISOString(),
    scriptCount: scripts.length,
    readyScriptCount: scripts.filter((script) => script.readyForVoiceover).length,
    averageScore,
    scripts,
    recommendedScripts: scripts.filter((script) => script.readyForVoiceover).slice(0, 12),
    warnings
  };
}
