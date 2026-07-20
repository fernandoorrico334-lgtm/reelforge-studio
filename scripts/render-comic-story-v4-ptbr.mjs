import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const workspaceRoot = dirname(root);
const voiceLab = join(workspaceRoot, "reelforge-voice-lab");
const pageDir = join(root, "storage/assets/comics/godzilla-kong-final-short-issue-01/.extract/pages");
const outputDir = join(root, "storage/renders/comic-compressed-story", `godzilla-v4-ptbr-${Date.now()}`);
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
const python = process.env.CHATTERBOX_PYTHON || join(voiceLab, ".venv-xtts/Scripts/python.exe");
const qaPython = process.env.NARRATION_QA_PYTHON || join(voiceLab, ".venv-py311/Scripts/python.exe");
const chatterboxSource = process.env.CHATTERBOX_PTBR_SOURCE || join(voiceLab, "chatterbox-ptbr-space/chatterbox/src");
const referenceAudio = process.env.CHATTERBOX_PTBR_REFERENCE || join(voiceLab, "voice-references/faber-narrator-ptbr.wav");

const beats = [
  {
    pages: ["004.jpg", "005.jpg", "006.jpg"],
    spokenText: "Doze horas antes de Godz\u00edla chegar, o Super-Homem preparava o pedido de casamento. Mas o monstro Kong apareceu, e Lex aproveitou o caos.",
    caption: "DOZE HORAS ANTES...",
  },
  {
    pages: ["010.jpg", "011.jpg"],
    spokenText: "Enquanto a Liga protegia Metr\u00f3polis, os vil\u00f5es invadiram a Fortaleza da Solid\u00e3o.",
    caption: "LEX QUERIA\nAPAGAR A LIGA",
  },
  {
    pages: ["012.jpg", "013.jpg"],
    spokenText: "Ali, roubaram uma Caixa Materna para mandar os her\u00f3is \u00e0 Zona Fantasma.",
    caption: "A CAIXA MATERNA\nERA A ARMA",
  },
  {
    pages: ["016.jpg", "017.jpg", "018.jpg"],
    spokenText: "O alarme disparou. Mulher-Maravilha, Kara e o Flash chegaram. A Fortaleza virou um campo de batalha.",
    caption: "A LIGA CHEGOU\nANTES DA FUGA",
  },
  {
    pages: ["019.jpg", "020.jpg"],
    spokenText: "Um golpe atingiu a Caixa. O portal se abriu e arrastou os vil\u00f5es para outro mundo.",
    caption: "UM GOLPE ABRIU\nO PORTAL",
  },
  {
    pages: ["022.jpg", "023.jpg", "024.jpg", "025.jpg"],
    spokenText: "Eles ca\u00edram na Ilha da Caveira, enfrentaram criaturas de Kong e descobriram que os Tit\u00e3s eram reais.",
    caption: "ELES CA\u00cdRAM NA\nILHA DA CAVEIRA",
  },
  {
    pages: ["026.jpg", "027.jpg"],
    spokenText: "Ent\u00e3o decidiram enviar os monstros de volta, direto contra a Liga.",
    caption: "UM PLANO\nAINDA PIOR",
  },
  {
    pages: ["028.jpg", "029.jpg", "030.jpg"],
    spokenText: "Em Metr\u00f3polis, Clark pediu Lo\u00eds em casamento. Antes da resposta, a cidade tremeu. O Super-Homem encontrou Godz\u00edla. O primeiro golpe fica para a parte dois.",
    caption: "SUPERMAN CONTRA GODZILLA\nCONTINUA NA PARTE 2",
  },
];

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolvePromise({ stdout, stderr })
      : reject(new Error(`${command} exited ${code}\n${stderr.slice(-8000)}`)));
  });
}

async function getDuration(path) {
  const result = await run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]);
  return Number(result.stdout.trim());
}

function assTime(seconds) {
  const value = Math.max(0, Math.round(seconds * 100));
  return `${Math.floor(value / 360000)}:${String(Math.floor((value % 360000) / 6000)).padStart(2, "0")}:${String(Math.floor((value % 6000) / 100)).padStart(2, "0")}.${String(value % 100).padStart(2, "0")}`;
}

async function synthesizeNarration() {
  const manifestPath = join(outputDir, "narration-manifest.json");
  await writeFile(manifestPath, JSON.stringify({ beats: beats.map((beat, index) => ({ ...beat, seed: 2400 + index })) }, null, 2), "utf8");
  await run(python, [
    join(root, "scripts/generate-chatterbox-ptbr.py"),
    "--manifest", manifestPath,
    "--output-dir", outputDir,
    "--reference-audio", referenceAudio,
    "--source-dir", chatterboxSource,
  ], { env: { ...process.env, HF_HUB_DISABLE_PROGRESS_BARS: "1", PYTHONUTF8: "1" } });

  const rawPaths = beats.map((_, index) => join(outputDir, `narration-${String(index).padStart(2, "0")}.wav`));
  const rawDurations = await Promise.all(rawPaths.map(getDuration));
  const rawTotal = rawDurations.reduce((sum, duration) => sum + duration, 0);
  const paceRatio = rawTotal > 55.5 ? Math.min(rawTotal / 55.5, 1.22) : 1;
  const processed = [];

  for (let index = 0; index < rawPaths.length; index += 1) {
    const output = join(outputDir, `narration-ready-${String(index).padStart(2, "0")}.wav`);
    const filters = [
      "highpass=f=70",
      "lowpass=f=15000",
      paceRatio > 1 ? `atempo=${paceRatio.toFixed(5)}` : null,
      "acompressor=threshold=-20dB:ratio=2.2:attack=12:release=160",
    ].filter(Boolean).join(",");
    await run(ffmpeg, ["-y", "-i", rawPaths[index], "-af", filters, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", output]);
    beats[index].durationSeconds = await getDuration(output);
    processed.push(output);
  }

  const list = join(outputDir, "narration-parts.txt");
  await writeFile(list, processed.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
  const output = join(outputDir, "narration.wav");
  await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", list, "-af", "loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", output]);
  return { output, rawTotal, paceRatio };
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const narration = await synthesizeNarration();
  const narrationDuration = await getDuration(narration.output);
  if (narrationDuration > 59) throw new Error(`Narration exceeds Shorts limit: ${narrationDuration.toFixed(2)}s`);
  const narrationQaPath = join(outputDir, "narration-qa.json");
  await run(qaPython, [
    join(root, "scripts/qa-chatterbox-narration.py"),
    "--audio", narration.output,
    "--manifest", join(outputDir, "narration-manifest.json"),
    "--output", narrationQaPath,
    "--model", process.env.WHISPER_MODEL_PATH || "base",
    "--threshold", "0.80",
  ], { env: { ...process.env, PYTHONUTF8: "1" } });
  const narrationQa = JSON.parse(await readFile(narrationQaPath, "utf8"));

  const schedule = beats.flatMap((beat) => beat.pages.map((page) => ({ page, duration: beat.durationSeconds / beat.pages.length })));
  const segments = [];
  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];
    const input = join(pageDir, item.page);
    await readFile(input);
    const output = join(outputDir, `segment-${String(index).padStart(2, "0")}.mp4`);
    const frames = Math.max(2, Math.ceil(item.duration * 30));
    const zoom = index % 2 === 0 ? "1+0.0010*on" : "1.09-0.0008*on";
    const y = index % 3 === 0 ? "0" : index % 3 === 1 ? "(ih-ih/zoom)/2" : "ih-ih/zoom";
    const filter = `scale=1400:-2,zoompan=z='${zoom}':x='(iw-iw/zoom)/2':y='${y}':d=${frames}:s=1080x1920:fps=30,eq=contrast=1.05:saturation=1.08,fade=t=in:st=0:d=0.08,fade=t=out:st=${Math.max(0.2, item.duration - 0.08).toFixed(3)}:d=0.08,format=yuv420p`;
    await run(ffmpeg, ["-y", "-loop", "1", "-i", input, "-t", item.duration.toFixed(3), "-vf", filter, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", output]);
    segments.push(output);
  }

  const segmentList = join(outputDir, "segments.txt");
  await writeFile(segmentList, segments.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
  const visualsPath = join(outputDir, "visuals.mp4");
  await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", segmentList, "-c", "copy", visualsPath]);

  let cursor = 0;
  const events = beats.map((beat, index) => {
    const start = cursor;
    cursor += beat.durationSeconds;
    const color = index === beats.length - 1 ? "&H0033CCFF" : "&H00FFFFFF";
    return `Dialogue: 0,${assTime(start)},${assTime(cursor)},Impact,,0,0,0,,{\\c${color}\\fad(80,80)\\t(0,160,\\fscx104\\fscy104)}${beat.caption.replaceAll("\n", "\\N")}`;
  });
  const assPath = join(outputDir, "captions.ass");
  await writeFile(assPath, `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Impact,Arial,44,&H00FFFFFF,&H0000FFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,4,1,2,140,140,280,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${events.join("\n")}\n`, "utf8");

  const outputPath = join(outputDir, "output.mp4");
  const escapedAss = assPath.replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'");
  await run(ffmpeg, ["-y", "-i", visualsPath, "-i", narration.output, "-vf", `ass='${escapedAss}'`, "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart", outputPath]);
  const finalDuration = await getDuration(outputPath);
  const repeatedPages = schedule.length - new Set(schedule.map((entry) => entry.page)).size;
  const wordCount = beats.reduce((count, beat) => count + beat.spokenText.split(/\s+/).length, 0);
  const report = {
    outputPath,
    durationSeconds: Number(finalDuration.toFixed(3)),
    pageRange: "004-030",
    visualMomentCount: schedule.length,
    repeatedPages,
    narrationProvider: "chatterbox-ptbr-local",
    narrationReference: "piper-faber-ptbr-cc0",
    narrationVoiceProfile: "faber_cinematic_ptbr",
    narrationVoiceModelLicense: "CC0-1.0",
    narrationSynthesizerLicense: "MIT",
    narrationChunks: beats.length,
    narrationWordCount: wordCount,
    narrationWordsPerMinute: Number((wordCount / finalDuration * 60).toFixed(1)),
    narrationWordSimilarity: narrationQa.wordSimilarity,
    narrationQaPassed: narrationQa.passed,
    rawNarrationDurationSeconds: Number(narration.rawTotal.toFixed(3)),
    paceRatio: Number(narration.paceRatio.toFixed(4)),
    audioTargetLufs: -16,
    audioTruePeakDb: -1.5,
    audioSampleRate: 48000,
    language: "pt-BR",
    cliffhanger: true,
    shortsLimitPassed: finalDuration <= 59,
    status: finalDuration <= 59 && repeatedPages === 0 ? "completed" : "failed",
  };
  await writeFile(join(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "completed") process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

