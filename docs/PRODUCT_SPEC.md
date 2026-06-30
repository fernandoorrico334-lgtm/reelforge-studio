# PRODUCT SPEC

## Resumo

ReelForge Studio sera uma plataforma local para receber assets diversos e transforma-los em videos verticais com narrativa, ritmo, captions premium e identidade cinematografica.

## Objetivo do produto

Criar um fluxo local e escalavel para sair de um conjunto de assets brutos ate um plano de video pronto para ser renderizado.

## Usuario inicial

- operador criativo;
- editor de conteudo short-form;
- time pequeno de marketing de performance;
- estudio enxuto que precisa repetir formatos com consistencia.

## Inputs previstos

- imagens;
- videos curtos;
- paginas de quadrinhos;
- artes estaticas;
- screenshots;
- audios e trilhas locais em fases futuras;
- metadados textuais do projeto.

## Outputs previstos

- projeto estruturado;
- manifest de assets;
- blueprint narrativo;
- plano cinematografico;
- plano de captions;
- render local 9:16 em fase futura.

## Escopo desta entrega

- estrutura de monorepo;
- apps e packages base;
- contratos de dominio;
- persistencia local com Prisma + SQLite;
- schema para canais, assets, projetos e cenas;
- tela inicial simples;
- API local simples;
- worker placeholder;
- documentacao de produto e arquitetura.

## Fora de escopo nesta entrega

- IA generativa ou de classificacao;
- renderizacao com FFmpeg;
- upload real com persistencia;
- autenticacao;
- scraping;
- integracoes externas.

## Requisitos funcionais futuros

- cadastrar e organizar projetos;
- armazenar assets localmente;
- classificar assets por tipo e funcao narrativa;
- montar story blueprint;
- escolher template;
- aplicar estrategias cinematograficas;
- preparar captions premium;
- enfileirar render local;
- exportar resultados em `storage/renders`.

## Requisitos nao funcionais

- arquitetura legivel e modular;
- isolamento entre dominio e infraestrutura;
- codigo pronto para crescer por workspaces;
- processamento previsivel em maquina local;
- documentacao suficiente para onboarding rapido.

## Criterios de sucesso desta fase

- qualquer colaborador entende a arquitetura em poucos minutos;
- a organizacao de pastas antecipa a direcao do produto;
- o projeto pode receber intake, FFmpeg e automacoes depois sem reestruturar tudo;
- os packages centrais ja expressam o vocabulario do dominio.

