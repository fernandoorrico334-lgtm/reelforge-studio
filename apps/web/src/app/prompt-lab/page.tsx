import { PromptLabStudio } from "../../components/prompt-lab-studio";
import {
  getChannelsSnapshot,
  getCharactersSnapshot,
  getComfyWorkflowPacksSnapshot,
  getEditingReferencePresetsSnapshot,
  getGeneratedAudioGallerySnapshot,
  getGeneratedImagesGallerySnapshot,
  getImageQualityPresetsSnapshot,
  getNarrationProvidersSnapshot,
  getNarrationVoicePacksSnapshot,
  getNegativePromptPacksSnapshot,
  getProjectsSnapshot,
  getPromptPacksSnapshot,
  getResearchDossierDetailSnapshot,
  getResearchDossiersSnapshot,
  getVisualGenerationProvidersSnapshot
} from "../../lib/studio-api";

function formatSourceLabel(value: string) {
  return value === "api" ? "API local ativa" : "Mock local";
}

export default async function PromptLabPage() {
  const [
    projectsSnapshot,
    channelsSnapshot,
    charactersSnapshot,
    promptPacksSnapshot,
    negativePromptPacksSnapshot,
    workflowPacksSnapshot,
    qualityPresetsSnapshot,
    editingReferencePresetsSnapshot,
    researchSnapshot,
    visualProvidersSnapshot,
    generatedImagesSnapshot,
    narrationProvidersSnapshot,
    narrationVoicePacksSnapshot,
    generatedAudioSnapshot
  ] = await Promise.all([
    getProjectsSnapshot(),
    getChannelsSnapshot(),
    getCharactersSnapshot(),
    getPromptPacksSnapshot(),
    getNegativePromptPacksSnapshot(),
    getComfyWorkflowPacksSnapshot(),
    getImageQualityPresetsSnapshot(),
    getEditingReferencePresetsSnapshot(),
    getResearchDossiersSnapshot(),
    getVisualGenerationProvidersSnapshot(),
    getGeneratedImagesGallerySnapshot(),
    getNarrationProvidersSnapshot(),
    getNarrationVoicePacksSnapshot(),
    getGeneratedAudioGallerySnapshot()
  ]);

  const researchDetails = await Promise.all(
    researchSnapshot.items.map((dossier) =>
      getResearchDossierDetailSnapshot(dossier.id)
    )
  );
  const researchRequirements = researchDetails.flatMap((snapshot) => {
    if (!snapshot.item) {
      return [];
    }

    return snapshot.item.assetRequirements.map((requirement) => ({
      dossierId: snapshot.item!.dossier.id,
      dossierTitle: snapshot.item!.dossier.title,
      requirement,
      channelId: snapshot.item!.dossier.channelId,
      channel: snapshot.item!.dossier.channel
    }));
  });
  const researchRequirementsSource = researchDetails.some(
    (snapshot) => snapshot.source === "api"
  )
    ? "api"
    : researchSnapshot.source;

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(123,224,255,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(99,255,225,0.12),transparent_24%),rgba(255,255,255,0.04)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-mist/55">
              Visual Prompt Ops
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Prompt Lab premium para Hybrid Visual e ComfyUI local
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-mist/72">
              Experimente prompt packs, negative packs e variantes sem sair do
              estudio. O Prompt Lab usa contexto real de projetos, personagens,
              canais e research para melhorar o visual antes da geracao.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Prompt packs
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {promptPacksSnapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Negative packs
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {negativePromptPacksSnapshot.items.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Fonte
              </p>
              <p className="mt-3 text-sm font-medium text-white">
                {formatSourceLabel(promptPacksSnapshot.source)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <PromptLabStudio
        projects={projectsSnapshot.items}
        projectsSource={projectsSnapshot.source}
        channels={channelsSnapshot.items}
        channelsSource={channelsSnapshot.source}
        characters={charactersSnapshot.items}
        charactersSource={charactersSnapshot.source}
        promptPacks={promptPacksSnapshot.items}
        promptPacksSource={promptPacksSnapshot.source}
        negativePromptPacks={negativePromptPacksSnapshot.items}
        negativePromptPacksSource={negativePromptPacksSnapshot.source}
        workflowPacks={workflowPacksSnapshot.items}
        workflowPacksSource={workflowPacksSnapshot.source}
        qualityPresets={qualityPresetsSnapshot.items}
        qualityPresetsSource={qualityPresetsSnapshot.source}
        editingReferencePresets={editingReferencePresetsSnapshot.items}
        editingReferencePresetsSource={editingReferencePresetsSnapshot.source}
        researchRequirements={researchRequirements}
        researchRequirementsSource={researchRequirementsSource}
        visualGenerationProviders={visualProvidersSnapshot.items}
        visualGenerationProvidersSource={visualProvidersSnapshot.source}
        recentGeneratedImages={generatedImagesSnapshot.items.slice(0, 6)}
        recentGeneratedImagesSource={generatedImagesSnapshot.source}
        narrationProviders={narrationProvidersSnapshot.items}
        narrationProvidersSource={narrationProvidersSnapshot.source}
        narrationVoicePacks={narrationVoicePacksSnapshot.items}
        narrationVoicePacksSource={narrationVoicePacksSnapshot.source}
        recentGeneratedAudio={generatedAudioSnapshot.items.slice(0, 6)}
        recentGeneratedAudioSource={generatedAudioSnapshot.source}
      />
    </div>
  );
}

