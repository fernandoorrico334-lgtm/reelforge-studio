import { PrismaClient } from "@prisma/client";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureArtifactsExist, printSmokeSummary } from "./smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadEngine() {
  await ensureArtifactsExist(
    projectRoot,
    ["packages/production-discovery-engine/dist/index.js"],
    "Run 'npm run build' before asset vault smokes."
  );

  return import(pathToFileURL(join(projectRoot, "packages/production-discovery-engine/dist/index.js")).href);
}

function runId() {
  return `smoke-${Date.now().toString(36)}`;
}

async function createCandidate(prisma, collectionId, mission, candidate, extra = {}) {
  return prisma.mediaCandidate.create({
    data: {
      collectionId,
      provider: candidate.provider,
      originalPath: extra.originalPath ?? null,
      title: candidate.title,
      previewUrl: candidate.previewUrl,
      downloadUrl: null,
      sourceUrl: candidate.sourceUrl,
      sourceAuthor: candidate.sourceAuthor,
      sourceLicense: candidate.sourceLicense,
      sourceLicenseUrl: candidate.sourceLicenseUrl,
      mediaType: "image",
      detectedType: candidate.mediaType,
      suggestedCategory: "REFERENCE",
      suggestedTags: JSON.stringify(["asset-vault", mission.niche]),
      category: "REFERENCE",
      tags: JSON.stringify([
        "asset-vault",
        "candidate-first",
        `mission:${mission.id}`,
        ...(mission.vaultId ? [`vault:${mission.vaultId}`] : []),
        `score:${candidate.overallScore}`
      ]),
      copyrightRisk: candidate.riskLevel === "low" ? "LOW" : "UNKNOWN",
      recommendedUse: candidate.whyThisCandidate,
      usageNotes: JSON.stringify({
        missionId: mission.id,
        vaultId: mission.vaultId,
        relevanceScore: candidate.relevanceScore,
        qualityScore: candidate.qualityScore,
        sceneFitScore: candidate.sceneFitScore,
        licenseConfidence: 70,
        sourceReliabilityScore: 70,
        overallScore: candidate.overallScore,
        whyThisCandidate: candidate.whyThisCandidate,
        duplicateWarning: extra.duplicateWarning ?? null,
        possibleDuplicateOf: extra.possibleDuplicateOf ?? null,
        userConfirmedUse: false,
        requiresUserReview: true
      }),
      status: "pending",
      assetId: null
    }
  });
}

export async function runAssetVaultBuilderSmoke() {
  const prisma = new PrismaClient();
  const engine = await loadEngine();
  const id = runId();

  try {
    const vault = await prisma.assetVault.create({
      data: {
        name: `Football Vault ${id}`,
        niche: "football",
        sourcePackId: "football_source_pack",
        targetAssetTypes: JSON.stringify(["image", "video", "sfx"]),
        tags: JSON.stringify(["football", id]),
        status: "draft"
      }
    });
    const plan = engine.buildSearchMissionQueries({
      topic: "football stadium night",
      niche: "football",
      sourcePackId: "football_source_pack",
      targetCount: 4
    });
    const mission = await prisma.searchMission.create({
      data: {
        vaultId: vault.id,
        topic: plan.topic,
        niche: plan.niche,
        sourcePackId: plan.sourcePackId,
        providers: JSON.stringify(plan.providers.slice(0, 4)),
        querySet: JSON.stringify(plan.queries),
        targetCount: 4,
        status: "searching"
      }
    });
    const search = engine.searchDiscoveryCandidates({
      query: plan.queries[0],
      mediaType: "image",
      providers: plan.providers.slice(0, 4),
      targetCount: 4,
      niche: "football"
    });
    const collection = await prisma.mediaCollection.create({
      data: {
        name: `Asset Vault Mission ${id}`,
        provider: "asset-vault-smoke",
        query: plan.queries[0],
        mediaType: "image",
        status: "ready_for_review",
        targetCount: 4,
        importedCount: 0,
        rejectedCount: 0,
        notes: `mission:${mission.id}; vault:${vault.id}`
      }
    });
    const deduped = engine.deduplicateCandidates([
      ...search.candidates.map((candidate) => ({
        id: candidate.id,
        provider: candidate.provider,
        title: candidate.title,
        sourceUrl: candidate.sourceUrl,
        previewUrl: candidate.previewUrl,
        downloadUrl: null
      })),
      {
        id: "forced-duplicate",
        provider: search.candidates[0].provider,
        title: search.candidates[0].title,
        sourceUrl: search.candidates[0].sourceUrl,
        previewUrl: search.candidates[0].previewUrl,
        downloadUrl: null
      }
    ]);
    const saved = [];
    for (const candidate of search.candidates) {
      const score = engine.scoreDiscoveryCandidate({
        title: candidate.title,
        query: plan.queries[0],
        mediaType: candidate.mediaType,
        providerId: candidate.provider,
        previewUrl: candidate.previewUrl,
        sourceUrl: candidate.sourceUrl,
        licenseStatus: candidate.licenseStatus,
        riskLevel: candidate.riskLevel
      });
      const dedup = deduped.find((item) => item.id === candidate.id);
      saved.push(
        await createCandidate(prisma, collection.id, mission, {
          ...candidate,
          ...score
        }, {
          duplicateWarning: dedup?.duplicateWarning ?? null,
          possibleDuplicateOf: dedup?.possibleDuplicateOf ?? null,
          originalPath: saved.length === 0 ? "storage/assets/imports/smoke-authorized-local.png" : null
        })
      );
    }
    const first = saved[0];
    await prisma.mediaCandidate.update({
      where: { id: first.id },
      data: {
        status: "approved",
        usageNotes: JSON.stringify({
          ...JSON.parse(first.usageNotes),
          userConfirmedUse: true,
          userConfirmedAt: new Date().toISOString()
        })
      }
    });
    const asset = await prisma.asset.create({
      data: {
        filename: "smoke-authorized-local.png",
        originalName: first.title,
        path: "storage/assets/imports/smoke-authorized-local.png",
        type: "IMAGE",
        category: "REFERENCE",
        tags: JSON.stringify(["asset-vault-import", id]),
        licenseType: first.sourceLicense ?? "local_user_review",
        copyrightRisk: first.copyrightRisk ?? "UNKNOWN",
        recommendedUse: first.recommendedUse,
        sourceProvider: first.provider,
        sourceUrl: first.sourceUrl,
        collectionId: collection.id,
        usageNotes: first.usageNotes
      }
    });
    await prisma.mediaCandidate.update({
      where: { id: first.id },
      data: {
        status: "imported",
        assetId: asset.id
      }
    });
    await prisma.searchMission.update({
      where: { id: mission.id },
      data: {
        status: "completed",
        candidateCount: saved.length,
        reviewRequiredCount: saved.length - 1,
        approvedCount: 0,
        importedCount: 1
      }
    });
    await prisma.assetVault.update({
      where: { id: vault.id },
      data: {
        status: "active",
        candidateCount: saved.length,
        importedCount: 1
      }
    });
    const gap = engine.analyzeAssetVaultGaps({
      niche: "football",
      targetAssetTypes: ["image", "video", "sfx"],
      existingCounts: { image: 1 },
      candidateCounts: { image: saved.length }
    });

    assert(search.assetsCreated === 0, "Search must not create assets.");
    assert(saved.every((candidate) => candidate.assetId === null), "Initial candidates must not be assets.");
    assert(asset.id, "Manual confirmed import should create an asset in smoke.");
    assert(deduped.some((candidate) => candidate.duplicateWarning), "Dedup should mark duplicates.");

    printSmokeSummary({
      smoke: "asset-vault-builder",
      status: "completed",
      vaultId: vault.id,
      missionId: mission.id,
      candidateCount: saved.length,
      importedCount: 1,
      assetId: asset.id,
      missingTypes: gap.missingByMediaType.map((item) => item.mediaType)
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function runSearchMissionsSmoke() {
  const prisma = new PrismaClient();
  const engine = await loadEngine();
  const id = runId();

  try {
    const plan = engine.buildSearchMissionQueries({
      topic: `documentary archive ${id}`,
      niche: "documentary",
      targetCount: 3
    });
    const mission = await prisma.searchMission.create({
      data: {
        topic: plan.topic,
        niche: plan.niche,
        sourcePackId: plan.sourcePackId,
        providers: JSON.stringify(plan.providers.slice(0, 3)),
        querySet: JSON.stringify(plan.queries),
        targetCount: 3,
        status: "searching"
      }
    });
    const result = engine.searchDiscoveryCandidates({
      query: plan.queries[0],
      providers: plan.providers.slice(0, 3),
      targetCount: 3,
      niche: "documentary"
    });
    await prisma.searchMission.update({
      where: { id: mission.id },
      data: {
        status: "ready_for_review",
        candidateCount: result.candidates.length,
        reviewRequiredCount: result.candidates.length
      }
    });

    assert(result.providerResults.length > 0, "Provider results should exist.");
    assert(result.candidates.length > 0, "Candidates should exist.");
    assert(result.assetsCreated === 0, "No assets should be created.");

    printSmokeSummary({
      smoke: "search-missions",
      status: "completed",
      missionId: mission.id,
      providerResults: result.providerResults.length,
      candidates: result.candidates.length
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function runCandidateScoringDedupSmoke() {
  const engine = await loadEngine();
  const score = engine.scoreDiscoveryCandidate({
    title: "Football stadium night crowd",
    query: "football stadium night",
    mediaType: "image",
    providerId: "wikimedia-commons",
    previewUrl: "https://commons.wikimedia.org/wiki/File:stadium.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:stadium.jpg",
    licenseStatus: "creative_commons",
    riskLevel: "medium"
  });
  const deduped = engine.deduplicateCandidates([
    {
      id: "a",
      provider: "wikimedia-commons",
      title: "Football stadium night crowd",
      sourceUrl: "https://example.com/a.jpg",
      previewUrl: "https://example.com/a.jpg",
      downloadUrl: null
    },
    {
      id: "b",
      provider: "wikimedia-commons",
      title: "Football stadium night crowd",
      sourceUrl: "https://example.com/a.jpg",
      previewUrl: "https://example.com/a.jpg",
      downloadUrl: null
    }
  ]);

  assert(score.overallScore > 0, "Score should be positive.");
  assert(score.whyThisCandidate, "whyThisCandidate should be present.");
  assert(deduped[1].duplicateWarning, "Second candidate should be marked duplicate.");

  printSmokeSummary({
    smoke: "candidate-scoring-dedup",
    status: "completed",
    overallScore: score.overallScore,
    duplicateWarning: deduped[1].duplicateWarning
  });
}

export async function runAssetVaultGapAnalysisSmoke() {
  const engine = await loadEngine();
  const analysis = engine.analyzeAssetVaultGaps({
    niche: "football",
    targetAssetTypes: ["image", "video", "sfx"],
    existingCounts: {},
    candidateCounts: {}
  });

  assert(analysis.missingByMediaType.length > 0, "Gap analysis should find missing types.");
  assert(
    analysis.suggestedSearchMissions.length === analysis.missingByMediaType.length,
    "Gap analysis should suggest missions."
  );

  printSmokeSummary({
    smoke: "asset-vault-gap-analysis",
    status: "completed",
    missingByMediaType: analysis.missingByMediaType,
    suggestedSearchMissions: analysis.suggestedSearchMissions.length
  });
}
