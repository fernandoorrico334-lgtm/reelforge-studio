from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile


def analyze(path: Path) -> dict[str, object]:
    sample_rate, audio = wavfile.read(path)
    values = audio.astype(np.float32)
    if values.ndim > 1:
        values = values.mean(axis=1)
    scale = max(1.0, float(np.iinfo(audio.dtype).max if np.issubdtype(audio.dtype, np.integer) else 1.0))
    values /= scale
    frame_size = max(1, int(sample_rate * 0.04))
    rms = np.array([np.sqrt(np.mean(np.square(values[index:index + frame_size])) + 1e-12) for index in range(0, len(values), frame_size)])
    active = rms[rms > 0.003]
    expressive_range_db = 0.0 if active.size < 3 else float(20 * np.log10((np.percentile(active, 90) + 1e-9) / (np.percentile(active, 20) + 1e-9)))
    energy_variation = 0.0 if active.size < 3 else float(np.std(active) / (np.mean(active) + 1e-9))
    active_rms = float(np.sqrt(np.mean(np.square(values[np.abs(values) > 0.003]))) + 1e-12) if np.any(np.abs(values) > 0.003) else 0.0
    active_rms_db = float(20 * np.log10(active_rms + 1e-12))
    peak_db = float(20 * np.log10(np.max(np.abs(values)) + 1e-12))
    active_floor_db = float(20 * np.log10(np.percentile(active, 20) + 1e-12)) if active.size else -120.0
    presence_consistency = 0.0 if active.size < 3 else float(np.mean(active >= np.percentile(active, 35)))
    return {
        "path": str(path),
        "expressiveRangeDb": round(expressive_range_db, 3),
        "energyVariation": round(energy_variation, 3),
        "silenceRatio": round(float(np.mean(rms < 0.003)), 3),
        "activeRmsDb": round(active_rms_db, 3),
        "peakDb": round(peak_db, 3),
        "activeFloorDb": round(active_floor_db, 3),
        "presenceConsistency": round(presence_consistency, 3),
        "clippingDetected": bool(np.max(np.abs(values)) >= 0.998),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    payload = json.loads(Path(args.input).read_text(encoding="utf-8-sig"))
    results = [analyze(Path(value)) for value in payload["files"]]
    Path(args.output).write_text(json.dumps({"results": results}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
