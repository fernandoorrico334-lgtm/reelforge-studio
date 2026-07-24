import {
  MultiTakePlanner,
  PronunciationMemoryStore,
  ProsodyInstructionCompiler,
  QwenClonedVoiceProvider,
  VoiceProfileStore,
  VoiceReferenceSampleStore,
  VoiceReferenceSelector,
  VoiceboxApiClient,
  buildNarrationSynthesisBlocks,
  selectBestNarrationSequence,
} from "../packages/media-beast/dist/index.js";

const profileStore = new VoiceProfileStore([{
  id: "fernando-owned-voice",
  name: "Fernando",
  language: "pt",
  consentConfirmed: true,
  ownerLabel: "owner-recorded-and-authorized",
  defaultVoiceboxProfileId: "voicebox-fernando-neutral",
  voiceboxProfileIdsByStyle: {
    tension: "voicebox-fernando-tension",
    action: "voicebox-fernando-action",
    cliffhanger: "voicebox-fernando-cliffhanger",
  },
  sampleIds: ["neutral", "tension", "action", "cliffhanger"],
}]);
const sampleStore = new VoiceReferenceSampleStore([
  ["neutral", "neutral", 0.96],
  ["tension", "tension", 0.94],
  ["action", "action", 0.93],
  ["cliffhanger", "cliffhanger", 0.95],
].map(([id, style, qualityScore]) => ({
  id, profileId: "fernando-owned-voice", audioPath: `tmp/${id}.wav`, transcript: "Amostra autorizada.",
  style, qualityScore, noiseScore: 0.05, clippingDetected: false, durationSec: 12, sha256: id.repeat(8),
})));

const compiler = new ProsodyInstructionCompiler();
const selector = new VoiceReferenceSelector(profileStore, sampleStore);
const direction = {
  intent: "hook",
  emotion: "surpresa contida",
  intensity: 0.86,
  energy: 0.78,
  rate: 0.72,
  emphasisWords: ["verdadeiro plano"],
  endingContour: "suspend",
  subtext: "o perigo ainda nao foi compreendido",
  deliveryGoal: "abrir uma pergunta que so sera respondida depois",
};
const blocks = buildNarrationSynthesisBlocks({
  profileId: "fernando-owned-voice",
  compiler,
  referenceSelector: selector,
  beats: [
    { id: "beat-1", text: "Batman encontrou algo que nao deveria existir.", estimatedDurationSec: 5, actingDirection: direction, storyBlockId: "opening" },
    { id: "beat-2", text: "Mas o verdadeiro plano ainda estava escondido.", estimatedDurationSec: 5, actingDirection: direction, storyBlockId: "opening" },
  ],
});
if (blocks.length !== 1 || blocks[0].estimatedDurationSec < 8 || blocks[0].estimatedDurationSec > 20) throw new Error("Narrative synthesis block contract failed.");
if (blocks[0].instruct.length > 500 || /intensity|0\./i.test(blocks[0].instruct)) throw new Error("Prosody compiler leaked numeric controls.");

const takes = new MultiTakePlanner(compiler).plan(blocks[0], 1707);
if (takes.length < 4 || new Set(takes.map((take) => take.variation)).size < 4) throw new Error("Critical block needs varied takes, not seed-only variants.");

const score = (value) => ({
  semanticAccuracy: value, pronunciationScore: value, actingMatch: value, naturalness: value,
  audioQuality: value, timbreSimilarity: value, pauseQuality: value, pitchVariation: value, energyVariation: value,
});
const sequence = selectBestNarrationSequence({
  takesByBlock: [
    takes.slice(0, 2).map((take, index) => ({ ...take, audioPath: `tmp/${take.id}.wav`, score: score(index ? 0.92 : 0.8) })),
    takes.slice(2, 4).map((take, index) => ({ ...take, blockId: "block-2", audioPath: `tmp/${take.id}.wav`, score: score(index ? 0.91 : 0.79) })),
  ],
  transitions: [{ fromTakeId: takes[1].id, toTakeId: takes[3].id, timbreContinuity: 0.95, pitchContinuity: 0.9, energyContinuity: 0.9, emotionalProgression: 0.96, pauseCompatibility: 0.92 }],
});
if (sequence.selectedTakes[0].id !== takes[1].id || sequence.selectedTakes[1].id !== takes[3].id) throw new Error("Global sequence judge did not select the coherent path.");

const pronunciation = new PronunciationMemoryStore();
pronunciation.remember({ word: "Batman", engine: "qwen", profileId: "fernando-owned-voice", successfulInput: "Batman", rejectedInputs: ["Betimem"], confidence: 0.96 });
const nameGate = pronunciation.requireCriticalApprovals({ text: "Batman chegou a Gotham.", engine: "qwen", profileId: "fernando-owned-voice" });
if (nameGate.passed || !nameGate.missing.includes("Gotham")) throw new Error("Critical-name gate must reject unapproved proper names.");

const requests = [];
const fakeFetch = async (url, init = {}) => {
  requests.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
  if (String(url).endsWith("/generate")) return new Response(JSON.stringify({ id: "gen-1", status: "completed", audio_path: "tmp/qwen.wav", duration: 10, seed: 1707, engine: "qwen", model_size: "1.7B" }), { status: 200 });
  return new Response(JSON.stringify({ status: "ok", gpu_available: true }), { status: 200 });
};
const provider = new QwenClonedVoiceProvider(new VoiceboxApiClient({ fetchImpl: fakeFetch, timeoutMs: 1000 }));
const generated = await provider.generateCloned({
  text: blocks[0].text, language: "pt", modelSize: "1.7B", profileId: blocks[0].providerProfileId,
  seed: 1707, instruct: blocks[0].instruct, normalize: false, maxChunkChars: 800, crossfadeMs: 50,
});
if (generated.instructApplied) throw new Error("Qwen Base cloning must not claim unsupported instruct control.");
if (requests[0].body.personality !== false || requests[0].body.normalize !== false || requests[0].body.effects_chain.length) throw new Error("Voicebox request must disable personality, normalization and effects.");

console.log(JSON.stringify({
  provider: "voicebox-qwen-local",
  ownVoiceProfile: "fernando-owned-voice",
  synthesisBlockCount: blocks.length,
  takeCount: takes.length,
  selectedTakeIds: sequence.selectedTakes.map((take) => take.id),
  missingCriticalPronunciations: nameGate.missing,
  qwenBaseInstructApplied: generated.instructApplied,
  status: "completed",
}, null, 2));

