# ROADMAP

## Etapa 1 - Fundacao

Entregue:

- monorepo TypeScript com workspaces;
- apps e packages principais;
- estrutura de storage;
- base documental do produto e da arquitetura.

## Etapa 2 - Persistencia local

Entregue:

- Prisma + SQLite preparados no monorepo;
- schema com `Channel`, `Asset`, `VideoProject` e `Scene`;
- seed inicial;
- repositorios concretos preparados;
- fallback em memoria preservado.

## Etapa 3 - Dashboard inicial

Entregue:

- dashboard dark studio em `apps/web`;
- paginas `/channels`, `/assets`, `/projects` e `/renders`;
- CRUD HTTP para canais;
- CRUD HTTP para assets;
- formulario manual de assets com metadados e path local;
- fallback mock na web e fallback em memoria na API.

## Etapa 4 - Upload local de assets e preview

Entregue:

- `POST /assets/upload`;
- salvamento real em `storage/assets/{category}/{type}/`;
- nome seguro de arquivo;
- metadata basica de arquivo no `Asset`;
- `GET /media/assets/:assetId`;
- preview de imagem, video e audio no frontend;
- modo manual por path local mantido como opcao avancada.

## Etapa 5 - Editor de projetos e cenas

Entregue:

- CRUD completo de `VideoProject`;
- CRUD de `Scene` por projeto;
- associacao visual entre cenas e assets existentes;
- timeline inicial em `/projects/[id]`;
- reorder manual de cenas;
- painel de qualidade com alertas basicos.

## Etapa 6 - Story Engine + cinematic presets

Entregue:

- presets cinematograficos reutilizaveis em `packages/cinematic-engine`;
- Story Engine deterministico em `packages/story-engine`;
- endpoint `GET /video-projects/:id/story-analysis`;
- painel narrativo e seletor de preset em `/projects/[id]`;
- timeline com energia, papel narrativo e preset efetivo.

## Etapa 7 - Caption Engine + templates premium + render blueprint

Entregue:

- `packages/templates` consolidado com catalogo premium por nicho;
- `packages/caption-engine` com estilos, analise de leitura e export SRT/ASS;
- `packages/video-engine` montando `captionAnalysis` e `renderBlueprint`;
- endpoints `GET /templates`, `GET /caption-styles`,
  `GET /video-projects/:id/caption-analysis` e
  `GET /video-projects/:id/render-blueprint`;
- painel de template, `Caption Engine`, preview de legenda e blueprint em
  `/projects/[id]`.

## Etapa 8 - Worker real + Render Engine V1

Entregue:

- modelo `RenderJob` com migration `render_jobs_v1`;
- endpoints de fila e media final;
- salvamento de `blueprint.json` em `storage/renders/{videoProjectId}/{renderJobId}/`;
- worker local consumindo jobs a cada 3 segundos;
- FFmpeg renderizando MP4 vertical 1080x1920 com burn de `ASS`;
- observabilidade inicial com `progress`, status, `render.log` e preview na web.

## Etapa 8.1 - Smoke test e estabilizacao

Entregue:

- smoke test ponta a ponta com assets locais gerados automaticamente;
- validacao de `output.mp4` por tamanho, status e `ffprobe` quando disponivel;
- suporte a `worker:once` como ferramenta operacional de diagnostico.

## Etapa 8.2 - Render Ops

Entregue:

- migration `render_ops_v1`;
- status `cancelled`;
- cancelamento manual de jobs em `queued` e `processing`;
- retry manual criando novo job com `attempt` incrementado;
- exclusao de job fora de `processing`;
- `currentStep`, `currentSceneIndex` e `totalScenes`;
- `thumbnail.jpg` servido por rota dedicada;
- metadata persistida de `outputWidth`, `outputHeight`, `outputDuration`,
  `outputCodec` e `outputFileSize`;
- paineis `/projects/[id]` e `/renders` com thumbnail, metadata, tentativa e
  polling inteligente.

## Etapa 9A - Render cinematografico V2 visual

Entregue:

- migration `render_cinematic_v2_mode`;
- `RenderJob.renderMode` e `RenderJob.renderQuality`;
- `POST /video-projects/:id/render-jobs` com body opcional para modo e
  qualidade;
- `renderCinematicV2` em `packages/video-engine`;
- motion deterministico por preset;
- placeholder melhorado;
- dispatcher no worker entre V1 e `cinematic_v2`;
- smoke `npm run smoke:render:cinematic`;
- cards e painel web diferenciando os modos.

## Etapa 9B - Audio Engine inicial

Entregue:

- migration `audio_engine_v1`;
- `packages/audio-engine` com moods, plano, validacao e resumo de mixagem;
- `GET /audio-moods` e `GET /audio-moods/:id`;
- `GET /video-projects/:id/audio-plan`;
- configuracao de trilha, voiceover, mood, ducking e volumes por projeto;
- configuracao de SFX por cena;
- blueprint de render com secao `audio`;
- mixagem local via FFmpeg preservando `v1` e `cinematic_v2`;
- metadata de audio persistida no `RenderJob`;
- smoke `npm run smoke:render:audio`.

## Etapa 10A - Production Flow V1

Entregue:

- migration `production_flow_channel_defaults`;
- defaults editoriais e tecnicos por canal;
- UI de `/channels` expandida para configurar identidade de producao;
- `createScenesFromScript` deterministico em `packages/story-engine`;
- smart picker local de assets com score e motivos;
- `POST /production/create-from-script`;
- `GET /video-projects/:id/production-checklist`;
- `GET /video-projects/:id/asset-suggestions`;
- `POST /video-projects/:id/apply-channel-defaults`;
- pagina `/produce` e card `Nova Producao` no dashboard;
- `Production Checklist` e `Smart Picks` no studio do projeto;
- defaults de render puxados do canal no painel de render;
- smoke `npm run smoke:production`.

## Etapa 10B - Manual Intake System

Entregue:

- migration `manual_intake_system`;
- estrutura `storage/inbox` com `drop`, `characters`, `projects`,
  `reviewed` e `rejected`;
- modelos `MediaCollection` e `MediaCandidate`;
- metadata adicional de origem no `Asset`;
- scan local por `storage/inbox` com inferencia deterministica;
- prevencao basica de duplicados por path, nome+tamanho e hash leve;
- endpoints `/intake/*` e preview seguro por `GET /media/candidates/:id/preview`;
- pagina `/intake` com scan, filtros, revisao, aprovacao, rejeicao e
  importacao em lote;
- suporte inicial a referencias de personagem e materiais por projeto;
- comandos `npm run intake:scan`, `npm run intake:import-approved` e
  `npm run smoke:intake`.

## Etapa 10C - Research Collector V1

Entregue:

- migration `research_collector_v1`;
- package `packages/research-collector`;
- modelos `ResearchDossier`, `ResearchSource`, `ResearchFact`,
  `ResearchTimelineEvent`, `ResearchHook`, `ResearchAssetRequirement` e
  `ResearchOutlineScene`;
- rotas `/research/*` para dossier, sources, analysis e create-production;
- pagina `/research` e workspace `/research/[id]`;
- busca assistida por Google apenas via queries/links, sem scraping;
- conectores simples para fonte manual, URL publica, Wikipedia e Wikidata;
- heuristicas locais para facts, timeline, hooks, outline e asset requirements;
- criacao de `VideoProject` a partir do dossie;
- smoke `npm run smoke:research`.

## Etapa 10D - Media Collector V1

Entregue:

- migration `media_collector_v1`;
- package `packages/media-collector`;
- providers seguros:
  `manual-url`, `wikimedia-commons`, `nasa-media`, `internet-archive`
  (experimental), `pexels`, `pixabay` e `unsplash` com API keys opcionais;
- pagina `/media-collector` com providers, colecoes, review queue e importacao
  aprovada;
- rotas `/media-collector/*`, `/media-collections/*` e `/media-candidates/*`;
- integracao com `ResearchAssetRequirement` e com cenas sem asset em
  `/projects/[id]`;
- politica de download segura com validacao de extensao, content-type, redirects
  e bloqueio de HTML como midia;
- smoke offline `npm run smoke:media-collector`.

## Etapa 10E - Hybrid Visual Engine + Character Reference System

Entregue:

- migration `hybrid_visual_engine_v1`;
- package `packages/hybrid-visual-engine`;
- modelos `CharacterProfile`, `CharacterReference` e `VisualGenerationJob`;
- rotas `/characters/*`, `/visual-source-modes`, `/visual-generation/*`,
  `/video-projects/:id/missing-visual-report`,
  `/video-projects/:id/generate-missing-visuals`,
  `/scenes/:sceneId/generate-visual` e
  `/research/asset-requirements/:id/generate-visual`;
- pagina `/characters`;
- painel `Hybrid Visual Engine` em `/projects/[id]`;
- integracao de personagens e visuais gerados em `Asset Requirements`;
- provider local `mock-svg` para planejar visuals sem IA externa;
- smoke `npm run smoke:hybrid-visual`.

## Proxima etapa operacional sugerida

- Etapa 10I concluida: Workflow Packs + Image Quality Presets para ComfyUI
  local, com endpoints de catalogo/sugestao, UI em `/projects/[id]`,
  `/prompt-lab`, `/characters` e `/research/[id]`, metadata em
  `VisualGenerationJob` e smoke offline `npm run smoke:workflow-packs`.
- concorrencia controlada para visual generation;
- prioridades, backoff e limites por worker;
- retries automaticos com politica configuravel;
- limpeza opcional de artefatos gerados;
- diagnostico melhor de falhas e consumo de recursos.

## Etapa 11 - Assistencias avancadas

- IA quando fizer sentido;
- classificacao assistida de assets;
- sugestoes de estrutura narrativa;
- automacoes criativas sempre com supervisao humana.

## Ordem recomendada a partir daqui

1. Aprofundar a fila local de visual generation com concorrencia,
   prioridade e cleanup.
2. Enriquecer overlays, crossfades e composicao multi-faixa.
3. Aprofundar o Audio Engine com ducking dinamico e automacao temporal.
4. Conectar o Media Collector e o Research Collector a matching mais forte de
   assets e requirements.
5. Conectar o Manual Intake a associacao mais forte com projetos e presets.
6. IA opcional apenas quando a base operacional estiver madura.

