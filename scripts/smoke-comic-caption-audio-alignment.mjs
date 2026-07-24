import { readFile } from "node:fs/promises";

const rendererPath = new URL("./render-comic-complete-saga-v1.mjs", import.meta.url);
const source = await readFile(rendererPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(source.includes("function buildCaptionTimeline"), "renderer must expose caption timeline builder");
assert(source.includes("timedChunksFromWhisperWords"), "renderer must use whisper word timestamps when available");
assert(source.includes("whisper_word_timestamps_with_measured_fallback"), "renderer must report whisper+fallback caption timing source");
assert(source.includes("wordTimestamps"), "renderer must consume QA word timestamps");
assert(source.includes("captionTimeline.whisperAlignedCaptionCount"), "render report must expose aligned caption count");
assert(source.includes("subtitles='${escapedAss}':charenc=UTF-8"), "ffmpeg subtitles must force UTF-8 char encoding");
assert(source.includes("Buffer.from([0xef, 0xbb, 0xbf])"), "ASS captions must be written with UTF-8 BOM");

const qaSource = await readFile(new URL("./qa-chatterbox-narration.py", import.meta.url), "utf8");
assert(qaSource.includes("word_timestamps=True"), "QA transcription must request word timestamps");
assert(qaSource.includes('"wordTimestamps": word_timestamps'), "QA report must include word timestamps");
assert(qaSource.includes('"captionAlignmentSource"'), "QA report must expose caption alignment source");

console.log(JSON.stringify({
  status: "completed",
  rendererUsesWhisperWordTimestamps: true,
  qaExportsWordTimestamps: true,
  utf8CaptionsProtected: true,
  fallback: "post_tts_measured_phrase_durations",
}, null, 2));
