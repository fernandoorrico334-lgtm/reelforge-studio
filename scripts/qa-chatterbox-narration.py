from __future__ import annotations

import argparse
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

from faster_whisper import WhisperModel


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reject unintelligible ReelForge PT-BR narration.")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="base")
    parser.add_argument("--threshold", type=float, default=0.8)
    return parser.parse_args()


def words(value: str) -> list[str]:
    ascii_text = unicodedata.normalize("NFKD", value.lower()).encode("ascii", "ignore").decode()
    return re.findall(r"[a-z0-9]+", ascii_text)


def main() -> None:
    args = parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    expected = " ".join(item["spokenText"] for item in manifest["beats"])
    model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=6, num_workers=1)
    segments, info = model.transcribe(
        args.audio,
        language="pt",
        beam_size=1,
        best_of=1,
        temperature=0.0,
        vad_filter=True,
    )
    transcript = " ".join(segment.text.strip() for segment in segments)
    similarity = SequenceMatcher(None, words(expected), words(transcript), autojunk=False).ratio()
    passed = info.language == "pt" and similarity >= args.threshold
    report = {
        "language": info.language,
        "languageProbability": round(info.language_probability, 4),
        "wordSimilarity": round(similarity, 4),
        "threshold": args.threshold,
        "expectedWordCount": len(words(expected)),
        "transcribedWordCount": len(words(transcript)),
        "expected": expected,
        "transcript": transcript,
        "passed": passed,
    }
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not passed:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
