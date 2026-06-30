import {
  getCinematicPresetById,
  suggestPresetForEmotion,
  type CinematicPreset
} from "@reelforge/cinematic-engine";
import {
  analyzeStoryProject,
  type StoryAnalysis,
  type StoryProjectInput
} from "@reelforge/story-engine";
import { NotFoundError } from "../../../shared/errors.js";
import type { ProjectScene, StudioProject } from "../domain/project.js";
import type { ProjectRepository } from "./project-repository.js";

export interface ProjectStorySceneInsight {
  sceneId: string;
  order: number;
  title: string;
  emotion: ProjectScene["emotion"];
  role: StoryAnalysis["suggestedSceneRoles"][number]["role"];
  energyScore: number;
  reason: string;
  suggestedPresetId: CinematicPreset["id"];
  suggestedPreset: CinematicPreset;
  appliedPresetId: string | null;
  appliedPreset: CinematicPreset | null;
  effectivePresetId: CinematicPreset["id"];
  effectivePreset: CinematicPreset;
}

export interface ProjectStoryAnalysisResponse {
  projectId: string;
  analysis: StoryAnalysis;
  sceneInsights: ProjectStorySceneInsight[];
}

function toStoryProjectInput(project: StudioProject): StoryProjectInput {
  return {
    id: project.id,
    title: project.title,
    script: project.script,
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      order: scene.order,
      title: scene.title,
      narrationText: scene.narrationText,
      captionText: scene.captionText,
      duration: scene.duration,
      emotion: scene.emotion,
      hasAsset: Boolean(scene.assetId),
      visualPreset: scene.visualPreset,
      energyLevel: scene.energyLevel
    }))
  };
}

function buildSceneInsight(
  scene: ProjectScene,
  roleSuggestion: StoryAnalysis["suggestedSceneRoles"][number]
): ProjectStorySceneInsight {
  const suggestedPreset = suggestPresetForEmotion(scene.emotion);
  const appliedPreset = getCinematicPresetById(scene.visualPreset);
  const effectivePreset = appliedPreset ?? suggestedPreset;

  return {
    sceneId: scene.id,
    order: scene.order,
    title: scene.title,
    emotion: scene.emotion,
    role: roleSuggestion.role,
    energyScore: roleSuggestion.energyScore,
    reason: roleSuggestion.reason,
    suggestedPresetId: suggestedPreset.id,
    suggestedPreset,
    appliedPresetId: appliedPreset?.id ?? null,
    appliedPreset,
    effectivePresetId: effectivePreset.id,
    effectivePreset
  };
}

export async function getVideoProjectStoryAnalysis(
  repository: ProjectRepository,
  projectId: string
): Promise<ProjectStoryAnalysisResponse> {
  const project = await repository.getById(projectId);

  if (!project) {
    throw new NotFoundError(`Video project '${projectId}' was not found.`);
  }

  const analysis = analyzeStoryProject(toStoryProjectInput(project));
  const roleSuggestionMap = new Map(
    analysis.suggestedSceneRoles.map((roleSuggestion) => [
      roleSuggestion.sceneId,
      roleSuggestion
    ])
  );

  return {
    projectId: project.id,
    analysis,
    sceneInsights: project.scenes.map((scene) =>
      buildSceneInsight(
        scene,
        roleSuggestionMap.get(scene.id) ?? {
          sceneId: scene.id,
          order: scene.order,
          role: "context",
          energyScore: 40,
          reason: "Fallback local aplicado por ausencia de sugestao narrativa."
        }
      )
    )
  };
}

