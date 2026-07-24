import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { narrativeBibleInput, episodeDefinitions } from "./comic-saga-configs/batman-white-knight-narrative-bible.mjs";

const root = process.cwd();
const bibleEngine = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-narrative-bible-engine.js")).href);
const episodePlanner = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-narrative-episode-planner.js")).href);
const gateEngine = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-one-click-production-gate.js")).href);

const bible = bibleEngine.buildComicNarrativeBible(narrativeBibleInput);
const plan = episodePlanner.buildComicNarrativeEpisodePlan({
  bible,
  episodes: episodeDefinitions,
  maximumEpisodeDurationSeconds: 180,
  targetWordsPerMinute: 160,
});

assert.equal(bible.gate.status, "passed");
assert.equal(plan.status, "passed");

const gates = plan.episodes.map((episode) => gateEngine.evaluateComicOneClickProductionGate({
  episode,
  minimumDurationSeconds: 30,
  maximumDurationSeconds: 180,
  minimumScoreToRender: 86,
}));

assert.ok(gates.length >= 4);
assert.ok(gates.every((gate) => gate.gateId === "comic_one_click_production_gate_v1"));
assert.ok(gates.every((gate) => gate.score >= 86), JSON.stringify(gates.map((gate, index) => ({ episode: index + 1, score: gate.score, blockers: gate.blockers, warnings: gate.warnings })), null, 2));
assert.ok(gates.every((gate) => gate.renderAllowed === true));
assert.ok(gates.every((gate) => gate.checks.some((check) => check.id === "visual_target_coverage")));
assert.ok(gates.every((gate) => gate.checks.some((check) => check.id === "narration_specificity")));

console.log(JSON.stringify({
  status: "completed",
  episodeCount: plan.episodeCount,
  renderReadyCount: gates.filter((gate) => gate.renderAllowed).length,
  scores: gates.map((gate) => gate.score),
  minimumScoreToRender: gates[0]?.minimumScoreToRender ?? 86,
}, null, 2));
