# Etapa 10I: ComfyUI Workflow Packs + Image Quality Presets

## Objetivo

Melhorar a qualidade das imagens geradas pelo ComfyUI local usando presets de workflow e prompt por nicho. A etapa deve manter o fluxo local e deterministico do ReelForge, permitindo escolher combinações seguras de prompt pack, negative prompt, workflow, resolução, seed strategy e notas de estilo para cada tipo de canal, cena ou personagem.

## Principios

- Continuar funcionando sem APIs externas.
- Preservar `mock-svg` e `mock-png` como fallback offline.
- Tratar workflows do ComfyUI como contratos versionados e auditaveis.
- Permitir overrides locais em `storage/comfyui/workflows` sem versionar workflows pessoais.
- Evitar trocar schema ou migrations ate a necessidade estar clara.
- Registrar erros reais do ComfyUI para diagnostico de workflow, modelo e output.

## Workflow Packs Propostos

| Pack | Prompt pack sugerido | Negative prompt sugerido | Workflow recomendado | Resolucao padrao | Seed strategy | Style notes | Quando usar | Limitacoes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `anime_dark` | `anime_lore` | `clean_anime` | `txt2img-zimage-anime` | `1080x1920` | `scene-stable` | Contraste alto, rim light, olhos expressivos, fundo atmosferico. | Lore de anime, personagens sombrios, cliffhangers. | Pode exagerar anatomia e detalhes de cabelo se o negative prompt for fraco. |
| `comic_drama` | `comic_panel` | `clean_comic` | `txt2img-zimage-comic` | `1080x1920` | `scene-stable` | Composição de capa, linhas fortes, textura de papel, drama editorial. | HQs comentadas, origem de personagens, arcos dramaticos. | Risco de texto falso em balões ou logos inventados. |
| `true_crime_doc` | `true_crime_doc` | `clean_documentary` | `txt2img-zimage-documentary` | `1080x1920` | `project-seeded` | Luz fria, evidencias, quadro investigativo, realismo contido. | Casos, dossies, narrativa policial ou investigativa. | Deve evitar gore, sensacionalismo e rostos realistas de pessoas reais. |
| `mystery_doc` | `mystery_doc` | `clean_documentary` | `txt2img-basic` | `1080x1920` | `scene-stable` | Teal noir, neblina, arquivos, mapas, pistas e profundidade cinematica. | Curiosidades sombrias, enigmas, arquivos secretos. | Pode ficar repetitivo se todos os takes usarem a mesma composição. |
| `history_dark` | `history_dark` | `clean_documentary` | `txt2img-zimage-history` | `1080x1920` | `project-seeded` | Luz de museu, pergaminho, artefatos, poeira, drama historico. | Historia, conflitos antigos, eventos obscuros. | Risco de anacronismos visuais e simbolos incorretos. |
| `sports_hype` | `sports_hype` | `clean_action` | `txt2img-zimage-action` | `1080x1920` | `random-per-generation` | Motion blur controlado, estadio, energia, contrastes de transmissao. | Reels esportivos, ranking, rivalidades, momentos de virada. | Pode gerar uniformes/logos ficticios ou marcas indesejadas. |
| `game_epic` | `game_epic` | `clean_game` | `txt2img-zimage-epic` | `1080x1920` | `scene-stable` | Key art, escala heroica, luz volumetrica, ambiente fantastico. | Games, builds, lore, chefes, mapas e batalhas. | Pode parecer fantasia generica se faltar contexto visual especifico. |
| `cinematic_story` | `cinematic_story` | `clean_cinematic` | `txt2img-zimage-cinematic` | `1080x1920` | `project-seeded` | Fotografia de cinema, lente, bloqueio de cena, cor narrativa. | Cenas narrativas originais, projetos com personagem recorrente. | Requer bons prompts de continuidade para manter personagem consistente. |
| `horror_tension` | `horror_tension` | `clean_horror` | `txt2img-zimage-horror` | `1080x1920` | `scene-stable` | Sombra, silhueta, neblina, low key, tensão sem gore explicito. | Horror, suspense, creepypasta, relatos sombrios. | Pode escurecer demais a imagem e perder leitura mobile. |
| `documentary_clean` | `documentary_clean` | `clean_documentary` | `txt2img-zimage-documentary` | `1080x1920` | `project-seeded` | Entrevista, arquivo, textura realista, composição clara. | Explicadores, docs, fatos, analise editorial. | Pode ficar visualmente neutro se não houver gancho narrativo forte. |

## Contratos de Cada Pack

Cada pack deve definir:

- `id`: identificador estavel usado pela API e UI.
- `name`: nome curto exibido para o usuario.
- `promptPackId`: prompt pack recomendado.
- `negativePromptPackId`: negative prompt recomendado.
- `workflowTemplate`: workflow recomendado.
- `defaultResolution`: largura e altura padrão.
- `seedStrategy`: `scene-stable`, `project-seeded` ou `random-per-generation`.
- `styleNotes`: diretrizes visuais para prompt preview e UI.
- `recommendedUse`: quando aplicar o pack.
- `limitations`: riscos conhecidos do pack.

## Melhorias Futuras

- Mostrar `generatedAssetId` na UI da cena e no detalhe do asset.
- Adicionar botão “Usar imagem gerada no render”.
- Comparar `mock-svg`/`mock-png` versus ComfyUI real lado a lado.
- Mostrar histórico de gerações por cena.
- Selecionar workflow por cena, personagem ou canal.
- Avaliar qualidade da imagem gerada com checklist local: resolução, proporção, tamanho, provider, nitidez percebida e presença de asset efetivo.
- Exibir origem do workflow: package versionado, override local ou workflow pessoal.
- Criar presets de qualidade: `draft`, `standard`, `high`, com steps, cfg e resolução.
- Adicionar aviso quando o workflow exigir modelos ausentes.

## Ordem Recomendada

1. Criar constantes TypeScript dos workflow packs em `packages/hybrid-visual-engine`.
2. Expor endpoint de leitura para listar packs disponiveis.
3. Adicionar seleção de pack na UI de projeto/cena, sem persistir no banco inicialmente.
4. Aplicar pack no prompt preview e na chamada de geração.
5. Adicionar comparação visual entre mock e ComfyUI real.
6. Só depois avaliar persistencia no Prisma se o uso real pedir histórico ou defaults por canal.
