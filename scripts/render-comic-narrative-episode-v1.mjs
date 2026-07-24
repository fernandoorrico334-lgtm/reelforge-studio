import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { narrativeBibleInput, episodeDefinitions } from "./comic-saga-configs/batman-white-knight-narrative-bible.mjs";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const bibleEngine = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-narrative-bible-engine.js")).href);
const episodePlanner = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-narrative-episode-planner.js")).href);
const bible = bibleEngine.buildComicNarrativeBible(narrativeBibleInput);
const plan = episodePlanner.buildComicNarrativeEpisodePlan({ bible, episodes: episodeDefinitions, maximumEpisodeDurationSeconds: 180, targetWordsPerMinute: 160 });
if (plan.status !== "passed") throw new Error(`Narrative series preflight blocked: ${plan.blockers.join(", ")}`);

const requestedEpisode = Number.parseInt(process.env.COMIC_SAGA_EPISODE ?? "1", 10);
const episode = plan.episodes[requestedEpisode - 1];
if (!episode) throw new Error(`COMIC_SAGA_EPISODE must be between 1 and ${plan.episodeCount}.`);
if (episode.gate.status !== "passed") throw new Error(`Episode preflight blocked: ${episode.gate.blockers.join(", ")}`);

console.log(JSON.stringify({
  status: "narrative_preflight_passed",
  episodeId: episode.episodeId,
  title: episode.title,
  issueNumbers: episode.issueNumbers,
  eventCount: episode.eventIds.length,
  estimatedDurationSeconds: episode.estimatedDurationSeconds,
  criticalFactCount: episode.criticalFactIds.length,
}, null, 2));

const configPath = join(root, "scripts/comic-saga-configs/batman-white-knight-series-runtime.mjs");
const child = spawn(process.execPath, [join(root, "scripts/render-comic-complete-saga-v1.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    COMIC_SAGA_CONFIG: configPath,
    COMIC_SAGA_EPISODE: String(requestedEpisode),
    COMIC_NARRATION_PROVIDER: process.env.COMIC_NARRATION_PROVIDER ?? "voicebox-qwen",
  },
});
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
