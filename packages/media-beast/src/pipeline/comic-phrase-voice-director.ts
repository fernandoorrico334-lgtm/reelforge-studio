export type ComicVoiceEmotion = "intrigue" | "suspense" | "controlled" | "urgency" | "reveal" | "impact" | "resolution";

export type ComicPhraseVoiceDirection = {
  phraseId: string;
  sourceBeatId: string;
  sourceBeatIndex: number;
  phraseIndex: number;
  text: string;
  emotion: ComicVoiceEmotion;
  pace: "measured" | "natural" | "fast";
  pauseAfterMs: number;
  emphasisWords: string[];
  deliveryNote: string;
  chatterbox: { exaggeration: number; cfgWeight: number; temperature: number };
};

export type ComicPhraseVoicePlan = {
  directorId: "comic_phrase_voice_director_v1";
  phrases: ComicPhraseVoiceDirection[];
  phraseCount: number;
  emotionalVariationCount: number;
  totalPlannedPauseMs: number;
  passed: boolean;
};

function splitMicrophrases(text: string) {
  return text.replace(/([.!?;:])\s+/g, "$1|").replace(/,\s+(?=(?:mas|porque|enquanto|quando|so que|e entao|por isso)\b)/gi, ",|").split("|").map((part) => part.trim()).filter(Boolean);
}

function emotionFor(text: string, role: string, phraseIndex: number): ComicVoiceEmotion {
  if (text.includes("?")) return "intrigue";
  if (/\b(?:nunca existiu|revelou|percebeu|descobriu|confirmaram|admitiu|era tarde|a verdade|o problema|ningu[eé]m sabia|sem imaginar)\b/i.test(text)) return "reveal";
  if (/\b(?:golpe|colidiram|atacou|ataque|tiros?|explod|guerra|destrui|energia at[oô]mica|portal|revolta|caiu|queda|enfrentaram)\b/i.test(text)) return "impact";
  if (/\b(?:corria|correram|avan[cç]ava|cada segundo|antes que|precisava|[uú]ltima|escapar|fuga|combust[ií]vel|tempestade|cercados?)\b/i.test(text)) return "urgency";
  if (/\b(?:escond|misterioso|desaparec|segredo|silenciad|bloquead|armadilha|risco|mentira|fora dos mapas|sem ser visto|vigil[aâ]ncia)\b/i.test(text)) return "suspense";
  if (role === "cold_open" || (phraseIndex === 0 && role === "setup")) return "intrigue";
  if (role === "resolution") return "resolution";
  return "controlled";
}

const PERFORMANCE: Record<ComicVoiceEmotion, Omit<ComicPhraseVoiceDirection, "phraseId" | "sourceBeatId" | "sourceBeatIndex" | "phraseIndex" | "text" | "emotion" | "emphasisWords">> = {
  intrigue: { pace: "measured", pauseAfterMs: 170, deliveryNote: "Comece baixo, crie uma pergunta e segure a última palavra.", chatterbox: { exaggeration: 0.68, cfgWeight: 0.31, temperature: 0.65 } },
  suspense: { pace: "measured", pauseAfterMs: 155, deliveryNote: "Baixe a voz, segure a revelação e crie expectativa sem perder dicção.", chatterbox: { exaggeration: 0.73, cfgWeight: 0.29, temperature: 0.66 } },
  controlled: { pace: "natural", pauseAfterMs: 80, deliveryNote: "Conte com conviccao, sem soar como leitura de resumo.", chatterbox: { exaggeration: 0.62, cfgWeight: 0.34, temperature: 0.62 } },
  urgency: { pace: "fast", pauseAfterMs: 65, deliveryNote: "Acelere levemente e mantenha tensao crescente.", chatterbox: { exaggeration: 0.73, cfgWeight: 0.3, temperature: 0.68 } },
  reveal: { pace: "measured", pauseAfterMs: 230, deliveryNote: "Reduza antes da revelacao e marque a informacao decisiva.", chatterbox: { exaggeration: 0.76, cfgWeight: 0.29, temperature: 0.67 } },
  impact: { pace: "fast", pauseAfterMs: 145, deliveryNote: "Ataque a frase e deixe o impacto terminar antes de continuar.", chatterbox: { exaggeration: 0.82, cfgWeight: 0.28, temperature: 0.7 } },
  resolution: { pace: "measured", pauseAfterMs: 260, deliveryNote: "Feche com alivio, peso e sensacao de consequencia.", chatterbox: { exaggeration: 0.64, cfgWeight: 0.34, temperature: 0.61 } },
};

function emphasisWords(text: string) {
  const candidates = text.match(/[A-Za-z\u00c0-\u00ff]{5,}/g) ?? [];
  const priority = candidates.filter((word) => /Godz|Kong|Superman|Batman|Quest[aã]o|Arqueiro|Oliver|Rotha|Arc[aá]dia|Ceres|portal|Tit[aã]s|Liga|guerra|Caixa|amea[cç]a|verdade|escrav|for[cç]ado|revolta|fuga|queda|satelit|terrorista/i.test(word));
  return [...new Set(priority.length ? priority : candidates.slice(-2))].slice(0, 3);
}

export function buildComicPhraseVoicePlan(input: { beats: Array<{ beatId: string; role: string; narrationLine: string }> }): ComicPhraseVoicePlan {
  const phrases = input.beats.flatMap((beat, sourceBeatIndex) => splitMicrophrases(beat.narrationLine).map((text, phraseIndex) => {
    const emotion = emotionFor(text, beat.role, phraseIndex);
    return { phraseId: `${beat.beatId}-phrase-${phraseIndex + 1}`, sourceBeatId: beat.beatId, sourceBeatIndex, phraseIndex, text, emotion, emphasisWords: emphasisWords(text), ...PERFORMANCE[emotion] };
  }));
  return { directorId: "comic_phrase_voice_director_v1", phrases, phraseCount: phrases.length, emotionalVariationCount: new Set(phrases.map((phrase) => phrase.emotion)).size, totalPlannedPauseMs: phrases.reduce((sum, phrase) => sum + phrase.pauseAfterMs, 0), passed: phrases.length >= input.beats.length && new Set(phrases.map((phrase) => phrase.emotion)).size >= 4 };
}
