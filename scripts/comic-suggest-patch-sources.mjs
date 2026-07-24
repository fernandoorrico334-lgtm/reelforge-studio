import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp"]);
const videoExtensions = new Set([".mp4", ".mov", ".mkv", ".webm", ".avi"]);
const stopWords = new Set([
  "a", "o", "os", "as", "e", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "com", "para", "por",
  "uma", "um", "este", "esta", "essa", "esse", "cena", "patch", "focar", "usar", "trocar", "painel", "correto",
  "the", "and", "with", "from", "this", "that", "scene", "panel", "focus", "swap", "correct"
]);

function parseArgs(argv) {
  const options = {
    manifest: null,
    panelCatalog: null,
    outputDir: null,
    topN: 3
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--manifest") {
      options.manifest = next ?? null;
      index += 1;
    } else if (token === "--panel-catalog") {
      options.panelCatalog = next ?? null;
      index += 1;
    } else if (token === "--output-dir") {
      options.outputDir = next ?? null;
      index += 1;
    } else if (token === "--top-n") {
      options.topN = Number(next ?? options.topN);
      index += 1;
    } else if (token === "--help" || token === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
node scripts/comic-suggest-patch-sources.mjs --manifest <scene-patch-manifest.json> --panel-catalog <panels.json>

This is candidate-first. It only suggests local panel/video sources. Nothing is imported, rendered or approved automatically.
`);
}

async function fileExists(path) {
  if (!path) return false;
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function detectSourceType(path) {
  const extension = extname(path ?? "").toLowerCase();
  if (imageExtensions.has(extension)) return "image";
  if (videoExtensions.has(extension)) return "video";
  return "unknown";
}

function normalizePanelList(panelCatalog) {
  if (Array.isArray(panelCatalog)) return panelCatalog;
  if (Array.isArray(panelCatalog?.panels)) return panelCatalog.panels;
  if (Array.isArray(panelCatalog?.items)) return panelCatalog.items;
  if (Array.isArray(panelCatalog?.candidates)) return panelCatalog.candidates;
  if (Array.isArray(panelCatalog?.timelineScenes)) return panelCatalog.timelineScenes;
  return [];
}

function valueFromFirst(object, keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null && object?.[key] !== "") return object[key];
  }
  return null;
}

function normalizePanelCandidate(raw, index) {
  const sourcePath = valueFromFirst(raw, [
    "panelImagePath",
    "imagePath",
    "sourcePath",
    "assetPath",
    "path",
    "outputPath"
  ]);
  const tags = [
    ...(Array.isArray(raw.tags) ? raw.tags : []),
    ...(Array.isArray(raw.entities) ? raw.entities.map((entity) => entity?.name ?? entity?.id ?? entity) : []),
    ...(Array.isArray(raw.actions) ? raw.actions : []),
    ...(Array.isArray(raw.themes) ? raw.themes : []),
    raw.storyFunction,
    raw.shotRole,
    raw.captionText,
    raw.narrationText,
    raw.title,
    raw.label,
    raw.description
  ];

  return {
    candidateId: String(valueFromFirst(raw, ["candidateId", "panelId", "id"]) ?? `panel-candidate-${index + 1}`),
    panelId: valueFromFirst(raw, ["panelId", "id"]),
    sceneId: valueFromFirst(raw, ["sceneId"]),
    requestItemId: valueFromFirst(raw, ["requestItemId"]),
    slotId: valueFromFirst(raw, ["slotId"]),
    pageNumber: Number(valueFromFirst(raw, ["pageNumber", "page", "sourcePageNumber"])),
    panelNumber: Number(valueFromFirst(raw, ["panelNumber", "panelIndex"])),
    sourcePath: sourcePath ? resolve(String(sourcePath)) : null,
    sourceType: detectSourceType(sourcePath),
    captionText: valueFromFirst(raw, ["captionText", "label", "title"]),
    focus: raw.focus ?? raw.normalizedCrop ?? raw.cropBounds ?? raw.crop ?? null,
    qualityScore: Number(valueFromFirst(raw, ["score", "qualityScore", "visualQualityScore", "cropability916Score"]) ?? 0),
    rawText: normalizeText(tags.join(" ")),
    raw
  };
}

function slotSearchText(slot) {
  return [
    slot.sceneId,
    slot.correctionType,
    slot.severity,
    ...(slot.instructions ?? []),
    ...(slot.sourceEvidenceFrames ?? []).map((frame) => `${frame.label ?? ""} ${frame.outputPath ?? ""}`)
  ].join(" ");
}

function scoreCandidateForSlot(slot, candidate, sourceExists) {
  let score = 0;
  const reasons = [];
  const slotTokens = tokenize(slotSearchText(slot));
  const candidateTokens = tokenize(candidate.rawText);
  const candidateTokenSet = new Set(candidateTokens);
  const overlap = slotTokens.filter((token) => candidateTokenSet.has(token));

  if (candidate.sceneId && candidate.sceneId === slot.sceneId) {
    score += 80;
    reasons.push("scene_id_match");
  }
  if (candidate.requestItemId && candidate.requestItemId === slot.requestItemId) {
    score += 70;
    reasons.push("request_item_match");
  }
  if (candidate.slotId && candidate.slotId === slot.slotId) {
    score += 70;
    reasons.push("slot_id_match");
  }
  if (overlap.length) {
    score += Math.min(45, overlap.length * 9);
    reasons.push(`keyword_overlap:${overlap.slice(0, 5).join(",")}`);
  }
  if (Number.isFinite(candidate.qualityScore) && candidate.qualityScore > 0) {
    score += Math.min(20, Math.round(candidate.qualityScore / 5));
    reasons.push(`quality:${candidate.qualityScore}`);
  }
  if (slot.correctionType === "crop_retarget" && candidate.focus) {
    score += 12;
    reasons.push("has_focus_crop");
  }
  if (slot.correctionType === "panel_swap" && candidate.panelId) {
    score += 10;
    reasons.push("has_panel_id");
  }
  if (candidate.sourceType === "image") {
    score += 8;
    reasons.push("image_source");
  } else if (candidate.sourceType === "video") {
    score += 5;
    reasons.push("video_source");
  }
  if (sourceExists) {
    score += 10;
    reasons.push("source_file_exists");
  } else {
    score -= 30;
    reasons.push("source_file_missing");
  }

  return { score, reasons: unique(reasons) };
}

export async function buildPatchSourceSuggestionPlan({ manifest, panelCatalog, topN = 3 }) {
  const panels = normalizePanelList(panelCatalog).map(normalizePanelCandidate);
  const suggestions = [];

  for (const slot of Array.isArray(manifest.patchSlots) ? manifest.patchSlots : []) {
    const ranked = [];
    for (const candidate of panels) {
      if (!candidate.sourcePath || candidate.sourceType === "unknown") continue;
      const sourceExists = await fileExists(candidate.sourcePath);
      const scored = scoreCandidateForSlot(slot, candidate, sourceExists);
      if (scored.score <= 0) continue;
      ranked.push({
        candidateId: candidate.candidateId,
        panelId: candidate.panelId,
        sceneId: candidate.sceneId,
        pageNumber: Number.isFinite(candidate.pageNumber) ? candidate.pageNumber : null,
        panelNumber: Number.isFinite(candidate.panelNumber) ? candidate.panelNumber : null,
        sourcePath: candidate.sourcePath,
        sourceType: candidate.sourceType,
        captionText: candidate.captionText,
        focus: candidate.focus,
        score: scored.score,
        reasons: scored.reasons,
        sourceExists
      });
    }

    ranked.sort((left, right) => right.score - left.score);
    const topCandidates = ranked.slice(0, Math.max(1, topN));
    const best = topCandidates[0] ?? null;
    suggestions.push({
      slotId: slot.slotId,
      requestItemId: slot.requestItemId,
      sceneId: slot.sceneId,
      order: slot.order,
      correctionType: slot.correctionType,
      severity: slot.severity,
      status: best ? "has_candidates" : "waiting_patch_source",
      bestCandidateScore: best?.score ?? 0,
      candidates: topCandidates,
      recommendedPatchSource: best
        ? {
            sceneId: slot.sceneId,
            slotId: slot.slotId,
            requestItemId: slot.requestItemId,
            sourcePath: best.sourcePath,
            sourceType: best.sourceType,
            captionText: best.captionText,
            focus: best.focus,
            approved: false,
            approvalRequired: true,
            candidateId: best.candidateId,
            panelId: best.panelId,
            score: best.score,
            reasons: best.reasons
          }
        : null
    });
  }

  const recommendedSources = suggestions
    .map((suggestion) => suggestion.recommendedPatchSource)
    .filter(Boolean);

  return {
    planId: "comic_patch_source_suggestion_plan_v1",
    sourceManifestId: manifest.manifestId,
    sourceRequestId: manifest.sourceRequestId,
    renderWholeVideoAgain: false,
    candidateFirst: true,
    approvalRequired: true,
    panelCandidateCount: panels.length,
    patchSlotCount: suggestions.length,
    suggestedSourceCount: recommendedSources.length,
    suggestions,
    patchSourcesDraft: {
      sources: recommendedSources
    },
    safety: {
      importsAssets: false,
      downloadsAssets: false,
      rendersPatches: false,
      approvesAutomatically: false,
      userMustSetApprovedTrueBeforeGeneration: true
    },
    nextAction: recommendedSources.length
      ? "Review patchSourcesDraft, set approved=true only for correct sources, then run comic:generate-scene-patches."
      : "No usable local panel candidates found. Provide manual patch sources."
  };
}

function markdownForSuggestionPlan(plan) {
  const lines = [
    "# Comic Patch Source Suggestions",
    "",
    `- Patch slots: ${plan.patchSlotCount}`,
    `- Suggested sources: ${plan.suggestedSourceCount}`,
    `- Candidate-first: ${plan.candidateFirst ? "yes" : "no"}`,
    `- Auto approval: no`,
    "",
    "## Suggestions"
  ];

  for (const suggestion of plan.suggestions) {
    lines.push("");
    lines.push(`### ${suggestion.order}. ${suggestion.sceneId}`);
    lines.push(`- Status: ${suggestion.status}`);
    lines.push(`- Correction: ${suggestion.correctionType}`);
    lines.push(`- Best score: ${suggestion.bestCandidateScore}`);
    for (const candidate of suggestion.candidates) {
      lines.push(`- Candidate ${candidate.candidateId}: score ${candidate.score}, page ${candidate.pageNumber ?? "?"}, source ${candidate.sourcePath}`);
      lines.push(`  Reasons: ${candidate.reasons.join(", ")}`);
    }
  }

  lines.push("", "## Next Action", "", plan.nextAction);
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.manifest || !options.panelCatalog) {
    printHelp();
    throw new Error("--manifest and --panel-catalog are required.");
  }

  const manifestPath = resolve(options.manifest);
  const panelCatalogPath = resolve(options.panelCatalog);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const panelCatalog = JSON.parse(await readFile(panelCatalogPath, "utf8"));
  if (manifest.manifestId !== "comic_scene_patch_manifest_v1") {
    throw new Error(`Unsupported manifest: ${manifest.manifestId ?? "unknown"}`);
  }

  const outputDir = resolve(options.outputDir ?? manifest.outputDir ?? dirname(manifestPath));
  await mkdir(outputDir, { recursive: true });
  const plan = await buildPatchSourceSuggestionPlan({
    manifest,
    panelCatalog,
    topN: Number.isFinite(options.topN) ? options.topN : 3
  });

  const planPath = join(outputDir, "patch-source-suggestions.json");
  const reviewPath = join(outputDir, "patch-source-suggestions.md");
  const draftPath = join(outputDir, "patch-sources-draft.json");
  await writeFile(planPath, JSON.stringify(plan, null, 2), "utf8");
  await writeFile(reviewPath, markdownForSuggestionPlan(plan), "utf8");
  await writeFile(draftPath, JSON.stringify(plan.patchSourcesDraft, null, 2), "utf8");

  console.log(JSON.stringify({
    status: "completed",
    planPath,
    reviewPath,
    draftPath,
    patchSlotCount: plan.patchSlotCount,
    suggestedSourceCount: plan.suggestedSourceCount,
    approvalRequired: plan.approvalRequired,
    renderWholeVideoAgain: plan.renderWholeVideoAgain
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(JSON.stringify({
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    process.exitCode = 1;
  });
}
