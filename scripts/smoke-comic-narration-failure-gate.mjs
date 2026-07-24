import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const renderer = await readFile(new URL("./render-comic-complete-saga-v1.mjs", import.meta.url), "utf8");

assert(renderer.includes("comic_narration_qa_v3_word_timestamps_strict_phrase_gate"), "QA cache must include strict policy version");
assert(renderer.includes("qaScriptHash"), "QA cache key must include QA script hash");
assert(renderer.includes("wordTimestampCount") && renderer.includes("captionAlignmentSource === \"whisper_word_timestamps\""), "QA cache reuse must require word timestamps");
assert(renderer.includes("reviewNarrationFailureGate"), "renderer must have narration failure gate");
assert(renderer.includes("Narration failure gate rejected audio before render"), "renderer must stop before render on bad narration");
assert(renderer.includes("phrase_alignment_or_intelligibility_failed"), "gate must block failed/low-score phrases");
assert(renderer.includes("missing_word_timestamps"), "gate must block QA without word timestamps");
assert(renderer.includes("rewriteFragileNarrationForTts"), "renderer must rewrite fragile TTS phrases");
assert(renderer.includes("antigo vilão que toma remédios"), "fragile 'medicado' phrase must be rewritten");
assert(renderer.includes("Jack precisa entrar de novo naquela mente"), "fragile 'aproximar da mente' phrase must be rewritten");
assert(renderer.includes("Se Jack recua"), "fragile 'Se recuar' phrase must be rewritten");
assert(renderer.includes("Jack escolhe fazer o certo"), "fragile 'Ele escolhe' phrase must be rewritten");

const qa = await readFile(new URL("./qa-chatterbox-narration.py", import.meta.url), "utf8");
assert(qa.includes("word_timestamps=True"), "QA must request word timestamps from Whisper");
assert(qa.includes('"wordTimestamps": word_timestamps'), "QA report must export word timestamps");

console.log(JSON.stringify({
  status: "completed",
  strictQaCache: true,
  blocksFailedPhrases: true,
  blocksMissingWordTimestamps: true,
  fragileTtsRewriteCount: 8,
}, null, 2));
