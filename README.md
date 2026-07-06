# ReelForge Studio

ReelForge Studio e uma plataforma local em evolucao para transformar imagens,
videos, quadrinhos, artes, screenshots, audios, musicas, efeitos e overlays em
videos verticais 9:16 com acabamento cinematografico.

Esta base agora cobre dezenove camadas do produto:

- fundacao do monorepo;
- persistencia local com Prisma + SQLite preparada;
- dashboard inicial com CRUD de canais e assets;
- upload real de arquivos locais com preview na biblioteca;
- projetos de video, cenas e timeline inicial no dashboard;
- presets cinematograficos reutilizaveis e Story Engine deterministico;
- Caption Engine local, templates premium e render blueprint;
- worker local com Render Jobs e Render Engine V1 via FFmpeg;
- render cinematografico V2 visual com dispatcher por modo e smoke dedicado.
- Audio Engine local deterministico com soundtrack, voiceover, SFX, mixagem e
  smoke dedicado.
- Production Flow V1 com defaults de canal, `/produce`, script-to-scenes,
  smart asset picker, checklist e smoke dedicado.
- Manual Intake System com inbox local, revisao via `/intake`, colecoes,
  candidatos e importacao em lote para a biblioteca.
- Research Collector V1 com `/research`, dossies, fontes, facts, timeline,
  hooks, outline, asset requirements e criacao de producao a partir do dossie.
- Media Collector V1 com `/media-collector`, providers autorizados, review de
  candidatos, importacao aprovada e integracao com research requirements e
  cenas sem asset.
- Hybrid Visual Engine + Character Reference System com `/characters`,
  perfis reutilizaveis, referencias visuais, relatorio de cenas fracas,
  geracao mock local via SVG, jobs de visual generation e smoke dedicado.
- Local Narration Pipeline V1 com `packages/narration-engine`, jobs de
  narracao, WAV local gerado por cena, provider offline `mock-tts`, provider
  opcional `windows-sapi-local`, pagina `/generated-audio` e integracao basica
  com blueprint/audio plan.
- Premium Audio Studio Pipeline com presets de masterizacao, ducking real ou
  fallback global, compressor/limiter/loudnorm via FFmpeg quando disponiveis,
  metadata no `RenderJob` e smokes dedicados.
- Music Library + Beat Sync Engine com perfis locais de musica e SFX, analise
  aproximada via FFmpeg/ffprobe quando disponiveis, selecao automatica por
  preset e plano ritmico para cortes, flashes, SFX e microclips.
- Editing Reference Presets com cadastro de reels locais de referencia,
  analise editorial basica via FFmpeg/ffprobe, presets reutilizaveis e
  sugestoes por template dentro do estudio.
- One-Click Reel Production Flow com checklist inteligente, geracao de
  narracao/visual ausentes, selecao de musica local, Beat Sync Plan, blueprint
  e criacao de RenderJob em um fluxo assistido por projeto.

Continuam fora do escopo nesta etapa:

- IA;
- login;
- scraping;
- APIs pagas, IA externa e scraping agressivo;
- download automatico de conteudo protegido da internet.

## O que ja existe

- Monorepo TypeScript com workspaces.
- `apps/web` com dashboard dark studio.
- `apps/api` com CRUD, upload multipart, preview local por `assetId` e fluxo de
  projetos/cenas.
- `apps/worker` processando fila local com Prisma + SQLite.
- `apps/web` com pagina `/characters` e paineis de Hybrid Visual em
  `/projects/[id]` e `/research/[id]`.
- `apps/web` com pagina `/generated-audio` e painel `Local Narration` em
  `/projects/[id]` e `/prompt-lab`.
- `apps/web` com pagina `/music-library` e integracao de selecao automatica de
  trilha em `/projects/[id]`.
- `apps/web` com pagina `/editing-references` e sugestoes editoriais ligadas
  ao template em `/projects/[id]`.
- `prisma/` com schema, seed e migrations para SQLite.
- `storage/assets` para intake local.
- `storage/references` para reels locais de referencia usados apenas como guia
  editorial, nunca como material a ser versionado ou reexportado.
- `storage/assets/generated/narrations` para WAVs gerados localmente.
- `storage/inbox` para ingestao manual, revisao e organizacao de materiais.
- `storage/research` para textos brutos importados de fontes publicas.
- `storage/renders` para blueprints, logs, legendas e MP4s exportados.
- `packages/cinematic-engine` com presets mockados reutilizaveis.
- `packages/story-engine` com analise narrativa deterministica local.
- `packages/media-collector` com contratos de provider, busca segura e
  importacao revisavel.
- `packages/research-collector` com heuristicas locais de pesquisa e outline.
- `packages/hybrid-visual-engine` com regras deterministicas para prompts,
  receitas visuais, relatorio de cenas fracas e SVGs mock locais.
- `packages/caption-engine` com catalogo de estilos, analise de leitura e
  exportacao SRT/ASS.
- `packages/narration-engine` com providers, voice packs e geracao WAV local.
- `packages/editing-reference-engine` com analise local de referencias,
  catalogo editorial e builder de presets reutilizaveis.
- `packages/templates` com templates premium por nicho.
- `packages/video-engine` com composicao de blueprint, Render V1 e
  Cinematic V2 server-side.
- `packages/audio-engine` com moods, plano de mixagem, presets premium de
  masterizacao, perfis de musica/SFX, selecao automatica e beat sync
  deterministico.
- `scripts/smoke-render-v1.mjs` para validacao ponta a ponta com assets reais
  gerados localmente.
- `scripts/smoke-render-audio.mjs` para validacao ponta a ponta do pipeline de
  audio local.
- `scripts/smoke-editing-reference-presets.mjs` para validar criacao,
  analise e derivacao de presets editoriais locais.
- `scripts/smoke-research.mjs` para validar dossier, sources, analysis e
  create-production.
- `scripts/smoke-hybrid-visual.mjs` para validar personagens, requirements,
  jobs e assets gerados localmente.
- operacao de render com cancelamento, retry manual, thumbnail e metadata de
  output persistidos no `RenderJob`.
- fluxo de producao rapido via `/produce`, com criacao de projeto a partir de
  roteiro, sugestoes de assets e defaults editoriais por canal.
- fluxo `One-Click Production` em `/projects/[id]` e endpoints
  `/reel-production/*` para preparar ou produzir um reel a partir de projetos
  existentes da Reels Factory.

## Estrutura

```text
reelforge-studio/
  apps/
    web/
    api/
    worker/
  packages/
    video-engine/
    story-engine/
    media-collector/
    research-collector/
    hybrid-visual-engine/
    cinematic-engine/
    caption-engine/
    narration-engine/
    editing-reference-engine/
    templates/
    audio-engine/
  prisma/
    schema.prisma
    seed.mjs
    migrations/
  storage/
    assets/
      generated/
        narrations/
    references/
    inbox/
    research/
    renders/
  docs/
```

## Rodando localmente

1. Entre na pasta do projeto:

```bash
cd reelforge-studio
```

2. Em clone limpo, prefira instalar com lockfile fechado:

```bash
npm ci
```

Se voce estiver atualizando dependencias ou reconstruindo o lockfile
intencionalmente, use `npm install`.

3. Confirme que o FFmpeg esta disponivel:

```bash
ffmpeg -version
ffprobe -version
```

Se o binario nao estiver no `PATH`, defina antes de rodar os renders ou smokes:

```bash
$env:FFMPEG_PATH="C:/ffmpeg/bin/ffmpeg.exe"
$env:FFPROBE_PATH="C:/ffmpeg/bin/ffprobe.exe"
```

Referencias locais editoriais devem ficar fora do Git. Use, por exemplo,
`storage/references/` para guardar MP4s de benchmarking visual/audio e trate
esse material apenas como guia de estilo, nunca como conteudo a ser copiado.

4. Gere o Prisma Client:

```bash
npm run db:generate
```

5. Aplique as migrations existentes e crie o SQLite local:

```bash
npm run db:migrate:dev
```

6. Rode o seed:

```bash
npm run db:seed
```

7. Suba a API com Prisma:

```powershell
$env:DATA_BACKEND="prisma"
npm run dev:api
```

8. Em outro terminal, suba o dashboard:

```bash
npm run dev:web
```

9. Em outro terminal, suba o worker:

```bash
npm run dev:worker
```

10. Se quiser processar apenas um job e sair:

```bash
npm run worker:once
```

11. Abra:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## Smoke recomendado da Etapa 11G

Para validar Editing Reference Presets localmente:

```bash
npm run db:generate
npm run build
npm run typecheck
npm run smoke:editing-reference-presets
```

Observacao: o backend padrao da API continua sendo `memory` para bootstrap
rapido, mas o fluxo de render V1 depende de `DATA_BACKEND=prisma`, porque o
worker consome `RenderJob` pelo SQLite local. O mesmo vale para
`cinematic_v2` e para o pipeline com audio local.

Se a porta `3000` estiver ocupada, o Next.js sobe automaticamente na proxima
porta livre, como `3001`.

Para validar a API pelo bundle compilado sem `tsx watch`, rode:

```bash
npm run build --workspace @reelforge/api
npm run start --workspace @reelforge/api
```

## Local Narration Pipeline V1

- `packages/narration-engine` concentra `mock-tts`, voice packs e o provider
  opcional `windows-sapi-local`.
- Os WAVs gerados ficam em
  `storage/assets/generated/narrations/{narrationJobId}.wav`.
- A API expoe:
  `GET /narration/providers`,
  `GET /narration/voice-packs`,
  `GET /narration/jobs`,
  `GET /scenes/:sceneId/narrations`,
  `POST /scenes/:sceneId/generate-narration` e
  `POST /scenes/:sceneId/use-narration/:assetId`.
- O blueprint agora devolve tambem
  `effectiveNarrationAssetId`,
  `effectiveNarrationAssetPath` e
  `narrationSource`.
- A validacao offline principal da etapa e:

```bash
npm run smoke:narration-engine
```

- A validacao opcional de voz local do Windows e:

```powershell
$env:NARRATION_WINDOWS_SAPI_ENABLED="true"
npm run smoke:narration-windows-sapi:local
```

Limitacoes da V1:

- `mock-tts` valida pipeline, player, asset e blueprint, mas nao tenta soar
  como fala humana real.
- `windows-sapi-local` depende apenas das vozes ja instaladas no Windows e pode
  ficar `disabled` por padrao.
- clonagem de voz, imitacao de pessoa real e qualquer uso de API externa ficam
  fora desta etapa.

## Music Library + Beat Sync Engine

- `packages/audio-engine` agora concentra:
  `MusicAssetProfile`, `SfxAssetProfile`, music presets, selecao automatica de
  trilha, SFX recomendados e `BeatSyncPlan`.
- A API expoe:
  `GET /audio/music-presets`,
  `GET /audio/music-presets/:id`,
  `GET /audio/music-library`,
  `POST /audio/music-library/analyze/:assetId`,
  `PUT /audio/music-library/:assetId/profile`,
  `GET /audio/sfx-library`,
  `PUT /audio/sfx-library/:assetId/profile`,
  `POST /audio/select-music` e
  `POST /audio/beat-sync-plan`.
- O dashboard ganhou a pagina `/music-library` para revisar trilhas/SFX locais,
  rodar analise FFmpeg quando o ambiente permitir e salvar metadados editoriais.
- `/projects/[id]` agora consegue:
  selecionar `musicPresetId`,
  sugerir preset por contexto,
  escolher musica automaticamente e
  visualizar o `Beat Sync Plan`.
- O render blueprint passou a expor:
  `selectedMusicAssetId`,
  `selectedMusicAssetPath`,
  `musicPresetId`,
  `musicLicenseStatus`,
  `beatSyncPlan`,
  `sfxCueCount` e
  `musicWarnings`.

Validacoes principais da etapa:

```bash
npm run smoke:music-render-plan
npm run smoke:music-library
npm run smoke:render-with-music-sync
```

Observacoes:

- `smoke:music-render-plan` e logico e nao depende de FFmpeg.
- `smoke:music-library` e `smoke:render-with-music-sync` podem ficar `skipped`
  no sandbox do Codex quando `child_process.spawn` estiver bloqueado.
- A biblioteca trabalha apenas com assets de audio locais/autorizados; nao ha
  downloader de musicas nem scraping.

## Manual Intake

O Manual Intake permite colocar arquivos locais em `storage/inbox` e revisar
esses materiais antes de promover para a biblioteca oficial de assets.

Estrutura recomendada:

```text
storage/inbox/
  drop/
    images/
    videos/
    audio/
    music/
    sfx/
    overlays/
    documents/
    references/
  characters/
    _example-character/
      references/
      notes/
  projects/
    _example-project/
      raw/
      selected/
      references/
  reviewed/
  rejected/
```

Fluxo local:

1. Coloque arquivos em `storage/inbox/drop`, `storage/inbox/characters` ou
   `storage/inbox/projects`.
2. Rode `npm run intake:scan` ou use `/intake` para gerar `MediaCollection` e
   `MediaCandidate`.
3. Revise metadados, aprove ou rejeite candidatos.
4. Rode `npm run intake:import-approved` ou use o botao da UI para copiar os
   aprovados para `storage/assets/{category}/{type}/`.

Comandos novos:

```bash
npm run intake:scan
npm run intake:import-approved
npm run smoke:intake
```

Suporte especial desta etapa:

- `storage/inbox/characters/{characterSlug}/references` gera sugestao de
  `character`, tag `character-reference` e base para o Hybrid Visual
  Engine.
- `storage/inbox/projects/{projectSlug}/raw` gera `suggestedProject`,
  adiciona a tag do projeto e marca `recommendedUse=project-material`.

Limitacoes atuais:

- os arquivos originais continuam no inbox; ainda nao ha move automatico para
  `reviewed/` ou `rejected/`;
- `documents` e alguns `reference` nao viram `Asset` se nao mapearem para um
  `AssetType` suportado;
- o intake ainda nao associa automaticamente o material a um `VideoProject`
  real.

## Research Collector

O Research Collector V1 organiza pesquisa local para shorts documentais e
historias sombrias sem usar IA externa, scraping agressivo nem Google scraping.

Fluxo atual:

1. Criar um dossie em `/research`.
2. Vincular opcionalmente o dossie a um canal.
3. Gerar queries e links de busca assistida para o usuario abrir manualmente.
4. Adicionar fontes manuais ou importar uma URL publica.
5. Buscar candidatos abertos via Wikipedia e Wikidata quando a internet estiver
   disponivel.
6. Aprovar ou rejeitar fontes.
7. Rodar a analise local para criar facts, timeline, hooks, outline e asset
   requirements.
8. Criar uma producao em `/projects/[id]` a partir do outline.

Regras importantes desta etapa:

- Google e usado apenas para gerar queries e links, sem scraping de resultados.
- `fetch-url` aceita apenas HTML/texto publico simples e respeita timeout,
  limite de tamanho e sinais de paywall/login.
- fatos tentam manter vinculo com `ResearchSource` sempre que possivel.
- temas true crime/documentario recebem `safetyNotes` e warnings locais, mas a
  criacao nao e bloqueada.

Comando novo:

```bash
npm run smoke:research
```

## Media Collector

O Media Collector V1 abastece a biblioteca local a partir de URLs diretas
revisadas, providers publicos autorizados e requirements do Research.

Fluxo atual:

1. Criar uma colecao em `/media-collector`.
2. Escolher um provider permitido:
   - `manual-url`
   - `wikimedia-commons`
   - `nasa-media`
   - `internet-archive` (experimental)
   - `pexels` com `PEXELS_API_KEY`
   - `pixabay` com `PIXABAY_API_KEY`
   - `unsplash` com `UNSPLASH_ACCESS_KEY`
3. Rodar a busca ou criar candidatos manuais por URL direta.
4. Revisar metadata, licenca, autor e tags.
5. Aprovar apenas o que pode entrar na biblioteca.
6. Importar aprovados para `storage/assets/{category}/{type}/`.
7. Abrir colecoes a partir de:
   - `ResearchAssetRequirement` em `/research/[id]`;
   - cenas sem asset em `/projects/[id]`.

Diferenca entre Media Collector e Manual Intake:

- `Manual Intake` parte de arquivos ja presentes em `storage/inbox`.
- `Media Collector` parte de URLs diretas e providers autorizados, sempre com
  revisao manual antes do download/import.

Politica de seguranca desta etapa:

- nao faz scraping protegido;
- nao baixa redes sociais;
- nao baixa conteudo protegido automaticamente;
- nao usa Google como downloader;
- bloqueia HTML como midia importavel;
- valida extensao, content-type, tamanho e redirects antes de importar.

Comando novo:

```bash
npm run smoke:media-collector
```

## Ativando Prisma + SQLite

Quando quiser persistencia real dos registros e da fila de render:

1. Gere o Prisma Client:

```bash
npm run db:generate
```

2. Aplique as migrations locais e crie o banco SQLite:

```bash
npm run db:migrate:dev
```

3. Rode o seed:

```bash
npm run db:seed
```

4. Reinicie a API com Prisma:

```powershell
$env:DATA_BACKEND="prisma"
npm run dev:api
```

## Banco local

- Schema: `prisma/schema.prisma`
- Seed: `prisma/seed.mjs`
- Migrations: `prisma/migrations/`
- SQLite local: `prisma/dev.db` apos a primeira migration

Models adicionais da Etapa 10B:

- `MediaCollection`
- `MediaCandidate`

Models adicionais da Etapa 10C:

- `ResearchDossier`
- `ResearchSource`
- `ResearchFact`
- `ResearchTimelineEvent`
- `ResearchHook`
- `ResearchAssetRequirement`
- `ResearchOutlineScene`

Models adicionais da Etapa 11F:

- `MusicAssetProfile`
- `SfxAssetProfile`

Package adicional da Etapa 10D:

- `packages/media-collector`

Migration desta etapa:

- `manual_intake_system`
- `research_collector_v1`
- `media_collector_v1`
- `music_library_beat_sync_engine`

## Endpoints atuais

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
- `POST /research/asset-requirements/:id/create-media-collection`
- `POST /research/dossiers/:id/create-media-collections-for-requirements`
- `GET /research/dossiers/:id/facts`
- `GET /research/dossiers/:id/timeline`
- `GET /research/dossiers/:id/hooks`
- `GET /research/dossiers/:id/asset-requirements`
- `GET /research/dossiers/:id/outline`
- `POST /research/dossiers/:id/create-production`
- `GET /media/assets/:assetId`
- `GET /media/candidates/:id/preview`
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
- `POST /production/create-from-script`

Filtros aceitos em `GET /assets`:

- `type`
- `category`
- `emotion`
- `copyrightRisk`
- `search`

`POST /video-projects/:id/render-jobs` agora aceita body opcional:

```json
{
  "renderMode": "v1",
  "renderQuality": "standard"
}
```

Valores suportados:

- `renderMode`: `v1`, `cinematic_v2`
- `renderQuality`: `draft`, `standard`, `high`

## Tipos aceitos no upload

- `IMAGE`
- `VIDEO`
- `AUDIO`
- `MUSIC`
- `SFX`
- `OVERLAY`
- `FONT`

Extensoes aceitas hoje:

- imagens: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- videos: `.mp4`, `.mov`, `.webm`, `.m4v`
- audio/musica/sfx: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.flac`
- font: `.ttf`, `.otf`, `.woff`, `.woff2`

## Telas atuais

- `/` dashboard inicial com cards operacionais.
- `/intake` intake manual para scan, review e importacao em lote.
- `/media-collector` busca, review e importacao aprovada de midias externas
  autorizadas.
- `/channels` CRUD completo de canais.
- `/assets` biblioteca com upload real, preview local, filtros e modo manual.
- `/music-library` catalogo de trilhas e SFX locais com BPM, energia e licenca.
- `/research` listagem e criacao de dossies.
- `/research/[id]` workspace de sources, facts, timeline, hooks, outline e
  create-production.
- `/projects` CRUD de projetos e acesso ao editor.
- `/produce` wizard rapido para gerar projeto a partir de roteiro.
- `/projects/[id]` timeline com cenas, painel narrativo, templates premium,
  Caption Engine, Audio Engine, Music Library, Beat Sync Plan,
  Production Checklist, smart picks, preview de legenda, render blueprint e
  painel de renderizacoes.
- `/renders` monitor operacional da fila local, com logs e preview do MP4.

## Como testar Production Flow V1

1. Rode `npm run db:migrate:dev -- --name production_flow_channel_defaults --skip-generate`.
2. Rode `npm run db:seed`.
3. Suba a API com Prisma:

```powershell
$env:DATA_BACKEND="prisma"
npm run dev:api
```

4. Em outro terminal, rode `npm run dev:web`.
5. Abra `http://localhost:3000/produce`.
6. Escolha um canal, cole um roteiro e ajuste:
   - `criar cenas automaticamente`;
   - `sugerir assets automaticamente`;
   - `aplicar defaults do canal`.
7. Clique em `Criar producao`.
8. Confira:
   - projeto aberto em `/projects/[id]` quando a API estiver ativa;
   - `Production Checklist` com status, duracao, template e audio base;
   - `Smart Picks` com top assets por cena;
   - painel de render usando `renderMode` e `renderQuality` padrao do canal.
9. Rotas uteis:

```bash
curl http://localhost:4000/production/create-from-script -X POST -H "Content-Type: application/json" -d "{\"channelId\":\"<id>\",\"title\":\"Teste\",\"script\":\"Pouca gente percebeu...\",\"durationTarget\":45,\"autoCreateScenes\":true,\"autoSuggestAssets\":true,\"applyChannelDefaults\":true}"
curl http://localhost:4000/video-projects/<project-id>/production-checklist
curl http://localhost:4000/video-projects/<project-id>/asset-suggestions
curl http://localhost:4000/video-projects/<project-id>/apply-channel-defaults -X POST -H "Content-Type: application/json" -d "{}"
```

## Como testar Research Collector

1. Rode `npm run db:generate`.
2. Rode `npm run db:migrate:dev -- --name research_collector_v1`.
3. Rode `npm run db:seed`.
4. Suba a API com Prisma:

```powershell
$env:DATA_BACKEND="prisma"
npm run dev:api
```

5. Em outro terminal, rode `npm run dev:web`.
6. Abra `http://localhost:3000/research`.
7. Crie um novo dossie com titulo, tema, canal opcional, nicho, tom e duracao
   alvo.
8. Abra `/research/[id]` e confira os paineis:
   - `Overview`;
   - `Source Discovery`;
   - `Sources`;
   - `Facts`;
   - `Timeline`;
   - `Hooks`;
   - `Outline`;
   - `Asset Requirements`;
   - `Create Production`.
9. Gere queries de busca assistida.
10. Adicione pelo menos uma fonte manual.
11. Opcionalmente, use Wikipedia/Wikidata se a internet local estiver
    disponivel.
12. Aprove as fontes candidatas.
13. Rode `Analyze`.
14. Clique em `Criar producao a partir deste dossie`.
15. Confira o redirecionamento para `/projects/[id]`.

Rotas uteis:

```bash
curl http://localhost:4000/research/dossiers
curl http://localhost:4000/research/dossiers/<dossier-id>/sources
curl http://localhost:4000/research/dossiers/<dossier-id>/generate-search-queries -X POST -H "Content-Type: application/json" -d "{}"
curl http://localhost:4000/research/dossiers/<dossier-id>/analyze -X POST -H "Content-Type: application/json" -d "{}"
curl http://localhost:4000/research/dossiers/<dossier-id>/create-production -X POST -H "Content-Type: application/json" -d "{\"status\":\"SCENE_PLANNING\",\"format\":\"9:16\"}"
```

## Como testar projetos e timeline

1. Rode `npm run dev:api`.
2. Rode `npm run dev:web`.
3. Abra `http://localhost:3000/projects`.
4. Crie ou edite um projeto vinculado a um canal.
5. Abra a timeline em `/projects/{id}`.
6. Adicione cenas, selecione assets da biblioteca, escolha presets e mova as
   cenas para cima ou para baixo.
7. Confira:
   - duracao total calculada;
   - contagem de cenas sem asset e sem legenda;
   - alerta para primeira cena acima de 5s;
   - sugestao de papel narrativo por cena;
   - preset sugerido por emocao quando nenhum preset manual estiver aplicado;
   - reorder persistido quando a API estiver disponivel.

## Como testar Story Engine e presets

1. Rode `npm run dev:api`.
2. Rode `npm run dev:web`.
3. Abra `http://localhost:3000/projects/{id}`.
4. Edite a ordem, duracao, emocao, legenda e preset visual das cenas.
5. Confira:
   - painel `Story Engine` com abertura, ritmo, climax e CTA;
   - timeline mostrando energia, papel narrativo e preset efetivo;
   - preview textual do preset no `Scene Composer`.
6. Opcionalmente, valide a rota HTTP:

```bash
curl http://localhost:4000/video-projects/<project-id>/story-analysis
```

## Como testar Caption Engine, templates e render blueprint

1. Rode `npm run dev:api`.
2. Rode `npm run dev:web`.
3. Abra `http://localhost:3000/projects/{id}`.
4. Confira na pagina:
   - painel `Project Template`;
   - `Caption Engine`;
   - `Caption Preview`;
   - `Render Blueprint`.
5. Edite uma cena sem salvar, trocando preset, `captionStyle`,
   `captionPosition`, `energyLevel` e palavras em enfase.
6. Confira:
   - preview textual do template;
   - preview visual da legenda 9:16;
   - leitura de impacto e velocidade por cena;
   - blueprint com output `1080x1920`, `30 fps`, SRT e ASS.
7. Opcionalmente, valide as rotas HTTP:

```bash
curl http://localhost:4000/templates
curl http://localhost:4000/caption-styles
curl http://localhost:4000/video-projects/<project-id>/caption-analysis
curl http://localhost:4000/video-projects/<project-id>/render-blueprint
```

## Como testar Audio Engine

1. Rode `npm run dev:api`.
2. Rode `npm run dev:web`.
3. Rode `npm run dev:worker`.
4. Abra `http://localhost:3000/projects/{id}`.
5. No painel `Audio Engine`, configure:
   - `audioMood`;
   - musica de fundo;
   - voiceover opcional;
   - volumes de musica, voz e SFX;
   - `enableAudioDucking` e `duckingLevel`.
6. No editor de cena, configure opcionalmente:
   - `sfxAssetId`;
   - `sfxStartTime`;
   - `sfxVolume`.
7. Confira:
   - `Audio Plan` com duracao total, warnings e resumo;
   - preview dos assets de audio;
   - SFX por cena refletidos na timeline;
   - render com metadata de audio no painel de jobs.
8. Opcionalmente, valide as rotas HTTP:

```bash
curl http://localhost:4000/audio-moods
curl http://localhost:4000/audio-moods/dark_suspense
curl http://localhost:4000/video-projects/<project-id>/audio-plan
```

## Como testar Premium Audio Studio Pipeline

1. Rode `npm run doctor:ffmpeg`.
2. Rode `npm run smoke:audio-mastering-presets`.
3. Rode `npm run smoke:narration-engine`.
4. Rode `npm run smoke:narration-render-plan`.
5. Se o ambiente permitir `child_process.spawn`, rode tambem:
   - `npm run smoke:render-with-narration`
   - `npm run smoke:premium-audio-render`
6. Em `/projects/[id]`, no painel `Renderizacoes`, escolha um preset:
   - `shorts_clean_voice`
   - `football_hype`
   - `true_crime_dark`
   - `cinematic_epic`
   - `documentary_clean`
   - `viral_fast_cut`
7. Confira:
   - preview de loudness target, ducking, compressor e limiter;
   - `RenderJob.audioMasteringPresetId` persistido;
   - `RenderJob.metadata.audioQualityReport` quando houver render real;
   - `effectiveNarrationAssetId` presente no blueprint quando a cena tiver WAV gerado;
   - `/generated-audio` listando os WAVs como `raw narration`.
8. Rotas novas desta etapa:

```bash
curl http://localhost:4000/audio/mastering-presets
curl http://localhost:4000/audio/mastering-presets/football_hype
```

## Como testar Music Library + Beat Sync Engine

1. Rode `npm run db:generate`.
2. Rode `npm run db:migrate:deploy`.
3. Rode `npm run build`.
4. Rode `npm run typecheck`.
5. Rode `npm run smoke:music-render-plan`.
6. Se o ambiente permitir `child_process.spawn`, rode tambem:
   - `npm run smoke:music-library`
   - `npm run smoke:render-with-music-sync`
7. Abra `/music-library` e confira:
   - filtros por mood, genre, energy, use case e licenca;
   - edicao de perfil musical e de SFX;
   - acao `Analisar com FFmpeg` quando a API estiver ativa.
8. Abra `/projects/[id]` e confira:
   - seletor de `Music Preset`;
   - acao `Selecionar musica automaticamente`;
   - painel `Beat Sync Plan`;
   - warnings de licenca/BPM quando houver.
9. Rotas novas desta etapa:

```bash
curl http://localhost:4000/audio/music-presets
curl http://localhost:4000/audio/music-library
curl http://localhost:4000/audio/select-music -X POST -H "Content-Type: application/json" -d "{\"durationSeconds\":35,\"musicPresetId\":\"football_hype\",\"useCase\":\"football\",\"allowUnknownLicense\":false}"
curl http://localhost:4000/audio/beat-sync-plan -X POST -H "Content-Type: application/json" -d "{\"projectId\":\"<project-id>\",\"musicPresetId\":\"football_hype\"}"
```

## Render modes atuais

- `v1`: fallback estavel, mais rapido e conservador, agora com audio opcional.
- `cinematic_v2`: motion por preset, placeholder mais elegante, look visual
  mais rico, audio opcional e logging mais detalhado.

## Como testar Render Ops V1 + Cinematic V2

1. Rode `ffmpeg -version` e confirme que o binario local responde.
2. Rode `npm run db:generate`.
3. Rode `npm run db:migrate:dev`.
4. Rode `npm run db:seed`.
5. Suba a API com Prisma:

```powershell
$env:DATA_BACKEND="prisma"
npm run dev:api
```

6. Em outro terminal, suba `npm run dev:web`.
7. Em outro terminal, suba `npm run dev:worker`.
8. Abra `http://localhost:3000/projects/<project-id>`.
9. Escolha o modo no painel `Renderizacoes`:
   - `Render V1 rapido`
   - `Cinematic V2`
10. Escolha a qualidade:
    - `draft`
    - `standard`
    - `high`
11. Clique em `Gerar render`.
10. Confira:
    - job criado com status `queued` e progresso inicial;
    - `renderMode` e `renderQuality` persistidos no job;
    - worker mudando para `processing` e depois `completed`;
    - `currentStep`, `currentSceneIndex` e `totalScenes` sendo atualizados;
    - arquivos em `storage/renders/{videoProjectId}/{renderJobId}/`;
    - `output.mp4`, `captions.srt`, `captions.ass`, `blueprint.json` e
      `render.log`;
    - `thumbnail.jpg` gerado apos o MP4;
    - metadata final preenchida no job:
      `outputWidth`, `outputHeight`, `outputDuration`, `outputCodec` e
      `outputFileSize`;
    - preview disponivel em `/projects/[id]` e em `/renders`.
12. Testes operacionais adicionais:
    - clique em `Cancelar` enquanto o job estiver `queued` ou `processing`;
    - use `Retry` em um job `failed` ou `cancelled`;
    - use `Deletar` em qualquer job que nao esteja `processing`.
13. Rotas uteis:

```bash
curl http://localhost:4000/render-jobs
curl http://localhost:4000/video-projects/<project-id>/render-jobs
curl http://localhost:4000/media/renders/<render-job-id>
curl http://localhost:4000/media/renders/<render-job-id>/log
curl http://localhost:4000/media/renders/<render-job-id>/thumbnail
```

## Smoke test reproduzivel

Os comandos abaixo geram assets reais locais, criam um canal/projeto/cenas no
SQLite, processam o worker em modo once e validam o MP4:

```bash
npm run smoke:render
npm run smoke:render:cinematic
npm run smoke:render:audio
npm run smoke:production
npm run smoke:research
npm run smoke:media-collector
```

O smoke V1:

- gera imagens reais em `storage/assets/smoke/image/`;
- cria o projeto `Smoke Render V1`;
- cria um render job queued usando o fluxo real da API;
- processa um unico job no worker;
- valida `output.mp4`, `thumbnail.jpg`, tamanho, status final e, quando
  `ffprobe` estiver disponivel, resolucao, duracao e codec.

O smoke `cinematic_v2`:

- gera 4 cenas com presets `suspense`, `action`, `drama` e `epic`;
- cria o projeto `Smoke Render Cinematic V2`;
- persiste `renderMode=cinematic_v2` e `renderQuality=standard`;
- valida output, thumbnail, metadata e codec do mesmo jeito que o V1.

O smoke de audio:

- gera imagens, musica, voiceover e SFX locais via FFmpeg;
- cria um projeto `cinematic_v2` com `audioMood`, trilha, voz e SFX em cenas;
- processa o worker em modo once;
- valida `output.mp4`, `thumbnail.jpg`, resolucao, duracao, codec de video,
  stream de audio, `audioCodec`, `audioChannels`, `audioSampleRate`,
  `hasAudio` e `outputFileSize`.

O smoke de producao:

- cria assets reais locais para hook, contexto, climax, CTA, musica e voz;
- cria um canal com defaults editoriais e de render focados em `cinematic_v2`;
- chama o mesmo fluxo de `create-from-script` usado pela API;
- confirma cenas criadas, assets sugeridos/associados e checklist pronto;
- cria um render job com audio e processa o worker em modo `once`;
- valida `output.mp4`, `thumbnail.jpg`, resolucao `1080x1920`, audio e status
  final `completed`.

O smoke de research:

- cria um `ResearchDossier` ficticio com canal valido;
- adiciona duas fontes manuais fake sobre um caso inventado;
- aprova as fontes e roda a analise local;
- confirma facts, timeline, hooks, outline e asset requirements;
- cria um `VideoProject` real a partir do dossie;
- valida que o checklist de producao existe para o projeto gerado.

O smoke de Media Collector:

- cria fixtures locais minimas de imagem e audio sem depender de internet;
- cria uma `MediaCollection` com `provider=manual-url`;
- cria `MediaCandidate` aprovaveis apontando para arquivos locais seguros;
- importa os aprovados para `storage/assets` e valida `sourceProvider` e
  `collectionId`;
- cria um `ResearchDossier` fake com `ResearchAssetRequirement`;
- cria uma colecao a partir do requirement e valida a ligacao de volta.

Saida esperada:

- `projectId`
- `renderJobId`
- `outputPath`
- `thumbnailPath`
- `durationSeconds`
- `resolution`
- `codec`
- `outputFileSize`
- `audioCodec`
- `audioChannels`
- `audioSampleRate`
- `hasAudio`
- `finalStatus`

O arquivo final fica em:

- `storage/renders/{videoProjectId}/{renderJobId}/output.mp4`

## Diagnostico rapido de FFmpeg

Se um render falhar:

1. Abra `storage/renders/{videoProjectId}/{renderJobId}/render.log`.
2. Confira:
   - `blueprintPath` usado pelo worker;
   - `currentStep` e checkpoints do pipeline;
   - cena que estava sendo processada;
   - asset path absoluto resolvido;
   - comando FFmpeg completo com args;
   - stdout/stderr do FFmpeg;
   - resultado do `ffprobe` quando disponivel.
3. Valide localmente:

```bash
ffmpeg -version
ffprobe -version
npm run doctor:ffmpeg
```

4. Para reprocessar um unico job sem subir o loop completo:

```bash
npm run worker:once
```

O `doctor:ffmpeg` separa tres classes de problema:

- `PATH/env`: o shell nao acha `ffmpeg` ou `ffprobe`.
- `spawn blocked`: o shell acha o binario, mas o Node nao consegue abrir o processo filho.
- `render runtime`: o binario inicia, mas a geracao de MP4/WAV falha por comando, input ou output.

## Como testar upload

1. Rode `npm run dev:api`.
2. Rode `npm run dev:web`.
3. Abra `http://localhost:3000/assets`.
4. Selecione um arquivo no bloco `Upload Real`.
5. Preencha `category` e, se quiser, deixe `type` em `AUTO`.
6. Envie o arquivo.
7. Confira:
   - arquivo salvo em `storage/assets/{category}/{type}/`
   - registro criado na biblioteca
   - preview exibido por `GET /media/assets/:assetId`

Se quiser testar via Prisma de verdade, ative `DATA_BACKEND=prisma` antes do
upload para manter os registros apos reiniciar a API.

## Limitacoes atuais

- o upload multipart ainda e bufferizado em memoria antes de salvar no disco;
- o limite atual por upload e `250 MB`;
- duracao de video e audio ainda nao e detectada;
- preview por `assetId` so funciona para arquivos dentro de `storage/assets`;
- assets criados por path manual fora de `storage/assets` podem nao ter preview;
- em `memory`, o arquivo sobe para o disco, mas o catalogo nao persiste no reboot.
- projetos criados em fallback local da web ficam apenas na sessao atual;
- a timeline ainda nao possui waveform, trim visual ou preview composto por cena;
- presets cinematograficos ainda sao constantes mockadas, fora do banco;
- o Story Engine usa regras locais deterministicas, sem IA e sem aprendizado;
- o `create-from-script` ainda usa heuristicas simples de segmentacao; nao ha
  beat sheet manual nem refinamento semantico profundo;
- o smart picker de assets usa score deterministico local e pode repetir assets
  quando a biblioteca disponivel for pequena;
- o Caption Engine gera preview, analise e SRT/ASS, mas ainda nao desenha
  animacoes temporais palavra por palavra;
- a Render Engine V1 ainda usa composicao simples e placeholders quando o asset
  referenciado nao existe fisicamente em `storage/assets`;
- o Audio Engine agora aplica presets premium, compressor, limiter, loudnorm e
  ducking por FFmpeg quando o ambiente permite, mas ainda nao possui edicao por
  waveform nem automacao fina guiada por envelope visual;
- a Music Library estima BPM, beat markers e energia de forma aproximada; quando
  a confianca for baixa, o beat sync cai para grid ritmico seguro;
- a selecao automatica de musica e SFX depende da qualidade do metadata local e
  nunca inventa assets inexistentes;
- o `cinematic_v2` ainda trabalha com fades por cena, sem crossfade real entre
  segmentos;
- o `cinematic_v2` prioriza imagens e normalizacao segura de video, sem speed
  ramp, sem composicao multi-faixa avancada nem sound design procedural;
- o worker processa um job por vez, em loop simples, sem concorrencia de fila;
- cancelamento e retry ja existem, mas ainda nao ha politica automatica de
  retry, backoff, prioridade ou limpeza fisica de artefatos;
- `npm run worker:once` retorna erro quando nao ha job queued, o que e esperado
  para uso diagnostico;
- o FFmpeg depende da instalacao local da maquina;
- no sandbox do Codex, `doctor:ffmpeg`, `smoke:render-with-narration` e
  `smoke:premium-audio-render` podem ficar `skipped` por `spawn EPERM` mesmo
  com FFmpeg funcionando fora do app;
- o arquivo seedado referencia alguns assets mockados; sem upload real desses
  arquivos, o render recai para placeholders escuros e registra isso no log;
- conectores Wikipedia/Wikidata dependem de internet local e podem ficar
  indisponiveis sem afetar o fluxo manual;
- providers publicos do Media Collector dependem de internet local e, em alguns
  casos, de API key opcional; o fluxo `manual-url` e o smoke offline continuam
  funcionando sem rede;
- `internet-archive` permanece experimental e deve ser tratado como fonte de
  review manual reforcada;
- `fetch-url` aceita apenas HTML/texto publico simples; nao tenta atravessar
  login, paywall, DRM ou bloqueios editoriais;
- o Research Collector ainda nao faz matching automatico forte entre
  `ResearchAssetRequirement` e assets da biblioteca;
- a criacao de producao a partir do dossie ainda nao associa assets
  automaticamente, exceto quando `fulfilledAssetId` ja existir no requirement;
- a rota `/projects/[id]` depende de um projeto existente na API ou nos mocks
  iniciais para abrir fora da sessao local.

## Proximos passos recomendados

- Etapa 10I entregue: ComfyUI Workflow Packs + Image Quality Presets.
  - Catálogos locais em `packages/hybrid-visual-engine`.
  - Endpoints `GET /comfy-workflow-packs`, `GET /image-quality-presets` e
    `POST /comfy-workflow-packs/suggest`.
  - Geração visual aceita `workflowPackId`, `qualityPresetId`, `workflowId`,
    seed strategy e parâmetros de qualidade sem alterar o schema.
  - Smokes: `npm run smoke:workflow-packs` e
    `npm run smoke:comfy-workflow-pack:local`.
- Etapa 10F: operacao de fila para visual generation e render com prioridade,
  retries automaticos e cleanup controlado.
- Etapa 11C entregue: Premium Audio Studio Pipeline com presets de
  masterizacao, metadata de qualidade em `RenderJob` e smokes dedicados.
- Etapa 11F entregue: Music Library + Beat Sync Engine com perfis locais de
  trilha/SFX, pagina `/music-library`, auto-select no studio e blueprint
  ritmico por projeto.
- Etapa 11K.2 entregue: Asset Vault Builder + Search Missions com vaults por
  nicho, missoes de busca candidate-first, scoring, deduplicacao segura e gap
  analysis. Busca nunca importa arquivos automaticamente; candidatos precisam
  de revisao e confirmacao manual antes de virar `Asset`.
- Proximo foco: refinamento de overlays, transicoes reais e composicao
  multi-faixa visual.
- Evolucao futura do audio: automacao temporal mais fina, waveform tooling,
  mix por faixa mais editorial e sincronizacao musical mais precisa por analise
  offline mais rica.

## Principios desta base

- dominio antes de automacao pesada;
- intake local antes de render;
- fallback explicito para onboarding e desenvolvimento;
- separacao clara entre web, API, worker e packages;
- escalabilidade pensada para projetos, preview, jobs e export futuros.

## Documentacao principal

- [Vision](./docs/VISION.md)
- [Product Spec](./docs/PRODUCT_SPEC.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Modules](./docs/MODULES.md)
- [Codex Guide](./docs/CODEX_GUIDE.md)

