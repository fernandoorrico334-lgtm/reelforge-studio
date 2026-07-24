import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { narrativeBibleInput, episodeDefinitions } from "./comic-saga-configs/batman-white-knight-narrative-bible.mjs";

const root = process.cwd();
const outputDir = await mkdtemp(join(tmpdir(), "reelforge-comic-one-click-"));
const bibleEngine = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-narrative-bible-engine.js")).href);
const episodePlanner = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-narrative-episode-planner.js")).href);
const productionGateEngine = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-one-click-production-gate.js")).href);

const bible = bibleEngine.buildComicNarrativeBible(narrativeBibleInput);
const plan = episodePlanner.buildComicNarrativeEpisodePlan({
  bible,
  episodes: episodeDefinitions,
  maximumEpisodeDurationSeconds: 180,
  targetWordsPerMinute: 160,
});

assert.equal(plan.status, "passed");
assert.ok(plan.episodeCount >= 2);
const selectedEpisodes = plan.episodes.slice(0, 2).map((episode, index) => {
  const productionGate = productionGateEngine.evaluateComicOneClickProductionGate({
    episode,
    minimumDurationSeconds: 30,
    maximumDurationSeconds: 180,
    minimumScoreToRender: 86,
  });
  return {
    episodeNumber: index + 1,
    episodeId: episode.episodeId,
    title: episode.title,
    issueNumbers: episode.issueNumbers,
    eventCount: episode.eventIds.length,
    estimatedDurationSeconds: episode.estimatedDurationSeconds,
    criticalFactCount: episode.criticalFactIds.length,
    gateStatus: episode.gate.status,
    blockers: episode.gate.blockers,
    productionGate,
    renderAllowed: productionGate.renderAllowed,
    renderOutputDir: null,
    status: productionGate.renderAllowed ? "render_ready" : episode.gate.status === "passed" ? "ready_for_review" : "blocked",
  };
});

const report = {
  status: "ready_for_review",
  mode: "plan",
  outputDir,
  bibleConfig: resolve("scripts/comic-saga-configs/batman-white-knight-narrative-bible.mjs"),
  runtimeConfig: resolve("scripts/comic-saga-configs/batman-white-knight-series-runtime.mjs"),
  bibleStatus: bible.status,
  plannerStatus: plan.status,
  episodeCount: plan.episodeCount,
  selectedEpisodeCount: selectedEpisodes.length,
  narrationProvider: "voicebox-qwen",
  narrationSessionMode: "single",
  humanApprovalRequired: true,
  selectedEpisodes,
};

await writeFile(join(outputDir, "assisted-plan.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(join(outputDir, "assisted-review.md"), "# Comic One-Click Assisted Review\n\n## Human Review Gate\n\nApprove only after checking story clarity, panels, narration, captions, and QA.\n", "utf8");

const saved = JSON.parse(await readFile(join(outputDir, "assisted-plan.json"), "utf8"));
assert.equal(saved.mode, "plan");
assert.equal(saved.humanApprovalRequired, true);
assert.equal(saved.selectedEpisodes.length, 2);
assert.ok(saved.selectedEpisodes.every((episode) => episode.productionGate.gateId === "comic_one_click_production_gate_v1"));
assert.ok(saved.selectedEpisodes.every((episode) => episode.productionGate.score >= 86));
assert.ok(saved.selectedEpisodes.every((episode) => episode.renderAllowed === true));
assert.equal(saved.narrationSessionMode, "single");

const review = await readFile(join(outputDir, "assisted-review.md"), "utf8");
assert.match(review, /Human Review Gate/);
assert.match(review, /Approve only after checking/);

console.log(JSON.stringify({
  status: "completed",
  outputDir,
  selectedEpisodeCount: saved.selectedEpisodes.length,
  humanApprovalRequired: saved.humanApprovalRequired,
  narrationSessionMode: saved.narrationSessionMode,
  productionGateScores: saved.selectedEpisodes.map((episode) => episode.productionGate.score),
}, null, 2));

