import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildComicPanelShotPlan } from "../packages/media-beast/dist/index.js";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const detection = JSON.parse(await readFile(resolve(root, "storage/renders/diagnostics/godzilla-panel-detection.json"), "utf8"));
const pageGroups = [
  ["004.jpg", "005.jpg", "006.jpg"],
  ["010.jpg", "011.jpg"],
  ["012.jpg", "013.jpg"],
  ["016.jpg", "017.jpg", "018.jpg"],
  ["019.jpg", "020.jpg"],
  ["022.jpg", "023.jpg", "024.jpg", "025.jpg"],
  ["026.jpg", "027.jpg"],
  ["028.jpg", "029.jpg", "030.jpg"]
];
const plan = buildComicPanelShotPlan({
  beats: pageGroups.map((pages, index) => ({
    pages,
    durationSeconds: [8, 5, 5, 7, 5, 9, 5, 9][index],
    role: ["hook", "setup", "context", "tension", "climax", "tension", "climax", "payoff"][index],
    hasDialogue: [true, true, true, false, false, false, true, true][index],
    hasImpact: [false, false, false, true, true, true, false, true][index]
  })),
  detectedPages: detection.pages,
  coldOpenPage: "030.jpg",
  coldOpenDurationSeconds: 2,
  maximumShotDurationSeconds: 2.1
});

if (!plan.mainStoryIsMonotonic) throw new Error("Main story must remain monotonic after the cold open.");
if (plan.repeatedPanelCount !== 0) throw new Error(`Repeated panels: ${plan.repeatedPanelCount}`);
if (plan.repeatedSourcePanelCount !== 0) throw new Error("Repeated source panels: " + plan.repeatedSourcePanelCount);
if (plan.maximumShotDurationSeconds > 4.01) throw new Error(`Shot exceeds editorial ceiling: ${plan.maximumShotDurationSeconds}`);
if (plan.shotCount < 24) throw new Error(`Insufficient visual coverage: ${plan.shotCount}`);
if (plan.transitionCounts.page_tear !== 1) throw new Error("Cold-open rewind must use one page-tear transition.");
if (plan.transitionCounts.black_flash !== 0) throw new Error("Repeated black flash grammar must not return.");

console.log(JSON.stringify({
  directorId: plan.directorId,
  shotCount: plan.shotCount,
  averageShotDurationSeconds: plan.averageShotDurationSeconds,
  maximumShotDurationSeconds: plan.maximumShotDurationSeconds,
  coldOpenDurationSeconds: plan.coldOpenDurationSeconds,
  mainStoryIsMonotonic: plan.mainStoryIsMonotonic,
  repeatedPanelCount: plan.repeatedPanelCount,
  repeatedSourcePanelCount: plan.repeatedSourcePanelCount,
  transitionCounts: plan.transitionCounts,
  status: "completed"
}, null, 2));



