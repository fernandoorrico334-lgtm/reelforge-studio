from __future__ import annotations

import argparse
import random
from pathlib import Path

import cv2
import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a local textured torn-page overlay.")
    parser.add_argument("--output", required=True)
    parser.add_argument("--width", type=int, default=1080)
    parser.add_argument("--height", type=int, default=1920)
    parser.add_argument("--seed", type=int, default=1707)
    args = parser.parse_args()
    random.seed(args.seed)

    canvas = np.zeros((args.height, args.width, 4), dtype=np.uint8)
    edge = args.width // 2
    points = []
    step = 28
    for y in range(-step, args.height + step, step):
        edge += random.randint(-24, 24)
        edge = max(args.width // 2 - 90, min(args.width // 2 + 90, edge))
        points.append((edge, y))
    polygon = [(0, 0), *points, (0, args.height)]
    cv2.fillPoly(canvas, [np.array(polygon, dtype=np.int32)], (238, 233, 218, 255))
    for offset, alpha in ((0, 220), (7, 150), (14, 80)):
        shifted = np.array([(x + offset, y) for x, y in points], dtype=np.int32)
        cv2.polylines(canvas, [shifted], False, (34, 28, 22, alpha), max(2, 9 - offset // 2), cv2.LINE_AA)
    noise = np.random.default_rng(args.seed).normal(0, 6, canvas[:, :, :3].shape).astype(np.int16)
    opaque = canvas[:, :, 3] > 0
    paper = np.clip(canvas[:, :, :3].astype(np.int16) + noise, 0, 255).astype(np.uint8)
    canvas[:, :, :3][opaque] = paper[opaque]
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output), canvas)
    print(output)


if __name__ == "__main__":
    main()
