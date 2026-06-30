import {
  describePresetIntensity,
  describePresetMotion,
  getCinematicPresetById,
  listCinematicPresets,
  suggestPresetForEmotion,
  type CinematicPreset
} from "@reelforge/cinematic-engine";
import {
  analyzeStoryProject,
  type StoryAnalysis
} from "@reelforge/story-engine";
import type {
  EmotionTag,
  ProjectStoryAnalysisResponse,
  ProjectStorySceneInsight,
  StudioProject
} from "./studio-types";

export const cinematicPresetsCatalog = listCinematicPresets();

export {
  describePresetIntensity,
  describePresetMotion
} from "@reelforge/cinematic-engine";

export interface ResolvedScenePreset {
  suggested: CinematicPreset;
  applied: CinematicPreset | null;
  effective: CinematicPreset;
  mode: "manual" | "auto";
}

function toStoryAnalysis(project: StudioProject) {
  return analyzeStoryProject({
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
      visualPreset: scene.visualPreset
    }))
  });
}

export function resolveScenePresetPreview(
  visualPreset: string | null | undefined,
  emotion: EmotionTag | null | undefined
): ResolvedScenePreset {
  const suggested = suggestPresetForEmotion(emotion);
  const applied = getCinematicPresetById(visualPreset);
  const effective = applied ?? suggested;

  return {
    suggested,
    applied,
    effective,
    mode: applied ? "manual" : "auto"
  };
}

function buildSceneInsights(
  project: StudioProject,
  analysis: StoryAnalysis
): ProjectStorySceneInsight[] {
  const roleSuggestionMap = new Map(
    analysis.suggestedSceneRoles.map((roleSuggestion) => [
      roleSuggestion.sceneId,
      roleSuggestion
    ])
  );

  return project.scenes
    .map((scene) => {
      const roleSuggestion = roleSuggestionMap.get(scene.id) ?? {
        sceneId: scene.id,
        order: scene.order,
        role: "context" as const,
        energyScore: 40,
        reason: "Fallback local aplicado por ausencia de sugestao narrativa."
      };
      const presetPreview = resolveScenePresetPreview(
        scene.visualPreset,
        scene.emotion
      );

      return {
        sceneId: scene.id,
        order: scene.order,
        title: scene.title,
        emotion: scene.emotion,
        role: roleSuggestion.role,
        energyScore: roleSuggestion.energyScore,
        reason: roleSuggestion.reason,
        suggestedPresetId: presetPreview.suggested.id,
        suggestedPreset: presetPreview.suggested,
        appliedPresetId: presetPreview.applied?.id ?? null,
        appliedPreset: presetPreview.applied,
        effectivePresetId: presetPreview.effective.id,
        effectivePreset: presetPreview.effective
      };
    })
    .sort((left, right) => left.order - right.order);
}

export function buildProjectStoryAnalysis(
  project: StudioProject
): ProjectStoryAnalysisResponse {
  const analysis = toStoryAnalysis(project);

  return {
    projectId: project.id,
    analysis,
    sceneInsights: buildSceneInsights(project, analysis)
  };
}