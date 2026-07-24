from __future__ import annotations

import argparse
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

from faster_whisper import WhisperModel


def normalized(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", value.lower()).encode("ascii", "ignore").decode()
    return " ".join(re.findall(r"[a-z0-9]+", ascii_text))


def word_similarity(expected: str, transcript: str) -> float:
    expected_words = normalized(expected).split()
    transcript_words = normalized(transcript).split()
    return SequenceMatcher(None, expected_words, transcript_words, autojunk=False).ratio()


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe every narration take before final selection.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="base")
    args = parser.parse_args()

    payload = json.loads(Path(args.input).read_text(encoding="utf-8-sig"))
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8-sig"))
    files = payload.get("files", [])
    beats = manifest.get("beats", [])
    if len(files) != len(beats):
        raise ValueError(f"Expected one manifest entry per take: files={len(files)} beats={len(beats)}")

    model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=6, num_workers=1)
    results = []
    for path_value, beat in zip(files, beats):
        segments, info = model.transcribe(
            path_value,
            language="pt",
            beam_size=1,
            best_of=1,
            temperature=0.0,
            vad_filter=True,
        )
        transcript = " ".join(segment.text.strip() for segment in segments).strip()
        expected = str(beat.get("qaText") or beat.get("displayText") or beat.get("spokenText") or "")
        similarity = word_similarity(expected, transcript)
        results.append({
            "path": path_value,
            "phraseId": beat.get("phraseId"),
            "takeId": beat.get("takeId"),
            "expected": expected,
            "transcript": transcript,
            "asrSimilarity": round(similarity, 4),
            "asrLanguage": info.language,
            "asrLanguageProbability": round(info.language_probability, 4),
            "asrPassed": info.language == "pt" and similarity >= 0.72,
        })

    Path(args.output).write_text(json.dumps({"results": results}, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
