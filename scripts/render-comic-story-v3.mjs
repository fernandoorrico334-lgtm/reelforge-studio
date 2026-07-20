import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const pageDir = join(root, "storage/assets/comics/godzilla-kong-final-short-issue-01/.extract/pages");
const outputDir = join(root, "storage/renders/comic-compressed-story", `godzilla-v3-${Date.now()}`);
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
const f5Url = (process.env.F5_TTS_BASE_URL || "http://127.0.0.1:7860").replace(/\/+$/, "");

const beats = [
  { pages: ["004.jpg", "005.jpg", "006.jpg"], text: "Antes de Godzilla aparecer, Superman s\u00f3 queria duas coisas: pedir Lois em casamento e finalmente tirar f\u00e9rias. Mas Kong surgiu em Metr\u00f3polis, e Lex Luthor usou o caos como distra\u00e7\u00e3o.", caption: "ANTES DE GODZILLA..." },
  { pages: ["010.jpg", "011.jpg"], text: "Lex n\u00e3o queria apenas derrotar a Liga da Justi\u00e7a. Ele queria fazer todos desaparecerem de uma vez.", caption: "LEX QUERIA\nAPAGAR A LIGA" },
  { pages: ["012.jpg", "013.jpg"], text: "A Legi\u00e3o do Mal invadiu a Fortaleza da Solid\u00e3o e encontrou uma Caixa Materna. O plano era prender os her\u00f3is na Zona Fantasma.", caption: "A CAIXA MATERNA\nERA A ARMA" },
  { pages: ["016.jpg", "017.jpg", "018.jpg"], text: "S\u00f3 que o alarme disparou. Flash, Mulher-Maravilha, Supergirl e os outros chegaram antes da fuga. Em segundos, a Fortaleza virou um campo de batalha.", caption: "A LIGA CHEGOU\nANTES DA FUGA" },
  { pages: ["019.jpg", "020.jpg"], text: "No meio da luta, o Homem dos Brinquedos atingiu a Caixa sem querer. O portal se abriu e arrastou todos os vil\u00f5es para outro mundo.", caption: "UM GOLPE ABRIU\nO PORTAL" },
  { pages: ["022.jpg", "023.jpg", "024.jpg", "025.jpg"], text: "Eles ca\u00edram na Ilha da Caveira, cercados pelas criaturas de Kong. Quando encontraram o centro de comando, perceberam que aqueles monstros eram reais.", caption: "ELES CA\u00cdRAM NA\nILHA DA CAVEIRA" },
  { pages: ["026.jpg", "027.jpg"], text: "Toyman ent\u00e3o teve uma ideia ainda pior: usar a Caixa para mandar os Tit\u00e3s de volta e solt\u00e1-los contra a Liga.", caption: "TOYMAN CRIOU\nUM PLANO PIOR" },
  { pages: ["028.jpg", "029.jpg", "030.jpg"], text: "Em Metr\u00f3polis, Clark finalmente se ajoelhou diante de Lois. Mas a cidade tremeu antes da resposta. Superman voou para o perigo e encontrou Godzilla esperando por ele. E o primeiro golpe dessa batalha fica para a parte dois.", caption: "SUPERMAN CONTRA GODZILLA\nCONTINUA NA PARTE 2" }
];

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise({ stdout, stderr }) : reject(new Error(`${command} exited ${code}\n${stderr.slice(-6000)}`)));
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
  const refText = "Voc\u00ea acha que o Superman consegue parar qualquer amea\u00e7a? Ent\u00e3o presta aten\u00e7\u00e3o nisso. Quando a Liga da Justi\u00e7a percebe que o Godzilla entrou no campo de batalha, ningu\u00e9m entende direito o tamanho do problema.";
  const parts = [];
  for (let index = 0; index < beats.length; index += 1) {
    const response = await fetch(`${f5Url}/synthesize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: beats[index].text, language: "pt-BR", voicePackId: "story_epic_ptbr", speed: 1.08, refText, removeSilence: true, seed: 1707 + index })
    });
    if (!response.ok) throw new Error(`F5-TTS beat ${index + 1} failed ${response.status}: ${await response.text()}`);
    const path = join(outputDir, `narration-${String(index).padStart(2, "0")}.wav`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
    beats[index].durationSeconds = await getDuration(path);
    parts.push(path);
  }
  const list = join(outputDir, "narration-parts.txt");
  await writeFile(list, parts.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
  const output = join(outputDir, "narration.wav");
  await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_s16le", output]);
  return output;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const narrationPath = await synthesizeNarration();
  const narrationDuration = await getDuration(narrationPath);
  if (narrationDuration > 59) throw new Error(`Narration exceeds Shorts limit: ${narrationDuration.toFixed(2)}s`);

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
  await run(ffmpeg, ["-y", "-i", visualsPath, "-i", narrationPath, "-vf", `ass='${escapedAss}'`, "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "192k", "-af", "acompressor=threshold=-18dB:ratio=2.5:attack=15:release=180,alimiter=limit=0.95", "-shortest", "-movflags", "+faststart", outputPath]);
  const finalDuration = await getDuration(outputPath);
  const repeatedPages = schedule.length - new Set(schedule.map((entry) => entry.page)).size;
  const report = { outputPath, durationSeconds: Number(finalDuration.toFixed(3)), pageRange: "004-030", visualMomentCount: schedule.length, repeatedPages, language: "pt-BR", narrationChunks: beats.length, cliffhanger: true, shortsLimitPassed: finalDuration <= 59, status: finalDuration <= 59 && repeatedPages === 0 ? "completed" : "failed" };
  await writeFile(join(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "completed") process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
