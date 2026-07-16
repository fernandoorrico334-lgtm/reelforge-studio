import type { ComicShortOpportunity, ComicStoryMinerReport } from "./comic-story-miner.js";
import { doctorComicStoryArcScriptsV2, type ComicArcScriptDoctorV2Report } from "./comic-arc-script-doctor-v2.js";

type ComicStoryMinerBaseReport = Omit<ComicStoryMinerReport, "storyArcMinerV2"> | ComicStoryMinerReport;

export type ComicStoryArcV2Type =
  | "hero_vs_kaiju_showdown"
  | "battle_escalation"
  | "hidden_reveal"
  | "unlikely_alliance"
  | "character_turning_point"
  | "visual_curiosity"
  | "comic_absurdity";

export type ComicStoryArcV2Beat = {
  role: "hook" | "setup" | "tension" | "climax" | "payoff";
  panelId: string;
  pageNumber: number;
  reason: string;
  narrationJob: "grab_attention" | "explain_context" | "raise_stakes" | "deliver_impact" | "reward_viewer";
};

export type ComicStoryArcV2 = {
  id: string;
  title: string;
  type: ComicStoryArcV2Type;
  shortAngle: string;
  viewerPromise: string;
  retentionHook: string;
  payoff: string;
  minimumDurationSeconds: number;
  recommendedDurationSeconds: number;
  sourceOpportunityIds: string[];
  pages: number[];
  panelIds: string[];
  characters: string[];
  themes: string[];
  beats: ComicStoryArcV2Beat[];
  storyCompletenessScore: number;
  visualStrengthScore: number;
  narrationPotentialScore: number;
  retentionScore: number;
  overallScore: number;
  readyForShort: boolean;
  reasons: string[];
  warnings: string[];
};

export type ComicStoryArcMinerV2Report = {
  minerId: "comic_story_arc_miner_v2";
  generatedAt: string;
  totalArcs: number;
  readyArcCount: number;
  averageScore: number;
  arcs: ComicStoryArcV2[];
  recommendedShorts: ComicStoryArcV2[];
  scriptDoctor: ComicArcScriptDoctorV2Report;
  warnings: string[];
  nextImprovements: string[];
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "story-arc";
}

function hasCategory(opportunities: ComicShortOpportunity[], category: ComicShortOpportunity["category"]): boolean {
  return opportunities.some((opportunity) => opportunity.category === category);
}

function dominant(values: string[], fallback = "a cena"): string {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? fallback;
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

function inferArcType(opportunities: ComicShortOpportunity[]): ComicStoryArcV2Type {
  const text = opportunities.map((opportunity) => `${opportunity.title} ${opportunity.angle} ${opportunity.themes.join(" ")} ${opportunity.characters.join(" ")}`).join(" ").toLowerCase();
  if (/godzilla|kong|kaiju|monster/.test(text) && hasCategory(opportunities, "fight")) return "hero_vs_kaiju_showdown";
  if (hasCategory(opportunities, "fight") || hasCategory(opportunities, "transformation")) return "battle_escalation";
  if (hasCategory(opportunities, "reveal") || hasCategory(opportunities, "origin") || hasCategory(opportunities, "cliffhanger")) return "hidden_reveal";
  if (hasCategory(opportunities, "relationship")) return "unlikely_alliance";
  if (hasCategory(opportunities, "humor")) return "comic_absurdity";
  if (hasCategory(opportunities, "curiosity") || hasCategory(opportunities, "visual_moment")) return "visual_curiosity";
  return "character_turning_point";
}

function titleFor(type: ComicStoryArcV2Type, characters: string[], themes: string[]): string {
  const main = display(characters[0] ?? themes[0] ?? "essa HQ");
  const second = characters[1] ? display(characters[1]) : null;
  if (type === "hero_vs_kaiju_showdown") return second ? `${main} contra ${second}: o confronto que vira short` : `${main}: confronto de escala absurda`;
  if (type === "battle_escalation") return second ? `${main} e ${second}: a batalha que escala rapido` : `${main}: a batalha que escala rapido`;
  if (type === "hidden_reveal") return `A revelacao escondida sobre ${main}`;
  if (type === "unlikely_alliance") return second ? `${main} e ${second}: alianca ou conflito?` : `${main}: relacao que muda a cena`;
  if (type === "comic_absurdity") return `O momento mais absurdo de ${main}`;
  if (type === "visual_curiosity") return `O detalhe visual que quase passa batido em ${main}`;
  return `O ponto de virada de ${main}`;
}

function hookFor(type: ComicStoryArcV2Type, characters: string[]): string {
  const main = display(characters[0] ?? "essa cena");
  const second = characters[1] ? display(characters[1]) : "algo muito maior";
  if (type === "hero_vs_kaiju_showdown") return `E se ${main} tivesse que encarar ${second} em poucos segundos?`;
  if (type === "battle_escalation") return `Essa luta parece simples, ate a HQ mostrar que nao era.`;
  if (type === "hidden_reveal") return `Tem um detalhe aqui que muda completamente essa cena.`;
  if (type === "unlikely_alliance") return `Essa dupla nao deveria funcionar, mas a HQ brinca exatamente com isso.`;
  if (type === "comic_absurdity") return `Esse e o tipo de cena que so quadrinho consegue levar a serio.`;
  if (type === "visual_curiosity") return `Olha o detalhe que a maioria passaria direto nessa pagina.`;
  return `Esse e o momento em que a historia vira de lado.`;
}

function payoffFor(type: ComicStoryArcV2Type, characters: string[]): string {
  const main = display(characters[0] ?? "a historia");
  if (type === "hero_vs_kaiju_showdown") return `O payoff e vender a escala: ${main} nao esta so lutando, esta tentando sobreviver a uma forca absurda.`;
  if (type === "battle_escalation") return "O payoff e mostrar a virada visual: a cena sobe de contexto para impacto.";
  if (type === "hidden_reveal") return "O payoff e entregar o detalhe que estava escondido no proprio quadrinho.";
  if (type === "unlikely_alliance") return "O payoff e a tensao da relacao: conflito, parceria ou dependencia forcada.";
  if (type === "comic_absurdity") return "O payoff e o absurdo da premissa funcionando porque a arte vende tudo com seriedade.";
  if (type === "visual_curiosity") return "O payoff e fazer o espectador enxergar algo que ele provavelmente ignoraria.";
  return "O payoff e deixar claro por que esse trecho merecia virar short.";
}

function roleCandidateWeight(opportunity: ComicShortOpportunity, panelStoryFunction: string | undefined, role: ComicStoryArcV2Beat["role"]): number {
  let weight = opportunity.score;
  if ((role === "hook" || role === "climax") && ["fight", "transformation", "reveal"].includes(opportunity.category)) weight += 18;
  if (role === "setup" && ["relationship", "curiosity"].includes(opportunity.category)) weight += 10;
  if (role === "tension" && ["relationship", "fight"].includes(opportunity.category)) weight += 10;
  if (role === "payoff" && ["reveal", "curiosity", "relationship"].includes(opportunity.category)) weight += 12;
  if ((role === "hook" || role === "climax") && ["action", "climax", "transformation", "reveal"].includes(panelStoryFunction ?? "")) weight += 14;
  if (role === "setup" && ["setup", "context", "dialogue"].includes(panelStoryFunction ?? "")) weight += 10;
  if (role === "payoff" && ["reaction", "reveal", "dialogue"].includes(panelStoryFunction ?? "")) weight += 10;
  return weight;
}
function pickRolePanel(
  opportunities: ComicShortOpportunity[],
  role: ComicStoryArcV2Beat["role"],
  usedPanelIds: Set<string>
): ComicStoryArcV2Beat | null {
  const roleMatches = opportunities.flatMap((opportunity) =>
    opportunity.visualSequence
      .filter((entry) => !usedPanelIds.has(entry.panelId))
      .filter((entry) => {
        if (role === "hook") return entry.role === "hook";
        if (role === "setup") return entry.role === "context" || entry.role === "development";
        if (role === "tension") return entry.role === "development";
        if (role === "climax") return entry.role === "climax";
        return entry.role === "payoff";
      })
      .map((entry) => ({
        opportunity,
        panelId: entry.panelId,
        panel: opportunity.panels.find((panel) => panel.panelId === entry.panelId)
      }))
  ).sort((left, right) =>
    roleCandidateWeight(right.opportunity, right.panel?.storyFunction, role) -
    roleCandidateWeight(left.opportunity, left.panel?.storyFunction, role)
  );

  const preferredPanel = opportunities
    .flatMap((opportunity) => opportunity.panels.map((panel) => ({ opportunity, panel })))
    .filter((entry) => !usedPanelIds.has(entry.panel.panelId))
    .sort((left, right) =>
      roleCandidateWeight(right.opportunity, right.panel.storyFunction, role) -
      roleCandidateWeight(left.opportunity, left.panel.storyFunction, role)
    )
    .find((entry) => {
      if (role === "hook") return ["setup", "action", "climax", "reveal"].includes(entry.panel.storyFunction);
      if (role === "setup") return ["setup", "context", "dialogue"].includes(entry.panel.storyFunction);
      if (role === "tension") return ["dialogue", "reaction", "action", "relationship"].includes(entry.panel.storyFunction);
      if (role === "climax") return ["climax", "action", "transformation", "reveal"].includes(entry.panel.storyFunction);
      return ["reaction", "reveal", "dialogue", "context"].includes(entry.panel.storyFunction);
    });

  const preferredPick = preferredPanel ? { opportunity: preferredPanel.opportunity, panelId: preferredPanel.panel.panelId } : null;
  const picked = (role === "hook" || role === "climax" ? preferredPick ?? roleMatches[0] : roleMatches[0] ?? preferredPick)
    ?? opportunities
      .flatMap((opportunity) => opportunity.panels.map((panel) => ({ opportunity, panelId: panel.panelId })))
      .find((entry) => !usedPanelIds.has(entry.panelId));

  if (!picked) return null;
  const panel = picked.opportunity.panels.find((candidate) => candidate.panelId === picked.panelId) ?? picked.opportunity.panels[0];
  if (!panel) return null;
  usedPanelIds.add(panel.panelId);
  return {
    role,
    panelId: panel.panelId,
    pageNumber: panel.pageNumber,
    reason: `arc_${role}:${picked.opportunity.category}:${picked.opportunity.title}`,
    narrationJob:
      role === "hook"
        ? "grab_attention"
        : role === "setup"
          ? "explain_context"
          : role === "tension"
            ? "raise_stakes"
            : role === "climax"
              ? "deliver_impact"
              : "reward_viewer"
  };
}
function scoreCompleteness(beats: ComicStoryArcV2Beat[], opportunities: ComicShortOpportunity[]): number {
  let score = beats.length * 16;
  if (beats.some((beat) => beat.role === "hook")) score += 8;
  if (beats.some((beat) => beat.role === "climax")) score += 14;
  if (beats.some((beat) => beat.role === "payoff")) score += 12;
  if (opportunities.length >= 2) score += 10;
  return clampScore(score);
}

function scoreVisual(opportunities: ComicShortOpportunity[]): number {
  const avg = opportunities.length
    ? opportunities.reduce((sum, opportunity) => sum + opportunity.score, 0) / opportunities.length
    : 0;
  const panels = unique(opportunities.flatMap((opportunity) => opportunity.panelIds));
  return clampScore(avg * 0.72 + Math.min(18, panels.length * 2.8) + (hasCategory(opportunities, "fight") ? 8 : 0));
}

function scoreNarration(opportunities: ComicShortOpportunity[]): number {
  let score = 48;
  if (opportunities.some((opportunity) => opportunity.narrationDraft.length >= 90)) score += 14;
  if (hasCategory(opportunities, "curiosity") || hasCategory(opportunities, "reveal")) score += 14;
  if (hasCategory(opportunities, "relationship")) score += 8;
  if (opportunities.flatMap((opportunity) => opportunity.panels).some((panel) => panel.localDialogue.length + panel.localNarrationBoxes.length > 0)) score += 12;
  return clampScore(score);
}

function scoreRetention(type: ComicStoryArcV2Type, opportunities: ComicShortOpportunity[]): number {
  let score = 52;
  if (["hero_vs_kaiju_showdown", "battle_escalation", "hidden_reveal"].includes(type)) score += 18;
  if (hasCategory(opportunities, "fight")) score += 10;
  if (hasCategory(opportunities, "cliffhanger") || hasCategory(opportunities, "reveal")) score += 10;
  if (unique(opportunities.flatMap((opportunity) => opportunity.pages)).length >= 2) score += 6;
  return clampScore(score);
}

function groupOpportunities(report: ComicStoryMinerBaseReport): ComicShortOpportunity[][] {
  const groups = new Map<string, ComicShortOpportunity[]>();
  for (const opportunity of report.opportunities) {
    const characters = opportunity.characters.slice(0, 2).sort().join("+") || "unknown";
    const theme = opportunity.themes[0] ?? opportunity.storyArc ?? opportunity.category;
    const pageBand = opportunity.pages.length ? Math.floor(Math.min(...opportunity.pages) / 3) : 0;
    const key = `${characters}:${theme}:${pageBand}`;
    const group = groups.get(key) ?? [];
    group.push(opportunity);
    groups.set(key, group);
  }

  const directGroups = [...groups.values()].filter((group) => group.length > 0);
  const topSingles = report.topOpportunities.slice(0, 12).map((opportunity) => [opportunity]);
  return [...directGroups, ...topSingles];
}

function buildArc(group: ComicShortOpportunity[], index: number): ComicStoryArcV2 {
  const opportunities = [...group].sort((left, right) => right.score - left.score).slice(0, 5);
  const characters = unique(opportunities.flatMap((opportunity) => opportunity.characters)).slice(0, 6);
  const themes = unique(opportunities.flatMap((opportunity) => opportunity.themes)).slice(0, 8);
  const type = inferArcType(opportunities);
  const usedPanelIds = new Set<string>();
  const beats = (["hook", "setup", "tension", "climax", "payoff"] as const)
    .map((role) => pickRolePanel(opportunities, role, usedPanelIds))
    .filter((beat): beat is ComicStoryArcV2Beat => Boolean(beat));
  const pages = unique(opportunities.flatMap((opportunity) => opportunity.pages)).sort((left, right) => left - right);
  const panelIds = unique(beats.map((beat) => beat.panelId));
  const storyCompletenessScore = scoreCompleteness(beats, opportunities);
  const visualStrengthScore = scoreVisual(opportunities);
  const narrationPotentialScore = scoreNarration(opportunities);
  const retentionScore = scoreRetention(type, opportunities);
  const overallScore = clampScore(storyCompletenessScore * 0.28 + visualStrengthScore * 0.28 + narrationPotentialScore * 0.2 + retentionScore * 0.24);
  const warnings: string[] = [];
  if (beats.length < 5) warnings.push("arc_missing_full_five_beat_structure");
  if (!beats.some((beat) => beat.role === "climax")) warnings.push("arc_missing_clear_climax");
  if (panelIds.length < 3) warnings.push("arc_has_low_visual_variety");
  if (overallScore < 72) warnings.push("arc_below_premium_short_threshold");

  return {
    id: `comic-story-arc-v2-${index + 1}-${slug(titleFor(type, characters, themes))}`,
    title: titleFor(type, characters, themes),
    type,
    shortAngle: opportunities[0]?.angle ?? `Short extraido de ${display(characters[0] ?? themes[0] ?? "HQ")}`,
    viewerPromise: hookFor(type, characters),
    retentionHook: hookFor(type, characters),
    payoff: payoffFor(type, characters),
    minimumDurationSeconds: 30,
    recommendedDurationSeconds: Math.max(30, Math.min(54, panelIds.length * 7 + 8)),
    sourceOpportunityIds: opportunities.map((opportunity) => opportunity.id),
    pages,
    panelIds,
    characters,
    themes,
    beats,
    storyCompletenessScore,
    visualStrengthScore,
    narrationPotentialScore,
    retentionScore,
    overallScore,
    readyForShort: overallScore >= 72 && beats.length >= 4 && panelIds.length >= 3,
    reasons: [
      `arc_type:${type}`,
      `beats:${beats.length}`,
      `panels:${panelIds.length}`,
      `source_opportunities:${opportunities.length}`,
      `retention:${retentionScore}`,
      `visual:${visualStrengthScore}`
    ],
    warnings
  };
}

export function buildComicStoryArcMinerV2Report(report: ComicStoryMinerBaseReport): ComicStoryArcMinerV2Report {
  const groups = groupOpportunities(report);
  const seen = new Set<string>();
  const arcs = groups
    .map((group, index) => buildArc(group, index))
    .filter((arc) => {
      const key = arc.panelIds.join("|") || arc.sourceOpportunityIds.join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.overallScore - left.overallScore)
    .slice(0, 30);
  const warnings: string[] = [];
  if (arcs.length === 0) warnings.push("no_story_arcs_detected");
  if (arcs.filter((arc) => arc.readyForShort).length === 0) warnings.push("no_ready_story_arcs_above_premium_threshold");
  const averageScore = arcs.length ? Math.round(arcs.reduce((sum, arc) => sum + arc.overallScore, 0) / arcs.length) : 0;
  const recommendedShorts = arcs.filter((arc) => arc.readyForShort).slice(0, 12);
  const scriptDoctor = doctorComicStoryArcScriptsV2({ arcs: recommendedShorts.length ? recommendedShorts : arcs.slice(0, 12) });
  return {
    minerId: "comic_story_arc_miner_v2",
    generatedAt: new Date().toISOString(),
    totalArcs: arcs.length,
    readyArcCount: arcs.filter((arc) => arc.readyForShort).length,
    averageScore,
    arcs,
    recommendedShorts,
    scriptDoctor,
    warnings,
    nextImprovements: [
      "Use OCR/dialogue ordering to make every arc scene-first instead of opportunity-first.",
      "Render an arc contact sheet with hook/setup/tension/climax/payoff before final project creation.",
      "Add human narration doctor per arc so every recommended short has curiosity, escalation and payoff."
    ]
  };
}
