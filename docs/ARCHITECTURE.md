# ARCHITECTURE

## Visao geral

O projeto usa um monorepo TypeScript dividido em apps e packages.

- `apps/web`: interface operacional e visual do estudio.
- `apps/api`: camada de orquestracao, persistencia e intake local.
- `apps/worker`: pipeline assincrono local que consome `RenderJob` reais.
- `packages/*`: regras reutilizaveis e independentes de framework.
- `storage/*`: arquivos locais de entrada e saida.
- `prisma/`: schema, seed, migrations e banco SQLite local.

## Arquitetura da API

Cada modulo segue a mesma separacao:

- `domain`: tipos, validacoes e regras de entrada;
- `application`: interfaces e casos de uso;
- `infrastructure`: implementacoes concretas;
- `http`: adaptadores de rota e serializacao.

Hoje isso ja esta aplicado em:

- `projects`;
- `channels`;
- `assets`;
- `audio-library`;
- `editing-references`;
- `characters`;
- `hybrid-visual`;
- `narration`;
- `intake`;
- `research`;
- `render-jobs`;
- `production`.

Na Etapa 5, `projects` passou a seguir o mesmo padrao completo dos outros
modulos:

- `application/project-service.ts` concentra os casos de uso;
- `application/project-repository.ts` define CRUD de projetos e cenas;
- `domain/project.ts` valida `VideoProject`, `Scene` e reorder de timeline;
- `infrastructure/*-project-repository.ts` entrega implementacoes `memory` e
  `prisma`;
- `http/routes/video-project-routes.ts` adapta as novas rotas REST.

Na Etapa 6, o modulo `projects` ganhou uma leitura criativa adicional:

- `application/project-story-analysis-service.ts` transforma um projeto em
  analise narrativa consumindo packages compartilhados;
- `GET /video-projects/:id/story-analysis` expoe a analise de qualidade,
  papeis sugeridos e presets recomendados;
- a timeline da web espelha a mesma leitura localmente para continuar
  responsiva mesmo em fallback.

Na Etapa 7, `projects` virou tambem a ponte para captions, templates e
render blueprint:

- `application/project-caption-analysis-service.ts` resolve impacto, leitura,
  quebra de linhas e estilo efetivo das legendas;
- `application/project-render-blueprint-service.ts` monta o contrato tecnico da
  timeline que a fila de render consome;
- `application/project-video-engine-mapper.ts` converte o projeto persistido no
  formato compartilhado por `packages/video-engine`;
- `GET /video-projects/:id/caption-analysis` devolve a leitura de legendas por
  cena;
- `GET /video-projects/:id/render-blueprint` devolve preset, template, story
  role, subtitles e checklist tecnico em um unico payload.

Na Etapa 8, a arquitetura ganhou o fluxo operacional de render local:

- `modules/render-jobs` concentra o dominio e os casos de uso de fila;
- `application/render-job-service.ts` cria o job, resolve o projeto e salva o
  `blueprint.json` em `storage/renders/{videoProjectId}/{renderJobId}/`;
- `infrastructure/*-render-job-repository.ts` entrega persistencia em memoria e
  via Prisma;
- `infrastructure/local-render-storage.ts` resolve MP4/log e garante que a API
  so sirva arquivos dentro de `storage/renders`;
- `http/routes/render-job-routes.ts` e `http/routes/render-media-routes.ts`
  expoem fila, detalhe e preview/download do resultado final.

Na Etapa 8.2, esse fluxo operacional passou a carregar tambem:

- transicoes validadas de status entre `queued`, `processing`, `completed`,
  `failed` e `cancelled`;
- cancelamento seguro por checkpoint do worker;
- retry manual criando um novo `RenderJob` com `attempt` incrementado e
  `retriedFromJobId`;
- thumbnail local por job;
- metadata final de output persistida apos `ffprobe` quando disponivel.

Na Etapa 9A, o mesmo fluxo passou a suportar dois modos de render:

- `v1`, preservado como fallback rapido e estavel;
- `cinematic_v2`, com motion por preset, placeholder premium e filtros visuais
  deterministas.

Na Etapa 9B, esse mesmo fluxo passou a resolver tambem a camada de audio:

- `application/project-audio-plan-service.ts` monta o plano de audio do
  projeto consumindo `packages/audio-engine`;
- `GET /audio-moods` e `GET /audio-moods/:id` expoem os presets locais de
  audio;
- `GET /video-projects/:id/audio-plan` devolve soundtrack, voiceover, SFX,
  warnings e resumo da mixagem antes do render;
- `application/project-render-blueprint-service.ts` e
  `application/project-video-engine-mapper.ts` passaram a incluir uma secao
  `audio` no blueprint consumido pelo worker.

Na Etapa 10A, a API ganhou tambem um fluxo rapido de producao:

- `modules/production/domain/production.ts` valida o wizard e os toggles
  deterministas de producao;
- `modules/production/application/production-service.ts` concentra
  `create-from-script`, checklist, smart picker e aplicacao de defaults do
  canal;
- `http/routes/production-routes.ts` expoe `POST /production/create-from-script`;
- `http/routes/video-project-routes.ts` passou a expor checklist,
  asset suggestions e aplicacao de defaults no detalhe do projeto.

Na Etapa 10B, a API ganhou tambem um fluxo de intake manual revisavel:

- `modules/intake/domain/intake.ts` modela `MediaCollection`,
  `MediaCandidate`, filtros e validacoes de update;
- `modules/intake/application/intake-service.ts` orquestra scan, aprovacao,
  rejeicao e importacao em lote;
- `modules/intake/infrastructure/intake-filesystem.ts` faz a leitura segura de
  `storage/inbox`, infere metadata e copia aprovados para `storage/assets`;
- `modules/intake/infrastructure/*-intake-repository.ts` entrega persistencia
  em memoria e via Prisma;
- `http/routes/intake-routes.ts` e `http/routes/candidate-media-routes.ts`
  expoem revisao, importacao e preview dos candidatos.

Na Etapa 10C, a API ganhou tambem uma camada de pesquisa editorial:

- `modules/research/domain/research.ts` valida dossies, fontes, facts,
  timeline, hooks, outline e create-production;
- `modules/research/application/research-service.ts` concentra source
  discovery, analise local e conversao de dossie em `VideoProject`;
- `modules/research/infrastructure/public-research-connectors.ts` limita a
  importacao a URLs publicas simples e conectores abertos de Wikipedia e
  Wikidata;
- `modules/research/infrastructure/research-source-storage.ts` salva texto
  bruto em `storage/research/raw`;
- `http/routes/research-routes.ts` expoe `/research/*` sem depender de IA
  externa nem scraping agressivo.

Na Etapa 10E, a arquitetura ganhou continuidade visual local e reutilizavel:

- `modules/characters` modela `CharacterProfile`, `CharacterReference`,
  construcao de prompt-base e bootstrap a partir do intake manual;
- `modules/hybrid-visual` concentra relatorio de cenas fracas, listagem de
  providers/modos, geracao mock local e controle de `VisualGenerationJob`;
- `http/routes/characters-routes.ts` expoe CRUD de personagens, referencias e
  `POST /characters/create-from-intake/:slug`;
- `http/routes/hybrid-visual-routes.ts` expoe
  `/visual-source-modes`, `/visual-generation/*`,
  `/video-projects/:id/missing-visual-report`,
  `/video-projects/:id/generate-missing-visuals`,
  `/scenes/:sceneId/generate-visual` e
  `/research/asset-requirements/:id/generate-visual`.

Na Etapa 11A, a arquitetura ganhou tambem narracao local por cena:

- `packages/narration-engine` concentra providers, voice packs, plano de
  narracao, geracao offline em WAV e o adaptador opcional de `windows-sapi-local`;
- `modules/narration` concentra o dominio `NarrationJob`, os casos de uso,
  a persistencia e as rotas HTTP;
- `http/routes/narration-routes.ts` expoe catalogos, jobs, listagem por cena,
  geracao local e promocao do WAV para a cena;
- `project-video-engine-mapper.ts` e `packages/video-engine` passaram a
  carregar `generatedNarrationAssetId`, `effectiveNarrationAssetId`,
  `effectiveNarrationAssetPath` e `narrationSource` no blueprint;
- `project-audio-plan-service.ts` ja resolve narrações geradas como assets de
  audio validos dentro do catalogo do projeto, sem quebrar o audio plan atual.

Na Etapa 11F, a arquitetura ganhou tambem uma camada editorial de trilha e
ritmo:

- `modules/audio-library` concentra perfis de musica/SFX, selecao automatica,
  analise local via FFmpeg/ffprobe quando disponiveis e construcao do
  `BeatSyncPlan`;
- `http/routes/audio-library-routes.ts` expoe catalogos de presets, biblioteca,
  analise, update de perfil, auto-select e plano ritmico;
- `project-video-engine-mapper.ts` e `packages/video-engine` passaram a incluir
  `selectedMusicAssetId`, `selectedMusicAssetPath`, `musicPresetId`,
  `musicLicenseStatus`, `beatSyncPlan`, `sfxCueCount` e `musicWarnings` no
  blueprint;
- o studio web passou a ler o mesmo contrato para sugerir trilha e mostrar o
  plano de cortes/microclips sem depender de render real.

Na Etapa 11G, a arquitetura ganhou tambem uma camada de benchmarking
editorial local:

- `packages/editing-reference-engine` concentra categorias, analise basica via
  FFmpeg/ffprobe, catalogo de presets derivados e sugestoes por template;
- `modules/editing-references` concentra o dominio `EditingReference` e
  `EditingReferencePreset`, os casos de uso de analise e a persistencia
  Prisma/in-memory;
- `http/routes/editing-reference-routes.ts` expoe CRUD de referencias,
  CRUD de presets, `POST /editing-references/:id/analyze`,
  `POST /editing-references/:id/build-preset` e
  `GET /editing-reference-presets/suggestions`;
- o studio web usa esses presets como camada de direcao editorial sem acoplar
  a referencia local ao render nem copiar o conteudo original.

No caso de `assets`, a Etapa 4 adicionou dois blocos importantes:

- `application/asset-storage.ts`: contrato para salvar e resolver arquivos;
- `infrastructure/local-asset-storage.ts`: implementacao local que escreve em
  `storage/assets`, cria nome seguro e resolve preview por `assetId`.

## Persistencia local atual

Pontos principais:

- `prisma/schema.prisma` para o schema principal;
- `prisma/seed.mjs` para dados iniciais locais;
- `prisma/migrations/` para historico de migracoes;
- `prisma/dev.db` como arquivo SQLite local criado pela primeira migration;
- `apps/api/src/infrastructure/database/prisma-client.ts` como client
  compartilhado;
- repositorios Prisma por modulo dentro de
  `apps/api/src/modules/*/infrastructure`.

O modelo `Asset` agora persiste tambem:

- `mimeType`;
- `extension`;
- `fileSize`;
- `width` e `height` quando a deteccao leve de imagem consegue preencher.

Na etapa atual, os modelos editoriais tambem foram expandidos:

- `VideoProject.templateId`;
- `VideoProject.defaultCaptionStyle`;
- `Scene.captionStyle`;
- `Scene.captionPosition`;
- `Scene.captionEmphasisWords`;
- `Scene.energyLevel`.

Na Etapa 10B, a camada Prisma passou a persistir tambem:

- `MediaCollection` com status de scan/revisao/importacao;
- `MediaCandidate` com metadata inferida, metadata revisada, hash leve e
  vinculo opcional ao `Asset` final;
- novos campos de origem no `Asset`:
  `sourceProvider`, `sourceUrl`, `sourceAuthor`, `sourceLicense`,
  `sourceLicenseUrl`, `downloadedAt`, `collectionId` e `usageNotes`.

Na Etapa 10C, a camada Prisma passou a persistir tambem:

- `ResearchDossier`;
- `ResearchSource`;
- `ResearchFact`;
- `ResearchTimelineEvent`;
- `ResearchHook`;
- `ResearchAssetRequirement`;
- `ResearchOutlineScene`.

Na Etapa 10D, a camada Prisma passou a persistir ainda:

- `MediaCollection.dossierId` para ligar colecoes ao Research Collector;
- `MediaCollection.assetRequirementId` para ligar colecoes a requisitos
  visuais especificos;
- `MediaCollection.mediaType` para orientar busca/importacao por tipo;
- `MediaCandidate.sourceLicenseUrl`, `suggestedCharacter` e
  `suggestedProject` para review mais forte antes da promocao a `Asset`.

Na Etapa 10E, a camada Prisma passou a persistir tambem:

- `CharacterProfile`;
- `CharacterReference`;
- `VisualGenerationJob`;
- novos campos de continuidade visual em `Scene`:
  `generatedAssetId`, `characterProfileId`, `visualSourceMode`,
  `visualPrompt`, `negativePrompt`, `visualRecipe`, `generationStatus`,
  `generationProvider` e `generationSeed`;
- novos campos equivalentes em `ResearchAssetRequirement` para permitir
  geracao visual a partir do dossier antes da criacao do projeto final.

Na Etapa 11A, a camada Prisma passou a persistir tambem:

- `NarrationJob`;
- novos campos de narracao em `Scene`:
  `generatedNarrationAssetId`,
  `narrationStatus`,
  `narrationProvider` e
  `narrationVoicePackId`.

Na Etapa 8, a camada Prisma tambem passou a persistir:

- `RenderJob.status`;
- `RenderJob.progress`;
- `RenderJob.blueprintPath`, `outputPath`, `srtPath`, `assPath`, `logPath`;
- `RenderJob.startedAt`, `completedAt` e `errorMessage`.

Na Etapa 8.2, `RenderJob` tambem passou a persistir:

- `currentStep`;
- `currentSceneIndex` e `totalScenes`;
- `thumbnailPath`;
- `outputWidth`, `outputHeight`, `outputDuration`, `outputCodec`,
  `outputFileSize`;
- `cancelledAt`;
- `retriedFromJobId`;
- `attempt`.

Na Etapa 9A, `RenderJob` passou a persistir tambem:

- `renderMode`;
- `renderQuality`.

Na Etapa 9B, o dominio persistido passou a carregar ainda:

- `VideoProject.backgroundMusicAssetId` e `voiceoverAssetId`;
- `VideoProject.audioMood`;
- `VideoProject.musicVolume`, `voiceVolume`, `sfxVolume`;
- `VideoProject.enableAudioDucking` e `duckingLevel`;
- `Scene.sfxAssetId`, `sfxStartTime` e `sfxVolume`;
- `RenderJob.hasAudio`, `audioCodec`, `audioChannels` e `audioSampleRate`.

Na Etapa 11C, `RenderJob` passou a persistir tambem:

- `metadata` como JSON string;
- `audioMasteringPresetId` dentro da metadata do job;
- `audioQualityReport` com loudness, ducking, compressor, limiter e codec final.

Na Etapa 11F, a camada Prisma passou a persistir tambem:

- `MusicAssetProfile`;
- `SfxAssetProfile`;
- `VideoProject.musicPresetId`.

Na Etapa 11G, a camada Prisma passou a persistir tambem:

- `EditingReference`;
- `EditingReferencePreset`;
- relacao opcional da referencia com `Asset` quando o reel local ja estiver
  registrado na biblioteca como video.

Na Etapa 10A, `Channel` virou tambem uma identidade editorial de producao:

- `defaultRenderMode` e `defaultRenderQuality`;
- `defaultAudioMood`;
- `defaultCaptionStyle`;
- `defaultVisualPreset`;
- `defaultMusicAssetId` e `defaultVoiceoverAssetId`;
- `defaultDurationTarget` e `defaultSceneDuration`;
- `preferredAssetCategories` e `preferredAssetTags`.

## Backend ativo: memoria ou Prisma

A API continua funcionando com dois backends:

- `memory` para bootstrap rapido;
- `prisma` para persistencia real via SQLite.

Decisao atual:

- `DATA_BACKEND` continua com padrao `memory`;
- uploads reais salvam o arquivo fisico em `storage/assets` mesmo no modo
  `memory`;
- para manter o catalogo apos reiniciar a API, o recomendado e usar
  `DATA_BACKEND=prisma`;
- para render V1 com worker, `DATA_BACKEND=prisma` e obrigatorio no fluxo
  operacional;
- o mesmo requisito vale para `cinematic_v2` com trilha, voiceover e SFX.

## Upload local direto de assets

Fluxo da Etapa 4:

1. O frontend envia `multipart/form-data` para `POST /assets/upload`.
2. A API valida `file`, `category`, `type` e extensao suportada.
3. O storage local gera um nome seguro:
   - sem espacos;
   - sem caracteres perigosos;
   - com timestamp e sufixo curto;
   - preservando a extensao.
4. O arquivo e salvo em `storage/assets/{category}/{type}/`.
5. A API cria o registro `Asset` no repositorio atual.
6. O frontend passa a consumir preview por `GET /media/assets/:assetId`.

## Manual Intake System

Fluxo da Etapa 10B:

1. O usuario coloca arquivos em `storage/inbox/drop`, `characters` ou
   `projects`.
2. `scanInbox()` percorre apenas raizes locais conhecidas, ignora temporarios,
   `.gitkeep`, `thumbs.db`, `desktop.ini` e extensoes nao suportadas.
3. O scan cria ou reutiliza uma `MediaCollection` aberta com
   `provider=manual-intake`.
4. Cada arquivo valido vira `MediaCandidate` com `status=pending`.
5. O sistema evita duplicados por `originalPath`, `title + fileSize` e
   `contentHash` leve quando viavel.
6. O frontend revisa metadados em `/intake` e o operador aprova ou rejeita o
   que deseja promover.
7. `importApprovedInboxCandidates()` copia o original para
   `storage/assets/{category}/{type}/`, cria o `Asset` oficial e marca o
   candidato como `imported`.

Inferencias especiais desta etapa:

- `storage/inbox/characters/{characterSlug}/references` injeta
  `suggestedCharacter`, tag `character-reference` e privilegia `image` quando o
  arquivo for visual;
- `storage/inbox/projects/{projectSlug}/raw` injeta `suggestedProject`, a tag
  do projeto e `recommendedUse=project-material`;
- `GET /media/candidates/:id/preview` serve preview seguro do original sem
  promover o arquivo para a biblioteca.

Limites intencionais nesta versao:

- os originais ainda nao sao movidos automaticamente para `reviewed/` ou
  `rejected/`;
- `document` e alguns `reference` continuam fora da biblioteca oficial quando
  nao houver `AssetType` valido;
- o intake registra `suggestedProject`, mas ainda nao associa isso
  automaticamente ao `VideoProject`.

## Research Collector System

Fluxo da Etapa 10C:

1. O operador cria um `ResearchDossier` em `/research`.
2. O dossie pode ou nao ser vinculado a um `Channel`.
3. `POST /research/dossiers/:id/generate-search-queries` gera queries e links
   do Google apenas como busca assistida, sem scraping.
4. O operador adiciona fontes manuais, importa uma URL publica ou busca
   candidatos abertos em Wikipedia/Wikidata.
5. `ResearchSource.status` separa `candidate`, `approved`, `rejected`,
   `imported` e `failed`.
6. `POST /research/dossiers/:id/analyze` roda heuristicas locais sobre fontes
   aprovadas/importadas.
7. A analise gera `ResearchFact`, `ResearchTimelineEvent`, `ResearchHook`,
   `ResearchAssetRequirement` e `ResearchOutlineScene`.
8. `POST /research/dossiers/:id/create-production` transforma o outline em
   `VideoProject` e `Scene`, aplicando defaults do canal quando houver.

Guardrails desta etapa:

- URLs publicas respeitam timeout, tamanho maximo e sinais de paywall/login;
- Google entra apenas como links prontos, nao como coletor automatico;
- true crime/documentario recebe warnings locais via `safetyNotes`;
- a analise tenta manter relacao entre fato/evento e `ResearchSource` sempre
  que possivel.

## Media Collector System

Fluxo da Etapa 10D:

1. O operador cria uma `MediaCollection` em `/media-collector`.
2. A colecao pode nascer manualmente, de um `ResearchAssetRequirement` ou de
   cenas sem asset em `/projects/[id]`.
3. O provider escolhido pode ser:
   - `manual-url`;
   - `wikimedia-commons`;
   - `nasa-media`;
   - `internet-archive` (experimental);
   - `pexels`, `pixabay` e `unsplash` com API key opcional.
4. `searchCollection()` cria `MediaCandidate` com `status=pending`, evitando
   duplicados por `sourceUrl`, `downloadUrl` e `title`.
5. O operador revisa licenca, autor, tags, categoria e uso recomendado.
6. Apenas candidatos `approved` seguem para importacao.
7. `importApproved()` valida extensao, `content-type`, redirects, tamanho e
   bloqueia HTML antes de gravar em `storage/assets/{category}/{type}/`.
8. O `Asset` final recebe `sourceProvider`, `sourceUrl`, `sourceAuthor`,
   `sourceLicense`, `sourceLicenseUrl`, `downloadedAt`, `collectionId` e
   `usageNotes`.

Guardrails desta etapa:

- nao ha scraping protegido;
- nao ha download de redes sociais;
- Google entra apenas como busca assistida/manual, nunca como downloader;
- conteudo protegido automatico continua fora do escopo;
- `manual-url` so baixa/importa depois de aprovacao humana;
- o smoke desta etapa funciona offline, sem internet.

## Hybrid Visual + Character Reference System

Fluxo da Etapa 10E:

1. O operador organiza referencias em `/characters` ou reaproveita material
   vindo de `storage/inbox/characters/{characterSlug}/references`.
2. `CharacterProfile` concentra identidade, prompt-base, negativos,
   estilo preferido, tags e provider local sugerido.
3. `CharacterReference` ancora assets existentes como rosto, pose, outfit,
   expressao ou referencia geral.
4. `GET /video-projects/:id/missing-visual-report` classifica cenas sem asset
   ou com visual fraco e sugere `visualSourceMode`.
5. `POST /scenes/:sceneId/generate-visual` e
   `POST /research/asset-requirements/:id/generate-visual` geram SVG mock local
   e opcionalmente vinculam o `Asset` resultante.
6. `POST /video-projects/:id/generate-missing-visuals` dispara jobs em lote
   para completar a timeline.
7. `VisualGenerationJob` registra provider, prompt, output, erro e status para
   observabilidade futura.

Guardrails desta etapa:

- nao ha IA externa;
- nao ha download automatico;
- o provider `mock-svg` existe para planejamento local e smoke test;
- a web pode cair para descritores mock sem impedir operacao de projeto;
- o render ainda consome assets gerados como biblioteca local comum, sem pular
  o catalogo oficial.

## Fluxo editorial atual

Fluxo principal desta etapa:

1. O usuario pode entrar em `/produce` para um fluxo rapido.
2. O wizard escolhe um `Channel`, recebe titulo, roteiro e duracao alvo.
3. `POST /production/create-from-script` cria o `VideoProject`.
4. O modulo `production` aplica defaults do canal quando o toggle estiver
   ligado.
5. Opcionalmente, a operacao pode nascer antes em `/research` e chegar nesse
   ponto via `create-production`.
6. Quando faltarem referencias visuais, `ResearchAssetRequirement` ou cenas sem
   asset podem abrir `MediaCollection` para abastecer a biblioteca.
7. `packages/story-engine` quebra o roteiro em cenas deterministicas.
8. O smart picker local pontua assets por tags, categoria, emocao e contexto.
9. O melhor asset pode ser associado automaticamente por cena.
10. O projeto resultante abre em `/projects/[id]` com checklist e smart picks.
11. O usuario ajusta o que quiser no studio.
12. O mesmo projeto segue para captions, audio, blueprint e render.

Fluxo editorial completo:

1. O usuario escolhe ou cria um `Channel`.
2. O dashboard cria um `VideoProject` vinculado a esse canal.
3. A pagina de detalhe do projeto cria e reordena `Scene`.
4. Cada cena pode apontar para um `Asset` existente na biblioteca local.
5. A timeline calcula duracao total e emite sinais de qualidade simples.
6. O Story Engine sugere papel narrativo para cada cena.
7. O Cinematic Engine sugere ou aplica preset visual por emocao.
8. O catalogo de templates resolve direcao editorial por nicho, canal e
   projeto.
9. O Caption Engine monta preview, analise e exports SRT/ASS.
10. O Audio Engine resolve soundtrack, voiceover, SFX e validacoes de mixagem.
11. Os presets premium de mastering resolvem loudness target, ducking,
    compressor, limiter, fades e tratamento de silencio.
12. O Video Engine consolida tudo em um render blueprint local.
13. A API cria um `RenderJob` e salva a copia do blueprint em `storage/renders`.
14. O worker local encontra jobs `queued` no SQLite.
15. O worker escolhe `renderBlueprintV1` ou `renderCinematicV2` com base em
    `RenderJob.renderMode`.
16. O worker atualiza `currentStep`, `progress`, `currentSceneIndex` e
    `totalScenes` conforme o pipeline avanca.
17. O `packages/video-engine/render-server` usa FFmpeg para gerar segmentos,
    concatenar a timeline, queimar `ASS`, mixar audio quando houver e exportar
    `output.mp4`.
18. O worker gera `thumbnail.jpg` e tenta enriquecer o job com `ffprobe` sem
    falhar o render se esse binario nao existir.
19. O worker persiste metadata de audio quando houver stream final:
    `hasAudio`, `audioCodec`, `audioChannels` e `audioSampleRate`.
19. A API serve `output.mp4`, `thumbnail.jpg` e `render.log` por `renderJobId`.
20. A web acompanha status, metadata, thumbnail e acoes de operacao em
    `/projects/[id]` e `/renders`.

Esse fluxo mantem a UI desacoplada de `child_process`, filesystem e FFmpeg,
preservando a fronteira entre browser-safe code e runtime server-side.

## Packages ativos na etapa atual

### `packages/story-engine`

Estado atual:

- analise deterministica de ritmo, abertura, climax e CTA;
- `createScenesFromScript` para transformar roteiro em cenas locais;
- `suggestAssetsForScene` para smart picks deterministas por cena;
- `buildProductionChecklist` para readiness editorial antes do render;
- atribuicao sugerida de papeis narrativos:
  `hook`, `context`, `tension`, `climax`, `resolution`, `cta`;
- retorno de alertas e warnings sem qualquer dependencia externa.

### `packages/research-collector`

Estado atual:

- `generateSearchQueries` e `generateGoogleSearchLinks` para busca assistida;
- `generateSourceChecklist` para operacao editorial minima;
- `rankSourceCandidate` para score deterministico de triagem;
- `extractBasicMetadataFromHtml` e `extractTextHeuristics` para importacao
  simples de URL publica;
- `extractFactCandidates` e `extractTimelineCandidates` para heuristicas
  locais de facts e cronologia;
- `buildResearchDossierSummary`, `buildOutlineFromResearch` e
  `buildAssetRequirementsFromOutline` para transformar pesquisa em estrutura
  narrativa pronta para producao.

### `packages/media-collector`

Estado atual:

- contratos `MediaProvider`, `MediaSearchOptions`, `MediaSearchResult` e
  `MediaDownloadResult`;
- `normalizeMediaType`, inferencia por URL e sanitizacao de nome de arquivo;
- validacao de extensoes e `content-type` seguro por tipo de midia;
- queries derivadas de `ResearchAssetRequirement` e `ResearchDossier`;
- base comum para `manual-url` e providers publicos autorizados.

### `packages/cinematic-engine`

Estado atual:

- catalogo local de presets:
  `action`, `drama`, `suspense`, `horror`, `mystery`, `epic`, `calm`;
- metadata audiovisual por preset:
  movimento, intensidade, mood de cor, caption, musica e SFX;
- sugestao de preset por emocao quando a cena ainda nao foi dirigida manualmente.

### `packages/caption-engine`

Estado atual:

- catalogo local de estilos:
  `bold_impact`, `premium_yellow`, `anime_punch`, `documentary_clean`,
  `horror_whisper`, `comic_pop`, `sports_hype`;
- quebra deterministica de linhas para preview e export;
- analise de velocidade de leitura, impacto e alertas;
- exportacao `SRT` e `ASS` para render local e preview tecnico.

### `packages/templates`

Estado atual:

- catalogo premium:
  `anime_dark`, `comic_drama`, `game_epic`, `mystery_doc`, `history_dark`,
  `sports_hype`, `true_crime`, `cinematic_story`;
- sugestao de template por nicho, canal e projeto;
- combinacao padrao de preset visual, caption style e mood.

### `packages/video-engine`

Estado atual:

- composicao local de `captionAnalysis`;
- composicao local de `renderBlueprint`;
- resolucao de template, preset e legenda efetivos por cena;
- consolidacao de warnings, story role e subtitle exports em um contrato unico;
- subpath server-side `@reelforge/video-engine/render-server` para path utils e
  renderizacao V1 e Cinematic V2 com FFmpeg;
- callbacks opcionais `onStep`, `onScene`, `onProgress` e `shouldCancel` para
  o worker reportar operacao e interromper com seguranca;
- render simples V1 de imagens, videos e placeholders em 1080x1920 / 30 fps;
- `render-cinematic-v2.ts` com motion por preset, fade por cena, placeholder
  melhorado e logs mais detalhados;
- `audio-mix.ts` com mixagem FFmpeg local para soundtrack, voiceover e SFX por
  cena;
- `cinematic-filter-plans.ts` com planos deterministas por preset e por
  qualidade;
- `ffmpeg-filter-utils.ts` com helpers de filtro, fade e dimensoes seguras.

### `packages/audio-engine`

Estado atual:

- presets locais:
  `dark_suspense`, `epic_rise`, `horror_tension`, `documentary_bed`,
  `sports_hype`, `calm_story`, `action_pulse`, `emotional_piano`;
- perfis persistidos de trilha e SFX via `MusicAssetProfile` e
  `SfxAssetProfile`;
- presets musicais:
  `football_hype`, `viral_fast_cut`, `cinematic_epic`,
  `true_crime_dark`, `documentary_clean`, `shorts_clean_voice`;
- analise local opcional com `analyzeAudioAsset`, `detectApproxBpm`,
  `detectBeatMarkers`, `detectEnergyTimeline` e `detectLoudness`;
- selecao automatica com `selectMusicForReel`;
- plano ritmico com `buildBeatSyncPlan`;
- plano deterministico de mixagem a partir de projeto, cenas e assets;
- validacao de warnings e erros antes da renderizacao;
- resumo operacional do mix para a API e para o painel web.

## Preview seguro por assetId

O preview nao expoe caminho absoluto do disco.

Em vez disso:

- a web pede `GET /media/assets/:assetId`;
- a API localiza o `Asset` pelo repositorio;
- o storage resolve o arquivo real apenas se ele estiver dentro de
  `storage/assets`;
- a resposta usa `Content-Type` apropriado e suporte basico a `Range` para
  audio e video.

Isso mantem a UI simples e evita transformar qualquer path arbitrario do banco
em um endpoint publico.

## Fluxo web -> API

1. `apps/web` carrega snapshots de canais, assets e projetos.
2. Se a API responder, a UI trabalha com dados reais.
3. Se a API estiver indisponivel, a web cai para mocks locais.
4. Em CRUD manual, a UI ainda consegue fallback de sessao.
5. Em upload real, a UI depende da API e mostra erro claro se ela nao estiver
   disponivel.
6. Em projetos e cenas, a UI tenta a API primeiro e, se falhar, mantem edits
   apenas na sessao atual.
7. Em templates, captions e blueprint, a web tambem consegue fallback local
   usando `packages/*` sem perder o editor.

## Rotas atuais

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
- `GET /media/renders/:renderJobId`
- `GET /media/renders/:renderJobId/log`
- `GET /media/renders/:renderJobId/thumbnail`
- `GET /audio-moods`
- `GET /audio-moods/:id`
- `GET /audio/music-presets`
- `GET /audio/music-presets/:id`
- `GET /audio/music-library`
- `POST /audio/music-library/analyze/:assetId`
- `PUT /audio/music-library/:assetId/profile`
- `GET /audio/sfx-library`
- `PUT /audio/sfx-library/:assetId/profile`
- `POST /audio/select-music`
- `POST /audio/beat-sync-plan`
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
- `POST /research/dossiers/:id/create-media-collections-for-requirements`

Observacoes importantes:

- `GET /projects` continua como alias legado de listagem para snapshots ja
  existentes;
- `GET /video-projects/:id` devolve canal associado, cenas ordenadas e asset
  de cada cena quando existir;
- `GET /video-projects/:id/story-analysis` devolve alertas narrativos,
  `suggestedSceneRoles` e preset sugerido/aplicado por cena;
- `GET /video-projects/:id/caption-analysis` devolve leitura de legenda,
  estilos sugeridos e estilo efetivo por cena;
- `GET /video-projects/:id/audio-plan` devolve o plano de mixagem, existencia
  fisica dos assets de audio e warnings deterministas;
- `GET /video-projects/:id/production-checklist` devolve prontidao editorial,
  warnings, sugestoes e render defaults recomendados;
- `GET /video-projects/:id/asset-suggestions` devolve top 5 assets sugeridos
  por cena com score e motivos;
- `POST /video-projects/:id/apply-channel-defaults` aplica defaults do canal
  sem sobrescrever escolhas manuais ja preenchidas;
- `POST /video-projects/:id/create-media-collection-for-missing-assets` gera
  colecoes a partir de cenas sem asset usando contexto do projeto e do canal;
- `GET /video-projects/:id/render-blueprint` devolve o contrato tecnico que a
  fila local de render consome hoje;
- `POST /production/create-from-script` cria projeto, cenas e smart picks a
  partir de roteiro local usando o mesmo dominio da API;
- `POST /video-projects/:id/render-jobs` cria o job sem renderizar no processo
  HTTP e aceita body opcional com `renderMode` e `renderQuality`;
- `GET /render-jobs*` devolve tambem `currentStep`, `currentSceneIndex`,
  `totalScenes`, `attempt`, `retriedFromJobId`, `mediaUrl`, `logUrl`,
  `thumbnailUrl`, metadata de output e metadata de audio;
- `POST /render-jobs/:id/cancel` marca o job como `cancelled` e deixa o worker
  parar no proximo checkpoint seguro;
- `POST /render-jobs/:id/retry` cria um novo job apontando para o mesmo projeto;
- `DELETE /render-jobs/:id` remove so o registro do banco nesta etapa;
- `GET /media/renders/:renderJobId`, `/log` e `/thumbnail` servem apenas
  artefatos resolvidos em `storage/renders`;
- `POST /video-projects/:id/scenes/reorder` espera a lista completa de
  `sceneIds` na ordem final da timeline;
- `POST /assets` continua sendo o caminho manual por JSON e path local;
- `POST /assets/upload` e o intake binario real;
- `POST /media-collections/:id/search` e `import-approved` operam apenas sobre
  providers autorizados e candidatos revisados;
- `GET /media/assets/:assetId` so atende arquivos dentro de `storage/assets`;
- `GET /templates*` e `GET /caption-styles*` sao catalogos locais, sem banco e
  sem dependencia externa.

## Cuidados para manter escalavel

- nao colocar logica de dominio dentro da UI;
- nao misturar regras de arquivo com regras de composicao narrativa;
- manter interfaces de repositorio e storage na aplicacao, nao no HTTP;
- manter Story Engine, Caption Engine e Cinematic Engine puros e
  deterministas mesmo com o pipeline de render ativo;
- manter o Audio Engine puro e deterministico, com catalogos e planos em
  `packages/audio-engine`, deixando apenas a execucao dos filtros de FFmpeg no
  `video-engine`/worker;
- preservar `RenderJob.metadata` como trilha tecnica de execucao, sem empurrar
  detalhes de mastering para campos relacionais novos quando uma estrutura JSON
  clara ja for suficiente;
- tratar uploads grandes com cautela enquanto o parser ainda bufferiza em
  memoria;
- evoluir preview, ingestao, projetos e render como modulos separados;
- manter `storage/assets` e `storage/renders` fora do fluxo normal de Git.

## Operacao local recomendada

Bootstrap rapido:

1. `npm install`
2. `ffmpeg -version`
3. `npm run db:generate`
4. `npm run db:migrate:dev`
5. `npm run db:seed`
6. `DATA_BACKEND=prisma`
7. `npm run dev:api`
8. `npm run dev:web`
9. `npm run dev:worker`
10. `npm run smoke:render`
11. `npm run smoke:render:cinematic`
12. `npm run smoke:render:audio`
13. `npm run smoke:production`
14. `npm run smoke:research`
15. `npm run smoke:media-collector`
16. `npm run smoke:music-render-plan`

Persistencia real com Prisma:

1. `npm run db:generate`
2. `npm run db:migrate:dev`
3. `npm run db:seed`
4. `DATA_BACKEND=prisma`
5. `npm run dev:api`
6. `npm run dev:web`
7. `npm run dev:worker`
8. `npm run smoke:render:audio`
9. `npm run smoke:production`
10. `npm run smoke:research`
11. `npm run smoke:music-render-plan`

## Etapa 10I - Workflow Packs e Quality Presets

- `packages/hybrid-visual-engine/src/workflow-packs.ts` define os 10 packs
  locais para ComfyUI por nicho.
- `packages/hybrid-visual-engine/src/image-quality-presets.ts` define
  `draft`, `standard` e `high`.
- `packages/hybrid-visual-engine/src/comfy-workflows.ts` carrega primeiro
  overrides em `storage/comfyui/workflows` e depois workflows versionados do
  pacote.
- A API expoe `/comfy-workflow-packs`, `/image-quality-presets` e
  `/comfy-workflow-packs/suggest`.
- `VisualGenerationJob.metadata` armazena `workflowPackId`,
  `qualityPresetId`, origem do workflow e parametros aplicados/ignorados sem
  exigir nova migration.
- O render blueprint continua lendo `generatedAssetId`/`effectiveAssetId`; a
  etapa nao muda o contrato de render.

## Etapa 11K.2 - Asset Vault Builder e Search Missions

- `AssetVault` agrupa uma biblioteca planejada por nicho, source pack e tipos
  alvo sem importar midia automaticamente.
- `SearchMission` registra providers, queries, contadores e status de revisao.
- As rotas `/asset-vault*` e `/discovery/search-missions*` usam o catalogo
  candidate-first do `production-discovery-engine`.
- Candidatos continuam em `MediaCandidate`: score, dedup, risco e confirmacao
  manual ficam em metadata/usage notes.
- `POST /discovery/candidates/:id/import` so cria `Asset` quando o candidato
  foi confirmado pelo usuario e aponta para um arquivo local autorizado.
- A pagina `/asset-vault-builder` e uma bancada de revisao: cria vaults,
  roda missoes, mostra gaps, abre fontes e deixa o usuario confirmar/importar.

