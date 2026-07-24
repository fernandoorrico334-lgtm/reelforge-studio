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
    parser.add_argument("--phrase-threshold", type=float, default=0.78)
    return parser.parse_args()


def normalized(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", value.lower()).encode("ascii", "ignore").decode()
    return " ".join(re.findall(r"[a-z0-9]+", ascii_text))


def words(value: str) -> list[str]:
    return normalized(value).split()
def canonicalize_pronunciations(manifest: dict, value: str) -> str:
    canonical = normalized(value)
    replacements = []
    for entry in manifest.get("criticalPronunciations", []):
        match = normalized(str(entry.get("match", "")))
        if not match:
            continue
        for alias in entry.get("acceptedAsr", []):
            normalized_alias = normalized(str(alias))
            if normalized_alias:
                replacements.append((normalized_alias, match))
    for alias, match in sorted(replacements, key=lambda item: len(item[0]), reverse=True):
        canonical = re.sub(rf"(?<!\\w){re.escape(alias)}(?!\\w)", match, canonical)
    return canonical



def review_critical_pronunciations(manifest: dict, expected: str, transcript: str) -> list[dict]:
    expected_normalized = normalized(expected)
    transcript_normalized = normalized(transcript)
    reviews = []
    for entry in manifest.get("criticalPronunciations", []):
        match = normalized(str(entry.get("match", "")))
        if not match or match not in expected_normalized:
            continue
        accepted = [normalized(str(alias)) for alias in entry.get("acceptedAsr", []) if normalized(str(alias))]
        matched_alias = next((alias for alias in accepted if alias in transcript_normalized), None)
        reviews.append({
            "label": entry.get("label", entry.get("match")),
            "expectedMatch": entry.get("match"),
            "acceptedAsr": entry.get("acceptedAsr", []),
            "matchedAlias": matched_alias,
            "passed": matched_alias is not None,
        })
    return reviews

def review_phrases(manifest: dict, transcript: str, threshold: float) -> list[dict]:
    transcript_words = words(canonicalize_pronunciations(manifest, transcript))
    cursor = 0
    reviews = []
    for index, item in enumerate(manifest.get("beats", [])):
        phrase_id = str(item.get("phraseId", f"phrase-{index + 1}"))
        expected_text = str(item.get("qaText") or item.get("displayText") or item.get("spokenText") or "")
        expected_words = words(canonicalize_pronunciations(manifest, expected_text))
        if not expected_words:
            continue

        minimum_length = max(1, round(len(expected_words) * 0.55))
        maximum_length = max(minimum_length, round(len(expected_words) * 1.55))
        search_starts = range(max(0, cursor - 2), min(len(transcript_words), cursor + 3) + 1)
        best = None
        for start in search_starts:
            for candidate_length in range(minimum_length, maximum_length + 1):
                end = min(len(transcript_words), start + candidate_length)
                if end <= start:
                    continue
                candidate_words = transcript_words[start:end]
                similarity = SequenceMatcher(None, expected_words, candidate_words, autojunk=False).ratio()
                length_penalty = abs(len(candidate_words) - len(expected_words)) / max(1, len(expected_words)) * 0.08
                skipped_word_penalty = max(0, start - cursor) * 0.04
                score = similarity - length_penalty - skipped_word_penalty
                if best is None or score > best["score"]:
                    best = {"start": start, "end": end, "similarity": similarity, "score": score, "words": candidate_words}

        if best is None:
            best = {"start": cursor, "end": cursor, "similarity": 0.0, "score": 0.0, "words": []}
        cursor = max(cursor, best["end"])
        reviews.append({
            "phraseId": phrase_id,
            "expected": expected_text,
            "transcript": " ".join(best["words"]),
            "wordSimilarity": round(best["similarity"], 4),
            "alignmentScore": round(best["score"], 4),
            "threshold": threshold,
            "passed": best["score"] >= threshold,
            "transcriptWordRange": [best["start"], best["end"]],
        })
    return reviews



def main() -> None:
    args = parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    expected = " ".join(str(item.get("qaText") or item.get("displayText") or item["spokenText"]) for item in manifest["beats"])
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
    similarity = SequenceMatcher(None, words(canonicalize_pronunciations(manifest, expected)), words(canonicalize_pronunciations(manifest, transcript)), autojunk=False).ratio()
    critical_reviews = review_critical_pronunciations(manifest, expected, transcript)
    failed_critical = [review["label"] for review in critical_reviews if not review["passed"]]
    critical_coverage = (
        sum(1 for review in critical_reviews if review["passed"]) / len(critical_reviews)
        if critical_reviews else 1.0
    )
    phrase_reviews = review_phrases(manifest, transcript, args.phrase_threshold)
    failed_phrases = [review["phraseId"] for review in phrase_reviews if not review["passed"]]
    minimum_phrase_similarity = min((review["alignmentScore"] for review in phrase_reviews), default=1.0)
    average_phrase_similarity = sum(review["alignmentScore"] for review in phrase_reviews) / max(1, len(phrase_reviews))
    passed = info.language == "pt" and similarity >= args.threshold and not failed_critical and not failed_phrases
    report = {
        "language": info.language,
        "languageProbability": round(info.language_probability, 4),
        "wordSimilarity": round(similarity, 4),
        "threshold": args.threshold,
        "expectedWordCount": len(words(expected)),
        "transcribedWordCount": len(words(transcript)),
        "expected": expected,
        "phraseThreshold": args.phrase_threshold,
        "phraseReviews": phrase_reviews,
        "failedPhraseIds": failed_phrases,
        "minimumPhraseAlignmentScore": round(minimum_phrase_similarity, 4),
        "averagePhraseAlignmentScore": round(average_phrase_similarity, 4),
        "transcript": transcript,
        "voiceIdentityPolicy": manifest.get("voiceIdentityPolicy"),
        "identityVoiceboxProfileId": manifest.get("identityVoiceboxProfileId"),
        "criticalPronunciationCoverage": round(critical_coverage, 4),
        "criticalPronunciationReviews": critical_reviews,
        "failedCriticalPronunciations": failed_critical,
        "passed": passed,
    }
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not passed:
        raise SystemExit(2)


if __name__ == "__main__":
    main()