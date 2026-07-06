import type { AppEnv } from "../../../config/env.js";
import { spawn } from "node:child_process";
import { NotFoundError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { AudioLibraryRepository } from "../../audio-library/application/audio-library-repository.js";
import {
  buildProjectBeatSyncPlan,
  selectMusicForProject
} from "../../audio-library/application/audio-library-service.js";
import type { CharacterRepository } from "../../characters/application/character-repository.js";
import type { EditorialMicroclipRepository } from "../../editorial-microclips/application/editorial-microclip-repository.js";
import { generateVisualForScene } from "../../hybrid-visual/application/hybrid-visual-service.js";
import type { VisualGenerationJobRepository } from "../../hybrid-visual/application/visual-generation-job-repository.js";
import type { IntakeRepository } from "../../intake/application/intake-repository.js";
import {
  generateNarrationForScene
} from "../../narration/application/narration-service.js";
import type { NarrationJobRepository } from "../../narration/application/narration-job-repository.js";
import { getVideoProjectRenderBlueprint } from "../../projects/application/project-render-blueprint-service.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type {
  ProjectScene,
  StudioProject,
  VisualGenerationProvider
} from "../../projects/domain/project.js";
import { createRenderJobForProject } from "../../render-jobs/application/render-job-service.js";
import type { RenderJobRepository } from "../../render-jobs/application/render-job-repository.js";
import type { RenderStorage } from "../../render-jobs/application/render-storage.js";
import type { ReelProductionRunRepository } from "./reel-production-run-repository.js";
import type {
  OneClickRunInput,
  OneClickRunResponse,
  ReelProductionChecklist,
  ReelProductionRun,
  ReelProductionRunMode,
  ReelProductionRunStatus,
  ReelProductionSceneChecklist,
  ReelProductionStep
} from "../domain/reel-production.js";

interface ReelProductionDependencies {
  appEnv: AppEnv;
  assetRepository: AssetRepository;
  audioLibraryRepository: AudioLibraryRepository;
  characterRepository: CharacterRepository;
  editorialMicroclipRepository: EditorialMicroclipRepository;
  intakeRepository: IntakeRepository;
  narrationJobRepository: NarrationJobRepository;
  projectRepository: ProjectRepository;
  renderJobRepository: RenderJobRepository;
  renderStorage: RenderStorage;
  runRepository: ReelProductionRunRepository;
  visualGenerationJobRepository: VisualGenerationJobRepository;
}

const stepDefinitions = [
  ["validate_project", "Validar projeto e cenas"],
  ["generate_narration", "Gerar narracao local ausente"],
  ["generate_visuals", "Gerar visuals ausentes"],
  ["select_music", "Selecionar musica local"],
  ["build_beat_sync", "Criar Beat Sync Plan"],
  ["validate_microclips", "Verificar microclips opcionais"],
  ["build_blueprint", "Gerar Render Blueprint"],
  ["create_render_job", "Criar RenderJob final"],
  ["process_render_job", "Processar RenderJob pelo worker"],
  ["finalize_output", "Finalizar output"]
] as const;

function now() {
  return new Date().toISOString();
}

function createInitialSteps(): ReelProductionStep[] {
  return stepDefinitions.map(([id, label]) => ({
    id,
    label,
    status: "pending",
    message: "Aguardando execucao.",
    entityIds: {},
    startedAt: null,
    completedAt: null
  }));
}

function updateStep(
  steps: ReelProductionStep[],
  id: string,
  patch: Partial<ReelProductionStep>
) {
  return steps.map((step) =>
    step.id === id
      ? {
          ...step,
          ...patch
        }
      : step
  );
}

function completeStep(
  steps: ReelProductionStep[],
  id: string,
  message: string,
  entityIds: ReelProductionStep["entityIds"] = {}
) {
  return updateStep(steps, id, {
    status: "completed",
    message,
    entityIds,
    startedAt: steps.find((step) => step.id === id)?.startedAt ?? now(),
    completedAt: now()
  });
}

function skipStep(steps: ReelProductionStep[], id: string, message: string) {
  return updateStep(steps, id, {
    status: "skipped",
    message,
    startedAt: steps.find((step) => step.id === id)?.startedAt ?? now(),
    completedAt: now()
  });
}

function failStep(steps: ReelProductionStep[], id: string, message: string) {
  return updateStep(steps, id, {
    status: "failed",
    message,
    startedAt: steps.find((step) => step.id === id)?.startedAt ?? now(),
    completedAt: now()
  });
}

function startStep(steps: ReelProductionStep[], id: string) {
  return updateStep(steps, id, {
    status: "running",
    startedAt: now(),
    completedAt: null
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message.trim()
    : "Etapa falhou.";
}

function parseSceneRecipe(scene: ProjectScene) {
  if (!scene.visualRecipe?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(scene.visualRecipe) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sceneHasVisual(scene: ProjectScene) {
  return Boolean(scene.assetId || scene.generatedAssetId);
}

function sceneHasNarration(scene: ProjectScene) {
  return Boolean(scene.generatedNarrationAssetId || scene.narrationText?.trim());
}

function countUnconfirmedCandidates(candidates: Awaited<ReturnType<IntakeRepository["listCandidates"]>>) {
  return candidates.filter((candidate) => {
    if (candidate.status !== "pending" && candidate.status !== "approved") {
      return false;
    }

    try {
      const notes = candidate.usageNotes
        ? (JSON.parse(candidate.usageNotes) as Record<string, unknown>)
        : {};
      return notes.userConfirmedUse !== true;
    } catch {
      return true;
    }
  }).length;
}

async function runWorkerOnceForQueuedJob(renderJobId: string) {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args =
    process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          `npm run once --workspace @reelforge/worker -- --render-job-id ${renderJobId}`
        ]
      : [
          "run",
          "once",
          "--workspace",
          "@reelforge/worker",
          "--",
          "--render-job-id",
          renderJobId
        ];

  return new Promise<{ exitCode: number; output: string }>((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: process.cwd(),
        env: process.env,
        windowsHide: true
      });
    } catch (error) {
      resolve({
        exitCode: 1,
        output: `Worker spawn failed: ${getErrorMessage(error)}`
      });
      return;
    }
    const chunks: string[] = [];

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    child.on("error", (error) => {
      resolve({
        exitCode: 1,
        output: `Worker spawn failed: ${error.message}`
      });
    });
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        output: chunks.join("").trim()
      });
    });
  });
}

function normalizeVisualProvider(value: string | null): VisualGenerationProvider {
  switch (value) {
    case "comfyui-local":
    case "manual":
    case "mock-svg":
    case "stable-diffusion-local":
    case "other":
      return value;
    default:
      return "mock-svg";
  }
}

function buildVisualGenerationInput(input: {
  provider: string | null;
  workflowPackId: string | null;
  qualityPresetId: string | null;
}) {
  return {
    provider: normalizeVisualProvider(input.provider),
    visualSourceMode: "generated_only" as const,
    characterProfileId: null,
    workflowPackId: input.workflowPackId,
    qualityPresetId: input.qualityPresetId,
    workflowId: "txt2img-basic",
    seedMode: "reuse",
    steps: null,
    cfg: null,
    sampler: null,
    scheduler: null,
    denoise: null,
    width: 1080,
    height: 1920,
    seed: null,
    autoAttach: true
  };
}

function resolveProductionDefaults(project: StudioProject, input: OneClickRunInput) {
  const firstRecipe =
    project.scenes.map(parseSceneRecipe).find((recipe) => recipe !== null) ?? null;
  const editing = project.editingStyleSummary;
  const isFootball = [project.channel.niche, project.channel.name, project.templateId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes("football") ||
    [project.channel.niche, project.channel.name, project.templateId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes("futebol");

  return {
    narrationProvider: input.providerStrategy.narrationProvider ?? "mock-tts",
    voicePackId:
      input.defaults.voicePackId ??
      editing?.recommendedNarrationVoicePackId ??
      readString(firstRecipe?.suggestedVoicePackId) ??
      (isFootball ? "sports_hype_ptbr" : "narrator_clean_ptbr"),
    visualProvider: input.providerStrategy.visualProvider ?? "mock-svg",
    fallbackVisualProvider: input.providerStrategy.fallbackVisualProvider ?? "mock-svg",
    workflowPackId:
      input.defaults.workflowPackId ??
      readString(firstRecipe?.suggestedWorkflowPackId) ??
      "cinematic_story",
    qualityPresetId: input.defaults.qualityPresetId ?? "standard",
    musicPresetId:
      input.defaults.musicPresetId ??
      project.musicPresetId ??
      editing?.recommendedMusicPresetId ??
      (isFootball ? "football_hype" : "shorts_clean_voice"),
    audioMasteringPresetId:
      input.defaults.audioMasteringPresetId ??
      editing?.recommendedAudioMasteringPresetId ??
      (isFootball ? "football_hype" : "shorts_clean_voice"),
    renderMode: project.channel.defaultRenderMode ?? "cinematic_v2",
    renderQuality: project.channel.defaultRenderQuality ?? "standard"
  };
}

async function requireProject(repository: ProjectRepository, projectId: string) {
  const project = await repository.getById(projectId);

  if (!project) {
    throw new NotFoundError(`Video project '${projectId}' was not found.`);
  }

  return project;
}

export async function buildReelProductionChecklist(
  dependencies: Pick<
    ReelProductionDependencies,
    "editorialMicroclipRepository" | "intakeRepository" | "projectRepository"
  >,
  projectId: string
): Promise<ReelProductionChecklist> {
  const project = await requireProject(dependencies.projectRepository, projectId);
  const microclips =
    await dependencies.editorialMicroclipRepository.listByProjectId(project.id);
  const projectCollections = await dependencies.intakeRepository.listCollections({
    projectId: project.id
  });
  const candidateGroups = await Promise.all(
    projectCollections.map((collection) =>
      dependencies.intakeRepository.listCandidates({ collectionId: collection.id })
    )
  );
  const mediaCandidates = candidateGroups.flat();
  const microclipsByScene = new Map<string, number>();

  for (const microclip of microclips) {
    if (microclip.sceneId) {
      microclipsByScene.set(
        microclip.sceneId,
        (microclipsByScene.get(microclip.sceneId) ?? 0) + 1
      );
    }
  }

  const scenes: ReelProductionSceneChecklist[] = project.scenes.map((scene) => {
    const narrationReady = Boolean(scene.generatedNarrationAssetId);
    const visualReady = sceneHasVisual(scene);
    const warnings: string[] = [];

    if (!narrationReady) warnings.push("Cena sem narracao gerada.");
    if (!visualReady) warnings.push("Cena sem visual efetivo.");
    if (!scene.captionText?.trim()) warnings.push("Cena sem caption.");

    return {
      sceneId: scene.id,
      order: scene.order,
      title: scene.title,
      narrationReady,
      visualReady,
      microclipCount: microclipsByScene.get(scene.id) ?? 0,
      effectiveAssetId: scene.generatedAssetId ?? scene.assetId,
      effectiveNarrationAssetId: scene.generatedNarrationAssetId,
      warnings
    };
  });
  const scenesWithNarration = scenes.filter((scene) => scene.narrationReady).length;
  const scenesWithVisual = scenes.filter((scene) => scene.visualReady).length;
  const scenesWithMusic = project.backgroundMusicAssetId ? project.scenes.length : 0;
  const scenesWithMicroclips = scenes.filter((scene) => scene.microclipCount > 0).length;
  const pendingMediaCandidates = mediaCandidates.filter(
    (candidate) => candidate.status === "pending"
  ).length;
  const unconfirmedCandidates = countUnconfirmedCandidates(mediaCandidates);
  const missingNarration = Math.max(0, project.scenes.length - scenesWithNarration);
  const missingVisuals = Math.max(0, project.scenes.length - scenesWithVisual);
  const missingMusic = project.backgroundMusicAssetId ? 0 : 1;
  const missingItems: string[] = [];
  const warnings: string[] = [];

  if (project.scenes.length === 0) missingItems.push("scenes");
  if (missingNarration > 0) missingItems.push("narration");
  if (missingVisuals > 0) missingItems.push("visuals");
  if (!project.backgroundMusicAssetId) warnings.push("Projeto sem musica selecionada.");
  if (!project.editingReferencePresetId) warnings.push("Projeto sem preset editorial.");
  if (microclips.length === 0) warnings.push("Microclip editorial opcional ainda nao anexado.");
  if (pendingMediaCandidates > 0 || unconfirmedCandidates > 0) {
    warnings.push("Ha candidatos de midia pendentes de revisao.");
  }

  const renderReady = project.scenes.length > 0 && missingItems.length === 0;

  return {
    projectId: project.id,
    scenesTotal: project.scenes.length,
    scenesWithNarration,
    scenesWithVisual,
    scenesWithMusic,
    scenesWithMicroclips,
    pendingMediaCandidates,
    unconfirmedCandidates,
    missingNarration,
    missingVisuals,
    missingMusic,
    hasMusic: Boolean(project.backgroundMusicAssetId),
    hasBeatSyncPlan: Boolean(project.backgroundMusicAssetId || project.musicPresetId),
    hasEditingReferencePreset: Boolean(project.editingReferencePresetId),
    hasAudioMasteringPreset: true,
    renderReady,
    missingItems,
    scenes,
    warnings,
    nextActions: [
      ...(scenesWithNarration < project.scenes.length
        ? ["generate_missing_narration"]
        : []),
      ...(scenesWithVisual < project.scenes.length ? ["generate_missing_visuals"] : []),
      ...(pendingMediaCandidates > 0 || unconfirmedCandidates > 0
        ? ["review_media_candidates"]
        : []),
      ...(!project.backgroundMusicAssetId ? ["select_music_optional"] : []),
      ...(microclips.length === 0 ? ["attach_microclip_optional"] : []),
      renderReady ? "create_render_job" : "prepare_assets"
    ]
  };
}

async function persistRun(
  repository: ReelProductionRunRepository,
  run: ReelProductionRun,
  patch: Parameters<ReelProductionRunRepository["update"]>[1]
) {
  return (await repository.update(run.id, patch)) ?? { ...run, ...patch };
}

export async function getReelProductionRun(
  repository: ReelProductionRunRepository,
  runId: string
) {
  const run = await repository.getById(runId);

  if (!run) {
    throw new NotFoundError(`Reel production run '${runId}' was not found.`);
  }

  return run;
}

export async function listReelProductionRunsForProject(
  dependencies: Pick<ReelProductionDependencies, "projectRepository" | "runRepository">,
  projectId: string
) {
  await requireProject(dependencies.projectRepository, projectId);
  return dependencies.runRepository.listByProjectId(projectId);
}

export async function cancelReelProductionRun(
  repository: ReelProductionRunRepository,
  runId: string
) {
  const run = await getReelProductionRun(repository, runId);

  if (["completed", "failed", "partial", "cancelled"].includes(run.status)) {
    return run;
  }

  return (
    (await repository.update(run.id, {
      status: "cancelled",
      completedAt: now(),
      errorMessage: "Production run cancelled by user."
    })) ?? run
  );
}

function resolveRunStatus(
  mode: ReelProductionRunMode,
  steps: ReelProductionStep[],
  checklist: ReelProductionChecklist
): ReelProductionRunStatus {
  if (steps.some((step) => step.status === "failed")) {
    return mode === "render" ? "failed" : "partial";
  }

  if (mode === "dry_run") {
    return "completed";
  }

  if (
    mode === "render" &&
    steps.some(
      (step) =>
        step.id === "process_render_job" &&
        step.status === "skipped" &&
        step.message.includes("queued")
    )
  ) {
    return "partial";
  }

  return checklist.renderReady ? "completed" : "partial";
}

export async function runOneClickReelProduction(
  dependencies: ReelProductionDependencies,
  projectId: string,
  input: OneClickRunInput
): Promise<OneClickRunResponse> {
  const project = await requireProject(dependencies.projectRepository, projectId);
  const defaults = resolveProductionDefaults(project, input);
  let steps = createInitialSteps();
  const startedAt = now();
  let run = await dependencies.runRepository.create({
    videoProjectId: project.id,
    status: "running",
    mode: input.mode,
    steps,
    startedAt,
    completedAt: null,
    errorMessage: null,
    renderJobId: null,
    outputPath: null,
    metadata: { defaults }
  });
  const warnings: string[] = [];
  let renderJobId: string | null = null;
  let outputPath: string | null = null;

  steps = startStep(steps, "validate_project");
  let checklist = await buildReelProductionChecklist(dependencies, project.id);
  steps = completeStep(steps, "validate_project", "Projeto carregado.", {
    projectId: project.id
  });

  if (input.mode === "dry_run") {
    steps = skipStep(steps, "generate_narration", "Dry run nao altera narracao.");
    steps = skipStep(steps, "generate_visuals", "Dry run nao gera visuals.");
    steps = skipStep(steps, "select_music", "Dry run nao seleciona musica.");
    steps = skipStep(steps, "build_beat_sync", "Dry run nao cria plano persistente.");
    steps = completeStep(steps, "validate_microclips", "Microclips verificados.");
    steps = skipStep(steps, "build_blueprint", "Dry run nao prepara blueprint.");
    steps = skipStep(steps, "create_render_job", "Dry run nao cria RenderJob.");
    steps = skipStep(steps, "process_render_job", "Dry run nao renderiza.");
  } else {
    if (input.options.generateMissingNarration) {
      steps = startStep(steps, "generate_narration");
      const generatedIds: string[] = [];
      for (const scene of project.scenes.filter((item) => !item.generatedNarrationAssetId)) {
        if (!sceneHasNarration(scene)) {
          warnings.push(`Cena ${scene.order} sem texto para narracao.`);
          continue;
        }

        try {
          const result = await generateNarrationForScene(
            dependencies.projectRepository,
            dependencies.assetRepository,
            dependencies.narrationJobRepository,
            scene.id,
            {
              provider: defaults.narrationProvider as "mock-tts",
              voicePackId: scene.narrationVoicePackId ?? defaults.voicePackId,
              text: scene.narrationText ?? scene.captionText ?? "",
              language: project.channel.language ?? "pt-BR",
              autoAttach: true
            },
            dependencies.appEnv
          );
          if (result.asset?.id) generatedIds.push(result.asset.id);
        } catch (error) {
          warnings.push(`Narracao cena ${scene.order}: ${getErrorMessage(error)}`);
        }
      }
      steps = completeStep(
        steps,
        "generate_narration",
        `${generatedIds.length} narracao(oes) gerada(s).`,
        { assetIds: generatedIds }
      );
    } else {
      steps = skipStep(steps, "generate_narration", "Geracao de narracao desativada.");
    }

    const refreshedAfterNarration = await requireProject(
      dependencies.projectRepository,
      project.id
    );

    if (input.options.generateMissingVisuals) {
      steps = startStep(steps, "generate_visuals");
      const generatedIds: string[] = [];
      for (const scene of refreshedAfterNarration.scenes.filter(
        (item) => !sceneHasVisual(item)
      )) {
        const recipe = parseSceneRecipe(scene);
        const workflowPackId =
          readString(recipe?.suggestedWorkflowPackId) ?? defaults.workflowPackId;
        try {
          const provider =
            dependencies.appEnv.comfyUiEnabled &&
            defaults.visualProvider === "comfyui-local"
              ? "comfyui-local"
              : defaults.fallbackVisualProvider;
          const result = await generateVisualForScene(
            dependencies.projectRepository,
            dependencies.assetRepository,
            dependencies.characterRepository,
            dependencies.visualGenerationJobRepository,
            scene.id,
            buildVisualGenerationInput({
              provider,
              workflowPackId,
              qualityPresetId: defaults.qualityPresetId
            }),
            dependencies.appEnv
          );
          if (result.asset?.id) generatedIds.push(result.asset.id);
        } catch (error) {
          if (defaults.fallbackVisualProvider !== "mock-svg") {
            warnings.push(`Visual cena ${scene.order}: ${getErrorMessage(error)}`);
          }

          try {
            const fallback = await generateVisualForScene(
              dependencies.projectRepository,
              dependencies.assetRepository,
              dependencies.characterRepository,
            dependencies.visualGenerationJobRepository,
            scene.id,
              buildVisualGenerationInput({
                provider: "mock-svg",
                workflowPackId,
                qualityPresetId: defaults.qualityPresetId
              }),
              dependencies.appEnv
            );
            if (fallback.asset?.id) generatedIds.push(fallback.asset.id);
          } catch (fallbackError) {
            warnings.push(
              `Fallback visual cena ${scene.order}: ${getErrorMessage(fallbackError)}`
            );
          }
        }
      }
      steps = completeStep(
        steps,
        "generate_visuals",
        `${generatedIds.length} visual(is) gerado(s).`,
        { assetIds: generatedIds }
      );
    } else {
      steps = skipStep(steps, "generate_visuals", "Geracao de visuals desativada.");
    }

    let refreshedProject = await requireProject(dependencies.projectRepository, project.id);

    if (input.options.selectMusic) {
      steps = startStep(steps, "select_music");
      if (refreshedProject.backgroundMusicAssetId) {
        steps = completeStep(steps, "select_music", "Projeto ja possui musica.", {
          assetId: refreshedProject.backgroundMusicAssetId
        });
      } else {
        const selection = await selectMusicForProject(dependencies.assetRepository, {
          templateId: refreshedProject.templateId,
          musicPresetId: defaults.musicPresetId,
          audioMasteringPresetId: defaults.audioMasteringPresetId,
          tone: refreshedProject.channel.narrativeTone,
          durationSeconds:
            refreshedProject.durationTarget ??
            refreshedProject.scenes.reduce((total, scene) => total + (scene.duration ?? 4), 0),
          useCase: defaults.musicPresetId === "football_hype" ? "football" : "shorts",
          allowUnknownLicense: false
        });

        if (selection.selectedMusicAsset?.asset.id) {
          refreshedProject =
            (await dependencies.projectRepository.update(refreshedProject.id, {
              backgroundMusicAssetId: selection.selectedMusicAsset.asset.id,
              musicPresetId: defaults.musicPresetId
            })) ?? refreshedProject;
          steps = completeStep(steps, "select_music", selection.reason, {
            assetId: selection.selectedMusicAsset.asset.id
          });
        } else {
          warnings.push(...selection.warnings, "Nenhuma musica compativel encontrada.");
          steps = skipStep(steps, "select_music", "Sem musica local compativel.");
        }
      }
    } else {
      steps = skipStep(steps, "select_music", "Selecao de musica desativada.");
    }

    if (input.options.buildBeatSyncPlan) {
      steps = startStep(steps, "build_beat_sync");
      const plan = await buildProjectBeatSyncPlan(
        dependencies.projectRepository,
        dependencies.assetRepository,
        dependencies.editorialMicroclipRepository,
        {
          projectId: project.id,
          musicPresetId: defaults.musicPresetId
        }
      );
      warnings.push(...plan.warnings);
      steps = completeStep(steps, "build_beat_sync", "Beat Sync Plan calculado.", {
        musicAssetId: plan.selectedMusicAssetId,
        presetId: plan.musicPresetId
      });
    } else {
      steps = skipStep(steps, "build_beat_sync", "Beat sync desativado.");
    }

    if (!refreshedProject.editingReferencePresetId) {
      warnings.push("Projeto sem preset editorial aplicado.");
    }

    const microclips =
      await dependencies.editorialMicroclipRepository.listByProjectId(project.id);
    steps = microclips.length
      ? completeStep(steps, "validate_microclips", `${microclips.length} microclip(s) detectado(s).`)
      : skipStep(steps, "validate_microclips", "Microclip editorial opcional pendente.");

    steps = startStep(steps, "build_blueprint");
    const blueprint = await getVideoProjectRenderBlueprint(
      dependencies.projectRepository,
      dependencies.assetRepository,
      dependencies.editorialMicroclipRepository,
      project.id
    );
    steps = completeStep(steps, "build_blueprint", "Render Blueprint pronto.", {
      projectId: blueprint.projectId
    });

    if (input.mode === "render" && input.options.createRenderJob) {
      steps = startStep(steps, "create_render_job");
      const renderJob = await createRenderJobForProject(
        dependencies.renderJobRepository,
        dependencies.projectRepository,
        dependencies.assetRepository,
        dependencies.editorialMicroclipRepository,
        dependencies.renderStorage,
        project.id,
        {
          renderMode: defaults.renderMode as "cinematic_v2",
          renderQuality: defaults.renderQuality as "standard",
          audioMasteringPresetId: defaults.audioMasteringPresetId as "football_hype"
        }
      );
      renderJobId = renderJob.id;
      outputPath = renderJob.outputPath;
      steps = completeStep(steps, "create_render_job", "RenderJob criado e enfileirado.", {
        renderJobId
      });
      if (input.runWorkerOnce || input.options.runWorkerOnce) {
        steps = startStep(steps, "process_render_job");
        const workerResult = await runWorkerOnceForQueuedJob(renderJob.id);
        const processedJob = await dependencies.renderJobRepository.getById(renderJob.id);
        outputPath = processedJob?.outputPath ?? outputPath;

        if (workerResult.exitCode === 0 && processedJob?.status === "completed") {
          steps = completeStep(steps, "process_render_job", "Worker processou RenderJob.", {
            renderJobId,
            outputPath: outputPath ?? null
          });
        } else {
          const message =
            processedJob?.errorMessage ??
            workerResult.output ??
            "Worker nao concluiu o RenderJob.";
          warnings.push(message);
          steps = failStep(steps, "process_render_job", message);
        }
      } else {
        steps = skipStep(
          steps,
          "process_render_job",
          "RenderJob ficou queued aguardando worker."
        );
      }
    } else {
      steps = skipStep(steps, "create_render_job", "Modo prepare_only nao cria RenderJob.");
      steps = skipStep(steps, "process_render_job", "Sem render nesta execucao.");
    }
  }

  checklist = await buildReelProductionChecklist(dependencies, project.id);
  const status = resolveRunStatus(input.mode, steps, checklist);
  steps =
    outputPath || status === "completed"
      ? completeStep(steps, "finalize_output", outputPath ? "Output final registrado." : "Execucao finalizada.")
      : skipStep(steps, "finalize_output", "Output final ainda nao disponivel.");
  run = await persistRun(dependencies.runRepository, run, {
    status,
    steps,
    completedAt: now(),
    errorMessage: status === "failed" ? "Production run failed." : null,
    renderJobId,
    outputPath,
    metadata: {
      defaults,
      checklist,
      warnings,
      mode: input.mode
    }
  });

  return {
    runId: run.id,
    status: run.status,
    steps: run.steps,
    projectId: project.id,
    renderJobId: run.renderJobId,
    outputPath: run.outputPath,
    checklist,
    warnings: [...new Set([...warnings, ...checklist.warnings])],
    nextActions: checklist.nextActions
  };
}
