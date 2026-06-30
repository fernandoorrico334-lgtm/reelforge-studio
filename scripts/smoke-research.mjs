import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  resolveApiBuildRoot
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Research Channel";
const smokeDossierTitle = "Smoke Research Dossier";
const smokeProjectTitle = "Smoke Research Production";
const npmCliPath =
  typeof process.env.npm_execpath === "string" &&
  process.env.npm_execpath.trim().length > 0
    ? process.env.npm_execpath
    : null;

function log(message) {
  console.log(`[smoke:research] ${message}`);
}

function runCommand(command, args, cwd = projectRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      const tail = `${stderr}${stdout}`
        .trim()
        .split(/\r?\n/u)
        .slice(-8)
        .join(" | ");
      rejectPromise(
        new Error(
          `Command '${command}' failed with code ${code ?? "unknown"}. ${tail || "No stdout/stderr output captured."}`
        )
      );
    });
  });
}

async function runNpm(argumentsList) {
  if (!npmCliPath) {
    throw new Error(
      "npm_execpath is unavailable. Run the smoke test through 'npm run smoke:research'."
    );
  }

  return runCommand(process.execPath, [npmCliPath, ...argumentsList]);
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:research."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/channels/infrastructure/prisma-channel-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/research/infrastructure/prisma-research-repository.js",
    "modules/research/application/research-service.js",
    "modules/production/application/production-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    apiArtifacts,
    "Run 'npm run build' before running smoke:research."
  );

  return { apiBuildRoot };
}

async function loadSmokeDependencies(apiBuildRoot) {
  const [
    apiPrismaModule,
    assetRepositoryModule,
    channelRepositoryModule,
    projectRepositoryModule,
    researchRepositoryModule,
    researchServiceModule,
    productionServiceModule
  ] = await Promise.all([
    importModule(apiArtifactPath(apiBuildRoot, "infrastructure/database/prisma-client.js")),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/assets/infrastructure/prisma-asset-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/channels/infrastructure/prisma-channel-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/projects/infrastructure/prisma-project-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/research/infrastructure/prisma-research-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/research/application/research-service.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/production/application/production-service.js"
      )
    )
  ]);

  return {
    prisma: apiPrismaModule.prisma,
    createPrismaAssetRepository:
      assetRepositoryModule.createPrismaAssetRepository,
    createPrismaChannelRepository:
      channelRepositoryModule.createPrismaChannelRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    createPrismaResearchRepository:
      researchRepositoryModule.createPrismaResearchRepository,
    createResearchDossier: researchServiceModule.createResearchDossier,
    addManualResearchSource: researchServiceModule.addManualResearchSource,
    approveResearchSource: researchServiceModule.approveResearchSource,
    analyzeResearchDossier: researchServiceModule.analyzeResearchDossier,
    createProductionFromResearchDossier:
      researchServiceModule.createProductionFromResearchDossier,
    getVideoProjectProductionChecklist:
      productionServiceModule.getVideoProjectProductionChecklist
  };
}

async function prepareSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: {
      name: smokeChannelName
    },
    update: {
      niche: "Smoke validation for Research Collector",
      language: "pt-BR",
      visualStyle: "Documentary desk with clean dark studio cards",
      narrativeTone: "Investigativo e responsavel",
      defaultTemplate: "true_crime",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "standard",
      defaultAudioMood: "documentary_bed",
      defaultCaptionStyle: "bold_impact",
      defaultVisualPreset: "mystery",
      defaultDurationTarget: 30,
      defaultSceneDuration: 4.5,
      preferredAssetCategories: JSON.stringify([
        "BACKGROUND",
        "REFERENCE",
        "SCREENSHOT"
      ]),
      preferredAssetTags: JSON.stringify([
        "research",
        "documentario",
        "arquivo"
      ])
    },
    create: {
      name: smokeChannelName,
      niche: "Smoke validation for Research Collector",
      language: "pt-BR",
      visualStyle: "Documentary desk with clean dark studio cards",
      narrativeTone: "Investigativo e responsavel",
      defaultTemplate: "true_crime",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "standard",
      defaultAudioMood: "documentary_bed",
      defaultCaptionStyle: "bold_impact",
      defaultVisualPreset: "mystery",
      defaultDurationTarget: 30,
      defaultSceneDuration: 4.5,
      preferredAssetCategories: JSON.stringify([
        "BACKGROUND",
        "REFERENCE",
        "SCREENSHOT"
      ]),
      preferredAssetTags: JSON.stringify([
        "research",
        "documentario",
        "arquivo"
      ])
    }
  });
}

async function clearPreviousSmokeData(prismaClient) {
  await prismaClient.videoProject.deleteMany({
    where: {
      title: smokeProjectTitle
    }
  });

  await prismaClient.researchDossier.deleteMany({
    where: {
      title: smokeDossierTitle
    }
  });
}

function buildManualSources() {
  return [
    {
      title: "Relatorio interno do Observatorio Meridian",
      url: "https://manual.local/meridian/relatorio-interno",
      provider: "manual",
      sourceType: "manual_note",
      author: "Equipe Meridian",
      publishedAt: "1998-08-14",
      citationText: "Relatorio interno do Observatorio Meridian",
      excerpt:
        "Em 12 de agosto de 1998, o Observatorio Meridian perdeu sinal por 9 minutos durante uma tempestade seca em Vale Frio. O relatorio interno registrou a interrupcao, a evacuacao de 18 tecnicos e a falha de um painel auxiliar.",
      notes:
        "Tratar como base factual para data, local e impacto operacional.",
      reliabilityScore: 84
    },
    {
      title: "Dossie publico sobre o fechamento do Meridian",
      url: "https://manual.local/meridian/dossie-publico",
      provider: "manual",
      sourceType: "archive",
      author: "Arquivo Regional de Vale Frio",
      publishedAt: "2001-03-09",
      citationText: "Dossie publico sobre o fechamento do Meridian",
      excerpt:
        "Tres anos depois, um dossie publico afirmou que registros de manutencao incompleta agravaram a crise. Alguns relatos alegam sabotagem, mas nenhuma prova conclusiva apareceu. Em 2001, o conselho regional confirmou o fechamento gradual do observatorio.",
      notes:
        "Boa camada de contexto, mas a alegacao de sabotagem precisa continuar marcada como incerta.",
      reliabilityScore: 73
    }
  ];
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadSmokeDependencies(apiBuildRoot);

  try {
    await clearPreviousSmokeData(deps.prisma);

    const channel = await prepareSmokeChannel(deps.prisma);
    const channelRepository = deps.createPrismaChannelRepository();
    const assetRepository = deps.createPrismaAssetRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const researchRepository = deps.createPrismaResearchRepository();

    log("Creating research dossier.");
    const dossier = await deps.createResearchDossier(
      researchRepository,
      channelRepository,
      {
        channelId: channel.id,
        title: smokeDossierTitle,
        topic: "O apagao do Observatorio Meridian em 1998",
        niche: "short documental sombrio",
        tone: "investigativo e responsavel",
        targetDuration: 32,
        status: "researching",
        summary: null,
        narrativeAngle: null,
        editorialNotes: null,
        safetyNotes: null
      }
    );

    const createdSources = [];

    for (const source of buildManualSources()) {
      const created = await deps.addManualResearchSource(
        researchRepository,
        dossier.id,
        source
      );
      createdSources.push(
        await deps.approveResearchSource(researchRepository, created.id)
      );
    }

    log(`Approved ${createdSources.length} manual source(s).`);

    const analysis = await deps.analyzeResearchDossier(
      researchRepository,
      dossier.id
    );

    if (
      analysis.factCount < 1 ||
      analysis.timelineCount < 1 ||
      analysis.hookCount < 1 ||
      analysis.assetRequirementCount < 1 ||
      analysis.outlineSceneCount < 1
    ) {
      throw new Error(
        "Research analysis did not generate the required facts, timeline, hooks, asset requirements and outline scenes."
      );
    }

    log("Creating production from analyzed dossier.");
    const productionResult = await deps.createProductionFromResearchDossier(
      researchRepository,
      projectRepository,
      channelRepository,
      assetRepository,
      dossier.id,
      {
        title: smokeProjectTitle,
        status: "SCENE_PLANNING",
        format: "9:16"
      }
    );

    if (!productionResult.projectId || productionResult.scenesCreated < 1) {
      throw new Error("Research production did not create a valid project.");
    }

    const checklistResult = await deps.getVideoProjectProductionChecklist(
      projectRepository,
      channelRepository,
      productionResult.projectId
    );

    if (!checklistResult?.checklist) {
      throw new Error("Production checklist was not returned for the created project.");
    }

    console.log(
      JSON.stringify(
        {
          dossierId: dossier.id,
          sourceCount: createdSources.length,
          factCount: analysis.factCount,
          timelineCount: analysis.timelineCount,
          outlineSceneCount: analysis.outlineSceneCount,
          projectId: productionResult.projectId,
          checklistReadyToRender: checklistResult.checklist.readyToRender,
          status: "completed"
        },
        null,
        2
      )
    );
  } finally {
    await deps.prisma.$disconnect();
  }
}

await main();

