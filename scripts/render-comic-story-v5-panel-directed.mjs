import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { buildComicPanelShotPlan } from "../packages/media-beast/dist/index.js";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const workspaceRoot = dirname(root);
const voiceLab = join(workspaceRoot, "reelforge-voice-lab");
const pageDir = join(root, "storage/assets/comics/godzilla-kong-final-short-issue-01/.extract/pages");
const outputDir = join(root, "storage/renders/comic-compressed-story", `godzilla-v5-panel-directed-${Date.now()}`);
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
const python = process.env.CHATTERBOX_PYTHON || join(voiceLab, ".venv-xtts/Scripts/python.exe");
const detectorPython = process.env.COMIC_VISION_PYTHON || join(voiceLab, ".venv-piper/Scripts/python.exe");
const qaPython = process.env.NARRATION_QA_PYTHON || join(voiceLab, ".venv-py311/Scripts/python.exe");
const chatterboxSource = process.env.CHATTERBOX_PTBR_SOURCE || join(voiceLab, "chatterbox-ptbr-space/chatterbox/src");
const referenceAudio = process.env.CHATTERBOX_PTBR_REFERENCE || join(voiceLab, "voice-references/faber-narrator-ptbr.wav");

const beats = [
  {
    pages: ["004.jpg", "005.jpg", "006.jpg"],
    role: "hook",
    hasDialogue: true,
    spokenText: "O Super-Homem encontrou Godzila. Mas, doze horas antes, tudo começou com um pedido de casamento. Quando Kong apareceu, Lex aproveitou o caos.",
    headline: "SUPERMAN ENCONTROU GODZILLA",
  },
  {
    pages: ["010.jpg", "011.jpg"],
    role: "setup",
    hasDialogue: true,
    spokenText: "Enquanto a Liga protegia Metrópolis, os vilões invadiram a Fortaleza da Solidão.",
    headline: "A INVASÃO COMEÇOU",
  },
  {
    pages: ["012.jpg", "013.jpg"],
    role: "context",
    hasDialogue: true,
    spokenText: "Ali, roubaram uma Caixa Materna. O plano era apagar a Liga, prendendo todos na Zona Fantasma.",
    headline: "A CAIXA ERA A ARMA",
  },
  {
    pages: ["016.jpg", "017.jpg", "018.jpg"],
    role: "tension",
    hasImpact: true,
    spokenText: "Só que o alarme disparou. Mulher-Maravilha, Kara e Flash chegaram, e a Fortaleza virou um campo de batalha.",
    headline: "A LIGA CHEGOU",
  },
  {
    pages: ["019.jpg", "020.jpg"],
    role: "climax",
    hasImpact: true,
    spokenText: "No meio da luta, um golpe atingiu a Caixa. O portal se abriu e arrastou os vilões para outro mundo.",
    headline: "UM GOLPE ABRIU O PORTAL",
  },
  {
    pages: ["022.jpg", "023.jpg", "024.jpg", "025.jpg"],
    role: "tension",
    hasImpact: true,
    spokenText: "Eles caíram na Ilha da Caveira, enfrentaram as criaturas de Kong e descobriram que os Titãs eram reais.",
    headline: "A ILHA DA CAVEIRA",
  },
  {
    pages: ["026.jpg", "027.jpg"],
    role: "climax",
    hasDialogue: true,
    spokenText: "Lex entendeu a oportunidade. Se controlasse o portal, poderia lançar aqueles monstros direto contra a Liga.",
    headline: "LEX TEVE OUTRO PLANO",
  },
  {
    pages: ["028.jpg", "029.jpg", "030.jpg"],
    role: "payoff",
    hasDialogue: true,
    hasImpact: true,
    spokenText: "Em Metrópolis, Clark finalmente pediu Loís em casamento. Antes da resposta, a cidade tremeu. O Super-Homem voou até a ameaça e ficou frente a frente com Godzila. O primeiro golpe fica para a parte dois.",
    headline: "SUPERMAN CONTRA GODZILLA",
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
      : reject(new Error(`${command} exited ${code}\n${stderr.slice(-10000)}`)));
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

function assEscape(text) {
  return text.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}");
}

function captionPhrases(text) {
  const words = text.replace(/[.!?]+/g, " ").split(/\s+/).filter(Boolean);
  const phrases = [];
  for (let index = 0; index < words.length; index += 4) phrases.push(words.slice(index, index + 4));
  return phrases;
}

function highlightedPhrase(words) {
  if (words.length === 1) return `{\\c&H0033CCFF&}${assEscape(words[0])}`;
  return `${assEscape(words.slice(0, -1).join(" "))} {\\c&H0033CCFF&}${assEscape(words.at(-1))}{\\c&H00FFFFFF&}`;
}

function expandToVerticalCrop(box, sourceWidth, sourceHeight) {
  const normalizedVerticalRatio = (9 / 16) * (sourceHeight / sourceWidth);
  let width = box.width;
  let height = box.height;
  if (width / height > normalizedVerticalRatio) height = width / normalizedVerticalRatio;
  else width = height * normalizedVerticalRatio;
  if (width > 1) {
    width = 1;
    height = width / normalizedVerticalRatio;
  }
  if (height > 1) {
    height = 1;
    width = height * normalizedVerticalRatio;
  }
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  return {
    x: Math.max(0, Math.min(1 - width, centerX - width / 2)),
    y: Math.max(0, Math.min(1 - height, centerY - height / 2)),
    width,
    height,
  };
}

function even(value) {
  return Math.max(2, Math.floor(value / 2) * 2);
}

function visualFilter(shot, detectedPage, renderDuration) {
  const crop = expandToVerticalCrop(shot.normalizedCrop, detectedPage.width, detectedPage.height);
  const x = even(crop.x * detectedPage.width);
  const y = even(crop.y * detectedPage.height);
  const width = Math.min(even(crop.width * detectedPage.width), detectedPage.width - x);
  const height = Math.min(even(crop.height * detectedPage.height), detectedPage.height - y);
  const frames = Math.max(2, Math.ceil(renderDuration * 30));
  const move = {
    slow_push: { z: "1+0.0009*on", x: "(iw-iw/zoom)/2", y: "(ih-ih/zoom)/2" },
    dialogue_push: { z: "1.02+0.0007*on", x: "(iw-iw/zoom)/2", y: "(ih-ih/zoom)*0.34" },
    reaction_push: { z: "1.04+0.0010*on", x: "(iw-iw/zoom)/2", y: "(ih-ih/zoom)*0.28" },
    action_pan: { z: "1.08", x: `(iw-iw/zoom)*(on/${frames})`, y: "(ih-ih/zoom)/2" },
    impact_snap: { z: "1.08+0.0018*on", x: "(iw-iw/zoom)/2", y: "(ih-ih/zoom)/2" },
    payoff_hold: { z: "1.08-0.0005*on", x: "(iw-iw/zoom)/2", y: "(ih-ih/zoom)/2" },
  }[shot.cameraMove];
  const transition = shot.transitionIn === "flash_white"
    ? ",fade=t=in:st=0:d=0.06:color=white"
    : shot.transitionIn === "push"
      ? ",fade=t=in:st=0:d=0.04"
      : "";
  return `crop=${width}:${height}:${x}:${y},scale=1200:2134,zoompan=z='${move.z}':x='${move.x}':y='${move.y}':d=${frames}:s=1080x1920:fps=30,eq=contrast=1.07:saturation=1.1${transition},format=yuv420p`;
}

async function synthesizeNarration() {
  const manifestPath = join(outputDir, "narration-manifest.json");
  await writeFile(manifestPath, JSON.stringify({ beats: beats.map((beat, index) => ({
    ...beat,
    seed: 3100 + index,
    exaggeration: index === 0 || index >= 6 ? 0.66 : 0.58,
    temperature: 0.6,
  })) }, null, 2), "utf8");
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
  const paceRatio = rawTotal > 56.5 ? Math.min(rawTotal / 56.5, 1.22) : 1;
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
  await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", list, "-af", "loudnorm=I=-14.5:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", output]);
  return { output, rawTotal, paceRatio, manifestPath };
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
    "--manifest", narration.manifestPath,
    "--output", narrationQaPath,
    "--model", process.env.WHISPER_MODEL_PATH || "base",
    "--threshold", "0.80",
  ], { env: { ...process.env, PYTHONUTF8: "1" } });
  const narrationQa = JSON.parse(await readFile(narrationQaPath, "utf8"));

  const pageNames = [...new Set(beats.flatMap((beat) => beat.pages))];
  const detectionPath = join(outputDir, "panel-detection.json");
  await run(detectorPython, [
    join(root, "scripts/detect-comic-page-panels.py"),
    "--page-dir", pageDir,
    "--pages", ...pageNames,
    "--output", detectionPath,
  ], { env: { ...process.env, PYTHONUTF8: "1" } });
  const detection = JSON.parse(await readFile(detectionPath, "utf8"));
  const pageMap = new Map(detection.pages.map((page) => [page.page, page]));
  const shotPlan = buildComicPanelShotPlan({
    beats: beats.map((beat) => ({
      pages: beat.pages,
      durationSeconds: beat.durationSeconds,
      role: beat.role,
      hasDialogue: beat.hasDialogue,
      hasImpact: beat.hasImpact,
    })),
    detectedPages: detection.pages,
    coldOpenPage: "030.jpg",
    coldOpenDurationSeconds: 2,
    maximumShotDurationSeconds: 2.1,
  });
  if (!shotPlan.mainStoryIsMonotonic || shotPlan.repeatedPanelCount > 0) throw new Error("Shot plan failed narrative continuity.");
  await writeFile(join(outputDir, "panel-shot-plan.json"), JSON.stringify(shotPlan, null, 2), "utf8");

  const segments = [];
  for (let index = 0; index < shotPlan.shots.length; index += 1) {
    const shot = shotPlan.shots[index];
    const detectedPage = pageMap.get(shot.page);
    if (!detectedPage) throw new Error(`Missing detection for ${shot.page}`);
    const input = join(pageDir, shot.page);
    await readFile(input);
    const output = join(outputDir, `shot-${String(index).padStart(2, "0")}.mp4`);
    const renderDuration = shot.isColdOpen ? shot.durationSeconds + 0.15 : shot.durationSeconds;
    await run(ffmpeg, [
      "-y", "-loop", "1", "-i", input,
      "-t", renderDuration.toFixed(3),
      "-vf", visualFilter(shot, detectedPage, renderDuration),
      "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", output,
    ]);
    segments.push(output);
  }

  const rewindPath = join(outputDir, "cold-open-rewind.mp4");
  await run(ffmpeg, [
    "-y", "-i", segments[0], "-i", segments[1],
    "-filter_complex", `[0:v][1:v]xfade=transition=diagtl:duration=0.15:offset=${shotPlan.coldOpenDurationSeconds.toFixed(3)},format=yuv420p[v]`,
    "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", rewindPath,
  ]);
  const visualParts = [rewindPath, ...segments.slice(2)];
  const segmentList = join(outputDir, "visual-parts.txt");
  await writeFile(segmentList, visualParts.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
  const visualsPath = join(outputDir, "visuals.mp4");
  await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", segmentList, "-c", "copy", visualsPath]);

  let cursor = 0;
  const subtitleEvents = [];
  const headlineEvents = [];
  beats.forEach((beat, beatIndex) => {
    const start = cursor;
    const end = start + beat.durationSeconds;
    const phrases = captionPhrases(beat.spokenText);
    const totalWords = phrases.reduce((sum, phrase) => sum + phrase.length, 0);
    let phraseCursor = start;
    phrases.forEach((phrase, phraseIndex) => {
      const phraseDuration = beat.durationSeconds * phrase.length / totalWords;
      const phraseEnd = phraseIndex === phrases.length - 1 ? end : phraseCursor + phraseDuration;
      subtitleEvents.push(`Dialogue: 0,${assTime(phraseCursor)},${assTime(phraseEnd)},Subtitle,,0,0,0,,{\\fad(35,35)\\t(0,90,\\fscx103\\fscy103)}${highlightedPhrase(phrase)}`);
      phraseCursor = phraseEnd;
    });
    const headlineDuration = beatIndex === 0 ? 2 : Math.min(1.25, beat.durationSeconds * 0.25);
    headlineEvents.push(`Dialogue: 1,${assTime(start)},${assTime(start + headlineDuration)},Editorial,,0,0,0,,{\\fad(70,100)}${assEscape(beat.headline)}`);
    cursor = end;
  });
  headlineEvents.push(`Dialogue: 2,${assTime(Math.max(0, cursor - 3.8))},${assTime(cursor)},Finale,,0,0,0,,{\\fad(100,160)}PARTE 2: O PRIMEIRO GOLPE`);
  const assPath = join(outputDir, "captions.ass");
  await writeFile(assPath, `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Subtitle,Arial,38,&H00FFFFFF,&H0000FFFF,&H00101010,&H70000000,-1,0,0,0,100,100,0,0,1,4,1,2,150,150,260,1\nStyle: Editorial,Arial,47,&H00FFFFFF,&H0000FFFF,&H00101010,&H60000000,-1,0,0,0,100,100,1,0,1,4,1,8,120,120,210,1\nStyle: Finale,Arial,48,&H0033CCFF,&H0000FFFF,&H00101010,&H70000000,-1,0,0,0,100,100,1,0,1,4,1,8,110,110,220,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${[...subtitleEvents, ...headlineEvents].join("\n")}\n`, "utf8");

  const outputPath = join(outputDir, "output.mp4");
  const escapedAss = assPath.replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'");
  await run(ffmpeg, [
    "-y", "-i", visualsPath, "-i", narration.output,
    "-vf", `ass='${escapedAss}'`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-shortest", "-movflags", "+faststart", outputPath,
  ]);
  const finalDuration = await getDuration(outputPath);
  const wordCount = beats.reduce((count, beat) => count + beat.spokenText.split(/\s+/).length, 0);
  const report = {
    outputPath,
    durationSeconds: Number(finalDuration.toFixed(3)),
    visualDirector: shotPlan.directorId,
    detectedPanelCount: detection.totalPanelCount,
    shotCount: shotPlan.shotCount,
    averageShotDurationSeconds: shotPlan.averageShotDurationSeconds,
    maximumShotDurationSeconds: shotPlan.maximumShotDurationSeconds,
    coldOpenDurationSeconds: shotPlan.coldOpenDurationSeconds,
    mainStoryIsMonotonic: shotPlan.mainStoryIsMonotonic,
    repeatedPanels: shotPlan.repeatedPanelCount,
    transitionCounts: shotPlan.transitionCounts,
    captionMode: "short_phrase_kinetic_with_editorial_headlines",
    maximumCaptionWords: 4,
    narrationProvider: "chatterbox-ptbr-local",
    narrationReference: "piper-faber-ptbr-cc0",
    narrationWordCount: wordCount,
    narrationWordsPerMinute: Number((wordCount / finalDuration * 60).toFixed(1)),
    narrationWordSimilarity: narrationQa.wordSimilarity,
    narrationQaPassed: narrationQa.passed,
    audioTargetLufs: -14.5,
    audioTruePeakDb: -1.5,
    audioSampleRate: 48000,
    language: "pt-BR",
    cliffhanger: true,
    shortsLimitPassed: finalDuration <= 59,
    status: finalDuration <= 59 && narrationQa.passed && shotPlan.mainStoryIsMonotonic && shotPlan.repeatedPanelCount === 0 ? "completed" : "failed",
  };
  await writeFile(join(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "completed") process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
