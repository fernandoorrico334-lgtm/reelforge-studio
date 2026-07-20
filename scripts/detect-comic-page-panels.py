from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect comic panel regions from local page images.")
    parser.add_argument("--page-dir", required=True)
    parser.add_argument("--pages", nargs="+", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def resolve_page_path(page_dir: Path, page: str) -> Path:
    requested = page_dir / page
    if requested.exists():
        return requested

    for extension in (".jpg", ".jpeg", ".png", ".webp"):
        candidate = requested.with_suffix(extension)
        if candidate.exists():
            return candidate

    return requested


def contiguous_runs(mask: np.ndarray) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start: int | None = None
    for index, active in enumerate(mask.tolist() + [False]):
        if active and start is None:
            start = index
        elif not active and start is not None:
            runs.append((start, index))
            start = None
    return runs


def best_separator(gray: np.ndarray, box: tuple[int, int, int, int]) -> tuple[str, int, int] | None:
    x, y, width, height = box
    region = gray[y : y + height, x : x + width]
    white = region >= 242
    candidates: list[tuple[float, str, int, int]] = []

    for axis, ratios, size in (
        ("horizontal", white.mean(axis=1), height),
        ("vertical", white.mean(axis=0), width),
    ):
        edge = max(10, int(size * 0.08))
        minimum_band = max(3, int(size * 0.006))
        for start, end in contiguous_runs(ratios >= 0.88):
            if end - start < minimum_band or start < edge or end > size - edge:
                continue
            before = start
            after = size - end
            if min(before, after) < size * 0.2:
                continue
            balance = min(before, after) / max(before, after)
            strength = float(ratios[start:end].mean())
            candidates.append((strength * 0.7 + balance * 0.3, axis, start, end))

    if not candidates:
        return None
    _, axis, start, end = max(candidates, key=lambda item: item[0])
    return axis, start, end


def split_region(
    gray: np.ndarray,
    box: tuple[int, int, int, int],
    page_area: int,
    depth: int = 0,
) -> list[tuple[int, int, int, int]]:
    x, y, width, height = box
    if depth >= 5 or width * height < page_area * 0.09:
        return [box]
    separator = best_separator(gray, box)
    if separator is None:
        return [box]

    axis, start, end = separator
    if axis == "horizontal":
        first = (x, y, width, start)
        second = (x, y + end, width, height - end)
    else:
        first = (x, y, start, height)
        second = (x + end, y, width - end, height)

    return split_region(gray, first, page_area, depth + 1) + split_region(gray, second, page_area, depth + 1)


def content_score(gray: np.ndarray, box: tuple[int, int, int, int]) -> float:
    x, y, width, height = box
    region = gray[y : y + height, x : x + width]
    return float((region < 238).mean())


def detect_page(path: Path) -> dict[str, object]:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to read page image: {path}")
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    margin_x = max(4, int(width * 0.012))
    margin_y = max(4, int(height * 0.008))
    root = (margin_x, margin_y, width - margin_x * 2, height - margin_y * 2)
    raw = split_region(gray, root, width * height)
    regions = [
        box
        for box in raw
        if box[2] >= width * 0.22
        and box[3] >= height * 0.1
        and box[2] * box[3] >= width * height * 0.045
        and content_score(gray, box) >= 0.14
    ]
    if not regions:
        regions = [root]
    regions.sort(key=lambda item: (round(item[1] / max(height * 0.12, 1)), item[0], item[1]))

    panels = []
    for index, (x, y, panel_width, panel_height) in enumerate(regions[:8]):
        panels.append(
            {
                "panelId": f"{path.stem}-panel-{index + 1}",
                "readingOrder": index + 1,
                "pixelBox": {"x": x, "y": y, "width": panel_width, "height": panel_height},
                "normalizedBox": {
                    "x": round(x / width, 5),
                    "y": round(y / height, 5),
                    "width": round(panel_width / width, 5),
                    "height": round(panel_height / height, 5),
                },
                "contentScore": round(content_score(gray, (x, y, panel_width, panel_height)), 4),
                "confidence": 86 if len(regions) > 1 else 58,
            }
        )

    return {
        "page": path.name,
        "width": width,
        "height": height,
        "panelCount": len(panels),
        "panels": panels,
        "warnings": [] if len(panels) > 1 else ["page_not_split_use_directed_crop_fallback"],
    }


def main() -> None:
    args = parse_args()
    page_dir = Path(args.page_dir)
    pages = [detect_page(resolve_page_path(page_dir, page)) for page in args.pages]
    report = {
        "detectorId": "comic_page_panel_detector_v1",
        "pageCount": len(pages),
        "totalPanelCount": sum(int(page["panelCount"]) for page in pages),
        "pages": pages,
    }
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"pageCount": report["pageCount"], "totalPanelCount": report["totalPanelCount"]}))


if __name__ == "__main__":
    main()

