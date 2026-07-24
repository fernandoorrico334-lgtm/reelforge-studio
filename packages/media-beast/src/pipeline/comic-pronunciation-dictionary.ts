export type ComicPronunciationEntry = {
  label: string;
  displayPattern: RegExp;
  spokenReplacement: string;
  reason: string;
};

export type ComicPronunciationResult = {
  spokenText: string;
  appliedLabels: string[];
  displayTextSafe: boolean;
};

export const comicTtsPronunciationDictionary: ComicPronunciationEntry[] = [
  { label: "Batman", displayPattern: /\bBatman\b/gi, spokenReplacement: "B\u00e9tman", reason: "guide PT-BR synthesis while preserving Batman in display text" },
  { label: "Superman", displayPattern: /\bSuperman\b/gi, spokenReplacement: "Supermãn", reason: "guide PT-BR narrator pronunciation" },
  { label: "Godzilla", displayPattern: /\bGodzilla\b/gi, spokenReplacement: "Godzíla", reason: "keep monster name punchy in PT-BR" },
  { label: "Lex Luthor", displayPattern: /\bLex\s+Luthor\b/gi, spokenReplacement: "Léks Lútor", reason: "avoid robotic foreign-name reading" },
  { label: "Lex", displayPattern: /\bLex\b/gi, spokenReplacement: "Léks", reason: "avoid flat PT-BR x reading" },
  { label: "Luthor", displayPattern: /\bLuthor\b/gi, spokenReplacement: "Lútor", reason: "avoid English spelling drift" },
  { label: "Clark", displayPattern: /\bClark\b/gi, spokenReplacement: "Clárk", reason: "keep name clear in PT-BR" },
  { label: "Lois", displayPattern: /\bLois\b/gi, spokenReplacement: "Lôis", reason: "avoid incorrect diphthong" },
  { label: "Flash", displayPattern: /\bFlash\b/gi, spokenReplacement: "Flésh", reason: "guide PT-BR narrator pronunciation" },
  { label: "Lanterna Verde", displayPattern: /\bLanterna\s+Verde\b/gi, spokenReplacement: "Lanterna Verde", reason: "preserve hero name" },
  { label: "força", displayPattern: /\bforca\b/gi, spokenReplacement: "força", reason: "restore cedilla before TTS" },
  { label: "ação", displayPattern: /\bacao\b/gi, spokenReplacement: "ação", reason: "restore diacritic before TTS" },
];

const PHONETIC_DISPLAY_LEAK = /\b(?:Supermãn|Godzíla|Léks|Lútor|Clárk|Lôis|Flésh)\b/i;

export function applyComicTtsPronunciation(text: string): ComicPronunciationResult {
  const appliedLabels: string[] = [];
  let spokenText = text;
  for (const entry of comicTtsPronunciationDictionary) {
    if (entry.displayPattern.test(spokenText)) {
      appliedLabels.push(entry.label);
      spokenText = spokenText.replace(entry.displayPattern, entry.spokenReplacement);
    }
    entry.displayPattern.lastIndex = 0;
  }
  return {
    spokenText,
    appliedLabels: [...new Set(appliedLabels)],
    displayTextSafe: !PHONETIC_DISPLAY_LEAK.test(text),
  };
}

export function assertComicDisplayTextHasNoPhoneticLeak(text: string) {
  return !PHONETIC_DISPLAY_LEAK.test(text);
}

