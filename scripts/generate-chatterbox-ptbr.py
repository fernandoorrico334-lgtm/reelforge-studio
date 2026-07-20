from __future__ import annotations

import argparse
import json
import os
import random
import sys
from pathlib import Path

import numpy as np
import torch
from scipy.io.wavfile import write


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate ReelForge PT-BR narration chunks.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--reference-audio", required=True)
    parser.add_argument("--source-dir", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_dir = Path(args.source_dir).resolve()
    sys.path.insert(0, str(source_dir))

    from chatterbox.tts import ChatterboxTTS

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not torch.cuda.is_available():
        raise RuntimeError("Chatterbox PT-BR requires CUDA for the ReelForge production profile")

    model = ChatterboxTTS.from_pretrained("cuda")
    results: list[dict[str, object]] = []

    for index, item in enumerate(manifest["beats"]):
        seed = int(item.get("seed", 1707 + index))
        torch.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        np.random.seed(seed)
        random.seed(seed)

        wav = model.generate(
            item["spokenText"],
            language_id="pt",
            audio_prompt_path=args.reference_audio,
            exaggeration=float(item.get("exaggeration", 0.58)),
            cfg_weight=float(item.get("cfgWeight", 0.35)),
            temperature=float(item.get("temperature", 0.62)),
        )
        audio = wav.squeeze().detach().cpu().numpy()
        output_path = output_dir / f"narration-{index:02d}.wav"
        write(output_path, model.sr, audio)
        results.append(
            {
                "index": index,
                "path": str(output_path),
                "sampleRate": model.sr,
                "sampleCount": int(audio.shape[0]),
                "durationSeconds": round(float(audio.shape[0]) / model.sr, 3),
                "seed": seed,
            }
        )

    result_path = output_dir / "chatterbox-generation.json"
    result_path.write_text(
        json.dumps({"provider": "chatterbox-ptbr-local", "results": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(result_path)


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
    main()
