from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser(description="Render a labeled contact sheet for comic page QA.")
    parser.add_argument("--page-dir", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--columns", type=int, default=6)
    args = parser.parse_args()

    page_dir = Path(args.page_dir)
    pages = sorted(
        (
            path for path in page_dir.iterdir()
            if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
            and (
                path.stem.replace("a", "").isdigit()
                or path.stem.removeprefix("page-").isdigit()
            )
        ),
        key=lambda path: int("".join(character for character in path.stem if character.isdigit()) or 0),
    )
    card_width, card_height = 180, 300
    cards: list[np.ndarray] = []

    for path in pages:
        image = cv2.imread(str(path))
        if image is None:
            continue
        card = np.full((card_height, card_width, 3), 12, dtype=np.uint8)
        scale = min((card_width - 12) / image.shape[1], (card_height - 34) / image.shape[0])
        resized = cv2.resize(
            image,
            (max(1, round(image.shape[1] * scale)), max(1, round(image.shape[0] * scale))),
        )
        x = (card_width - resized.shape[1]) // 2
        y = 28 + (card_height - 30 - resized.shape[0]) // 2
        card[y : y + resized.shape[0], x : x + resized.shape[1]] = resized
        cv2.putText(card, path.name, (7, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 1, cv2.LINE_AA)
        cards.append(card)

    columns = max(1, args.columns)
    rows = (len(cards) + columns - 1) // columns
    sheet = np.full((rows * card_height, columns * card_width, 3), 6, dtype=np.uint8)
    for index, card in enumerate(cards):
        row, column = divmod(index, columns)
        sheet[row * card_height : (row + 1) * card_height, column * card_width : (column + 1) * card_width] = card

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output), sheet, [cv2.IMWRITE_JPEG_QUALITY, 82])
    print(f"pages={len(cards)} output={output}")


if __name__ == "__main__":
    main()
