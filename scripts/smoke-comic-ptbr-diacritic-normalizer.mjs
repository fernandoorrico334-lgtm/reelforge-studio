import {
  evaluateComicNarrationLanguage,
  restorePtBrDiacriticsForComicNarration,
} from "../packages/media-beast/dist/index.js";

const brokenText = "Para impedir a destruicao, Jack protege Gotham da policia, das cameras e da ameaca final.";
const rejectedBeforeNormalize = evaluateComicNarrationLanguage({
  beats: [{ beatId: "saga-beat-2", narrationLine: brokenText }],
});
if (rejectedBeforeNormalize.status !== "rejected") {
  throw new Error(`Broken PT-BR narration was not rejected before normalization: ${JSON.stringify(rejectedBeforeNormalize)}`);
}

const normalizedText = restorePtBrDiacriticsForComicNarration(brokenText);
const acceptedAfterNormalize = evaluateComicNarrationLanguage({
  beats: [{ beatId: "saga-beat-2", narrationLine: normalizedText }],
});
if (acceptedAfterNormalize.status !== "passed") {
  throw new Error(`Normalized PT-BR narration was rejected: ${JSON.stringify(acceptedAfterNormalize)}`);
}

console.log(JSON.stringify({
  rejectedBeforeNormalize: rejectedBeforeNormalize.status,
  acceptedAfterNormalize: acceptedAfterNormalize.status,
  normalizedText,
  status: "completed",
}, null, 2));
