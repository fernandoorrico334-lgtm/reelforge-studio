import { evaluateComicNarrationLanguage } from "../packages/media-beast/dist/index.js";

const valid = evaluateComicNarrationLanguage({
  beats: [
    { beatId: "hook", narrationLine: "Por que Batman protegeria uma cidade construída com trabalho forçado?" },
    { beatId: "reveal", narrationLine: "Então Oliver revelou a verdade: Ceres nunca existiu." },
  ],
});
if (valid.status !== "passed") throw new Error(`Valid PT-BR narration was rejected: ${JSON.stringify(valid.reviews)}`);

const invalid = evaluateComicNarrationLanguage({
  beats: [{ beatId: "broken", narrationLine: "Por que Bétman protegeu uma cidade com trabalho forcado." }],
});
if (invalid.status !== "rejected" || invalid.issueCount < 3) {
  throw new Error(`Broken narration was not rejected: ${JSON.stringify(invalid)}`);
}

console.log(JSON.stringify({ validStatus: valid.status, rejectedIssueCount: invalid.issueCount, status: "completed" }, null, 2));