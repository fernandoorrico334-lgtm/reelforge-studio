# CODEX GUIDE

## Objetivo deste guia

Ajudar qualquer futura sessao do Codex a expandir ReelForge Studio sem quebrar a direcao arquitetural desta fundacao.

## Regras de colaboracao

- ler `README.md` e os docs antes de introduzir novas camadas;
- respeitar o limite desta fase quando a tarefa pedir apenas fundacao;
- preferir evolucoes pequenas e verificaveis;
- atualizar docs quando a arquitetura mudar de verdade.

## Regras de implementacao

- manter logica de dominio nos packages sempre que possivel;
- evitar colocar regras permanentes dentro de componentes React;
- evitar acoplar API e worker diretamente a detalhes de render;
- preservar `storage/assets` e `storage/renders` como fronteiras operacionais locais;
- manter `schema.prisma`, seed, migrations e SQLite dentro de `prisma/`;
- manter o client compartilhado em `apps/api/src/infrastructure/database`;
- manter `packages/caption-engine`, `packages/templates` e
  `packages/video-engine` como fontes unicas das regras criativas locais;
- manter `packages/audio-engine` como fonte unica das regras de mixagem local;
- quando tocar em presets premium, importar `@reelforge/audio-engine/mastering`
  em vez de misturar catalogos diretamente em apps;
- manter `packages/narration-engine` como fonte unica das regras de narracao
  local;
- manter `packages/research-collector` como fonte unica das heuristicas de
  busca assistida, facts, timeline e outline de pesquisa;
- manter `packages/story-engine` como fonte unica do `create-from-script`,
  smart picker e checklist de producao;
- manter `@reelforge/video-engine` browser-safe e reservar
  `@reelforge/video-engine/render-server` para API/worker;
- nao importar `@reelforge/narration-engine` diretamente dentro do bundle do
  frontend; quando o web precisar fallback local, usar tipos/constantes
  browser-safe e deixar a logica Node-only no package server-side;
- manter o FFmpeg encapsulado no worker e nos adapters server-side.
- manter `storage/inbox` como fronteira de intake manual e nunca versionar
  arquivos reais do usuario colocados ali;
- ao tocar em `MediaCollection` e `MediaCandidate`, preservar a ideia de
  revisao humana antes da promocao para `Asset`;
- nao mover, apagar ou sobrescrever originais do inbox sem pedido explicito;
- preservar `tsconfig.dev.json` em `apps/api` e `apps/worker` como caminho
  source-first para runtimes locais com `tsx watch`, sem quebrar os builds
  normais do monorepo;
- preferir validar mudancas de render com `npm run smoke:render` e
  `npm run smoke:render:cinematic`, `npm run smoke:render:audio` e
  `npm run smoke:production` antes de abrir varias frentes manuais ao mesmo
  tempo;
- preferir validar mudancas de intake com `npm run smoke:intake` antes de
  revisar a UI manualmente;
- preservar `worker:once` como caminho minimo para diagnostico reprodutivel.
- ao tocar em `RenderJob`, preservar semantica de status, checkpoints de
  cancelamento e `attempt` de retry;
- ao tocar em modos de render, preservar `v1` como fallback estavel e nao
  acoplar `cinematic_v2` ao frontend diretamente;
- ao tocar em audio, preservar o comportamento sem soundtrack como caminho
  valido e nao quebrar renders mudos;
- ao tocar no app web, manter o polling de render ativo apenas quando houver
  jobs `queued` ou `processing`.
- ao tocar em `Channel`, tratar defaults como identidade editorial de producao,
  nao como simples placeholders de formulario;
- ao tocar em `apply-channel-defaults`, nao sobrescrever escolhas manuais que
  ja existirem no projeto ou nas cenas;
- ao tocar em `create-from-script`, manter o fluxo 100% deterministico e sem
  qualquer dependencia externa.
- ao tocar em `research`, preservar a regra de Google apenas como query/link
  assistido, sem scraping de resultados.
- ao tocar em `media-collector`, preservar a regra de download apenas de fontes
  autorizadas, URLs diretas revisadas e APIs oficiais opcionais.
- ao tocar em providers do Media Collector, bloquear HTML, extensoes
  perigosas, redirects suspeitos e qualquer tentativa de coletor massivo da web.
- ao tocar em fontes publicas, nao burlar login, paywall, DRM, robots ou
  bloqueios equivalentes.
- ao tocar em true crime/documentario, preservar `safetyNotes`, separar
  alegacao de fato confirmado e evitar linguagem glorificante.

## Ordem de leitura recomendada para novas tarefas

1. `docs/VISION.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/MODULES.md`
5. `docs/ROADMAP.md`

## Convencoes recomendadas

- criar novos modulos com nomes do dominio, nao nomes genericos;
- usar interfaces para isolar infraestrutura;
- manter packages independentes de Next.js e de HTTP;
- pensar primeiro em contratos e depois em adaptadores.

## O que nao fazer sem pedido explicito

- adicionar IA;
- adicionar login;
- adicionar scraping;
- integrar APIs externas;
- baixar assets da internet;
- transformar conectores abertos de pesquisa em crawler agressivo;
- promover candidatos de intake direto para render sem passarem por `Asset`;
- importar modulos Node-only de render dentro do frontend.

## Proxima iteracao ideal

A proxima iteracao mais segura e aprofundar a fila operacional que sucede a
Etapa 10E e conectar melhor research, intake, media collector, personagens e
producao sem quebrar as fronteiras atuais, preservando:

- composicao local e deterministica;
- separacao entre catalogos criativos e pipeline de render;
- defaults editoriais por canal como fonte de consistencia;
- fallback da web quando a API nao estiver disponivel;
- render jobs como responsabilidade da API + worker, nunca do Next.js.
- Research Collector como camada editorial, nao como automacao cega de coleta.
- Media Collector como camada de review e importacao segura, nao como crawler
  agressivo.
- Character Profiles como contrato editorial reutilizavel, nao como upload
  solto sem contexto.
- Hybrid Visual Engine como camada de planejamento/continuidade, nao como
  dependencia obrigatoria de render para cada cena.

## Smoke test recomendado

Ao tocar no Render V1, a sequencia mais segura agora e:

1. `npm run db:generate`
2. `npm run db:migrate:dev`
3. `npm run db:seed`
4. `npm run smoke:render`
5. `npm run smoke:render:cinematic`
6. `npm run smoke:render:audio`
7. `npm run smoke:production`

Ao tocar no Manual Intake, a sequencia minima passa a ser:

1. `npm run db:generate`
2. `npm run db:migrate:dev`
3. `npm run db:seed`
4. `npm run smoke:intake`
5. validar `/intake` e `/assets`

Ao tocar no Research Collector, a sequencia minima passa a ser:

1. `npm run db:generate`
2. `npm run db:migrate:dev`
3. `npm run db:seed`
4. `npm run smoke:research`
5. validar `/research`
6. validar `/research/[id]`

Ao tocar em personagens ou no Hybrid Visual Engine, a sequencia minima passa a
ser:

1. `npm run db:generate`
2. `npm run db:migrate:dev`
3. `npm run db:seed`
4. `npm run smoke:hybrid-visual`
5. validar `/characters`
6. validar `/projects/[id]`
7. validar `/research/[id]`

Ao tocar no Local Narration Pipeline, a sequencia minima passa a ser:

1. `npm run db:generate`
2. `npm run db:migrate:dev`
3. `npm run db:seed`
4. `npm run smoke:narration-engine`
5. validar `/generated-audio`
6. validar `/projects/[id]`
7. validar `/prompt-lab`

Ao tocar no Premium Audio Studio Pipeline, a sequencia minima passa a ser:

1. `npm run db:generate`
2. `npm run db:migrate:dev`
3. `npm run build`
4. `npm run typecheck`
5. `npm run doctor:ffmpeg`
6. `npm run smoke:audio-mastering-presets`
7. `npm run smoke:narration-engine`
8. `npm run smoke:narration-render-plan`
9. se o ambiente permitir spawn: `npm run smoke:render-with-narration`
10. se o ambiente permitir spawn: `npm run smoke:premium-audio-render`

Ao tocar no Media Collector, a sequencia minima passa a ser:

1. `npm run db:generate`
2. `npm run db:migrate:dev`
3. `npm run db:seed`
4. `npm run smoke:media-collector`
5. validar `/media-collector`
6. validar integracoes em `/research/[id]` e `/projects/[id]`

Se o smoke falhar:

- abrir o `render.log` do job;
- conferir se o `renderMode` persistido bate com o esperado;
- conferir se o `audio-plan` e os assets de audio resolvidos batem com o
  esperado quando o projeto tiver soundtrack;
- conferir se `thumbnail.jpg` foi gerado e se o `RenderJob` recebeu metadata;
- conferir se `hasAudio`, `audioCodec`, `audioChannels` e `audioSampleRate`
  foram persistidos quando houver audio;
- confirmar `ffmpeg -version` e `ffprobe -version`;
- se necessario, definir `FFMPEG_PATH` e `FFPROBE_PATH` sem hardcode pessoal;
- rodar `npm run doctor:ffmpeg` para distinguir PATH ausente de bloqueio de `child_process.spawn`;
- lembrar que o sandbox do Codex pode marcar os smokes de render premium como
  `skipped` por `spawn EPERM` mesmo quando o mesmo comando funciona num terminal
  Windows normal/elevado;
- rerodar um unico job com `npm run worker:once` quando precisar isolar o
  problema do loop do worker.

## Checklist operacional de render

Quando a tarefa tocar em fila, status ou media final, validar sempre:

1. `GET /render-jobs` retornando `currentStep`, `progress`, URLs e metadata.
2. `POST /render-jobs/:id/cancel` interrompendo o job no proximo checkpoint.
3. `POST /render-jobs/:id/retry` criando novo job com `attempt` incrementado.
4. `GET /media/renders/:id/thumbnail` servindo a miniatura do job concluido.
5. `GET /video-projects/:id/audio-plan` refletindo soundtrack, voz e SFX do
   projeto.

## Checklist operacional de producao

Quando a tarefa tocar em wizard, defaults de canal ou criacao automatica de
cenas, validar sempre:

1. `POST /production/create-from-script` criando projeto e cenas sem usar IA.
2. `GET /video-projects/:id/production-checklist` refletindo warnings e
   `readyToRender`.
3. `GET /video-projects/:id/asset-suggestions` devolvendo score e motivos por
   cena.
4. `POST /video-projects/:id/apply-channel-defaults` preservando escolhas
   manuais existentes.
5. `/produce` redirecionando para `/projects/[id]` quando a API estiver ativa.

## Checklist operacional de research

Quando a tarefa tocar em dossie, fontes ou create-production, validar sempre:

1. `POST /research/dossiers/:id/generate-search-queries` retornando queries e
   links assistidos, sem scraping do Google.
2. `POST /research/dossiers/:id/sources/manual` criando fonte revisavel.
3. `POST /research/dossiers/:id/analyze` gerando facts, timeline, hooks,
   outline e asset requirements.
4. `POST /research/dossiers/:id/create-production` abrindo um `VideoProject`
   valido sem renderizar automaticamente.
5. `/research/[id]` refletindo warnings, `safetyNotes` e papel editorial do
   dossie.

## Checklist operacional de media collector

Quando a tarefa tocar em busca, review ou importacao de midia autorizada,
validar sempre:

1. `GET /media-collector/providers` refletindo providers disponiveis e status
   de API key.
2. `POST /media-collections` criando colecao com provider, query e media type.
3. `POST /media-collections/:id/search` criando `MediaCandidate` sem duplicar
   entradas obvias.
4. `POST /media-candidates/:id/approve` e `POST /media-candidates/:id/reject`
   alterando a fila de review corretamente.
5. `POST /media-collections/:id/import-approved` criando `Asset` com metadata
   de origem preenchida.
6. `POST /research/asset-requirements/:id/create-media-collection` ligando
   requirement e collection.
7. `POST /video-projects/:id/create-media-collection-for-missing-assets`
   gerando colecoes quando houver cenas sem asset.

## Checklist operacional de intake

Quando a tarefa tocar em inbox, revisao ou importacao manual, validar sempre:

1. `GET /intake/folders` refletindo a estrutura local do inbox.
2. `POST /intake/scan` criando `MediaCollection` e `MediaCandidate`.
3. `GET /intake/candidates` devolvendo status e metadata inferida.
4. `GET /media/candidates/:id/preview` servindo o original com seguranca.
5. `POST /intake/import-approved` criando `Asset` com
   `sourceProvider=manual-intake`.

## Checklist operacional de workflow packs

Quando a tarefa tocar em ComfyUI packs, qualidade de imagem ou Prompt Lab:

1. `GET /comfy-workflow-packs` deve retornar 10 packs.
2. `GET /image-quality-presets` deve retornar `draft`, `standard` e `high`.
3. `POST /comfy-workflow-packs/suggest` deve sugerir pack por cena, canal,
   template, nicho ou requirement.
4. `POST /scenes/:id/generate-visual` deve aceitar `workflowPackId`,
   `qualityPresetId`, `workflowId`, `seedMode`, `steps`, `cfg`, `sampler`,
   `scheduler` e `denoise`.
5. `VisualGenerationJob.metadata` deve registrar `workflowPackId`,
   `qualityPresetId`, `workflowOrigin`, `appliedParameters` e
   `ignoredParameters`.
6. Rodar `npm run smoke:workflow-packs` antes de depender de ComfyUI real.
7. Rodar `npm run smoke:comfy-workflow-pack:local` apenas quando
   `COMFYUI_ENABLED=true` e o servidor local estiver pronto.

