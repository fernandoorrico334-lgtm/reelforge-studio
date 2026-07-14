import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type {
  SceneEvidenceContract,
  SceneFirstNarrationCue,
  SceneFirstStoryProposal
} from "./comics-scene-first-narration.js";

export const SCENE_EVIDENCE_AUDIT_FILENAME = "variation-b-scene-evidence-audit.json";
export const SCENE_EVIDENCE_CONTACT_SHEET_FILENAME = "variation-b-scene-evidence-contact-sheet.jpg";

export const EVIDENCE_AUDIT_THRESHOLDS = {
  evidenceScore: 85,
  hookDirectEvidence: true,
  climaxDirectEvidence: true,
  minDistinctVisualSteps: 3
} as const;

export const FORBIDDEN_LITERAL_TAG_PHRASES = [
  "duo presence",
  "symbiote duo presence",
  "symbiote mass",
  "symbiote_duo_presence",
  "tema de transformação",
  "visual_symbiote_duo",
  "perfect_partner"
] as const;

export type EvidenceClaimTier = "visibleFact" | "strongInference" | "unsupportedInterpretation";

export type PanelVisualAuditRecord = {
  panelId: string;
  panelImagePath: string;
  panelImageSha256: string;
  indexClaimedEntities: string[];
  indexLiteralDescription: string;

  literalDescriptionPtBr: string;
  whoAppears: string[];
  characterPositions: string;
  visibleAction: string;
  symbioteElementVisible: string;
  expressionOrReaction: string;
  cannotConclude: string[];

  visibleFacts: string[];
  strongInferences: string[];
  unsupportedInterpretations: string[];

  indexMismatch: boolean;
  indexMismatchReasons: string[];
};

export type NarrationClaimAudit = {
  claim: string;
  tier: EvidenceClaimTier;
  supported: boolean;
  reason: string;
};

export type NarrationEvidenceAudit = {
  beatId: string;
  role: SceneFirstNarrationCue["role"];
  panelId: string;
  originalNarration: string;
  revisedNarration: string;
  removedClaims: string[];
  claimAudits: NarrationClaimAudit[];
  evidenceScore: number;
  hookOrClimaxDirectEvidence: boolean;
  passesEvidenceGate: boolean;
  warnings: string[];
};

export type SceneEvidenceAuditEntry = {
  panelId: string;
  panelImagePath: string;
  literalDescriptionPtBr: string;
  visibleFacts: string[];
  strongInferences: string[];
  unsupportedInterpretations: string[];
  indexMismatch: boolean;
  evidenceScore: number;
  narrationAudits: NarrationEvidenceAudit[];
};

export type SceneEvidenceAuditResult = {
  generatedAt: string;
  sourceScriptPath: string;
  originalProposalTitle: string;
  originalProposalTopic: string;
  revisedProposalTitle: string;
  revisedProposalTopic: string;
  transformationArcVisible: boolean;
  distinctVisualSteps: string[];
  distinctVisualStepCount: number;
  arcAssessment: string;
  panels: PanelVisualAuditRecord[];
  scenes: SceneEvidenceAuditEntry[];
  narrationBeforeAfter: Array<{
    role: string;
    panelId: string;
    before: string;
    after: string;
    removedClaims: string[];
    evidenceScore: number;
  }>;
  allRemovedClaims: string[];
  unsupportedClaimCount: number;
  averageEvidenceScore: number;
  hookEvidenceScore: number;
  climaxEvidenceScore: number;
  literalDescriptionsSpecific: boolean;
  canRender: boolean;
  canPublish: boolean;
  blockReason: string | null;
  auditPath: string | null;
  contactSheetPath: string | null;
};

const PANEL_VISUAL_AUDITS: Record<string, Omit<PanelVisualAuditRecord, "panelId" | "panelImagePath" | "panelImageSha256" | "indexClaimedEntities" | "indexLiteralDescription">> = {
  "user-remix-asset-28ec95401fea:page1:panel1": {
    literalDescriptionPtBr:
      "Homem calvo de macacão azul está parado à esquerda, com uma mão na cintura, ao lado de um trator verde em primeiro plano. Ao fundo há campo marrom, cerca e céu azul com nuvens.",
    whoAppears: ["homem calvo de macacão azul"],
    characterPositions: "Homem à esquerda do quadro, corpo de frente para a direita; trator verde ocupa o centro-direita.",
    visibleAction: "Homem parado em pose estática; nenhum movimento, luta ou transformação visível.",
    symbioteElementVisible: "Nenhum elemento orgânico preto, massa simbionte ou traje colado ao corpo.",
    expressionOrReaction: "Rosto pequeno e simplificado; não há expressão legível de choque, dor ou perda de controle.",
    cannotConclude: [
      "Venom visível",
      "Homem-Aranha visível",
      "dupla Venom e Homem-Aranha",
      "traje preto ou simbionte",
      "transformação corporal",
      "perda de controle",
      "confronto"
    ],
    visibleFacts: [
      "homem calvo com macacão azul",
      "trator verde em primeiro plano",
      "campo rural ao fundo",
      "céu azul com nuvens"
    ],
    strongInferences: ["cena de contexto rural ou cotidiano"],
    unsupportedInterpretations: [
      "Venom e Homem-Aranha na mesma cena",
      "presença de simbionte",
      "tema de parceria ou simbiose",
      "início de transformação do traje"
    ],
    indexMismatch: true,
    indexMismatchReasons: [
      "índice marca Venom e Homem-Aranha, mas o crop mostra agricultor e trator",
      "tag symbiote_duo_presence não corresponde ao visual"
    ]
  },
  "user-remix-asset-28ec95401fea:page1:panel5": {
    literalDescriptionPtBr:
      "No canto inferior esquerdo aparece recorte parcial de figura preta e branca muscular. No centro há abóbora laranja esculpida cercada por tentáculos brancos grossos. Letreiro amarelo parcialmente legível: ANHA / LIENÍGENA.",
    whoAppears: ["figura preta e branca parcial (recorte de ombro/cabeça)"],
    characterPositions:
      "Figura cortada no canto inferior esquerdo; abóbora no centro; tentáculos atravessam o quadro.",
    visibleAction:
      "Nenhuma ação dinâmica clara; abóbora suspensa/envolvida por tentáculos brancos em composição estática.",
    symbioteElementVisible:
      "Tentáculos brancos orgânicos em contato com a abóbora; figura preta/branca parcial pode ser traje orgânico, mas está cortada.",
    expressionOrReaction: "Sem rosto legível da figura; sem reação corporal identificável.",
    cannotConclude: [
      "Homem-Aranha visível",
      "dupla completa no mesmo quadro",
      "traje preto envolvendo corpo humano inteiro",
      "transformação em andamento",
      "perda de controle",
      "identidade certa da figura parcial"
    ],
    visibleFacts: [
      "abóbora laranja esculpida no centro",
      "tentáculos brancos grossos",
      "figura preta e branca parcial no canto",
      "texto amarelo ANHA / LIENÍGENA"
    ],
    strongInferences: [
      "elemento orgânico branco em contato com objeto central",
      "figura parcial compatível com traje simbionte, mas incompleta"
    ],
    unsupportedInterpretations: [
      "Venom e Homem-Aranha juntos",
      "traje preto como parte do corpo já estabelecido",
      "transformação confirmada",
      "clímax de simbiose"
    ],
    indexMismatch: true,
    indexMismatchReasons: [
      "índice afirma dupla Venom + Homem-Aranha; crop não mostra Homem-Aranha",
      "descrição symbiote duo presence ignora abóbora e texto visíveis"
    ]
  },
  "user-remix-asset-28ec95401fea:page1:panel10": {
    literalDescriptionPtBr:
      "Abóbora laranja grande com rosto esculpido iluminada por dentro, envolta por tentáculos brancos retorcidos. Há forma preta parcial no canto superior esquerdo e prédios inclinados ao fundo.",
    whoAppears: ["forma preta parcial sem rosto legível"],
    characterPositions:
      "Forma preta cortada no canto superior esquerdo; abóbora ocupa o centro; fundo urbano inclinado.",
    visibleAction:
      "Tentáculos brancos em contato com a abóbora; cena estática, sem sequência de mudança corporal visível.",
    symbioteElementVisible: "Tentáculos brancos orgânicos envolvendo a abóbora; não há corpo humano completo visível.",
    expressionOrReaction: "Nenhuma reação facial ou corporal legível.",
    cannotConclude: [
      "Venom identificável",
      "Homem-Aranha",
      "massa simbionte substituindo traje",
      "transformação corporal",
      "consequência emocional",
      "vínculo hospedeiro-simbionte comprovado"
    ],
    visibleFacts: [
      "abóbora esculpida com luz interna",
      "tentáculos brancos envolvendo o objeto",
      "fundo urbano inclinado",
      "forma preta parcial cortada"
    ],
    strongInferences: ["objeto central dominado por material orgânico branco"],
    unsupportedInterpretations: [
      "symbiote mass como transformação de personagem",
      "ligação hospedeiro-simbionte",
      "payoff narrativo de simbiose"
    ],
    indexMismatch: true,
    indexMismatchReasons: [
      "índice descreve symbiote mass sem mencionar abóbora, que é o foco visual",
      "entidade simbionte sem personagem hospedeiro visível"
    ]
  },
  "user-remix-asset-3b8b7c565b52:page5:panel7": {
    literalDescriptionPtBr:
      "Homem de perfil com capa vermelha alta, túnica azul, colar com gema verde e cabelo preto com faixas brancas. Ele olha para cima, com balões de fala em português. À direita, livro ornamentado com aura verde.",
    whoAppears: ["homem de capa vermelha e colar verde (Doutor Estranho)"],
    characterPositions: "Perfil virado à direita, cabeça inclinada para cima; livro no canto superior direito.",
    visibleAction: "Personagem falando; boca entreaberta; olhar elevado.",
    symbioteElementVisible: "Nenhum material orgânico preto, traje simbionte ou massa branca envolvendo corpo.",
    expressionOrReaction: "Fala ativa; sem sinais visíveis de transformação, choque físico ou luta.",
    cannotConclude: [
      "Venom",
      "Homem-Aranha",
      "dupla no mesmo quadro",
      "simbiose",
      "clímax de transformação",
      "Natasha visível (só citada no diálogo)"
    ],
    visibleFacts: [
      "homem de capa vermelha em perfil",
      "colar com gema verde",
      "três balões de diálogo em português",
      "livro com aura verde",
      "diálogo menciona Natasha e palavra de Deus"
    ],
    strongInferences: ["cena de fala/misticismo, não de ação física"],
    unsupportedInterpretations: [
      "Venom e Homem-Aranha no clímax",
      "payoff de simbiose",
      "dois personagens da dupla no quadro",
      "transformação do traje preto"
    ],
    indexMismatch: true,
    indexMismatchReasons: [
      "índice marca Venom + Homem-Aranha; crop mostra Doutor Estranho",
      "visualFlags.doctorStrangeVisible deveria bloquear esta cena para tema simbionte"
    ]
  }
};

const REVISED_NARRATION_BY_KEY: Record<string, string> = {
  "scene-first-hook-1":
    "A cena abre no campo, com um homem de macacão azul parado ao lado de um trator verde — e isso não mostra traje, simbionte nem transformação.",
  "scene-first-context-2":
    "Aqui dá para ver uma figura preta e branca cortada no canto e uma abóbora laranja cercada por tentáculos brancos no centro do quadro.",
  "scene-first-development-3":
    "Os tentáculos brancos continuam em volta da abóbora, mas este recorte ainda não prova transformação de corpo nem perda de controle.",
  "scene-first-development-4":
    "A abóbora iluminada fica envolta pelos tentáculos brancos — o objeto domina o quadro, sem mostrar um personagem completo mudando de forma.",
  "scene-first-climax-5":
    "No perfil, um homem de capa vermelha e colar verde fala enquanto olha para um livro com aura verde — Venom e Homem-Aranha não aparecem neste recorte.",
  "scene-first-closing-6":
    "O vídeo volta ao homem com o trator no campo — então a pergunta fica: em qual desses recortes a transformação do traje realmente acontece?"
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function containsForbiddenTagPhrase(text: string): boolean {
  const normalized = text.toLowerCase();
  return FORBIDDEN_LITERAL_TAG_PHRASES.some((phrase) => normalized.includes(phrase.toLowerCase()));
}

function extractClaimsFromNarration(text: string): string[] {
  const claims: string[] = [];
  const patterns: Array<{ regex: RegExp; claim: string }> = [
    { regex: /traje começa a envolver/i, claim: "traje envolvendo o corpo" },
    { regex: /perde o controle/i, claim: "perda de controle" },
    { regex: /traje preto/i, claim: "traje preto" },
    { regex: /parte do próprio corpo/i, claim: "traje como parte do corpo" },
    { regex: /transforma/i, claim: "transformação" },
    { regex: /simbiose|simbionte/i, claim: "simbiose ou simbionte" },
    { regex: /os dois/i, claim: "dois personagens juntos" },
    { regex: /cada corte/i, claim: "meta de edição (cada corte)" },
    { regex: /vira eixo da cena/i, claim: "abstração editorial (eixo da cena)" },
    { regex: /clímax fecha/i, claim: "meta de estrutura (clímax fecha)" },
    { regex: /venom/i, claim: "Venom" },
    { regex: /homem-aranha/i, claim: "Homem-Aranha" },
    { regex: /dupla|parceiro/i, claim: "dupla ou parceria" },
    { regex: /massa do simbionte/i, claim: "massa simbionte como personagem" },
    { regex: /vínculo/i, claim: "vínculo emocional ou simbiótico" },
    { regex: /lutando sozinho/i, claim: "luta solitária após transformação" }
  ];
  for (const entry of patterns) {
    if (entry.regex.test(text)) claims.push(entry.claim);
  }
  return [...new Set(claims)];
}

function auditClaimAgainstPanel(
  claim: string,
  panel: PanelVisualAuditRecord
): NarrationClaimAudit {
  const unsupportedMatchers: Array<{ claim: string; reason: string }> = [
    { claim: "Venom", reason: "Venom não é identificável no crop" },
    { claim: "Homem-Aranha", reason: "Homem-Aranha não aparece no crop" },
    { claim: "dois personagens juntos", reason: "dois personagens não aparecem juntos no crop" },
    { claim: "dupla ou parceria", reason: "relação de dupla não é visível" },
    { claim: "perda de controle", reason: "não há reação ou consequência visível de perda de controle" },
    { claim: "traje envolvendo o corpo", reason: "não há traje orgânico envolvendo corpo humano completo" },
    { claim: "traje preto", reason: "traje preto não é o elemento dominante legível" },
    { claim: "traje como parte do corpo", reason: "não há prova visual de fusão corpo-traje" },
    { claim: "transformação", reason: "transformação corporal não está visível neste recorte" },
    { claim: "massa simbionte como personagem", reason: "o foco visual é abóbora/objeto, não corpo em transformação" },
    { claim: "simbiose ou simbionte", reason: "simbiose não está demonstrada sem hospedeiro visível" },
    { claim: "vínculo emocional ou simbiótico", reason: "vínculo não é comprovado visualmente" },
    { claim: "luta solitária após transformação", reason: "não houve transformação visível na sequência" },
    { claim: "meta de edição (cada corte)", reason: "frase meta de montagem, não fato visual" },
    { claim: "abstração editorial (eixo da cena)", reason: "linguagem abstrata sem fato visual" },
    { claim: "meta de estrutura (clímax fecha)", reason: "meta narrativa, não descrição do quadro" }
  ];

  const matched = unsupportedMatchers.find((entry) => entry.claim === claim);
  if (matched) {
    const visibleOverride = panel.visibleFacts.some((fact) =>
      claim.toLowerCase().includes("tentáculo") ? fact.includes("tentáculo") : false
    );
    if (visibleOverride) {
      return {
        claim,
        tier: "visibleFact",
        supported: true,
        reason: "afirmação limitada ao elemento orgânico branco visível"
      };
    }
    return {
      claim,
      tier: "unsupportedInterpretation",
      supported: false,
      reason: matched.reason
    };
  }

  if (claim.includes("tentáculo") || panel.visibleFacts.some((fact) => textIncludes(fact, claim))) {
    return { claim, tier: "visibleFact", supported: true, reason: "corresponde a fato listado no painel" };
  }

  return { claim, tier: "strongInference", supported: true, reason: "inferência aceitável com cautela" };
}

function textIncludes(fact: string, claim: string): boolean {
  return fact.toLowerCase().includes(claim.toLowerCase());
}

function scoreNarrationAudit(input: {
  claimAudits: NarrationClaimAudit[];
  role: SceneFirstNarrationCue["role"];
  literalSpecific: boolean;
  directEvidence: boolean;
}): number {
  const unsupported = input.claimAudits.filter((entry) => !entry.supported).length;
  const base = 100 - unsupported * 18;
  let score = clamp(base, 0, 100);
  if (!input.literalSpecific) score -= 25;
  if ((input.role === "hook" || input.role === "climax") && !input.directEvidence) score -= 20;
  if (input.claimAudits.some((entry) => entry.tier === "unsupportedInterpretation")) {
    score -= 8;
  }
  return clamp(Math.round(score), 0, 100);
}

function buildPanelAudit(
  scene: SceneEvidenceContract,
  indexLiteral: string,
  indexEntities: string[]
): PanelVisualAuditRecord {
  const preset = PANEL_VISUAL_AUDITS[scene.panelId];
  if (!preset) {
    return {
      panelId: scene.panelId,
      panelImagePath: scene.panelImagePath,
      panelImageSha256: scene.panelImageSha256,
      indexClaimedEntities: indexEntities,
      indexLiteralDescription: indexLiteral,
      literalDescriptionPtBr: "Painel sem auditoria visual manual cadastrada.",
      whoAppears: [],
      characterPositions: "desconhecido",
      visibleAction: "desconhecido",
      symbioteElementVisible: "desconhecido",
      expressionOrReaction: "desconhecido",
      cannotConclude: [],
      visibleFacts: [],
      strongInferences: [],
      unsupportedInterpretations: [],
      indexMismatch: true,
      indexMismatchReasons: ["auditoria visual manual ausente"]
    };
  }
  return {
    panelId: scene.panelId,
    panelImagePath: scene.panelImagePath,
    panelImageSha256: scene.panelImageSha256,
    indexClaimedEntities: indexEntities,
    indexLiteralDescription: indexLiteral,
    ...preset
  };
}

function hasDirectVisualEvidence(panel: PanelVisualAuditRecord, role: SceneFirstNarrationCue["role"]): boolean {
  if (role === "hook" || role === "climax") {
    return panel.visibleFacts.length > 0 && !panel.indexMismatch;
  }
  return panel.visibleFacts.length > 0;
}

function assessVisualArc(panels: PanelVisualAuditRecord[]): {
  transformationArcVisible: boolean;
  distinctVisualSteps: string[];
  revisedTitle: string;
  revisedTopic: string;
  assessment: string;
} {
  const steps = panels.map((panel) => panel.literalDescriptionPtBr.slice(0, 120));
  const uniqueSteps = [...new Set(steps)];
  const hasTransformation = panels.some((panel) =>
    panel.visibleFacts.some(
      (fact) => fact.includes("traje") || fact.includes("transform") || fact.includes("corpo")
    )
  );
  const hasBefore = panels[0]?.visibleFacts.some((fact) => fact.includes("trator") || fact.includes("campo"));
  const hasMass = panels.some((panel) =>
    panel.visibleFacts.some((fact) => fact.includes("abóbora") || fact.includes("tentáculo"))
  );
  const hasReaction = panels.some((panel) => panel.expressionOrReaction.includes("reação"));
  const transformationArcVisible = Boolean(
    hasBefore && hasTransformation && hasMass && hasReaction
  );

  return {
    transformationArcVisible,
    distinctVisualSteps: uniqueSteps,
    revisedTitle: transformationArcVisible
      ? "Transformação do traje preto"
      : "Cenas heterogêneas sem arco de transformação visível",
    revisedTopic: transformationArcVisible
      ? "transformacao_traje_preto"
      : "cenas_heterogeneas_sem_transformacao",
    assessment: transformationArcVisible
      ? "Há indícios de antes, transformação e consequência visíveis."
      : "A sequência mistura campo rural, abóbora com tentáculos e fala de Doutor Estranho; não há antes→transformação→reação comprovados."
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

export async function renderSceneEvidenceContactSheet(input: {
  panels: PanelVisualAuditRecord[];
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  const usable = input.panels.filter((entry) => entry.panelImagePath);
  if (usable.length === 0) return null;

  await mkdir(dirname(input.outputPath), { recursive: true });
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const annotatedDir = join(dirname(input.outputPath), `${basename(input.outputPath)}.annotated`);
  await mkdir(annotatedDir, { recursive: true });

  const annotatedPaths: string[] = [];
  for (const [index, panel] of usable.entries()) {
    if (!(await fileExists(panel.panelImagePath))) continue;
    const shortDesc = panel.literalDescriptionPtBr.slice(0, 70).replace(/[:\\']/g, " ");
    const label = `${panel.panelId.split(":").slice(-2).join("/")} | score${panel.indexMismatch ? "Mismatch" : "OK"} | ${shortDesc}`
      .replace(/[:\\']/g, " ");
    const annotatedPath = join(annotatedDir, `audit-${String(index + 1).padStart(2, "0")}.jpg`);
    await runFfmpeg(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      panel.panelImagePath,
      "-vf",
      `scale=360:360:force_original_aspect_ratio=decrease,pad=360:480:(ow-iw)/2:(oh-ih)/2:color=black,drawtext=text='${label}':fontsize=8:fontcolor=white:x=8:y=8:box=1:boxcolor=black@0.55`,
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
  const columns = Math.min(2, Math.max(1, annotatedPaths.length));
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

export function auditSceneFirstWinningProposal(input: {
  selectedProposal: SceneFirstStoryProposal;
  scenes: SceneEvidenceContract[];
  narrationCues: SceneFirstNarrationCue[];
  sourceScriptPath: string;
}): Omit<SceneEvidenceAuditResult, "generatedAt" | "auditPath" | "contactSheetPath"> {
  const panelAudits = input.scenes.map((scene) =>
    buildPanelAudit(
      scene,
      scene.literalDescription,
      scene.visibleEntities.map((entry) => entry.name)
    )
  );
  const panelById = new Map(panelAudits.map((panel) => [panel.panelId, panel]));
  const arc = assessVisualArc(panelAudits);

  const narrationAudits: NarrationEvidenceAudit[] = input.narrationCues.map((cue) => {
    const panel = panelById.get(cue.panelId);
    const original = cue.narrationText;
    const revised = REVISED_NARRATION_BY_KEY[cue.beatId] ?? original;
    const claims = extractClaimsFromNarration(original);
    const claimAudits = claims.map((claim) =>
      auditClaimAgainstPanel(claim, panel ?? panelAudits[0]!)
    );
    const removedClaims = claimAudits.filter((entry) => !entry.supported).map((entry) => entry.claim);
    const literalSpecific =
      Boolean(panel) &&
      !containsForbiddenTagPhrase(panel!.literalDescriptionPtBr) &&
      panel!.literalDescriptionPtBr.length >= 40;
    const directEvidence = panel ? hasDirectVisualEvidence(panel, cue.role) : false;
    const evidenceScore = scoreNarrationAudit({
      claimAudits,
      role: cue.role,
      literalSpecific,
      directEvidence
    });
    const passesEvidenceGate =
      evidenceScore >= EVIDENCE_AUDIT_THRESHOLDS.evidenceScore &&
      removedClaims.length === 0 &&
      ((cue.role !== "hook" && cue.role !== "climax") || directEvidence);

    return {
      beatId: cue.beatId,
      role: cue.role,
      panelId: cue.panelId,
      originalNarration: original,
      revisedNarration: revised,
      removedClaims,
      claimAudits,
      evidenceScore,
      hookOrClimaxDirectEvidence: directEvidence,
      passesEvidenceGate,
      warnings: removedClaims.map((claim) => `unsupported_claim:${claim}`)
    };
  });

  const sceneEntries: SceneEvidenceAuditEntry[] = panelAudits.map((panel) => {
    const related = narrationAudits.filter((entry) => entry.panelId === panel.panelId);
    const panelScore =
      related.length > 0
        ? Math.round(related.reduce((sum, entry) => sum + entry.evidenceScore, 0) / related.length)
        : panel.indexMismatch
          ? 42
          : 88;
    return {
      panelId: panel.panelId,
      panelImagePath: panel.panelImagePath,
      literalDescriptionPtBr: panel.literalDescriptionPtBr,
      visibleFacts: panel.visibleFacts,
      strongInferences: panel.strongInferences,
      unsupportedInterpretations: panel.unsupportedInterpretations,
      indexMismatch: panel.indexMismatch,
      evidenceScore: panelScore,
      narrationAudits: related
    };
  });

  const allRemovedClaims = [
    ...new Set(narrationAudits.flatMap((entry) => entry.removedClaims))
  ];
  const unsupportedClaimCount = allRemovedClaims.length;
  const averageEvidenceScore =
    narrationAudits.length > 0
      ? Number(
          (
            narrationAudits.reduce((sum, entry) => sum + entry.evidenceScore, 0) /
            narrationAudits.length
          ).toFixed(2)
        )
      : 0;
  const hookEvidenceScore =
    narrationAudits.find((entry) => entry.role === "hook")?.evidenceScore ?? 0;
  const climaxEvidenceScore =
    narrationAudits.find((entry) => entry.role === "climax")?.evidenceScore ?? 0;
  const literalDescriptionsSpecific = panelAudits.every(
    (panel) => !containsForbiddenTagPhrase(panel.literalDescriptionPtBr) && panel.literalDescriptionPtBr.length >= 40
  );

  const gateFailures: string[] = [];
  if (unsupportedClaimCount > 0) gateFailures.push(`unsupportedClaimCount:${unsupportedClaimCount}`);
  if (!literalDescriptionsSpecific) gateFailures.push("literalDescriptionsNotSpecific");
  if (hookEvidenceScore < EVIDENCE_AUDIT_THRESHOLDS.evidenceScore) {
    gateFailures.push(`hookEvidenceScore:${hookEvidenceScore}`);
  }
  if (climaxEvidenceScore < EVIDENCE_AUDIT_THRESHOLDS.evidenceScore) {
    gateFailures.push(`climaxEvidenceScore:${climaxEvidenceScore}`);
  }
  if (averageEvidenceScore < EVIDENCE_AUDIT_THRESHOLDS.evidenceScore) {
    gateFailures.push(`averageEvidenceScore:${averageEvidenceScore}`);
  }
  if (arc.distinctVisualSteps.length < EVIDENCE_AUDIT_THRESHOLDS.minDistinctVisualSteps) {
    gateFailures.push(`distinctVisualSteps:${arc.distinctVisualSteps.length}`);
  }
  if (!arc.transformationArcVisible) gateFailures.push("transformationArcNotVisible");
  if (panelAudits.some((panel) => panel.indexMismatch)) {
    gateFailures.push(`indexMismatchCount:${panelAudits.filter((panel) => panel.indexMismatch).length}`);
  }
  if (narrationAudits.some((entry) => !entry.passesEvidenceGate)) {
    gateFailures.push(`failedNarrationCueCount:${narrationAudits.filter((entry) => !entry.passesEvidenceGate).length}`);
  }

  return {
    sourceScriptPath: input.sourceScriptPath,
    originalProposalTitle: input.selectedProposal.title,
    originalProposalTopic: input.selectedProposal.topic,
    revisedProposalTitle: arc.revisedTitle,
    revisedProposalTopic: arc.revisedTopic,
    transformationArcVisible: arc.transformationArcVisible,
    distinctVisualSteps: arc.distinctVisualSteps,
    distinctVisualStepCount: arc.distinctVisualSteps.length,
    arcAssessment: arc.assessment,
    panels: panelAudits,
    scenes: sceneEntries,
    narrationBeforeAfter: narrationAudits.map((entry) => ({
      role: entry.role,
      panelId: entry.panelId,
      before: entry.originalNarration,
      after: entry.revisedNarration,
      removedClaims: entry.removedClaims,
      evidenceScore: entry.evidenceScore
    })),
    allRemovedClaims,
    unsupportedClaimCount,
    averageEvidenceScore,
    hookEvidenceScore,
    climaxEvidenceScore,
    literalDescriptionsSpecific,
    canRender: gateFailures.length === 0,
    canPublish: gateFailures.length === 0,
    blockReason: gateFailures.length > 0 ? gateFailures.join(";") : null
  };
}

export async function runSceneEvidenceAudit(input: {
  projectRoot?: string;
  scriptPath?: string;
  ffmpegCommand?: string;
}): Promise<SceneEvidenceAuditResult> {
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const scriptPath = resolve(
    input.scriptPath ?? join(projectRoot, "tmp", "variation-b-scene-first-best-script.json")
  );
  const tmpDir = join(projectRoot, "tmp");
  await mkdir(tmpDir, { recursive: true });

  const raw = await readFile(scriptPath, "utf8");
  const script = JSON.parse(raw) as {
    selectedProposal: SceneFirstStoryProposal;
    scenes: SceneEvidenceContract[];
    narrationCues: SceneFirstNarrationCue[];
  };

  const audited = auditSceneFirstWinningProposal({
    selectedProposal: script.selectedProposal,
    scenes: script.scenes,
    narrationCues: script.narrationCues,
    sourceScriptPath: scriptPath
  });

  const auditPath = join(tmpDir, SCENE_EVIDENCE_AUDIT_FILENAME);
  const contactSheetPath = join(tmpDir, SCENE_EVIDENCE_CONTACT_SHEET_FILENAME);

  const result: SceneEvidenceAuditResult = {
    generatedAt: new Date().toISOString(),
    ...audited,
    auditPath,
    contactSheetPath: null
  };

  result.contactSheetPath = await renderSceneEvidenceContactSheet({
    panels: result.panels,
    outputPath: contactSheetPath,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  await writeFile(auditPath, JSON.stringify(result, null, 2), "utf8");
  return result;
}