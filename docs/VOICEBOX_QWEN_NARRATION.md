# Voicebox + Qwen Narration

Esta integracao e opcional e nao substitui o Chatterbox automaticamente. O objetivo e testar Qwen3-TTS com uma voz gravada e autorizada pelo proprio usuario, mantendo Story Director, Acting Director, QA e masterizacao do ReelForge.

## Uso da propria voz

Crie no Voicebox um perfil clonado com amostras limpas da sua propria voz e confirme o consentimento no perfil do ReelForge. Para aumentar a emocao sem trocar o timbre, grave amostras separadas para:

- neutral
- conversational
- mystery
- tension
- action
- reveal
- emotional
- cliffhanger

A API atual do Voicebox nao permite selecionar sample IDs individuais no POST /generate. Para controle emocional real com Qwen Base, use perfis Voicebox separados por estilo e mapeie esses IDs em voiceboxProfileIdsByStyle. O ReelForge escolhe o perfil compativel com cada bloco.

Qwen3-TTS Base clona a voz, mas nao aplica instrucoes naturais de atuacao no backend atual. O ReelForge compensa isso com referencias emocionais, texto dirigido, multiplos takes e selecao global. Qwen CustomVoice aceita instruct, mas usa vozes predefinidas e nao a voz clonada do usuario.

## Variaveis locais

- VOICEBOX_BASE_URL, default http://127.0.0.1:17493
- VOICEBOX_TIMEOUT_MS, default 300000
- VOICEBOX_PROFILE_ID, perfil autorizado usado no benchmark

Personality, efeitos e normalizacao do Voicebox permanecem desligados. A masterizacao final continua no ReelForge.

## Validacao

```powershell
npm run build --workspace @reelforge/media-beast
npm run smoke:voicebox-qwen-narration
npm run benchmark:tts-providers
```

O benchmark compara gancho, contexto, suspense, acao e cliffhanger. O provider padrao so pode mudar se a voz clonada vencer o Chatterbox em fidelidade, naturalidade, atuacao, continuidade e nomes criticos.

Os relatorios locais ficam em:

- tmp/tts-provider-benchmark.json
- tmp/tts-provider-contact-report.html

Nenhum audio pessoal ou WAV gerado deve ser versionado.

