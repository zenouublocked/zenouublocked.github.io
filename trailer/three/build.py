#!/usr/bin/env python3
"""Encode the rendered frames + mix into the trailer.

    python build.py
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJ = ROOT.parent.parent
FRAMES = ROOT / ".tmp" / "frames"
AUDIO = ROOT.parent / "out" / "audio.m4a"
OUT = ROOT.parent / "out" / "zenou-trailer.mp4"
MEDIA = PROJ / "media"
FPS = 30


def main():
    n = len(list(FRAMES.glob("f*.jpg")))
    if n < 30:
        raise SystemExit(f"only {n} frames in {FRAMES}")
    print(f"{n} frames")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # a touch of grain kills banding in the dark gradients; the pictures are
    # already colour-graded in the renderer
    vf = "noise=alls=2:allf=t,eq=contrast=1.015:saturation=1.04,format=yuv420p"
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-framerate", str(FPS), "-i", str(FRAMES / "f%05d.jpg"),
           "-i", str(AUDIO),
           "-vf", vf,
           "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-profile:v", "high",
           "-x264-params", "keyint=60:min-keyint=30",
           "-c:a", "aac", "-b:a", "192k", "-shortest",
           "-movflags", "+faststart", str(OUT)]
    subprocess.run(cmd, check=True)
    print("wrote", OUT, round(OUT.stat().st_size / 1e6, 1), "MB")

    MEDIA.mkdir(exist_ok=True)
    shutil.copy2(OUT, MEDIA / "zenou-trailer.mp4")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-ss", "69.5", "-i", str(OUT), "-frames:v", "1", "-q:v", "2",
                    str(MEDIA / "zenou-trailer.jpg")], check=True)
    shutil.copy2(MEDIA / "zenou-trailer.jpg", OUT.parent / "zenou-trailer.jpg")
    print("poster + media copy done")


if __name__ == "__main__":
    main()
