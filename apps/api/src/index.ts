import { loadEnv } from "./config/env.js";
import { createApp } from "./http/app.js";
import { resolveAssetRepository } from "./modules/assets/infrastructure/asset-repository-factory.js";
import { resolveAudioLibraryRepository } from "./modules/audio-library/infrastructure/audio-library-repository-factory.js";
import { createLocalAssetStorage } from "./modules/assets/infrastructure/local-asset-storage.js";
import { resolveCharacterRepository } from "./modules/characters/infrastructure/character-repository-factory.js";
import { resolveChannelRepository } from "./modules/channels/infrastructure/channel-repository-factory.js";
import { resolveEditorialMicroclipRepository } from "./modules/editorial-microclips/infrastructure/editorial-microclip-repository-factory.js";
import { resolveVisualGenerationJobRepository } from "./modules/hybrid-visual/infrastructure/visual-generation-job-repository-factory.js";
import { resolveIntakeRepository } from "./modules/intake/infrastructure/intake-repository-factory.js";
import { resolveNarrationJobRepository } from "./modules/narration/infrastructure/narration-job-repository-factory.js";
import { resolveProjectRepository } from "./modules/projects/infrastructure/project-repository-factory.js";
import { resolveResearchRepository } from "./modules/research/infrastructure/research-repository-factory.js";
import { resolveRenderJobRepository } from "./modules/render-jobs/infrastructure/render-job-repository-factory.js";
import { createLocalRenderStorage } from "./modules/render-jobs/infrastructure/local-render-storage.js";

const appEnv = loadEnv();
const { dataBackend, port } = appEnv;
const [
  projectBinding,
  channelBinding,
  assetBinding,
  audioLibraryBinding,
  characterBinding,
  intakeBinding,
  editorialMicroclipBinding,
  narrationJobBinding,
  researchBinding,
  renderJobBinding,
  visualGenerationJobBinding
] = await Promise.all([
  resolveProjectRepository(dataBackend),
  resolveChannelRepository(dataBackend),
  resolveAssetRepository(dataBackend),
  resolveAudioLibraryRepository(dataBackend),
  resolveCharacterRepository(dataBackend),
  resolveIntakeRepository(dataBackend),
  resolveEditorialMicroclipRepository(dataBackend),
  resolveNarrationJobRepository(dataBackend),
  resolveResearchRepository(dataBackend),
  resolveRenderJobRepository(dataBackend),
  resolveVisualGenerationJobRepository(dataBackend)
]);

const repositoryMode =
  projectBinding.backend === channelBinding.backend &&
  channelBinding.backend === assetBinding.backend &&
  assetBinding.backend === audioLibraryBinding.backend &&
  audioLibraryBinding.backend === characterBinding.backend &&
  characterBinding.backend === intakeBinding.backend &&
  intakeBinding.backend === editorialMicroclipBinding.backend &&
  editorialMicroclipBinding.backend === narrationJobBinding.backend &&
  narrationJobBinding.backend === researchBinding.backend &&
  researchBinding.backend === renderJobBinding.backend &&
  renderJobBinding.backend === visualGenerationJobBinding.backend
    ? projectBinding.backend
    : "mixed";

const app = createApp({
  appEnv,
  assetStorage: createLocalAssetStorage(),
  repositoryMode,
  projectRepository: projectBinding.repository,
  researchRepository: researchBinding.repository,
  channelRepository: channelBinding.repository,
  assetRepository: assetBinding.repository,
  audioLibraryRepository: audioLibraryBinding.repository,
  characterRepository: characterBinding.repository,
  editorialMicroclipRepository: editorialMicroclipBinding.repository,
  intakeRepository: intakeBinding.repository,
  narrationJobRepository: narrationJobBinding.repository,
  renderJobRepository: renderJobBinding.repository,
  renderStorage: createLocalRenderStorage(),
  visualGenerationJobRepository: visualGenerationJobBinding.repository
});

app.listen(port, () => {
  console.log(
    `ReelForge API listening on http://localhost:${port} with projects=${projectBinding.label}, channels=${channelBinding.label}, assets=${assetBinding.label}, audioLibrary=${audioLibraryBinding.label}, characters=${characterBinding.label}, intake=${intakeBinding.label}, editorialMicroclips=${editorialMicroclipBinding.label}, narration=${narrationJobBinding.label}, research=${researchBinding.label}, renders=${renderJobBinding.label}, hybridVisual=${visualGenerationJobBinding.label}`
  );
});

