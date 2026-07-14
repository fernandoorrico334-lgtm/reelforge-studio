import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const beast = await importMediaBeast();
  const { appendComicsSelectionFeedback, deriveComicIdFromPanel, buildMockPanel } = beast;

  const panelId = args["panel-id"];
  const beatRole = args["beat-role"];
  const theme = args.theme;
  const decision = args.decision;
  const reason = args.reason;

  if (!panelId || !beatRole || !theme || !decision || !reason) {
    throw new Error(
      "Usage: node scripts/record-comics-selection-feedback.mjs --panel-id <id> --beat-role <role> --theme <theme> --decision approved|rejected --reason <reason> [--entities a,b] [--relationships duo] [--sha256 <hash>] [--comic-id <id>] [--notes text]"
    );
  }

  if (decision !== "approved" && decision !== "rejected") {
    throw new Error(`Invalid --decision: ${decision}`);
  }

  const entities = (args.entities ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const relationships = (args.relationships ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const panel = buildMockPanel({
    panelId,
    panelImageSha256: args.sha256 ?? "0".repeat(64),
    localEvidence: {
      characters: entities.map((name) => ({
        name,
        confidence: 0.9,
        evidenceSource: "visual"
      })),
      actions: [],
      relationships: relationships.map((type) => ({
        type,
        entities,
        confidence: 0.85
      })),
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: [theme],
      objects: [],
      locations: []
    }
  });

  const result = await appendComicsSelectionFeedback(
    {
      comicId: args["comic-id"] ?? deriveComicIdFromPanel(panel),
      panelId,
      panelImageSha256: panel.panelImageSha256,
      beatRole,
      narrationTheme: theme,
      requiredEntities: entities,
      requiredRelationships: relationships,
      decision,
      reason,
      ...(args.notes ? { notes: String(args.notes) } : {})
    },
    projectRoot
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        feedbackId: result.entry.feedbackId,
        ledgerPath: result.ledgerPath,
        entry: result.entry
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[record-comics-selection-feedback] FAIL");
  console.error(error);
  process.exit(1);
});