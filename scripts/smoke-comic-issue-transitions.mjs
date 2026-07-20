import { buildComicIssueTransitionPlan } from "../packages/media-beast/dist/index.js";

const evidence = [{
  fromIssueNumber: 1,
  toIssueNumber: 2,
  previousConflictTerms: ["portal"],
  causalBridgeTerms: ["foi assim"],
  newConflictTerms: ["Superman", "Godzilla"],
}];
const passed = buildComicIssueTransitionPlan({
  beats: [
    { beatId: "i1-end", issueNumber: 1, narrationLine: "O portal arrastou os Titãs para a Terra." },
    { beatId: "i2-start", issueNumber: 2, narrationLine: "Foi assim que o portal colocou Godzilla diante de Superman." },
  ],
  evidence,
});
if (!passed.passed || passed.reviews[0]?.score !== 100) throw new Error("Complete issue transition was rejected.");
const rejected = buildComicIssueTransitionPlan({
  beats: [
    { beatId: "i1-end", issueNumber: 1, narrationLine: "O portal ficou aberto." },
    { beatId: "i2-start", issueNumber: 2, narrationLine: "Ele atacou de repente." },
  ],
  evidence,
});
if (rejected.passed || rejected.reviews[0]?.warnings.length < 2) throw new Error("Ambiguous issue transition was accepted.");
console.log(JSON.stringify({ directorId: passed.directorId, transitionCount: passed.transitionCount, completeTransitionCount: passed.completeTransitionCount, rejectedWarnings: rejected.warnings, status: "completed" }, null, 2));