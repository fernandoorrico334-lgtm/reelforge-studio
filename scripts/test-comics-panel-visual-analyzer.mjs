import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const assetDir = join(projectRoot, "storage/assets/user-provided/remix/venom-partner");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const CASES = [
  {
    file: "remix-asset-b24d862bb229.jpg",
    label: "espiral page 33 (doctor strange)",
    expectReject: true
  },
  {
    file: "remix-asset-505d6d331cf6.jpg",
    label: "espiral page 30 (doctor strange)",
    expectReject: true
  },
  {
    file: "remix-asset-3b8b7c565b52.jpg",
    label: "simbionte page 5",
    minDuoScore: 40
  },
  {
    file: "remix-asset-bd624296f938.jpg",
    label: "simbionte page 4",
    minDuoScore: 40
  },
  {
    file: "remix-asset-28ec95401fea.jpg",
    label: "simbionte page 1",
    minDuoScore: 35
  }
];

async function main() {
  const { analyzeComicsPanelVisual } = await importMediaBeast();
  const results = [];

  for (const testCase of CASES) {
    const assetPath = join(assetDir, testCase.file);
    const verdict = await analyzeComicsPanelVisual({ assetPath });
    results.push({ ...testCase, verdict });

    if (testCase.expectReject) {
      assert(
        !verdict.eligible || verdict.rejectReason !== null,
        `${testCase.label} should be visually rejected`
      );
    }
    if (testCase.minDuoScore) {
      assert(
        verdict.duoVisualScore >= testCase.minDuoScore,
        `${testCase.label} duo score ${verdict.duoVisualScore} < ${testCase.minDuoScore}`
      );
    }
  }

  console.log(
    JSON.stringify(
      results.map((entry) => ({
        label: entry.label,
        eligible: entry.verdict.eligible,
        rejectReason: entry.verdict.rejectReason,
        duoVisualScore: entry.verdict.duoVisualScore,
        visualTags: entry.verdict.visualTags,
        profile: entry.verdict.profile
          ? {
              white: entry.verdict.profile.global.whiteRatio,
              black: entry.verdict.profile.global.blackRatio,
              red: entry.verdict.profile.global.redRatio,
              blue: entry.verdict.profile.global.blueRatio,
              buckets: entry.verdict.profile.global.colorBucketCount
            }
          : null
      })),
      null,
      2
    )
  );
  console.log("[test] comics panel visual analyzer: OK");
}

main().catch((error) => {
  console.error("[test] comics panel visual analyzer: FAIL");
  console.error(error);
  process.exit(1);
});