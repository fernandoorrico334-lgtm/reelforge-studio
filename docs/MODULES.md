# MODULES

## apps/web

Responsavel pela experiencia operacional do estudio.

Estado atual:

- dashboard inicial em `/`;
- workspace de personagens em `/characters`;
- intake manual em `/intake`;
- media collector em `/media-collector`;
- research editorial em `/research`;
- wizard rapido de producao em `/produce`;
- gestao de canais em `/channels`;
- biblioteca local de assets em `/assets`;
- galeria de audio gerado em `/generated-audio`;
- CRUD de projetos em `/projects`;
- timeline inicial e editor de cenas em `/projects/[id]`;
- painel de renderizacoes por projeto e monitor global em `/renders`.

Na Etapa 5, `apps/web` agora inclui tambem:

- criacao e edicao de `VideoProject`;
- formulario de cena com asset selector;
- timeline com reorder para cima/baixo;
- painel de qualidade do projeto;
- fallback de sessao para projetos e cenas quando a API falha.

Na Etapa 6, `apps/web` passa a incluir ainda:

- painel `Story Engine` em `/projects/[id]`;
- seletor guiado de preset cinematografico por cena;
- preview textual do preset efetivo;
- timeline com energia, papel narrativo e preset aplicado/sugerido.

Na Etapa 7, `apps/web` ganhou tambem:

- painel `Project Template`;
- painel `Caption Engine`;
- `Caption Preview` 9:16 por cena;
- painel `Render Blueprint`;
- edicao de `templateId`, `defaultCaptionStyle`, `captionStyle`,
  `captionPosition`, `captionEmphasisWords` e `energyLevel`.

Na Etapa 8, `apps/web` ganhou ainda:

- botao `Gerar render V1` no detalhe do projeto;
- polling local de render jobs a cada 3 segundos;
- preview do MP4 final e acesso ao log por job;
- pagina `/renders` realmente conectada a jobs reais.

Na Etapa 8.1, a operacao de render ganhou:

- smoke test reproduzivel com assets reais gerados localmente;
- validacao automatica de `output.mp4` com `ffprobe` quando disponivel;
- suporte a worker em modo `once` para diagnostico e automacao local.

Na Etapa 8.2, a UX operacional de render ganhou:

- botoes `Cancelar`, `Retry` e `Deletar` por job;
- polling inteligente, ativo so enquanto houver job em andamento;
- thumbnail do render concluido;
- exibicao de `currentStep`, cena atual, tentativa, origem do retry e metadata
  final de output.

Na Etapa 9A, `apps/web` ganhou ainda:

- seletor de `renderMode` no painel de renderizacoes;
- seletor de `renderQuality`;
- cards distinguindo V1 e `cinematic_v2`;
- smoke visual dedicado refletido em `/renders`.

Na Etapa 9B, `apps/web` ganhou tambem:

- painel `Audio Engine` em `/projects/[id]`;
- selecao de `audioMood`, musica de fundo e voiceover;
- controles de volume e ducking;
- configuracao de SFX por cena;
- `Audio Plan` com warnings, resumo e preview dos assets de audio;
- cards de render mostrando metadata de audio do MP4 final.

Na Etapa 10A, `apps/web` ganhou ainda:

- card `Nova Producao` no dashboard;
- pagina `/produce` com fluxo `Canal -> Roteiro -> Cenas -> Checklist`;
- toggles de criacao automatica de cenas, smart picker e defaults do canal;
- redirecionamento para `/projects/[id]` quando a API estiver ativa;
- painel `Production Checklist` no studio;
- painel `Smart Picks` com top assets por cena;
- badge `Ready to Render` ou `Needs Attention`;
- botao destacado de render quando o checklist estiver pronto.

Na Etapa 10C, `apps/web` ganhou tambem:

- card `Research Collector` no dashboard;
- pagina `/research` com listagem e criacao de dossies;
- pagina `/research/[id]` com `Overview`, `Source Discovery`, `Sources`,
  `Facts`, `Timeline`, `Hooks`, `Outline`, `Asset Requirements` e
  `Create Production`;
- fallback local de queries e analise quando a API nao estiver disponivel.

Na Etapa 10D, `apps/web` ganhou ainda:

- card `Media Collector` no dashboard;
- pagina `/media-collector` com status dos providers;
- criacao de colecoes por provider, query e media type;
- review queue de `MediaCandidate` com preview, metadados e aprovacao manual;
- importacao aprovada para a biblioteca;
- atalhos a partir de `/research/[id]` e `/projects/[id]`.

Na Etapa 10E, `apps/web` ganhou ainda:

- pagina `/characters` com CRUD de `CharacterProfile` e `CharacterReference`;
- atalhos no dashboard e na barra lateral para continuidade visual;
- painel `Hybrid Visual Engine` em `/projects/[id]`;
- seletor de personagem, modo visual, provider, prompt e seed por cena;
- geracao mock local por cena e em lote;
- cards de preview de assets gerados no projeto e em `Asset Requirements`.

Na Etapa 11A, `apps/web` ganhou tambem:

- painel `Local Narration` em `/projects/[id]`;
- badge de `Narracao pronta` na timeline quando houver
  `generatedNarrationAssetId`;
- pagina `/generated-audio` para ouvir, revisar e promover WAVs gerados;
- bloco `Narration Preview` em `/prompt-lab`;
- leitura de `effectiveNarrationAssetId`, `effectiveNarrationAssetPath` e
  `narrationSource` no painel de blueprint.

## apps/api

Responsavel por expor os contratos HTTP e orquestrar os casos de uso.

Estado atual:

- modulo `channels` com CRUD completo;
- modulo `assets` com CRUD manual, upload real e preview por `assetId`;
- modulo `characters` com perfis, referencias e prompt-base;
- modulo `hybrid-visual` com relatorio, jobs e geracao mock local;
- modulo `narration` com jobs, providers, voice packs e geracao WAV local;
- modulo `intake` com scan local, revisao de candidatos e importacao em lote;
- modulo `media-collector` com busca segura, review e importacao aprovada;
- modulo `research` com dossies, fontes e analise editorial local;
- modulo `projects` com CRUD completo de projetos e cenas;
- modulo `production` com wizard local deterministico;
- modulo `render-jobs` com fila, detalhe e media final;
- escolha explicita do backend via `DATA_BACKEND`.

Rotas atuais:

- `GET /health`
- `GET /studio/manifest`
- `GET /projects`
- `GET /video-projects`
- `GET /video-projects/:id`
- `GET /video-projects/:id/story-analysis`
- `GET /video-projects/:id/caption-analysis`
- `GET /video-projects/:id/audio-plan`
- `GET /video-projects/:id/production-checklist`
- `GET /video-projects/:id/asset-suggestions`
- `GET /video-projects/:id/render-blueprint`
- `GET /video-projects/:id/render-jobs`
- `POST /video-projects`
- `PUT /video-projects/:id`
- `DELETE /video-projects/:id`
- `POST /video-projects/:id/apply-channel-defaults`
- `POST /video-projects/:id/create-media-collection-for-missing-assets`
- `GET /video-projects/:id/scenes`
- `POST /video-projects/:id/scenes`
- `PUT /video-projects/:id/scenes/:sceneId`
- `DELETE /video-projects/:id/scenes/:sceneId`
- `POST /video-projects/:id/scenes/reorder`
- `POST /video-projects/:id/render-jobs`
- `POST /production/create-from-script`
- `GET /render-jobs`
- `GET /render-jobs/:id`
- `POST /render-jobs/:id/cancel`
- `POST /render-jobs/:id/retry`
- `DELETE /render-jobs/:id`
- `GET /channels`
- `GET /channels/:id`
- `POST /channels`
- `PUT /channels/:id`
- `DELETE /channels/:id`
- `GET /characters`
- `GET /characters/:id`
- `POST /characters`
- `PUT /characters/:id`
- `DELETE /characters/:id`
- `POST /characters/:id/build-base-prompt`
- `GET /characters/:id/references`
- `POST /characters/:id/references`
- `PUT /characters/:id/references/:referenceId`
- `DELETE /characters/:id/references/:referenceId`
- `POST /characters/create-from-intake/:slug`
- `GET /assets`
- `GET /assets/:id`
- `POST /assets`
- `PUT /assets/:id`
- `DELETE /assets/:id`
- `POST /assets/upload`
- `GET /intake/folders`
- `POST /intake/scan`
- `GET /intake/collections`
- `GET /intake/collections/:id`
- `GET /intake/candidates`
- `GET /intake/candidates/:id`
- `PUT /intake/candidates/:id`
- `POST /intake/candidates/:id/approve`
- `POST /intake/candidates/:id/reject`
- `POST /intake/import-approved`
- `GET /media-collector/providers`
- `POST /media-collector/manual-url`
- `GET /media-collections`
- `POST /media-collections`
- `GET /media-collections/:id`
- `POST /media-collections/:id/search`
- `GET /media-collections/:id/candidates`
- `POST /media-collections/:id/import-approved`
- `GET /media-candidates/:id`
- `PUT /media-candidates/:id`
- `POST /media-candidates/:id/approve`
- `POST /media-candidates/:id/reject`
- `GET /media/assets/:assetId`
- `GET /media/candidates/:id/preview`
- `GET /media/renders/:renderJobId`
- `GET /media/renders/:renderJobId/log`
- `GET /media/renders/:renderJobId/thumbnail`
- `GET /audio-moods`
- `GET /audio-moods/:id`
- `GET /visual-source-modes`
- `GET /visual-generation/providers`
- `GET /visual-generation/jobs`
- `GET /visual-generation/jobs/:id`
- `POST /visual-generation/jobs/:id/cancel`
- `GET /narration/providers`
- `GET /narration/voice-packs`
- `GET /narration/voice-packs/:id`
- `GET /narration/jobs`
- `GET /narration/jobs/:id`
- `POST /narration/jobs/:id/cancel`
- `GET /scenes/:sceneId/narrations`
- `POST /scenes/:sceneId/generate-narration`
- `POST /scenes/:sceneId/use-narration/:assetId`
- `GET /video-projects/:id/missing-visual-report`
- `POST /video-projects/:id/generate-missing-visuals`
- `POST /scenes/:sceneId/generate-visual`
- `GET /templates`
- `GET /templates/:id`
- `GET /caption-styles`
- `GET /caption-styles/:id`
- `GET /research/dossiers`
- `GET /research/dossiers/:id`
- `POST /research/dossiers`
- `PUT /research/dossiers/:id`
- `DELETE /research/dossiers/:id`
- `POST /research/dossiers/:id/generate-search-queries`
- `GET /research/dossiers/:id/sources`
- `POST /research/dossiers/:id/sources/manual`
- `POST /research/dossiers/:id/sources/fetch-url`
- `POST /research/dossiers/:id/sources/search-wikipedia`
- `POST /research/dossiers/:id/sources/search-wikidata`
- `GET /research/sources/:id`
- `POST /research/sources/:id/approve`
- `POST /research/sources/:id/reject`
- `POST /research/dossiers/:id/analyze`
- `GET /research/dossiers/:id/facts`
- `GET /research/dossiers/:id/timeline`
- `GET /research/dossiers/:id/hooks`
- `GET /research/dossiers/:id/asset-requirements`
- `GET /research/dossiers/:id/outline`
- `POST /research/dossiers/:id/create-production`
- `POST /research/asset-requirements/:id/create-media-collection`
- `POST /research/asset-requirements/:id/generate-visual`
- `POST /research/dossiers/:id/create-media-collections-for-requirements`

Pecas novas relevantes no modulo `characters`:

- `modules/characters/domain/character.ts`
- `modules/characters/application/character-repository.ts`
- `modules/characters/application/character-service.ts`
- `modules/characters/infrastructure/prisma-character-repository.ts`
- `modules/characters/infrastructure/in-memory-character-repository.ts`
- `modules/characters/infrastructure/character-repository-factory.ts`
- `http/routes/characters-routes.ts`

Pecas novas relevantes no modulo `hybrid-visual`:

- `modules/hybrid-visual/domain/visual-generation.ts`
- `modules/hybrid-visual/application/hybrid-visual-service.ts`
- `modules/hybrid-visual/application/visual-generation-job-repository.ts`
- `modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.ts`
- `modules/hybrid-visual/infrastructure/in-memory-visual-generation-job-repository.ts`
- `modules/hybrid-visual/infrastructure/visual-generation-job-repository-factory.ts`
- `http/routes/hybrid-visual-routes.ts`

Pecas novas relevantes no modulo `narration`:

- `modules/narration/domain/narration.ts`
- `modules/narration/application/narration-job-repository.ts`
- `modules/narration/application/narration-service.ts`
- `modules/narration/infrastructure/prisma-narration-job-repository.ts`
- `modules/narration/infrastructure/in-memory-narration-job-repository.ts`
- `modules/narration/infrastructure/narration-job-repository-factory.ts`
- `http/routes/narration-routes.ts`

Pecas novas relevantes no modulo `assets`:

- `application/asset-storage.ts`
- `application/asset-upload-service.ts`
- `infrastructure/local-asset-storage.ts`
- `infrastructure/asset-file-utils.ts`

Pecas novas relevantes no modulo `intake`:

- `modules/intake/domain/intake.ts`
- `modules/intake/application/intake-repository.ts`
- `modules/intake/application/intake-service.ts`
- `modules/intake/infrastructure/intake-filesystem.ts`
- `modules/intake/infrastructure/prisma-intake-repository.ts`
- `modules/intake/infrastructure/in-memory-intake-repository.ts`
- `modules/intake/infrastructure/intake-repository-factory.ts`
- `http/routes/intake-routes.ts`
- `http/routes/candidate-media-routes.ts`
- `cli/intake-scan.ts`
- `cli/intake-import-approved.ts`

Pecas novas relevantes no modulo `research`:

- `modules/research/domain/research.ts`
- `modules/research/application/research-repository.ts`
- `modules/research/application/research-service.ts`
- `modules/research/infrastructure/in-memory-research-repository.ts`
- `modules/research/infrastructure/prisma-research-repository.ts`
- `modules/research/infrastructure/public-research-connectors.ts`
- `modules/research/infrastructure/research-source-storage.ts`
- `modules/research/infrastructure/research-repository-factory.ts`
- `http/routes/research-routes.ts`

Pecas novas relevantes no modulo `media-collector`:

- `modules/media-collector/domain/media-collector.ts`
- `modules/media-collector/application/media-collector-service.ts`
- `modules/media-collector/infrastructure/media-provider-registry.ts`
- `http/routes/media-collector-routes.ts`

Pecas novas relevantes no modulo `projects`:

- `application/project-service.ts`
- `application/project-story-analysis-service.ts`
- `application/project-caption-analysis-service.ts`
- `application/project-render-blueprint-service.ts`
- `application/project-video-engine-mapper.ts`
- `domain/project.ts`
- `http/routes/video-project-routes.ts`
- `infrastructure/in-memory-project-repository.ts`
- `infrastructure/prisma-project-repository.ts`

Pecas novas relevantes para catalogos locais:

- `http/routes/template-routes.ts`
- `http/routes/caption-style-routes.ts`

Pecas novas relevantes para producao:

- `modules/production/domain/production.ts`
- `modules/production/application/production-service.ts`
- `http/routes/production-routes.ts`

Pecas novas relevantes para render:

- `modules/render-jobs/domain/render-job.ts`
- `modules/render-jobs/application/render-job-service.ts`
- `modules/render-jobs/application/render-storage.ts`
- `modules/render-jobs/infrastructure/prisma-render-job-repository.ts`
- `modules/render-jobs/infrastructure/in-memory-render-job-repository.ts`
- `modules/render-jobs/infrastructure/local-render-storage.ts`
- `http/routes/render-job-routes.ts`
- `http/routes/render-media-routes.ts`

Na Etapa 9A, o modulo de render passou a aceitar tambem:

- body opcional em `POST /video-projects/:id/render-jobs`;
- persistencia de `renderMode` e `renderQuality`;
- roteamento do worker por modo.

Na Etapa 9B, o modulo de projetos/render passou a aceitar ainda:

- configuracao de `backgroundMusicAssetId`, `voiceoverAssetId` e `audioMood`;
- volumes de musica, voz, SFX e ducking por projeto;
- `sfxAssetId`, `sfxStartTime` e `sfxVolume` por cena;
- resolucao deterministica de audio no blueprint e no `audio-plan`.

Na Etapa 11C, o modulo de render passou a aceitar tambem:

- `audioMasteringPresetId` no body de `POST /video-projects/:id/render-jobs`;
- persistencia de `RenderJob.metadata` com `audioQualityReport`;
- leitura operacional desse relatorio no worker e no painel web.

Na Etapa 10A, `channels` e `production` passaram a aceitar ainda:

- defaults editoriais e tecnicos por canal;
- aplicacao desses defaults sem sobrescrever escolhas manuais;
- criacao de projeto a partir de roteiro local;
- checklist de prontidao para render;
- sugestoes deterministicas de assets por cena.

## apps/worker

Responsavel pela camada de processamento assincrono local.

Estado atual:

- loop local a cada 3 segundos;
- modo `once` para processar um unico job e sair;
- consumo de `RenderJob` com Prisma + SQLite;
- atualizacao de progresso, etapa e status (`queued`, `processing`,
  `completed`, `failed`, `cancelled`);
- checkpoints seguros para cancelamento;
- geracao de `thumbnail.jpg` apos o MP4;
- enriquecimento opcional de metadata via `ffprobe`;
- renderizacao real via FFmpeg;
- dispatcher entre V1 e `cinematic_v2`;
- etapas `preparing_audio`, `mixing_audio` e `probing_audio`;
- persistencia de `hasAudio`, `audioCodec`, `audioChannels` e
  `audioSampleRate`;
- persistencia de `audioMasteringPresetId` e `audioQualityReport` via metadata;
- escrita de `captions.srt`, `captions.ass`, `render.log` e `output.mp4`.

## scripts

Ferramentas operacionais e smokes do monorepo.

Estado atual:

- `scripts/smoke-render-v1.mjs`
- `scripts/smoke-render-audio.mjs`
- `scripts/smoke-production-flow.mjs`
- `scripts/smoke-intake.mjs`
- `scripts/smoke-research.mjs`
- `scripts/smoke-media-collector.mjs`
- `scripts/smoke-hybrid-visual.mjs`
- `scripts/smoke-narration-engine.mjs`
- `scripts/smoke-narration-windows-sapi-local.mjs`
- `scripts/smoke-audio-mastering-presets.mjs`
- `scripts/smoke-premium-audio-render.mjs`

Comandos novos relevantes da Etapa 10B:

- `npm run intake:scan`
- `npm run intake:import-approved`
- `npm run smoke:intake`

## packages/audio-engine

Camada local de planejamento de audio.

Estado atual:

- moods:
  `dark_suspense`, `epic_rise`, `horror_tension`, `documentary_bed`,
  `sports_hype`, `calm_story`, `action_pulse`, `emotional_piano`;
- presets premium:
  `shorts_clean_voice`, `football_hype`, `true_crime_dark`,
  `cinematic_epic`, `documentary_clean`, `viral_fast_cut`;
- funcoes:
  `getAudioMoodPresets`, `getAudioMoodPresetById`, `buildAudioMixPlan`,
  `validateAudioMixPlan`, `estimateAudioTimelineDuration`,
  `summarizeAudioPlan`, `getAudioMasteringPresets`,
  `getAudioMasteringPresetById`, `resolveAudioMasteringPreset` e
  `buildPremiumAudioMixPlan`;
- regras deterministicas para soundtrack, voiceover, SFX, ducking e
  mastering premium.

Proximos passos:

- automacao temporal por envelope;
- edicao por waveform;
- composicao multi-faixa mais rica.

## packages/narration-engine

Camada local de narracao.

Estado atual:

- providers `mock-tts` e `windows-sapi-local`;
- voice packs genericos em PT-BR;
- `buildNarrationTextFromScene` e `buildNarrationPlan`;
- geracao WAV offline deterministica para validar pipeline e player;
- integracao opcional com vozes ja instaladas no Windows via SAPI;
- resumo reutilizavel de `NarrationJob`.

## packages/hybrid-visual-engine

Camada local de continuidade visual e geracao mock.

Estado atual:

- catalogos `visualSourceModes`, `visualGenerationProviders` e
  `visualGenerationStatuses`;
- construcao deterministica de prompt e negative prompt;
- sugestao de `visualSourceMode` por cena;
- `buildMissingVisualReport` para timeline e research requirements;
- geracao de SVG vertical local via `createMockGeneratedVisualSvg`;
- metadata padrao para promover o output a `Asset`.

## packages/story-engine

Vocabulario e regras de narrativa.

Estado atual:

- analise deterministica de timeline por projeto;
- `createScenesFromScript` para transformar roteiro em cenas;
- `suggestAssetsForScene` para smart picks locais;
- `buildProductionChecklist` para prontidao editorial;
- leitura de hook, tension, climax, resolucao e CTA;
- warnings de pacing;
- sugestao de papel narrativo por cena.

Proximos passos:

- beats editaveis;
- blueprint narrativo por canal;
- estrategias de estrutura por template.

## packages/research-collector

Camada local de pesquisa editorial.

Estado atual:

- busca assistida por queries e links do Google;
- checklist editorial minimo por tema;
- score deterministico de fontes;
- extracao leve de metadata e texto de HTML publico;
- heuristicas locais de facts e timeline;
- geracao de resumo, outline e asset requirements a partir das fontes
  aprovadas.

## packages/media-collector

Camada local de busca e importacao segura de midias autorizadas.

Estado atual:

- contratos `MediaProvider`, `MediaSearchResult` e `MediaDownloadResult`;
- utilitarios de `normalizeMediaType`, inferencia por URL e nome seguro;
- validacao de extensoes e `content-type` por tipo de midia;
- queries derivadas de `ResearchAssetRequirement` e `ResearchDossier`;
- base comum para providers autorizados e para o fluxo `manual-url`.

Proximos passos:

- score melhor de relevancia por provider;
- cache local opcional de resultados de busca;
- matching mais forte entre assets importados e requirements cumpridos.

## packages/cinematic-engine

Regras de linguagem audiovisual.

Estado atual:

- presets `action`, `drama`, `suspense`, `horror`, `mystery`, `epic`, `calm`;
- sugestao de preset por emocao;
- metadata de movimento, intensidade, cor, caption, musica e SFX.

Proximos passos:

- presets derivados por template;
- curvas de energia mais ricas;
- ponte com pipeline de composicao e render.

## packages/caption-engine

Sistema de legendas premium.

Estado atual:

- estilos:
  `bold_impact`, `premium_yellow`, `anime_punch`, `documentary_clean`,
  `horror_whisper`, `comic_pop`, `sports_hype`;
- funcoes de quebra de linha, leitura e impacto;
- sugestao de caption style por template e emocao;
- exportacao `SRT` e `ASS`.

Proximos passos:

- encaixar o desenho real das legendas no pipeline FFmpeg;
- suportar animacoes temporais por palavra;
- evoluir layout por template e por faixa segura de render.

## packages/templates

Catalogo de formatos reutilizaveis.

Estado atual:

- templates:
  `anime_dark`, `comic_drama`, `game_epic`, `mystery_doc`, `history_dark`,
  `sports_hype`, `true_crime`, `cinematic_story`;
- sugestao por nicho, canal e projeto;
- combinacoes sugeridas de caption e cinematic profile;
- notas operacionais por formato.

Proximos passos:

- permitir templates customizados persistidos;
- ligar templates a pacotes reais de trilha, SFX e overlay.

## packages/video-engine

Camada de composicao.

Estado atual:

- unir story, cinematic, captions e templates;
- produzir `captionAnalysis` e `renderBlueprint` consumindo a timeline
  persistida;
- servir de ponte entre dominio criativo, API e worker;
- expor um entrypoint browser-safe em `@reelforge/video-engine`;
- expor um entrypoint server-only em
  `@reelforge/video-engine/render-server`;
- oferecer `renderBlueprintV1` e `renderCinematicV2`;
- carregar planos visuais por preset em `cinematic-filter-plans.ts`;
- reportar progresso e cancelamento via callbacks opcionais consumidos pelo
  worker.

Proximos passos:

- enriquecer motion, overlays, soundtrack e composicao por faixa;
- suportar trims, loops e cortes mais refinados por asset.

## packages/hybrid-visual-engine - Etapa 10I

Novos contratos locais:

- `workflow-packs.ts`: packs `anime_dark`, `comic_drama`,
  `true_crime_doc`, `mystery_doc`, `history_dark`, `sports_hype`,
  `game_epic`, `cinematic_story`, `horror_tension` e
  `documentary_clean`.
- `image-quality-presets.ts`: presets `draft`, `standard` e `high`.
- `comfy-workflows.ts`: builder com metadata de `workflowOrigin`,
  `appliedParameters` e `ignoredParameters`.

Esses contratos sao constantes versionadas, sem banco, e alimentam API, Web e
smokes.

Na etapa atual, `packages/video-engine` tambem passou a:

- carregar o `AudioMixPlan` no render blueprint;
- separar `visual_output.mp4` do mux final;
- mixar soundtrack, voiceover e SFX via FFmpeg quando houver audio configurado;
- preservar o render sem audio quando nenhum asset de audio estiver configurado.

## storage

Camada fisica local para os arquivos do fluxo.

- `storage/assets`: destino atual do upload real local.
- `storage/research`: cache local de texto bruto para fontes importadas.
- `storage/renders`: destino atual de blueprints, logs, subtitles e MP4s.
- `storage/renders/{videoProjectId}/{renderJobId}/thumbnail.jpg`: preview
  visual local do render concluido.

Organizacao adicional para smoke test:

- `storage/assets/smoke/image/*.png`: imagens locais geradas por FFmpeg para
  validar V1 e `cinematic_v2` ponta a ponta.
- `storage/assets/smoke/music/*.wav`: trilhas locais geradas por FFmpeg para
  smoke de audio.
- `storage/assets/smoke/audio/*.wav`: voiceovers fake locais para smoke.
- `storage/assets/smoke/sfx/*.wav`: efeitos locais para smoke.
- `storage/assets/smoke/production/*`: assets dedicados ao smoke do wizard de
  producao.

Organizacao de assets nesta etapa:

- `storage/assets/{category}/{type}/arquivo-seguro.ext`

## prisma

Camada de persistencia local.

- `prisma/schema.prisma`: modelagem principal;
- `prisma/seed.mjs`: seed inicial;
- `prisma/migrations/`: historico de migracoes;
- `prisma/dev.db`: banco SQLite local criado apos a primeira migration, agora
  incluindo `RenderJob`, `renderMode`, `renderQuality` e metadata de audio.
- `prisma/migrations/*research_collector_v1*`: amplia o banco com dossies,
  fontes, facts, timeline, hooks e outline.

Observacao operacional:

- a API sobe em `memory` por padrao para nao bloquear o primeiro boot;
- upload real funciona mesmo assim, mas so `DATA_BACKEND=prisma` preserva o
  catalogo apos reboot;
- o smoke test e o worker once assumem Prisma + SQLite ativos;
- `RenderJob` agora carrega estado operacional mais rico para painel e fila.
- a migration `audio_engine_v1` expande projeto, cena e job para a camada de
  audio local.
- a migration `production_flow_channel_defaults` transforma `Channel` em uma
  identidade editorial de producao para o wizard rapido.

