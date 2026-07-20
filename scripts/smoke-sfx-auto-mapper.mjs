import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const { autoMapSfxCues, resolveSfxSuggestionTarget } = await import(
    pathToFileURL(join(projectRoot, "packages", "audio-engine", "dist", "sfx-auto-mapper.js")).href
  );

  const sfxAssets = [
    {
      asset: {
        id: "sfx-hit-01",
        filename: "short-impact-hit-pop.wav",
        type: "SFX",
        tags: ["hit", "impact", "caption"],
        recommendedUse: "Caption hits and comic impact accents",
        duration: 0.28
      },
      profile: {
        assetId: "sfx-hit-01",
        title: "Short Impact Hit Pop",
        category: "impact",
        intensity: "high",
        durationSeconds: 0.28,
        useCase: "impact_moment",
        licenseStatus: "owned",
        notes: "Local authorized SFX pack"
      }
    },
    {
      asset: {
        id: "sfx-whoosh-01",
        filename: "fast-whoosh-transition.wav",
        type: "SFX",
        tags: ["whoosh", "transition"],
        recommendedUse: "Fast zoom and page moves",
        duration: 0.48
      },
      profile: {
        assetId: "sfx-whoosh-01",
        title: "Fast Whoosh Transition",
        category: "whoosh",
        intensity: "medium",
        durationSeconds: 0.48,
        useCase: "transition",
        licenseStatus: "royalty_free",
        notes: "Royalty-free whoosh"
      }
    },
    {
      asset: {
        id: "sfx-riser-01",
        filename: "dark-riser-build.wav",
        type: "SFX",
        tags: ["riser", "tension"],
        recommendedUse: "Tension builds",
        duration: 1.1
      },
      profile: {
        assetId: "sfx-riser-01",
        title: "Dark Riser Build",
        category: "riser",
        intensity: "medium",
        durationSeconds: 1.1,
        useCase: "reveal",
        licenseStatus: "licensed",
        notes: "Licensed pack"
      }
    }
  ];

  const cues = [
    {
      sceneId: "scene-1",
      sceneOrder: 1,
      cueIndex: 1,
      text: "SUPERMAN SENTIU",
      keyword: "SUPERMAN",
      sfxSuggestion: "caption_hit",
      emphasis: "impact",
      colorMood: "red",
      absoluteStartSeconds: 0,
      volume: 0.78
    },
    {
      sceneId: "scene-1",
      sceneOrder: 1,
      cueIndex: 2,
      text: "RASGA A PAGINA",
      keyword: "PAGINA",
      sfxSuggestion: "page_tear",
      emphasis: "shake",
      colorMood: "gold",
      absoluteStartSeconds: 1.2,
      volume: 0.72
    },
    {
      sceneId: "scene-2",
      sceneOrder: 2,
      cueIndex: 1,
      text: "A TENSAO SOBE",
      keyword: "TENSAO",
      sfxSuggestion: "riser",
      emphasis: "glow",
      colorMood: "blue",
      absoluteStartSeconds: 4.3,
      volume: 0.58
    }
  ];

  const targets = cues.map((cue) => resolveSfxSuggestionTarget(cue.sfxSuggestion, cue));
  assert(targets[0].category === "impact", "caption_hit should map to impact category");
  assert(targets[1].category === "transition", "page_tear should map to transition category");
  assert(targets[2].category === "riser", "riser should map to riser category");

  const mapped = autoMapSfxCues(cues, sfxAssets, { allowUnknownLicense: false });
  assert(mapped.length === 3, "expected one result per cue");
  assert(mapped[0].selectedAsset?.asset.id === "sfx-hit-01", "caption_hit should select the short impact hit");
  assert(mapped[0].confidence >= 70, "caption_hit match should have strong confidence");
  assert(mapped[1].selectedAsset?.asset.id === "sfx-whoosh-01", "page_tear should fall back to transition/whoosh asset");
  assert(mapped[2].selectedAsset?.asset.id === "sfx-riser-01", "riser cue should select riser asset");

  console.log(JSON.stringify({
    status: "completed",
    mappedCount: mapped.filter((item) => item.selectedAsset).length,
    results: mapped.map((item) => ({
      suggestion: item.cue.sfxSuggestion,
      targetCategory: item.target.category,
      selectedAssetId: item.selectedAsset?.asset.id ?? null,
      selectedFilename: item.selectedAsset?.asset.filename ?? null,
      confidence: item.confidence,
      warnings: item.warnings
    }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
