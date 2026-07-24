import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  TTS_BENCHMARK_SECTIONS,
  VoiceboxApiClient,
  VoiceboxHealthCheck,
  evaluateTtsProviderBenchmark,
} from "../packages/media-beast/dist/index.js";

const root = resolve(import.meta.dirname, "..");
const outputDir = join(root, "tmp");
const jsonPath = join(outputDir, "tts-provider-benchmark.json");
const htmlPath = join(outputDir, "tts-provider-contact-report.html");
await mkdir(outputDir, { recursive: true });

const health = await new VoiceboxHealthCheck(new VoiceboxApiClient()).inspect();
const profileId = process.env.VOICEBOX_PROFILE_ID?.trim() || null;
const entries = [];
const evaluation = evaluateTtsProviderBenchmark(entries);
const blockers = [];
if (!health.reachable) blockers.push("Voicebox is not reachable at VOICEBOX_BASE_URL.");
if (!profileId) blockers.push("VOICEBOX_PROFILE_ID is not configured for the owner-authorized voice.");
blockers.push("Objective ASR, acoustic and transition measurements must be supplied before provider promotion.");

const report = {
  status: blockers.length ? "blocked_pending_real_benchmark" : "ready_for_real_benchmark",
  generatedAt: new Date().toISOString(),
  defaultProviderChanged: false,
  voiceboxHealth: health,
  ownerVoiceProfileId: profileId,
  providers: ["chatterbox-current", "qwen-custom-voice", "qwen-cloned-voice"],
  sections: TTS_BENCHMARK_SECTIONS,
  acceptance: {
    textualFidelity: 0.94,
    naturalness: 0.85,
    actingMatch: 0.85,
    continuity: 0.85,
    criticalNamesRequireIndividualApproval: true,
  },
  evaluation,
  blockers,
};
await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");

const rows = TTS_BENCHMARK_SECTIONS.map((section) =>
  `<tr><td>${section.id}</td><td>${section.intent}</td><td>pending</td><td>pending</td><td>pending</td></tr>`
).join("");
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>ReelForge TTS Provider Benchmark</title><style>body{background:#111;color:#eee;font:16px system-ui;padding:32px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:10px}th{background:#222}.blocked{color:#ffb86b}</style></head><body><h1>TTS Provider Benchmark</h1><p class="blocked">Status: ${report.status}</p><p>O provider padrao permanece Chatterbox ate um concorrente vencer todos os gates.</p><table><thead><tr><th>Trecho</th><th>Objetivo</th><th>Chatterbox</th><th>Qwen CustomVoice</th><th>Qwen voz clonada</th></tr></thead><tbody>${rows}</tbody></table><h2>Bloqueios</h2><ul>${blockers.map((item) => `<li>${item}</li>`).join("")}</ul></body></html>`;
await writeFile(htmlPath, html, "utf8");

console.log(JSON.stringify({ jsonPath, htmlPath, status: report.status, blockers }, null, 2));

