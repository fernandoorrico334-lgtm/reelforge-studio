from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np


def load_panel_detector():
    source = Path(__file__).with_name("detect-comic-page-panels.py")
    spec = importlib.util.spec_from_file_location("reelforge_panel_detector", source)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load panel detector")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect comic panels, speech balloons and speaker anchors.")
    parser.add_argument("--page-dir", required=True)
    parser.add_argument("--pages", nargs="+", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def normalized_box(x: int, y: int, width: int, height: int, page_width: int, page_height: int) -> dict[str, float]:
    return {
        "x": round(x / page_width, 5),
        "y": round(y / page_height, 5),
        "width": round(width / page_width, 5),
        "height": round(height / page_height, 5),
    }


def detect_balloons(image: np.ndarray, panel: dict[str, object]) -> list[dict[str, object]]:
    box = panel["pixelBox"]
    px, py, pw, ph = box["x"], box["y"], box["width"], box["height"]
    crop = image[py : py + ph, px : px + pw]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    white_mask = cv2.inRange(gray, 218, 255)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 7))
    connected = cv2.morphologyEx(white_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(connected, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates: list[dict[str, object]] = []

    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        area_ratio = (width * height) / max(1, pw * ph)
        if area_ratio < 0.006 or area_ratio > 0.32 or width < 55 or height < 28:
            continue
        region = gray[y : y + height, x : x + width]
        white_ratio = float(np.mean(region >= 218))
        dark_ratio = float(np.mean(region <= 105))
        contour_area = cv2.contourArea(contour)
        solidity = contour_area / max(1.0, float(width * height))
        if white_ratio < 0.52 or dark_ratio < 0.008 or dark_ratio > 0.34 or solidity < 0.34:
            continue

        absolute_x, absolute_y = px + x, py + y
        center_x = (absolute_x + width / 2) / image.shape[1]
        center_y = (absolute_y + height / 2) / image.shape[0]
        side = "left" if center_x < 0.42 else "right" if center_x > 0.58 else "center"
        speaker_x = center_x if side == "center" else center_x + (-0.12 if side == "left" else 0.12)
        speaker_y = center_y + max(0.09, height / image.shape[0] * 0.9)
        confidence = round(clamp(0.35 + white_ratio * 0.28 + min(0.22, dark_ratio * 1.2) + solidity * 0.18) * 100)
        candidates.append({
            "balloonId": f"{panel['panelId']}-balloon-{len(candidates) + 1}",
            "readingOrder": 0,
            "pixelBox": {"x": absolute_x, "y": absolute_y, "width": width, "height": height},
            "normalizedBox": normalized_box(absolute_x, absolute_y, width, height, image.shape[1], image.shape[0]),
            "speakerSide": side,
            "speakerAnchor": {"x": round(clamp(speaker_x, 0.08, 0.92), 5), "y": round(clamp(speaker_y, 0.1, 0.92), 5)},
            "whiteRatio": round(white_ratio, 4),
            "textInkRatio": round(dark_ratio, 4),
            "confidence": confidence,
        })

    candidates.sort(key=lambda item: (item["normalizedBox"]["y"], item["normalizedBox"]["x"]))
    for index, candidate in enumerate(candidates):
        candidate["readingOrder"] = index + 1
    return candidates[:8]


def enrich_page(path: Path, detector) -> dict[str, object]:
    page = detector.detect_page(path)
    image = cv2.imread(str(path))
    if image is None:
        raise RuntimeError(f"Unable to read page image: {path}")
    balloon_count = 0
    for panel in page["panels"]:
        balloons = detect_balloons(image, panel)
        balloon_count += len(balloons)
        panel["balloons"] = balloons
        panel["dialogueImportanceScore"] = round(min(100, len(balloons) * 24 + sum(item["confidence"] for item in balloons) / max(1, len(balloons)) * 0.45))
        panel["semanticRole"] = "dialogue" if balloons else "visual_action_or_context"
        panel["primarySpeakerAnchor"] = balloons[0]["speakerAnchor"] if balloons else None
    page["balloonCount"] = balloon_count
    page["semanticConfidence"] = round(sum(panel["confidence"] for panel in page["panels"]) / max(1, len(page["panels"])))
    return page


def main() -> None:
    args = parse_args()
    detector = load_panel_detector()
    page_dir = Path(args.page_dir)
    pages = [enrich_page(detector.resolve_page_path(page_dir, page), detector) for page in args.pages]
    report = {
        "detectorId": "comic_semantic_region_detector_v1",
        "pageCount": len(pages),
        "panelCount": sum(page["panelCount"] for page in pages),
        "balloonCount": sum(page["balloonCount"] for page in pages),
        "pages": pages,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("detectorId", "pageCount", "panelCount", "balloonCount")}))


if __name__ == "__main__":
    main()
