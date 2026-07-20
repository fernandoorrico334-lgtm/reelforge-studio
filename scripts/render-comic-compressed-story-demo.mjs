import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const pageDir = join(root, "storage/assets/comics/godzilla-kong-final-short-issue-01/.extract/pages");
const runId = `godzilla-compressed-${Date.now()}`;
const outputDir = join(root, "storage/renders/comic-compressed-story", runId);
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
const f5Url = (process.env.F5_TTS_BASE_URL || "http://127.0.0.1:7860").replace(/\/+$/, "");

const narration = [
  "Lex Luthor n\u00e3o queria apenas vencer a Liga da Justi\u00e7a. Ele queria apagar todos de uma vez.",
  "Enquanto Kong distra\u00eda os her\u00f3is, a Legi\u00e3o do Mal invadiu a Fortaleza da Solid\u00e3o e encontrou uma Caixa Materna.",
  "O plano era usar o artefato para prender a Liga inteira na Zona Fantasma.",
  "Mas o alarme disparou. Flash, Mulher-Maravilha e os outros chegaram, e a Fortaleza virou um campo de batalha.",
  "No meio da luta, o Homem dos Brinquedos atingiu a Caixa sem querer. O portal abriu e arrastou os vil\u00f5es para outro mundo.",
  "Eles ca\u00edram na Ilha da Caveira, cercados pelos monstros de Kong.",
  "E quando Toyman descobriu que aquelas criaturas eram reais, teve uma ideia ainda pior: mand\u00e1-las de volta para enfrentar a Liga.",
  "Em Metr\u00f3polis, Clark finalmente pediu Lois em casamento. Antes que ela pudesse responder, a cidade tremeu.",
  "Superman voou para o perigo e encontrou Godzilla esperando por ele. O pedido teria que esperar. A guerra dos monstros acabava de come\u00e7ar."
].join(" ");

const captions = [
  "LEX QUERIA\\NAPAGAR A LIGA",
  "A FORTALEZA\\NFOI INVADIDA",
  "A ARMA ERA UMA\\NCAIXA MATERNA",
  "A LIGA CHEGOU\\NA TEMPO",
  "UM GOLPE ATIVOU\\NO PORTAL",
  "ILHA DA CAVEIRA\\NUM NOVO MUNDO",
  "TOYMAN TEVE\\NUMA IDEIA PIOR",
  "CLARK IA PEDIR\\NLOIS EM CASAMENTO",
  "GODZILLA CHEGOU\\NPRIMEIRO"
];

const pages = Array.from({ length: 21 }, (_, index) => String(index + 10).padStart(3, "0") + ".jpg");

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stderr.slice(-6000)}`));
    });
  });
}

function assTime(seconds) {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const secs = Math.floor((centiseconds % 6000) / 100);
  const cs = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

async function duration(path) {
  const result = await run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]);
  return Number(result.stdout.trim());
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const refText = "Voc\u00ea acha que o Superman consegue parar qualquer amea\u00e7a? Ent\u00e3o presta aten\u00e7\u00e3o nisso. Quando a Liga da Justi\u00e7a percebe que o Godzilla entrou no campo de batalha, ningu\u00e9m entende direito o tamanho do problema.";
  const response = await fetch(`${f5Url}/synthesize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: narration,
      language: "pt-BR",
      voicePackId: "story_epic_ptbr",
      speed: 1.08,
      refText,
      removeSilence: true
    })
  });
  if (!response.ok) throw new Error(`F5-TTS failed ${response.status}: ${await response.text()}`);
  const narrationPath = join(outputDir, "narration.wav");
  await writeFile(narrationPath, Buffer.from(await response.arrayBuffer()));
  const narrationDuration = await duration(narrationPath);
  if (narrationDuration > 59) throw new Error(`Narration exceeds Shorts limit: ${narrationDuration.toFixed(2)}s`);

  const segmentDuration = narrationDuration / pages.length;
  const segmentPaths = [];
  for (let index = 0; index < pages.length; index += 1) {
    const input = join(pageDir, pages[index]);
    await readFile(input);
    const segment = join(outputDir, `segment-${String(index).padStart(2, "0")}.mp4`);
    const frames = Math.max(2, Math.ceil(segmentDuration * 30));
    const zoomDirection = index % 2 === 0 ? `1+0.0009*on` : `1.08-0.0007*on`;
    const yExpression = index % 3 === 0 ? "0" : index % 3 === 1 ? "(ih-ih/zoom)/2" : "ih-ih/zoom";
    const filter = [
      "scale=1400:-2",
      `zoompan=z='${zoomDirection}':x='(iw-iw/zoom)/2':y='${yExpression}':d=${frames}:s=1080x1920:fps=30`,
      "eq=contrast=1.05:saturation=1.08",
      "fade=t=in:st=0:d=0.10",
      `fade=t=out:st=${Math.max(0.2, segmentDuration - 0.10).toFixed(3)}:d=0.10`,
      "format=yuv420p"
    ].join(",");
    await run(ffmpeg, ["-y", "-loop", "1", "-i", input, "-t", segmentDuration.toFixed(3), "-vf", filter, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", segment]);
    segmentPaths.push(segment);
  }

  const concatPath = join(outputDir, "segments.txt");
  await writeFile(concatPath, segmentPaths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
  const visualsPath = join(outputDir, "visuals.mp4");
  await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", visualsPath]);

  const weights = narration.split(/\s+/).length;
  let cursor = 0;
  const lines = captions.map((caption, index) => {
    const sentenceWords = narration.split(/(?<=[.!?])\s+/)[index]?.split(/\s+/).length || Math.floor(weights / captions.length);
    const cueDuration = index === captions.length - 1 ? narrationDuration - cursor : narrationDuration * (sentenceWords / weights);
    const start = cursor;
    cursor += cueDuration;
    const color = index === captions.length - 1 ? "&H0033CCFF" : "&H00FFFFFF";
    return `Dialogue: 0,${assTime(start)},${assTime(Math.min(narrationDuration, cursor))},Impact,,0,0,0,,{\\c${color}\\fad(90,90)\\t(0,180,\\fscx108\\fscy108)}${caption}`;
  });
  const assPath = join(outputDir, "captions.ass");
  await writeFile(assPath, `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Impact,Arial,62,&H00FFFFFF,&H0000FFFF,&H00101010,&H80000000,-1,0,0,0,100,100,1,0,1,6,2,2,90,90,250,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${lines.join("\n")}\n`, "utf8");

  const outputPath = join(outputDir, "output.mp4");
  const escapedAss = assPath.replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'");
  await run(ffmpeg, ["-y", "-i", visualsPath, "-i", narrationPath, "-vf", `ass='${escapedAss}'`, "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "192k", "-af", "acompressor=threshold=-18dB:ratio=2.5:attack=15:release=180,alimiter=limit=0.95", "-shortest", "-movflags", "+faststart", outputPath]);
  const finalDuration = await duration(outputPath);
  const report = {
    outputPath,
    durationSeconds: Number(finalDuration.toFixed(3)),
    narrationDurationSeconds: Number(narrationDuration.toFixed(3)),
    pageRange: "010-030",
    visualMomentCount: pages.length,
    repeatedPages: 0,
    story: "Legion of Doom steals Mother Box, reaches Skull Island, and sends Godzilla to Metropolis",
    shortsLimitPassed: finalDuration <= 59,
    status: finalDuration <= 59 ? "completed" : "failed"
  };
  await writeFile(join(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.shortsLimitPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


