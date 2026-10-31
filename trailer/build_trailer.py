#!/usr/bin/env python3
"""Zenou Unblocked — motion-graphics trailer renderer.

Builds every frame with Pillow from the real site screenshots in assets/shots,
then muxes the narration and the supplied music with ffmpeg.

    python build_trailer.py            # render frames + encode
    python build_trailer.py --stills   # only preview stills of each scene
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUT = ROOT / "output"
FRAMES = ROOT / "frames"
W, H = 1920, 1080
FPS = 24

INK = (240, 242, 250)
MUTED = (158, 163, 182)
PURPLE = (178, 76, 255)
PINK = (255, 79, 176)
MINT = (109, 242, 193)
DEEP = (9, 7, 16)

FONT_PATH = str(ASSETS / "fonts" / "Archivo.ttf")


# ---------------------------------------------------------------- text helpers


@lru_cache(maxsize=64)
def F(size: int, weight: int = 800, width: int = 100) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT_PATH, size)
    try:
        f.set_variation_by_axes([weight, width])
    except Exception:
        pass
    return f


def tracked(draw: ImageDraw.ImageDraw, xy, s, font, fill, tracking=0, anchor="ls"):
    widths = [draw.textlength(ch, font=font) for ch in s]
    total = sum(widths) + tracking * max(0, len(s) - 1)
    x, y = xy
    if anchor[0] == "m":
        x -= total / 2
    elif anchor[0] == "r":
        x -= total
    for ch, w in zip(s, widths):
        draw.text((x, y), ch, font=font, fill=fill, anchor="l" + anchor[1])
        x += w + tracking
    return total


def text_width(draw, s, font, tracking=0):
    return sum(draw.textlength(ch, font=font) for ch in s) + tracking * max(0, len(s) - 1)


@lru_cache(maxsize=32)
def gradient_image(size, c1, c2, angle=0):
    w, h = size
    if angle == 0:  # horizontal
        t = np.linspace(0, 1, max(2, w))[None, :]
        t = np.repeat(t, h, axis=0)
    else:  # diagonal
        x = np.linspace(0, 1, max(2, w))[None, :]
        y = np.linspace(0, 1, max(2, h))[:, None]
        t = np.clip((x * 0.65 + y * 0.35), 0, 1)
    t = t[..., None]
    a = np.array(c1, dtype=np.float32)
    b = np.array(c2, dtype=np.float32)
    arr = (a * (1 - t) + b * t).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def draw_line(img, xy, s, font, fill, tracking=0, anchor="ls"):
    """fill is an RGB tuple, or ((c1),(c2)) for a gradient."""
    if isinstance(fill[0], tuple):
        mask = Image.new("L", img.size, 0)
        tracked(ImageDraw.Draw(mask), xy, s, font, 255, tracking, anchor)
        img.paste(gradient_image(img.size, fill[0], fill[1], 0), (0, 0), mask)
    else:
        tracked(ImageDraw.Draw(img), xy, s, font, fill, tracking, anchor)


def kicker(img, xy, s, color=PURPLE, size=22, tracking=8):
    tracked(ImageDraw.Draw(img), xy, s.upper(), F(size, 700, 100), color, tracking)


# ---------------------------------------------------------------- background


@lru_cache(maxsize=8)
def radial_glow(size, color, strength=255):
    w = size
    y, x = np.mgrid[0:w, 0:w]
    cx = cy = w / 2
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (w / 2)
    a = np.clip(1 - d, 0, 1) ** 2.4 * strength
    arr = np.zeros((w, w, 4), dtype=np.uint8)
    arr[..., 0], arr[..., 1], arr[..., 2] = color
    arr[..., 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


@lru_cache(maxsize=1)
def starfield():
    rng = np.random.default_rng(7)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(190):
        x = rng.integers(0, W)
        y = rng.integers(0, H)
        r = float(rng.choice([0.7, 0.9, 1.2, 1.6, 2.1]))
        a = int(rng.integers(28, 120))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(220, 226, 255, a))
    return layer


@lru_cache(maxsize=1)
def grid_layer():
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    horizon = int(H * 0.64)
    vp = (W // 2, horizon)
    for i in range(-16, 17):
        x = W // 2 + i * 130
        d.line([vp, (x, H)], fill=(150, 110, 255, 34), width=2)
    for i in range(14):
        t = i / 13
        y = horizon + int((H - horizon) * (t ** 2.1))
        d.line([(0, y), (W, y)], fill=(150, 110, 255, int(12 + 34 * t)), width=2)
    return layer


@lru_cache(maxsize=1)
def base_gradient():
    top = Image.new("RGB", (1, H))
    td = ImageDraw.Draw(top)
    for y in range(H):
        t = y / H
        r = int(12 + 20 * (1 - t))
        g = int(8 + 8 * (1 - t))
        b = int(22 + 34 * (1 - t))
        td.point((0, y), (r, g, b))
    return top.resize((W, H))


def background(gt, tint=PURPLE, glow_pos=(0.18, 0.22), grid=False, darkness=1.0):
    img = base_gradient().copy()

    g = radial_glow(760, tint, 220)
    gx = int(W * glow_pos[0] - 380 + math.sin(gt * 0.22) * 70)
    gy = int(H * glow_pos[1] - 380 + math.cos(gt * 0.18) * 50)
    img.paste(g, (gx, gy), g)

    g2 = radial_glow(620, PINK, 120)
    img.paste(g2, (int(W * 0.72 - 310), int(H * 0.78 - 310)), g2)

    img = img.convert("RGBA")
    stars = starfield().copy()
    img.alpha_composite(stars)

    if grid:
        gl = grid_layer().copy()
        # animate the floor sliding forward
        shift = int((gt * 90) % 140)
        gl = ImageChops.offset(gl, 0, 0)
        img.alpha_composite(gl)

    # vignette
    v = radial_glow(1400, (0, 0, 0), 235)
    v = v.resize((W, H))
    img.alpha_composite(v)

    return img.convert("RGB")


@lru_cache(maxsize=6)
def noise_tile(seed):
    rng = np.random.default_rng(seed)
    a = rng.integers(0, 255, (H, W), dtype=np.uint8)
    arr = np.stack([a, a, a, np.full_like(a, 13)], axis=-1)
    return Image.fromarray(arr, "RGBA")


def finish(img, gt, fade=1.0):
    img = img.convert("RGBA")
    img.alpha_composite(noise_tile(int(gt * FPS) % 3))
    if fade < 1:
        black = Image.new("RGBA", (W, H), (0, 0, 0, int(255 * (1 - fade))))
        img.alpha_composite(black)
    return img.convert("RGB")


# ---------------------------------------------------------------- cards


@lru_cache(maxsize=24)
def card(path, w, h, radius=22):
    im = Image.open(ASSETS / "shots" / path if not path.startswith("games/") else ASSETS / path)
    im = im.convert("RGB")
    sw, sh = im.size
    scale = max(w / sw, h / sh)
    nw, nh = int(sw * scale + 0.5), int(sh * scale + 0.5)
    im = im.resize((nw, nh), Image.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    im = im.crop((left, top, left + w, top + h))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    d = ImageDraw.Draw(out)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, outline=(255, 255, 255, 34), width=2)
    return out


@lru_cache(maxsize=24)
def card_shadow(w, h, radius=22, blur=34):
    m = Image.new("L", (w + blur * 2, h + blur * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [blur, blur, blur + w - 1, blur + h - 1], radius=radius, fill=170
    )
    m = m.filter(ImageFilter.GaussianBlur(blur * 0.55))
    sh = Image.new("RGBA", m.size, (0, 0, 0, 0))
    sh.putalpha(m)
    return sh


def paste_card(img, c, cx, cy, angle=0.0, scale=1.0, shadow=True, alpha=255):
    w, h = c.size
    if abs(scale - 1) > 0.002:
        c = c.resize((max(2, int(w * scale)), max(2, int(h * scale))), Image.LANCZOS)
    if abs(angle) > 0.2:
        c = c.rotate(angle, resample=Image.BICUBIC, expand=True)
    if alpha < 255:
        c = c.copy()
        a = c.getchannel("A").point(lambda v: int(v * alpha / 255))
        c.putalpha(a)
    if shadow:
        sh = card_shadow(w, h).resize(
            (int(c.width * 1.02), int(c.height * 1.02)), Image.BILINEAR
        )
        img.paste(sh, (int(cx - sh.width / 2), int(cy - sh.height / 2 + 26)), sh)
    img.paste(c, (int(cx - c.width / 2), int(cy - c.height / 2)), c)


def glass(img, box, radius, fill=(255, 255, 255, 16), outline=None, width=2):
    """Alpha-blended rounded rectangle (ImageDraw alone ignores alpha on RGB)."""
    x0, y0, x1, y1 = [int(v) for v in box]
    pad = width + 2
    region = img.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad)).convert("RGBA")
    layer = Image.new("RGBA", region.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        [pad, pad, x1 - x0 + pad, y1 - y0 + pad], radius=radius,
        fill=fill, outline=outline, width=width,
    )
    region.alpha_composite(layer)
    img.paste(region.convert("RGB"), (x0 - pad, y0 - pad))


def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- scene: intro


def scene_intro(img, d, lt, dur, gt):
    p = ease_out(lt / 1.15)
    # horizon line
    line_w = int(1180 * ease_out(lt / 0.9))
    d.line([(W // 2 - line_w // 2, 514), (W // 2 + line_w // 2, 514)],
           fill=(176, 95, 255, int(200 * min(1, lt / 0.8))), width=3)

    if lt > 0.15:
        ks = "6,572 GAMES  ·  ONE TAB"
        kf = F(23, 700, 100)
        kw = text_width(d, ks, kf, 9)
        tracked(d, (W / 2 - kw / 2, 452), ks, kf, (196, 156, 255), tracking=9)
    off = int((1 - p) * 90)
    title = "ZENOU"
    tw = text_width(d, title, F(196, 900, 108), tracking=6)
    draw_line(img, (W / 2 - tw / 2, 706 + off), title, F(196, 900, 108),
              (INK, (222, 170, 255)), tracking=6)
    sub_track = 12 + 26 * ease_out((lt - 0.45) / 1.0)
    tracked(d, (W / 2, 792 + off), "UNBLOCKED", F(46, 700, 120), (232, 224, 248),
            tracking=sub_track, anchor="ms")

    if lt > 1.1:
        a = ease_out((lt - 1.1) / 0.7)
        tracked(d, (W / 2, 884), "THE ARCADE, THE WEB, MEDIA AND MUSIC IN ONE PLACE",
                F(21, 500, 100), (150, 152, 175), tracking=5, anchor="ms")
        d.line([(W // 2 - 70, 820), (W // 2 + 70, 820)], fill=(178, 76, 255), width=2)


# ---------------------------------------------------------------- scene: games


GAME_CARDS = [
    ("games/crossy.png", 520, 328, -7.5, 1290, 240),
    ("games/clustertruck.png", 450, 284, 6.0, 1520, 540),
    ("games/howtofish.png", 410, 258, -3.5, 1180, 630),
]


def scene_games(img, d, lt, dur, gt):
    x = 120
    kicker(img, (x, 300), "Games", color=(196, 156, 255))
    draw_line(img, (x, 430), "PRESS PLAY.", F(102, 900, 104), INK, tracking=-3)
    draw_line(img, (x, 540), "STAY HERE.", F(102, 900, 104), ((210, 130, 255), (255, 79, 176)), tracking=-3)

    body = "Arcade classics, racing, sandbox worlds and\nfull 3D adventures. Every one opens in this tab."
    for i, line in enumerate(body.split("\n")):
        tracked(d, (x + 3, 618 + i * 38), line, F(27, 500, 100), MUTED, tracking=0.2)

    # counters
    count = int(6572 * ease_out(lt / 1.6))
    tracked(d, (x, 792), f"{count:,}", F(94, 900, 108), (238, 234, 250), tracking=-2)
    tracked(d, (x + 4, 826), "GAMES IN THE CATALOGUE", F(17, 700, 100), (144, 128, 176), tracking=5)

    chips = ["NO PRE-ROLL ADS", "NO INSTALLS", "ALL IN-PAGE"]
    cx = x + 4
    for i, c in enumerate(chips):
        a = ease_out((lt - 0.7 - i * 0.12) / 0.5)
        if a <= 0:
            continue
        f = F(16, 700, 100)
        tw = text_width(d, c, f, 3)
        y = 884
        glass(img, [cx, y - 20, cx + tw + 34, y + 10], 15,
              fill=(255, 255, 255, int(14 * a)), outline=(255, 255, 255, int(46 * a)))
        tracked(d, (cx + 17, y), c, f, (214, 206, 232), tracking=3)
        cx += tw + 52

    for i, (path, w, h, ang, cx0, cy0) in enumerate(GAME_CARDS):
        drift = math.sin(lt * 0.7 + i * 1.7) * 10
        rise = (1 - ease_out((lt - i * 0.14) / 0.9)) * 90
        c = card(path, w, h)
        cx1 = cx0 + math.sin(lt * 0.5 + i) * 8
        cy1 = cy0 + drift + rise
        paste_card(img, c, cx1 + 30, cy1 + 12, angle=ang + math.sin(lt * 0.4 + i) * 1.4 + 1.5,
                   alpha=45, shadow=False)
        paste_card(img, c, cx1, cy1, angle=ang + math.sin(lt * 0.4 + i) * 1.4)


# ---------------------------------------------------------------- scene: web


def scene_web(img, d, lt, dur, gt):
    x = 120
    kicker(img, (x, 250), "Web", color=(196, 156, 255))
    draw_line(img, (x, 372), "THE WEB,", F(112, 900, 104), INK, tracking=-3)
    draw_line(img, (x, 480), "IN HERE.", F(112, 900, 104), ((210, 130, 255), (255, 79, 176)), tracking=-3)
    for i, line in enumerate(["Open a site without leaving the arcade.", "Sites that allow framing load right below."]):
        tracked(d, (x + 3, 550 + i * 36), line, F(26, 500, 100), MUTED, tracking=0.2)

    beat2 = lt > 4.2
    if beat2:
        feats = [("EMBEDDED SITES", "load in the stage"), ("INSTANT SHORTCUTS", "one key, one site"),
                 ("DIRECT TABS", "your own list")]
        for i, (t1, t2) in enumerate(feats):
            a = ease_out((lt - 4.2 - i * 0.16) / 0.55)
            y = 668 + i * 82
            glass(img, [x, y - 30, x + 560, y + 36], 14,
                  fill=(255, 255, 255, int(12 * a)), outline=(255, 255, 255, int(38 * a)))
            d.ellipse([x + 20, y - 9, x + 38, y + 9], fill=(178, 76, 255, int(255 * a)))
            tracked(d, (x + 54, y + 2), t1, F(21, 800, 100), (240, 236, 250), tracking=3)
            tracked(d, (x + 54, y + 26), t2, F(17, 500, 100), (150, 145, 168), tracking=0.5)

    slide = (1 - ease_out((lt - 0.25) / 1.05)) * 220
    scale = 1.0 + max(0, (lt - 8) / 6) * 0.05
    paste_card(img, card("web.png", 980, 612), 1370 + slide, 430, angle=-2.2 + min(2.2, lt * 0.5), scale=scale)
    tag_text = "9 FAVOURITES · ANY KEY"
    tagf = F(15, 800, 100)
    tw2 = text_width(d, tag_text, tagf, 3)
    glass(img, [1100, 780, 1100 + tw2 + 38, 826], 14,
          fill=(12, 8, 20, 190), outline=(255, 118, 210, 120))
    tracked(d, (1119, 811), tag_text, tagf, (255, 190, 240), tracking=3)

    # address-bar highlight
    if lt > 1.4:
        a = ease_out((lt - 1.4) / 0.5)
        bx, by, bw, bh = 1110, 323, 430, 24
        d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=8,
                            outline=(255, 118, 210, int(220 * a)), width=3)


# ---------------------------------------------------------------- scene: media


def scene_media(img, d, lt, dur, gt):
    x = 120
    kicker(img, (x, 236), "Media", color=(255, 140, 210))
    draw_line(img, (x, 356), "EVERYTHING", F(100, 900, 104), INK, tracking=-3)
    draw_line(img, (x, 456), "YOU WATCH.", F(100, 900, 104), ((210, 130, 255), (255, 79, 176)), tracking=-3)
    tracked(d, (x + 3, 524), "A searchable video library, plus TikTok, Instagram", F(25, 500, 100), MUTED)
    tracked(d, (x + 3, 560), "and Discord through the built-in browser.", F(25, 500, 100), MUTED)

    apps = [("YouTube", (255, 72, 88)), ("TikTok", (120, 240, 235)), ("Instagram", (255, 120, 170)), ("Discord", (140, 150, 255))]
    ax = x + 3
    for i, (name, col) in enumerate(apps):
        a = ease_out((lt - 1.0 - i * 0.14) / 0.5)
        if a <= 0:
            continue
        f = F(22, 700, 100)
        tw = text_width(d, name, f, 1)
        y = 672
        glass(img, [ax, y - 30, ax + tw + 64, y + 20], 25,
              fill=(255, 255, 255, int(14 * a)), outline=col + (int(130 * a),))
        d.ellipse([ax + 20, y - 12, ax + 40, y + 8], fill=col + (int(255 * a),))
        tracked(d, (ax + 50, y + 2), name, f, (238, 236, 248, int(255 * a)), tracking=1)
        ax += tw + 86

    paste_card(img, card("media.png", 880, 550), 1350, 720, angle=1.2, scale=1.0 + lt * 0.006)
    tagf = F(15, 800, 100)
    tag_text = "SEARCHABLE · IN-PAGE"
    tw2 = text_width(d, tag_text, tagf, 3)
    glass(img, [1060, 452, 1060 + tw2 + 38, 498], 14,
          fill=(12, 8, 20, 190), outline=(255, 118, 210, 130))
    tracked(d, (1079, 483), tag_text, tagf, (255, 196, 240), tracking=3)


# ---------------------------------------------------------------- scene: music


def scene_music(img, d, lt, dur, gt):
    x = 120
    kicker(img, (x, 250), "Music", color=(196, 156, 255))
    draw_line(img, (x, 400), "SOUND", F(132, 900, 104), INK, tracking=-3)
    draw_line(img, (x, 520), "ON.", F(132, 900, 104), ((210, 130, 255), (255, 79, 176)), tracking=-3)
    tracked(d, (x + 3, 596), "Spotify and SoundCloud through their own", F(26, 500, 100), MUTED)
    tracked(d, (x + 3, 632), "players, queued and remembered.", F(26, 500, 100), MUTED)

    # equalizer
    base = 900
    n = 26
    for i in range(n):
        hgt = 26 + abs(math.sin(gt * 2.2 + i * 0.55)) * 92 * (0.45 + 0.55 * math.sin(i * 1.3 + 0.7) ** 2)
        bx = x + i * 22
        col = tuple(int(PURPLE[j] * (0.55 + 0.45 * hgt / 120)) for j in range(3))
        d.rounded_rectangle([bx, base - hgt, bx + 11, base], radius=5, fill=col)

    paste_card(img, card("music.png", 940, 588), 1370, 470, angle=-1.8, scale=1.0 + max(0, lt - 2) * 0.01)
    tagf = F(15, 800, 100)
    tag_text = "SPOTIFY · SOUNDCLOUD"
    tw2 = text_width(d, tag_text, tagf, 3)
    glass(img, [1100, 796, 1100 + tw2 + 38, 842], 14,
          fill=(12, 8, 20, 190), outline=(178, 76, 255, 140))
    tracked(d, (1119, 827), tag_text, tagf, (226, 200, 255), tracking=3)


# ---------------------------------------------------------------- scene: build


def scene_build(img, d, lt, dur, gt):
    c1 = card("mineral.png", 620, 388)
    c2 = card("games/zenoucity.png", 700, 438)
    paste_card(img, c1, 548, 412, angle=-6 + lt * 0.4, scale=(1.0 + lt * 0.012), alpha=40, shadow=False)
    paste_card(img, c2, 1268, 712, angle=4 - lt * 0.3, scale=(1.0 + lt * 0.012), alpha=40, shadow=False)
    paste_card(img, c1, 520, 400, angle=-6 + lt * 0.4, scale=1.0 + lt * 0.012)
    paste_card(img, c2, 1240, 700, angle=4 - lt * 0.3, scale=1.0 + lt * 0.012)
    veil = Image.new("RGBA", (W, H), (7, 5, 14, 70))
    img.paste(veil, (0, 0), veil)

    title = "BUILD. DRIVE. EXPLORE."
    tw = text_width(d, title, F(76, 900, 106), tracking=1)
    glass(img, [W / 2 - tw / 2 - 42, 150, W / 2 + tw / 2 + 42, 264], 18,
          fill=(8, 6, 15, 205), outline=(190, 120, 255, 100))
    draw_line(img, (W / 2 - tw / 2, 242), title, F(76, 900, 106), (INK, (240, 190, 255)), tracking=1)
    tracked(d, (W / 2, 300), "MINERAL  ·  ZENOU CITY", F(20, 700, 100), (176, 150, 210), tracking=6, anchor="ms")


# ---------------------------------------------------------------- scene: you


@lru_cache(maxsize=1)
def you_background():
    bg = Image.open(ASSETS / "shots" / "home.png").convert("RGB")
    bg = bg.resize((W, int(bg.height * W / bg.width)), Image.LANCZOS)
    top = max(0, (bg.height - H) // 2)
    bg = bg.crop((0, top, W, top + H)).filter(ImageFilter.GaussianBlur(9))
    bg = bg.convert("RGBA")
    bg.alpha_composite(Image.new("RGBA", (W, H), (8, 6, 16, 185)))
    return bg.convert("RGB")


def scene_you(img, d, lt, dur, gt):
    img.paste(you_background(), (0, 0))
    d = ImageDraw.Draw(img)

    x = 120
    kicker(img, (x, 250), "Make it yours", color=(196, 156, 255))
    draw_line(img, (x, 408), "YOUR PLACE.", F(122, 900, 104), INK, tracking=-3)
    draw_line(img, (x, 522), "YOUR RULES.", F(122, 900, 104), ((210, 130, 255), (255, 79, 176)), tracking=-3)

    rows = [("Themes & accents", "one slider, every colour"), ("Animated backgrounds", "stars, snow, custom art"),
            ("A library that remembers", "favourites, notes, playtime")]
    for i, (t1, t2) in enumerate(rows):
        a = ease_out((lt - 1.0 - i * 0.3) / 0.6)
        if a <= 0:
            continue
        y = 680 + i * 92
        d.rounded_rectangle([x, y - 38, x + 760, y + 40], radius=16,
                            fill=(14, 10, 24, int(170 * a)), outline=(255, 255, 255, int(30 * a)))
        d.ellipse([x + 24, y - 14, x + 50, y + 12], outline=(210, 150, 255, int(255 * a)), width=3)
        d.line([x + 31, y - 1, x + 37, y + 6, x + 48, y - 8], fill=(230, 200, 255, int(255 * a)), width=3)
        tracked(d, (x + 74, y - 2), t1, F(28, 700, 100), (242, 238, 250, int(255 * a)), tracking=1)
        tracked(d, (x + 74, y + 28), t2, F(20, 500, 100), (162, 152, 180, int(255 * a)))

    # swatches
    cols = [(178, 76, 255), (255, 79, 176), (109, 242, 193), (255, 176, 76), (96, 165, 255)]
    for i, col in enumerate(cols):
        cx2 = W - 250 + math.sin(gt * 0.9 + i) * 10
        cy2 = 300 + i * 100
        d.ellipse([cx2 - 26, cy2 - 26, cx2 + 26, cy2 + 26], fill=col)
        d.ellipse([cx2 - 38, cy2 - 38, cx2 + 38, cy2 + 38], outline=col, width=2)


# ---------------------------------------------------------------- scene: outro


def scene_outro(img, d, lt, dur, gt):
    # faint strips of the site drifting
    strips = ["home.png", "library.png", "web.png", "media.png"]
    for i, s in enumerate(strips):
        c = card(s, 340, 214, radius=14)
        y = 760 + i * 90 + math.sin(gt * 0.5 + i) * 12
        paste_card(img, c, 260 + i * 480, y, angle=-4 + i * 2.4, alpha=42, shadow=False,
                   scale=1.0 + 0.12 * math.sin(gt * 0.6 + i))

    veil = Image.new("RGBA", (W, H), (8, 6, 16, 150))
    img.paste(veil, (0, 0), veil)

    logo = Image.open(ASSETS / "shots" / "logo-mark.png").convert("RGBA")
    lw = 112
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    lmask = Image.new("L", logo.size, 0)
    ImageDraw.Draw(lmask).rounded_rectangle([0, 0, logo.width - 1, logo.height - 1],
                                            radius=int(lw * 0.26), fill=255)
    logo.putalpha(lmask)
    img.paste(logo, (W // 2 - lw // 2, 250), logo)

    tw = text_width(d, "ZENOU UNBLOCKED", F(84, 900, 108), tracking=2)
    draw_line(img, (W / 2 - tw / 2, 470), "ZENOU UNBLOCKED", F(84, 900, 108),
              (INK, (228, 186, 255)), tracking=2)

    d.line([(W // 2 - 250, 520), (W // 2 + 250, 520)], fill=(178, 76, 255), width=2)

    tag = "ONE TAB. EVERYTHING."
    tracked(d, (W // 2, 610), tag, F(38, 700, 110), (226, 214, 245), tracking=14, anchor="ms")

    url = "zenou-unblocked"
    f = F(26, 600, 100)
    uw = text_width(d, url, f, 1)
    glass(img, [W / 2 - uw / 2 - 34, 682, W / 2 + uw / 2 + 34, 746], 32,
          fill=(255, 255, 255, 18), outline=(200, 150, 255, 130))
    tracked(d, (W / 2, 724), url, f, (236, 226, 252), tracking=1, anchor="ms")

    tracked(d, (W // 2, 820), "6,572 games  ·  web  ·  media  ·  music  ·  mineral", F(19, 500, 100),
            (146, 138, 170), tracking=4, anchor="ms")


def scene_stats(img, d, lt, dur, gt):
    img.paste(speed_lines(img, lt, 0.9), (0, 0))
    d = ImageDraw.Draw(img)

    # drifting game cards behind the numbers
    faint = [("games/clustertruck.png", 320, 202, 210, 700, -9),
             ("games/crossy.png", 300, 190, 1500, 250, 7),
             ("games/howtofish.png", 300, 190, 1640, 720, -5),
             ("games/zenoucity.png", 330, 208, 120, 220, 6)]
    for i, (path, w, h, cx, cy, ang) in enumerate(faint):
        paste_card(img, card(path, w, h), cx + math.sin(lt * 0.6 + i) * 14, cy + math.cos(lt * 0.5 + i) * 10,
                   angle=ang + math.sin(lt + i) * 2, alpha=52, shadow=False)

    kicker(img, (120, 248), "The shelf", color=(196, 156, 255))
    draw_line(img, (118, 362), "SIX THOUSAND", F(88, 900, 104), INK, tracking=-2)
    draw_line(img, (118, 452), "FIVE HUNDRED AND SEVENTY-TWO.", F(64, 900, 104), ((210, 130, 255), (255, 79, 176)), tracking=-1)

    cols = [("6,572", "GAMES IN THE CATALOGUE", 6572, 0.0),
            ("3,900", "START WITH NO PRE-ROLL", 3900, 0.25),
            ("0", "LINKS OUT OF THIS TAB", 0, 0.5)]
    base_y = 812
    for i, (label, sub, target, delay) in enumerate(cols):
        x = 140 + i * 600
        a = ease_out((lt - 0.8 - delay) / 0.7)
        if a <= 0:
            continue
        n = int(target * ease_out((lt - 0.8 - delay) / 1.5))
        draw_line(img, (x, base_y), f"{n:,}", F(128, 900, 108), (INK, (240, 196, 255)), tracking=-3)
        tracked(d, (x + 4, base_y + 36), sub, F(17, 700, 100), (168, 160, 190), tracking=4)
        d.rectangle([x, base_y + 54, x + int(360 * a), base_y + 58], fill=(178, 76, 255, 220))
        if i:
            d.line([(x - 70, base_y - 120), (x - 70, base_y + 46)], fill=(255, 255, 255, 28), width=2)

    wing = "CLUSTERTRUCK  ·  CROSSY ROAD  ·  HOW TO FISH  ·  ZENOU CITY"
    tracked(d, (120, 1012), wing, F(16, 700, 100), (150, 136, 176), tracking=5)


def scene_library(img, d, lt, dur, gt):
    img.paste(speed_lines(img, lt, 0.55), (0, 0))
    d = ImageDraw.Draw(img)
    paste_card(img, card("library-real.png", 1010, 632), 1400 + (1 - ease_out(lt / 1.1)) * 120, 430,
               angle=-2.4 + min(2.4, lt * 0.7), scale=1.03 - 0.03 * ease_out(lt / 2.5))

    x = 118
    kicker(img, (x, 250), "My Library", color=(196, 156, 255))
    draw_line(img, (x, 400), "IT", F(112, 900, 104), INK, tracking=-3)
    draw_line(img, (x, 512), "REMEMBERS.", F(112, 900, 104), ((210, 130, 255), (255, 79, 176)), tracking=-3)
    tracked(d, (x + 3, 566), "Favourites, ratings, notes, playlists, playtime, achievements.", F(23, 500, 100), MUTED)

    chips = ["FAVOURITES", "RATINGS", "NOTES", "PLAYLISTS", "PLAYTIME", "ACHIEVEMENTS"]
    for i, c in enumerate(chips):
        a = ease_out((lt - 1.1 - i * 0.1) / 0.45)
        if a <= 0:
            continue
        col, row = i % 2, i // 2
        cx = x + 3 + col * 246
        cy = 668 + row * 78
        f = F(16, 700, 100)
        tw = text_width(d, c, f, 2)
        glass(img, [cx, cy - 26, cx + tw + 52, cy + 22], 14,
              fill=(255, 255, 255, int(13 * a)), outline=(200, 150, 255, int(90 * a)))
        d.ellipse([cx + 16, cy - 7, cx + 30, cy + 7], fill=(109, 242, 193, int(230 * a)))
        tracked(d, (cx + 40, cy), c, f, (226, 220, 240), tracking=2)


SCENES = [
    ("intro", scene_intro, ["01_intro"], 0.20, 0.20, 0.50),
    ("games", scene_games, ["02_games"], 0.15, 0.00, 0.45),
    ("stats", scene_stats, ["03_stats"], 0.15, 0.00, 0.45),
    ("web", scene_web, ["04_web", "05_web2"], 0.15, 0.18, 0.45),
    ("media", scene_media, ["06_media"], 0.15, 0.00, 0.45),
    ("music", scene_music, ["07_music"], 0.15, 0.00, 0.45),
    ("build", scene_build, ["08_build"], 0.15, 0.00, 0.45),
    ("library", scene_library, ["09_library"], 0.15, 0.00, 0.45),
    ("you", scene_you, ["10_you"], 0.15, 0.00, 0.55),
    ("outro", scene_outro, ["11_outro"], 0.25, 0.00, 0.80),
]


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def timeline():
    t = 0.0
    rows = []
    for name, fn, clips, lead, gap, tail in SCENES:
        dur = lead + tail
        starts = []
        for c in clips:
            starts.append(t + lead + (dur - lead - tail))
            dur += probe(ASSETS / "audio" / f"{c}.mp3") + gap
        rows.append(dict(name=name, fn=fn, start=t, dur=dur, clips=clips, clip_starts=starts))
        t += dur
    return rows, t


def speed_lines(img, lt, intensity=0.6, color=(222, 190, 255)):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = W * 0.55, H * 0.52
    for i in range(26):
        ang = (i / 26) * math.tau + lt * 0.22
        r0 = 360 + (i % 4) * 95
        r1 = r0 + 170 + (i % 3) * 130
        d.line([
            (cx + math.cos(ang) * r0, cy + math.sin(ang) * r0 * 0.62),
            (cx + math.cos(ang) * r1, cy + math.sin(ang) * r1 * 0.62),
        ], fill=color + (int(30 * intensity),), width=2)
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def wipe(img, lt, color=PURPLE):
    if lt > 0.3:
        return img
    p = lt / 0.3
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(5):
        off = (p ** 0.6) * (W + 900) - 450 - i * 210
        pts = [(off + i * 60, -50), (off + 320 + i * 60, -50), (off + 120 + i * 60, H + 50), (off - 200 + i * 60, H + 50)]
        d.polygon(pts, fill=color + (int(80 * (1 - p)),))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def transition_fx(img, lt):
    img = wipe(img, lt)
    if lt < 0.22:
        img = speed_lines(img, lt, intensity=1.4 * (1 - lt / 0.22))
        img = img.copy()
        for i in range(4):
            y = int((i * 211 + lt * 1400) % H)
            h = 8 + (i * 11) % 34
            shift = int(math.sin(i * 2.3 + lt * 42) * 70 * (1 - lt / 0.22))
            strip = img.crop((0, y, W, min(H, y + h)))
            img.paste(strip, (shift, y))
        flash = Image.new("RGB", (W, H), (255, 255, 255))
        img = Image.blend(img, flash, 0.18 * (1 - lt / 0.22))
    return img


def render_frame(rows, gt):
    total_dur = rows[-1]["start"] + rows[-1]["dur"]
    idx = 0
    for i, r in enumerate(rows):
        if gt < r["start"] + r["dur"]:
            idx = i
            break
    r = rows[idx]
    lt = gt - r["start"]
    img = background(gt, tint=PURPLE if idx % 2 == 0 else (255, 90, 170),
                     glow_pos=(0.2, 0.16) if idx % 2 == 0 else (0.78, 0.2),
                     grid=(r["name"] == "intro"))
    d = ImageDraw.Draw(img)
    r["fn"](img, d, lt, r["dur"], gt)
    img = transition_fx(img, lt)

    # reel progress line along the bottom
    d = ImageDraw.Draw(img)
    ty = H - 30
    d.line([(120, ty), (W - 120, ty)], fill=(255, 255, 255, 28), width=2)
    d.line([(120, ty), (120 + int((W - 240) * gt / total_dur), ty)], fill=(206, 140, 255, 210), width=3)
    for rr in rows:
        dx = 120 + (W - 240) * rr["start"] / total_dur
        d.line([(dx, ty - 5), (dx, ty + 5)], fill=(255, 255, 255, 46), width=1)

    fade = min(1.0, gt / 0.7, max(0.0, (total_dur - gt) / 1.2))
    return finish(img, gt, fade)


# ---------------------------------------------------------------- audio


def build_audio(rows, total):
    vo_dir = ASSETS / "audio"
    inputs = [str(ASSETS / "audio" / "Cachalot.mp3")]
    filters = []
    mix_inputs = []
    for i, r in enumerate(rows):
        for j, clip in enumerate(r["clips"]):
            inputs.append(str(vo_dir / f"{clip}.mp3"))
            delay = int(1000 * (r["clip_starts"][j]))
            lbl = f"v{i}_{j}"
            filters.append(f"[{len(inputs)-1}:a]adelay={delay}|{delay},volume=1.0[{lbl}]")
            mix_inputs.append(f"[{lbl}]")

    loops = max(2, int(math.ceil(total / 19.0)) + 1)
    filters.append(f"[0:a]asplit={loops}" + "".join(f"[m{i}]" for i in range(loops)))
    prev = "m0"
    for i in range(1, loops):
        lbl = f"x{i}"
        filters.append(f"[{prev}][m{i}]acrossfade=d=1.0:c1=tri:c2=tri[{lbl}]")
        prev = lbl
    filters.append(f"[{prev}]atrim=0:{total:.3f},loudnorm=I=-21:TP=-3:LRA=9,afade=t=in:st=0:d=1.2,afade=t=out:st={total-2.6:.3f}:d=2.6[bed]")
    filters.append("".join(mix_inputs) + f"amix=inputs={len(mix_inputs)}:normalize=0[vo]")
    filters.append(f"[vo]loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur={total:.3f}[vo2]")
    filters.append("[bed][vo2]sidechaincompress=threshold=0.02:ratio=9:attack=12:release=380[duck]")
    filters.append("[duck][vo2]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.85[aoutpre]")
    filters.append(f"[aoutpre]apad=whole_dur={total:.3f},atrim=0:{total:.3f}[aout]")

    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for i in inputs:
        cmd += ["-i", i]
    cmd += ["-filter_complex", ";".join(filters), "-map", "[aout]", "-t", f"{total:.3f}",
            "-c:a", "aac", "-b:a", "192k", str(OUT / "trailer-audio.m4a")]
    subprocess.run(cmd, check=True)


# ---------------------------------------------------------------- main


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows, total = timeline()
    print(f"timeline: {total:.2f}s, {len(rows)} scenes")

    if "--stills" in sys.argv:
        for r in rows:
            for frac in (0.45, 0.8):
                gt = r["start"] + r["dur"] * frac
                img = render_frame(rows, gt)
                img.save(OUT / f"still-{r['name']}-{int(frac*100)}.jpg", quality=92)
        print("stills written")
        return

    if "--frames" in sys.argv:
        FRAMES.mkdir(exist_ok=True)
        n = int(total * FPS)
        for i in range(n):
            gt = i / FPS
            render_frame(rows, gt).save(FRAMES / f"f{i:05d}.jpg", quality=93)
            if i % 96 == 0:
                print(f"  frame {i}/{n}", flush=True)
        print("frames done")
        return

    build_audio(rows, total)

    if not any(FRAMES.glob("*.jpg")):
        print("no frames yet — run with --frames first")
        return

    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-framerate", str(FPS), "-i", str(FRAMES / "f%05d.jpg"),
        "-i", str(OUT / "trailer-audio.m4a"),
        "-c:v", "libx264", "-preset", "slower", "-crf", "26", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
        str(OUT / "zenou-trailer.mp4"),
    ], check=True)
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", "2.0", "-i", str(OUT / "zenou-trailer.mp4"), "-frames:v", "1",
        "-q:v", "3", str(OUT / "zenou-trailer.jpg"),
    ], check=True)
    print("encoded", OUT / "zenou-trailer.mp4")


if __name__ == "__main__":
    main()
