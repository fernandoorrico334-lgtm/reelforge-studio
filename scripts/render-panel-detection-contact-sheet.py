from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    parser.add_argument("--page-dir", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    report = json.loads(Path(args.report).read_text(encoding="utf-8"))
    page_dir = Path(args.page_dir)
    cards: list[np.ndarray] = []

    for page in report["pages"]:
        image = cv2.imread(str(page_dir / page["page"]))
        if image is None:
            continue
        for panel in page["panels"]:
            box = panel["pixelBox"]
            crop = image[
                box["y"] : box["y"] + box["height"],
                box["x"] : box["x"] + box["width"],
            ]
            if crop.size == 0:
                continue
            card = np.full((360, 240, 3), 18, dtype=np.uint8)
            scale = min(220 / crop.shape[1], 315 / crop.shape[0])
            resized = cv2.resize(
                crop,
                (max(1, round(crop.shape[1] * scale)), max(1, round(crop.shape[0] * scale))),
            )
            x = (240 - resized.shape[1]) // 2
            y = 32 + (315 - resized.shape[0]) // 2
            card[y : y + resized.shape[0], x : x + resized.shape[1]] = resized
            cv2.putText(
                card,
                panel["panelId"],
                (8, 22),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )
            cards.append(card)

    columns = 5
    rows = (len(cards) + columns - 1) // columns
    sheet = np.full((rows * 360, columns * 240, 3), 10, dtype=np.uint8)
    for index, card in enumerate(cards):
        row, column = divmod(index, columns)
        sheet[row * 360 : (row + 1) * 360, column * 240 : (column + 1) * 240] = card

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output), sheet)
    print(json.dumps({"panelCount": len(cards), "output": str(output)}))


if __name__ == "__main__":
    main()
