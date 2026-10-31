#!/usr/bin/env python3
"""Narration + score + mix for the Zenou trailer.

    python make_audio.py            # voice, timeline, score, mix
    python make_audio.py --voice    # only regenerate the narration takes

The narration clocks the film: every shot is as long as its line plus air, and
`timeline.json` is written here so the renderer and the mixer agree on every cut.
"""
from __future__ import annotations

import asyncio
import json
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
PROJ = ROOT.parent.parent
VO = PROJ / "trailer" / "assets" / "vo3"
TMP = ROOT / ".tmp"
SR = 48000
FPS = 30
BPM = 120
BEAT = 60.0 / BPM
BAR = BEAT * 4


# ------------------------------------------------------------------ voice
async def _speak(text: str, voice: str, rate: str, pitch: str, out: Path):
    import edge_tts

    rate_txt = rate
    pitch_txt = pitch
    com = edge_tts.Communicate(text, voice, rate=rate_txt, pitch=pitch_txt)
    audio = bytearray()
    async for chunk in com.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(bytes(audio))


def render_voice(lines, voice, rate, pitch):
    for ln in lines:
        mp3 = VO / f"{ln['id']}.mp3"
        if mp3.exists() and mp3.stat().st_size > 4000:
            continue
        print("  voice", ln["id"], flush=True)
        asyncio.run(_speak(ln["text"], voice, rate, pitch, mp3))


def to_wav(src: Path, dst: Path):
    """mp3 -> 48k mono, treated like a recorded line (eq, comp, room)."""
    chain = (
        "highpass=f=88,"
        "equalizer=f=230:t=q:w=1.1:g=-2.0,"
        "equalizer=f=3100:t=q:w=1.3:g=2.6,"
        "deesser=i=0.32,"
        "acompressor=threshold=0.10:ratio=3:attack=6:release=170,"
        "aecho=0.62:0.36:17|33:0.085|0.032,"
        "aresample=48000"
    )
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(src), "-af", chain, "-ac", "1", "-c:a", "pcm_s16le",
                    str(dst)], check=True)


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        n = w.getnframes()
        raw = w.readframes(n)
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        if w.getnchannels() > 1:
            data = data.reshape(-1, w.getnchannels()).mean(axis=1)
    return data


def clip_duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", str(path)],
                         capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


# ------------------------------------------------------------------ timeline
# visual id, floor duration, tail after the line
SHOTS = [
    ("hook",    6.2, 1.4),
    ("rules",   5.0, 1.0),
    ("site",    6.6, 1.0),
    ("games",   8.2, 1.0),
    ("web",     7.8, 1.0),
    ("media",   7.6, 1.0),
    ("music",   6.8, 1.0),
    ("library", 7.4, 1.0),
    ("yours",   7.0, 1.0),
    ("outro",   8.4, 1.6),
]
LEAD = 0.55


def quantize(t: float, step: float = 0.25) -> float:
    return math.ceil(t / step - 1e-6) * step


def build_timeline(lines, durs):
    rows = []
    t = 0.0
    for (sid, floor, tail), ln in zip(SHOTS, lines):
        d = durs[ln["id"]]
        end = max(t + floor, t + LEAD + d + tail)
        end = quantize(end)
        rows.append(dict(id=sid, start=round(t, 3), end=round(end, 3),
                         vo=dict(id=ln["id"], start=round(t + LEAD, 3),
                                 end=round(t + LEAD + d, 3), text=ln["text"])))
        t = end
    total = quantize(t, 0.5)
    return dict(fps=FPS, width=1920, height=1080, duration=round(total, 3),
                bpm=BPM, shots=rows)


# ------------------------------------------------------------------ score
def _t(n):
    return np.arange(n, dtype=np.float32) / SR


def env(n, attack=0.004, decay=0.18):
    t = _t(n)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / decay)


def noise(n, seed):
    return np.random.default_rng(seed).normal(0, 1, n).astype(np.float32)


def onepole_lp(x, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(x.size):
        acc = a * acc + (1 - a) * x[i]
        y[i] = acc
    return y


def kick():
    n = int(0.42 * SR)
    t = _t(n)
    f = 50 + 78 * np.exp(-t / 0.028)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.15)
    click = noise(n, 1) * np.exp(-t / 0.0035) * 0.30
    return (body + click).astype(np.float32) * 0.9


def clap():
    n = int(0.30 * SR)
    t = _t(n)
    nz = noise(n, 2)
    # crude band emphasis
    nz = np.diff(nz, prepend=0.0)
    e = np.exp(-t / 0.055)
    for off in (0.0, 0.009, 0.019):
        e += 0.55 * np.exp(-np.clip(t - off, 0, None) / 0.035) * (t >= off)
    return (nz * e * 0.28).astype(np.float32)


def hat(open_=False):
    n = int((0.14 if open_ else 0.055) * SR)
    t = _t(n)
    nz = noise(n, 3)
    nz = np.diff(nz, prepend=0.0) + 0.4 * nz
    return (nz * np.exp(-t / (0.06 if open_ else 0.016)) * 0.16).astype(np.float32)


def saw(freq, n, detune=0.0):
    t = _t(n)
    f = freq * (1 + detune)
    ph = (t * f) % 1.0
    return (2 * ph - 1).astype(np.float32)


def bass_note(freq, dur):
    n = int(dur * SR)
    t = _t(n)
    sub = np.sin(2 * np.pi * freq * t)
    body = saw(freq, n) * 0.45
    envv = np.clip(t / 0.006, 0, 1) * np.exp(-t / (dur * 0.55))
    return ((sub * 0.9 + body) * envv).astype(np.float32)


def pluck(freq, dur=0.30):
    n = int(dur * SR)
    t = _t(n)
    a = np.sin(2 * np.pi * freq * t)
    b = np.sin(2 * np.pi * freq * 2 * t) * 0.35
    c = np.sin(2 * np.pi * freq * 3 * t) * 0.16
    envv = np.exp(-t / 0.10) * np.clip(t / 0.004, 0, 1)
    return ((a + b + c) * envv).astype(np.float32) * 0.22


def pad_chord(freqs, dur):
    n = int(dur * SR)
    t = _t(n)
    out = np.zeros(n, dtype=np.float32)
    for f in freqs:
        for det in (-0.06, 0.0, 0.07):
            out += saw(f, n, det) / len(freqs) / 3
    out = onepole_lp(out, 900)
    envv = np.clip(t / 0.5, 0, 1) * np.clip((dur - t) / 0.5, 0, 1)
    return (out * envv).astype(np.float32) * 0.16


def riser(dur):
    n = int(dur * SR)
    t = _t(n)
    nz = noise(n, 5)
    nz = np.diff(nz, prepend=0.0)
    envv = (t / dur) ** 2.6
    return (nz * envv).astype(np.float32) * 0.20


def impact():
    n = int(1.5 * SR)
    t = _t(n)
    f = 44 + 30 * np.exp(-t / 0.07)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.42)
    nz = np.diff(noise(n, 7), prepend=0.0) * np.exp(-t / 0.10) * 0.5
    return (body + nz).astype(np.float32) * 0.8


NOTE = {"D": 73.42, "F": 87.31, "A": 110.0, "C": 130.81,
        "Bb": 116.54, "G": 98.0, "E": 82.41, "D4": 146.83, "F4": 174.61,
        "A4": 220.0, "C5": 261.63, "Bb4": 233.08, "G4": 196.0, "E4": 164.81}
PROG = [
    (["D", "F", "A"], ["D4", "F4", "A4"]),
    (["Bb", "D", "F"], ["Bb4", "D4", "F4"]),
    (["F", "A", "C"], ["F4", "A4", "C5"]),
    (["C", "E", "G"], ["C5", "E4", "G4"]),
]


def add(buf, sig, at):
    i = int(at * SR)
    if i >= buf.size:
        return
    n = min(sig.size, buf.size - i)
    buf[i:i + n] += sig[:n]


def build_score(tl):
    total = tl["duration"]
    n = int(total * SR) + SR
    buf = np.zeros(n, dtype=np.float32)

    # energy per shot
    energy = {"hook": 0.25, "rules": 0.55, "site": 0.75, "games": 1.0, "web": 0.9,
              "media": 0.95, "music": 0.95, "library": 0.55, "yours": 0.85, "outro": 1.0}

    K, C, H, HO = kick(), clap(), hat(), hat(True)
    IMP, RIS = impact(), riser(3.2)

    bars = int(math.ceil(total / BAR))
    for b in range(bars):
        t0 = b * BAR
        chord, arp = PROG[b % 4]
        add(buf, pad_chord([NOTE[x] for x in chord], BAR * 1.02), t0)

    for s in tl["shots"]:
        e = energy[s["id"]]
        add(buf, IMP * (0.85 if s["id"] in ("hook", "site", "games", "outro") else 0.5),
            s["start"])
        if s["id"] in ("rules", "games", "yours", "outro"):
            add(buf, RIS * 0.8, max(0.0, s["start"] - 3.2))

    # drums + bass + arp
    beat = 0
    while beat * BEAT < total - 0.3:
        t = beat * BEAT
        bar = int(t // BAR)
        chord, arp = PROG[bar % 4]
        shot = next((s for s in tl["shots"] if s["start"] <= t < s["end"]), tl["shots"][-1])
        e = energy.get(shot["id"], 0.6)
        in_bar = (t % BAR) / BEAT

        if e >= 0.5:
            add(buf, K * (0.9 if e > 0.8 else 0.55), t)
        if e >= 0.8 and int(in_bar) in (1, 3):
            add(buf, C * 0.9, t)
        if e >= 0.5:
            add(buf, H * (0.8 if e > 0.8 else 0.5), t)
            add(buf, H * 0.4, t + BEAT / 2)
        if e >= 0.9:
            for k in (1, 3):
                add(buf, H * 0.22, t + k * BEAT / 4)
        if e >= 0.85 and int(in_bar) == 3 and beat % 8 == 7:
            add(buf, HO * 0.5, t + BEAT / 2)

        if e >= 0.5:
            root = NOTE[chord[0]]
            add(buf, bass_note(root / 2 if root > 90 else root, BEAT * 0.92), t)
            add(buf, bass_note(root / 2 if root > 90 else root, BEAT * 0.42), t + BEAT * 0.5)

        if e >= 0.7:
            step = NOTE[arp[(beat * 2) % len(arp)]]
            add(buf, pluck(step * 2, 0.22), t)
            add(buf, pluck(step * 3, 0.16) * 0.5, t + BEAT / 2)
        beat += 1

    # tidy: strip DC and sub-40 rumble, gentle top roll-off
    buf = np.diff(buf, prepend=0.0)
    buf = onepole_lp(buf, 15000)
    peak = float(np.max(np.abs(buf))) or 1.0
    buf = buf / peak * 0.89
    return buf[: int(total * SR)]


# ------------------------------------------------------------------ mix
def place(master, sig, at, gain=1.0):
    i = int(at * SR)
    n = min(sig.size, master.size - i)
    if n > 0:
        master[i:i + n] += sig[:n] * gain


def duck_gain(voice, total):
    """Follow the voice and pull the bed down under it."""
    win = int(0.020 * SR)
    rms = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, mode="same"))
    thr = 0.006
    g = np.clip((rms - thr) / (thr * 3.0), 0, 1)
    g = 1.0 - 0.72 * g
    # attack/release smoothing
    a_att, a_rel = math.exp(-1 / (0.010 * SR)), math.exp(-1 / (0.180 * SR))
    out = np.empty_like(g)
    acc = 1.0
    for i in range(g.size):
        target = g[i]
        a = a_att if target < acc else a_rel
        acc = a * acc + (1 - a) * target
        out[i] = acc
    return out


def main():
    nl = json.loads((ROOT / "narration.json").read_text(encoding="utf-8"))
    lines = nl["lines"]
    VO.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(exist_ok=True)

    if "--voice" in sys.argv or not (VO / "outro.mp3").exists():
        render_voice(lines, nl["voice"], nl["rate"], nl["pitch"])

    wavs, durs = {}, {}
    for ln in lines:
        w = TMP / f"vo_{ln['id']}.wav"
        to_wav(VO / f"{ln['id']}.mp3", w)
        data = read_wav(w)
        # trim leading/trailing silence so the cut is tight
        thr = 0.004
        idx = np.where(np.abs(data) > thr)[0]
        if idx.size:
            a = max(0, idx[0] - int(0.03 * SR))
            b = min(data.size, idx[-1] + int(0.06 * SR))
            data = data[a:b]
        wavs[ln["id"]] = data
        durs[ln["id"]] = data.size / SR
        print(f"  {ln['id']:8s} {durs[ln['id']]:5.2f}s")

    tl = build_timeline(lines, durs)
    (ROOT / "timeline.json").write_text(json.dumps(tl, indent=1), encoding="utf-8")
    print(f"timeline: {tl['duration']:.2f}s  /  {int(tl['duration'] * FPS)} frames")

    total = tl["duration"]
    voice = np.zeros(int(total * SR) + SR, dtype=np.float32)
    for s in tl["shots"]:
        sig = wavs[s["vo"]["id"]]
        rms = float(np.sqrt(np.mean(sig ** 2))) or 1e-4
        gain = 0.085 / rms
        place(voice, sig, s["vo"]["start"], gain)
    voice = np.clip(voice, -1.2, 1.2)

    score = build_score(tl)
    duck = duck_gain(voice[: score.size], total)
    mix = score * duck * 0.42 + voice[: score.size] * 0.95

    # section swells on each cut: a short noise lift, very subtle
    for s in tl["shots"][1:]:
        add(mix, riser(0.55) * 0.20, max(0.0, s["start"] - 0.55))

    mix = onepole_lp(mix, 17000)
    peak = float(np.max(np.abs(mix))) or 1.0
    if peak > 0.95:
        mix = mix / peak * 0.95
    rms = float(np.sqrt(np.mean(mix ** 2)))
    mix *= (10 ** (-16 / 20)) / max(rms, 1e-6)
    mix = np.tanh(mix * 1.08) * 0.94

    out = TMP / "mix.wav"
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        stereo = np.stack([mix, mix], axis=1)
        w.writeframes((np.clip(stereo, -1, 1) * 32767).astype(np.int16).tobytes())

    final = ROOT.parent / "out" / "audio.m4a"
    final.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(out), "-c:a", "aac", "-b:a", "192k", str(final)], check=True)
    print("wrote", final, f"{total:.2f}s")


if __name__ == "__main__":
    main()
