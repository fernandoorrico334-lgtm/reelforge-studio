export type ComicDialogueAwarenessCue = {
  cueId: string;
  sourceBeatIndex: number;
  hasDialogue: boolean;
  balloonCount: number;
  recommendedHoldSeconds: number;
  recommendedFocus: "speaker" | "balloon" | "reaction" | "action";
  captionPolicy: "avoid_balloon_overlap" | "lower_caption" | "normal";
  warning: string | null;
};

export type ComicDialogueAwarenessPlan = {
  directorId: "comic_dialogue_awareness_director_v1";
  cues: ComicDialogueAwarenessCue[];
  dialogueCueCount: number;
  averageHoldSeconds: number;
  warnings: string[];
  passed: boolean;
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function buildComicDialogueAwarenessPlan(input: {
  cues: Array<{ cueId: string; sourceBeatIndex: number; hasDialogue: boolean; durationSeconds: number; text: string }>;
  shots: Array<{ beatIndex: number; dialogueBalloonId: string | null; semanticAssociationConfidence: number; shotRole: string; durationSeconds: number }>;
}): ComicDialogueAwarenessPlan {
  const cues = input.cues.map((cue): ComicDialogueAwarenessCue => {
    const relatedShots = input.shots.filter((shot) => shot.beatIndex === cue.sourceBeatIndex);
    const balloonCount = relatedShots.filter((shot) => shot.dialogueBalloonId).length;
    const hasDialogue = cue.hasDialogue || balloonCount > 0 || /[“"].+[”"]|\b(?:disse|perguntou|respondeu|gritou|falou)\b/i.test(cue.text);
    const lowAssociation = hasDialogue && balloonCount > 0 && relatedShots.some((shot) => shot.dialogueBalloonId && shot.semanticAssociationConfidence < 55);
    const recommendedHoldSeconds = hasDialogue ? round(Math.min(2.4, Math.max(1.1, cue.durationSeconds * 0.38 + balloonCount * 0.18))) : 0.8;
    return {
      cueId: cue.cueId,
      sourceBeatIndex: cue.sourceBeatIndex,
      hasDialogue,
      balloonCount,
      recommendedHoldSeconds,
      recommendedFocus: hasDialogue && balloonCount > 0 ? "speaker" : hasDialogue ? "balloon" : cue.text.includes("?") ? "reaction" : "action",
      captionPolicy: hasDialogue ? "avoid_balloon_overlap" : "normal",
      warning: lowAssociation ? "dialogue_balloon_speaker_association_low" : null,
    };
  });
  const dialogueCueCount = cues.filter((cue) => cue.hasDialogue).length;
  const averageHoldSeconds = round(cues.reduce((sum, cue) => sum + cue.recommendedHoldSeconds, 0) / Math.max(1, cues.length));
  const warnings = cues.flatMap((cue) => cue.warning ? [`${cue.cueId}:${cue.warning}`] : []);
  return { directorId: "comic_dialogue_awareness_director_v1", cues, dialogueCueCount, averageHoldSeconds, warnings, passed: warnings.length === 0 };
}
