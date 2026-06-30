# Web Contracts Recovery

## Scope

- Workspace alvo: `C:\Users\Pichau\Documents\New project\reelforge-studio-recovered`
- Arquivos foco:
  - `apps/web/src/lib/studio-types.ts`
  - `apps/web/src/lib/studio-api.ts`

## Backup interno

- Backup criado em `recovery/backups/web-contracts/`
- Arquivos preservados:
  - `studio-types.ts.bak`
  - `studio-api.ts.bak`

## Comparacao das fontes recuperadas

### `studio-types.ts`

- `studio-types.ts.reconstructed.txt` parece incompleto para o estagio 10.x.
- Ele e identico ao arquivo atual e para antes de contracts de:
  - render jobs completos
  - defaults operacionais de canal
  - prompt engine
  - intake / media collector
  - research collector
  - hybrid visual / characters
- `studio-types.ts.from-get-content.txt` parece muito mais completo.
- Evidencias encontradas nele:
  - `CharacterProfile`, `CharacterReference`
  - `MediaCollection`, `MediaCandidate`
  - `ResearchDossier`, `ResearchDossierDetail`
  - `VisualGenerationJob`
  - `StudioRenderJob`
  - `renderModes`, `renderQualities`
  - contracts de prompt packs, comfy status e audio plan

### `studio-api.ts`

- `studio-api.ts.reconstructed.txt` tambem e identico ao arquivo atual.
- Ele cobre apenas CRUD inicial de channels/assets/projects/scenes e snapshots basicos.
- `studio-api.ts.from-get-content.txt` e a melhor base recuperada.
- Evidencias encontradas nele:
  - resolucao SSR/client com `REELFORGE_API_BASE_URL` e `NEXT_PUBLIC_API_BASE_URL`
  - fallback para mocks com log do motivo
  - snapshots de channels, assets, characters, intake, media collector, projects, research e renders
  - CRUDs avancados para characters, research, intake, media collector, render jobs e hybrid visual

## Trechos ausentes ou ainda suspeitos

### Tipos

- Ainda precisam ser verificados apos restauracao:
  - aliases nominais esperados pela UI, como `PromptPack` e `ComfyProviderStatus`
  - compatibilidade fina de payloads usados por componentes de Prompt Lab e Render panel
  - compatibilidade entre `DashboardSnapshot.sources` e `renders`

### Endpoints/helpers

- A base `from-get-content` ainda aparenta nao expor todos os wrappers esperados pelas telas atuais.
- Ausencias provaveis observadas no typecheck atual:
  - `getPromptPacksSnapshot`
  - `getNegativePromptPacksSnapshot`
  - `getVisualGenerationProvidersSnapshot`
  - wrappers de story/caption/audio/render blueprint se a tela usar snapshots locais
  - validacoes ComfyUI (`status`, `test`, `workflow`) com nomes finais usados no Web

## Tipos e endpoints ja identificados como necessarios

- Base:
  - Channel, Asset, VideoProject, Scene, RenderJob
- Engines:
  - Caption, Template, Story, Render Blueprint, Audio Plan, Production Checklist, Asset Suggestions
- Intake / Media Collector:
  - folders, collections, candidates, providers, import responses
- Research:
  - dossiers, sources, facts, timeline, hooks, requirements, outline
- Characters / Hybrid Visual:
  - profiles, references, visual jobs, providers, missing visual report
- Prompt Engine:
  - prompt packs, negative packs, prompt build, variants, quality

## Confianca de recuperacao

- `studio-types.ts`: alta
  - A versao `from-get-content` parece rica e estruturalmente coerente com o resto do Web.
- `studio-api.ts`: media-alta
  - A versao `from-get-content` cobre grande parte da contract layer, mas deve exigir alguns wrappers nominais extras para casar com as telas atuais.

## Proximo passo operacional

1. Restaurar `studio-types.ts` e `studio-api.ts` usando `from-get-content.txt` como base.
2. Ajustar aliases/export names ausentes sem reescrever telas grandes.
3. Corrigir `apps/web/tsconfig.json` para apontar para `src` dos packages, evitando dependencia de `dist`.
4. Rodar `npm run typecheck --workspace @reelforge/web`.
5. Registrar erros restantes em `recovery/reports/web-typecheck-errors.md`.
