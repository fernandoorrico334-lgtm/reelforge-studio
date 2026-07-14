import { repairTruncatedPhrases } from "./narration-pad-sanitizer.js";

export const ACTION_LABEL_ORALIZATION: Record<string, string> = {
  "parceiro ideal / simbiose": "essa ideia de dupla perfeita e a ligação entre os dois",
  "parceiro ideal e simbiose": "essa ideia de dupla perfeita e a ligação entre os dois",
  "parceiro ideal": "essa ideia de dupla perfeita",
  simbiose: "a ligação entre os dois",
  vingança: "essa sensação de acerto de contas",
  vinganca: "essa sensação de acerto de contas",
  transformação: "essa mudança do personagem",
  transformacao: "essa mudança do personagem",
  revelação: "esse detalhe revelado aos poucos",
  revelacao: "esse detalhe revelado aos poucos",
  ameaça: "essa tensão no ar",
  ameaca: "essa tensão no ar",
  "poder oculto": "essa força que ainda não apareceu inteira",
  "encontro / descoberta": "esse encontro e essa descoberta"
};

const ORALIZATION_ORDER = Object.keys(ACTION_LABEL_ORALIZATION).sort(
  (a, b) => b.length - a.length
);

const RAW_LABEL_PATTERNS = ORALIZATION_ORDER.map(
  (label) => new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi")
);

export function oralizeActionLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return label;

  const direct = ACTION_LABEL_ORALIZATION[normalized];
  if (direct) return direct;

  const slashParts = normalized.split(/\s*\/\s*/).filter(Boolean);
  if (slashParts.length > 1) {
    const oralParts = slashParts.map((part) => ACTION_LABEL_ORALIZATION[part] ?? part);
    if (oralParts.some((part, index) => part !== slashParts[index])) {
      return oralParts.join(" e ");
    }
  }

  return label.replace(/\s*\/\s*/g, " e ").trim();
}

export function oralizeActionLabelsInNarration(text: string): string {
  let oral = text;

  for (const label of ORALIZATION_ORDER) {
    const replacement = ACTION_LABEL_ORALIZATION[label]!;
    const pattern = new RegExp(
      `(?<![A-Za-zÀ-ÿ])${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-zÀ-ÿ])`,
      "gi"
    );
    oral = oral.replace(pattern, (match) => {
      if (match[0] === match[0]?.toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }

  oral = oral
    .replace(
      /\bpor causa de parceiro ideal e simbiose\b/gi,
      "por causa dessa ideia de dupla perfeita e da simbiose entre os dois"
    )
    .replace(
      /\bpor causa de parceiro ideal\b/gi,
      "por causa dessa ideia de dupla perfeita"
    )
    .replace(
      /\bpor causa de simbiose\b/gi,
      "por causa da ligação entre os dois"
    )
    .replace(/\bEssa dupla funciona por causa de essa\b/gi, "Essa dupla funciona por causa dessa")
    .replace(/\bNão é só essa ideia de dupla perfeita e a ligação entre\.?\b/gi,
      "Não é só essa ideia de dupla perfeita e a ligação entre os dois")
    .replace(/\s{2,}/g, " ")
    .trim();

  return repairTruncatedPhrases(oral);
}

export function findRawActionLabelsInText(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();

  for (const label of ORALIZATION_ORDER) {
    const pattern = new RegExp(
      `(?<![a-zà-ú])${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-zà-ú])`,
      "i"
    );
    if (pattern.test(lower)) {
      found.push(label);
    }
  }

  return [...new Set(found)];
}

export function oralizeNarrationBeats<T extends { text: string }>(beats: T[]): T[] {
  return beats.map((beat) => ({
    ...beat,
    text: oralizeActionLabelsInNarration(beat.text)
  }));
}