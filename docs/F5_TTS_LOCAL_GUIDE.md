# F5-TTS Local Guide

O ReelForge agora tem um provider opcional `f5-tts-local` para narração premium local. Ele fica desligado por padrão e não usa API externa.

## Quando usar

Use F5-TTS quando o `mock-tts` e o Windows SAPI não forem humanos o bastante para shorts finais. A ideia é gerar uma voz genérica, expressiva e local, sem clonagem e sem imitar pessoa real, celebridade, narrador conhecido ou personagem.

## Hardware esperado

Sua RTX com 12 GB de VRAM deve ser suficiente para testar F5-TTS com qualidade boa. O uso real depende do modelo, tamanho do texto e configuração PyTorch/CUDA. Espere alguns GB de download entre pacote, dependências e modelo/cache.

## Instalação recomendada fora do Git

Instale fora do repositório, por exemplo:

```powershell
cd "C:\Users\Pichau\Documents\New project"
mkdir reelforge-voice-lab
cd reelforge-voice-lab
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install f5-tts
```

Depois suba o servidor local do F5-TTS/Gradio:

```powershell
.\.venv\Scripts\f5-tts_infer-gradio.exe --host 127.0.0.1 --port 7860
```

Observação: o F5-TTS pode baixar modelos no primeiro uso. Mantenha esses caches fora do Git.

## Bridge local criado

Nesta maquina, o ambiente foi preparado fora do Git em:

```text
C:\Users\Pichau\Documents\New project\reelforge-voice-lab
```

Arquivos locais criados:

- `C:\Users\Pichau\Documents\New project\reelforge-voice-lab\.venv-py311`: venv Python 3.11 com F5-TTS.
- `C:\Users\Pichau\Documents\New project\reelforge-voice-lab\ffmpeg-8.1.2-full_build-shared`: FFmpeg full-shared exigido pelo TorchCodec.
- `C:\Users\Pichau\Documents\New project\reelforge-voice-lab\f5_bridge.py`: bridge FastAPI `/synthesize`.
- `C:\Users\Pichau\Documents\New project\reelforge-voice-lab\start-f5-bridge.ps1`: script para subir o bridge.

Para iniciar:

```powershell
& "C:\Users\Pichau\Documents\New project\reelforge-voice-lab\start-f5-bridge.ps1"
```

O provider `f5-tts-local` chama um endpoint local:

```text
POST http://127.0.0.1:7860/synthesize
```

O endpoint deve receber JSON com `text`, `language`, `voicePackId`, `seed` e retornar WAV direto (`audio/wav`) ou JSON com `wavBase64`, `audioBase64`, `outputPath` ou `audioUrl`.

Se o Gradio puro não expuser `/synthesize`, crie/rode um bridge local fino na frente do F5-TTS. A integração do ReelForge foi desenhada assim para não acoplar o produto a uma versão específica do Gradio.

## Variáveis da API

```powershell
$env:F5_TTS_ENABLED="true"
$env:F5_TTS_BASE_URL="http://127.0.0.1:7860"
$env:F5_TTS_TIMEOUT_MS="300000"
```

Também use as variáveis normais da API:

```powershell
$env:DATA_BACKEND="prisma"
npm run start --workspace @reelforge/api
```

## Smoke opcional

```powershell
npm run build --workspace @reelforge/narration-engine
$env:F5_TTS_ENABLED="true"
$env:F5_TTS_BASE_URL="http://127.0.0.1:7860"
npm run smoke:narration-f5-tts:local
```

Se `F5_TTS_ENABLED` não estiver ativo, o smoke pula com mensagem clara. Se o servidor local não responder ou não tiver `/synthesize`, ele falha mostrando o erro real do endpoint.

## Segurança de voz

- Sem clonagem de voz nesta etapa.
- Sem imitar pessoa real, celebridade, dublador, narrador famoso ou personagem.
- Use voice packs genéricos do ReelForge como direção de tom, não como identidade vocal.
