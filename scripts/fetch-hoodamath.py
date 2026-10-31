#!/usr/bin/env python3
"""Import HoodaMath's HTML5 games and keep the catalogue playable-only.

HoodaMath publishes each game page at
    https://www.hoodamath.com/games/<slug>.html
and HTML5 titles frame their actual build from
    https://www.hoodamath.com/mobile/games/<dir>/game.html?nocheckorient=1

That second URL is the build itself: no site chrome, no gate, no ad wrapper and
no framing restriction. This script extracts it for every game whose page uses
an iframe, checks that it answers 200 without X-Frame-Options / CSP
frame-ancestors, and adds it to catalog/games.json.

Maths titles are skipped by category (Addition, Subtraction, Multiplication,
Division, Fractions, Integers, Algebra, Geometry, …). Puzzle/logic/board games
that HoodaMath files under its maths menu (2048, Checkers, Connect 4, Dark Room)
are kept, because they are games, not arithmetic drills.

The merge:
  · A playable HoodaMath build always wins over the same title from an
    ad-supported portal, so the catalogue prefers the build that starts instantly.
  · Duplicate titles and duplicate build URLs are collapsed.
  · Anything that cannot run in the page is removed, this site never sends a
    visitor to an external page.

Usage: python scripts/fetch-hoodamath.py [--workers 16] [--limit N] [--dry]
"""
import concurrent.futures as cf
import io
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "catalog" / "games.json"
MANIFEST = ROOT / "catalog" / "manifest.json"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

WORKERS = 16
LIMIT = 0
DRY = False
for i, a in enumerate(sys.argv):
    if a == "--workers" and i + 1 < len(sys.argv):
        WORKERS = int(sys.argv[i + 1])
    if a == "--limit" and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])
    if a == "--dry":
        DRY = True

CARD = re.compile(
    r'<a class="game-card" href="https://www\.hoodamath\.com/games/([^"]+?)\.html">\s*'
    r'<div class="game-thumb">\s*<img src="([^"]+)" alt="([^"]*)"',
    re.S,
)
IFRAME = re.compile(r'<iframe[^>]+src="([^"]+)"', re.I)
DRAWER_CAT = re.compile(r'<details class="drawer-cat">(.*?)</details>', re.S)
AD_HOSTS = ("doubleclick", "googlesyndication", "googleadservices", "amazon-adsystem", "adnxs")

# Whole learning strands. A game filed under one of these is a maths drill.
MATH_CATEGORIES = (
    "addition", "subtraction", "multiplication", "division", "fraction",
    "integer", "algebra", "decimal", "percent", "exponent", "ratio",
    "geometry", "place value", "rounding", "counting", "money",
    "telling time", "measurement", "coordinate", "graphing", "times table",
)
# Catch a stray drill that the site files elsewhere.
MATH_SLUGS = {
    "flappymultiples", "touchshapes", "countthecubes", "numbereaters",
    "numbersnake", "primefactortreegame", "calculatorbalance", "digitle",
}

MATH_NAME = re.compile(
    r"\b(math|maths|addition|subtraction|multiplication|division|fractions?|"
    r"decimals?|algebra|geometry|integers?|equations?|times tables?|"
    r"place value|rounding|protractor|symmetry|probability)\b",
    re.I,
)

CATEGORY_RULES = [
    ("drift", ("drift",)),
    ("racing", ("race", "racing", "kart", "nascar", "formula", "speed", "turbo", "car ")),
    ("motorcycle", ("moto", "bike", "motorcycle", "wheelie")),
    ("stunt", ("stunt", "flip", "jump", "ragdoll", "crash")),
    ("runner", ("run", "runner", "escape", "parkour", "dash")),
    ("platformer", ("platform", "mario", "sonic", "adventure", "jump")),
    ("shooter", ("shoot", "gun", "war", "sniper", "zombie", "tank", "battle")),
    ("horror", ("horror", "scary", "granny", "fnaf", "night", "ghost")),
    ("sports", ("soccer", "football", "basketball", "tennis", "golf", "hockey", "baseball", "boxing", "sport")),
    ("io", (".io", "agar", "slither")),
    ("multiplayer", ("multiplayer", "2 player", "2player", "online")),
    ("puzzle", ("puzzle", "match", "block", "tetris", "sudoku", "maze", "brain", "word", "2048")),
    ("tycoon", ("tycoon", "idle", "clicker", "simulator", "builder", "farm", "restaurant")),
    ("stickman", ("stickman", "stick man", "henry")),
    ("fighting", ("fight", "combat", "karate", "boxing", "smash")),
    ("arcade", ("arcade", "classic", "snake", "pacman", "invader", "breakout", "flappy")),
]

REFERENCE = {"lo", "hm", "pf", "sc", "pg"}


def norm(title):
    t = re.sub(r"[^a-z0-9 ]+", " ", (title or "").lower())
    return re.sub(r"\s+", " ", t).strip()


def dedupe_key(title):
    """Collapse 'X Game' / 'X Unblocked' / 'X HTML5' onto 'X', not 'Game of Life'."""
    t = norm(title)
    t = re.sub(r"\s+(games?|unblocked|html5|free|online|play)$", "", t)
    return t


def fetch(url, timeout=25, read=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        if read:
            return r.status, r.headers, r.read(read)
        return r.status, r.headers, b""


def categories(name, slug):
    hay = f"{name} {slug}".lower()
    cats = [cat for cat, words in CATEGORY_RULES if any(w in hay for w in words)]
    return cats[:3] + ["hoodamath"]


def iframe_src(html):
    """The game build, not an ad slot. Prefer HoodaMath's own /mobile/games/ frame."""
    srcs = [s.replace("&amp;", "&") for s in IFRAME.findall(html)]
    for s in srcs:
        if "/mobile/games/" in s:
            return s
    for s in srcs:
        if s.startswith("https://") and not any(h in s for h in AD_HOSTS):
            return s
    return None


def probe_game(card):
    slug, thumb, name = card
    if MATH_NAME.search(f"{name} {slug}"):
        return None
    page = f"https://www.hoodamath.com/games/{slug}.html"
    body = None
    for _ in range(2):
        try:
            _, _, raw = fetch(page, read=250_000)
            body = raw.decode("utf-8", "replace")
            break
        except Exception:
            body = None
    if not body:
        return None
    content = iframe_src(body)
    if not content:
        return None
    try:
        status, headers, _ = fetch(content, read=2048)
    except Exception:
        return None
    if status != 200:
        return None
    xfo = (headers.get("X-Frame-Options") or "").lower()
    csp = (headers.get("Content-Security-Policy") or "").lower()
    if "deny" in xfo or "sameorigin" in xfo or "frame-ancestors" in csp:
        return None
    return {
        "id": f"hm-{slug}",
        "t": html_lib.unescape(name).strip()[:90],
        "cs": categories(name, slug),
        "s": "hoodamath",
        "a": None,
        "p": "hm",
        "u": content,
        "g": page,
        "img": thumb.replace("&amp;", "&"),
        "note": "Runs from HoodaMath's own game build inside this page, no portal shell and no pre-game gate.",
    }


def main():
    print("reading the HoodaMath catalogue…", flush=True)
    _, _, home = fetch("https://www.hoodamath.com/games/allgames.html", read=2_000_000)
    html = home.decode("utf-8", "replace")

    cards, seen = [], set()
    for m in CARD.finditer(html):
        slug, thumb, name = m.group(1), m.group(2), m.group(3)
        if slug in seen:
            continue
        seen.add(slug)
        cards.append((slug, thumb, name))

    # Maths strands come from the drawer's own category groups.
    math_slugs = set()
    for block in DRAWER_CAT.findall(html):
        label = re.sub(r"<[^>]+>", "", block.split("</summary>")[0]).strip().lower()
        if any(word in label for word in MATH_CATEGORIES):
            math_slugs.update(
                re.findall(r'href="https://www\.hoodamath\.com/games/([^"]+?)\.html"', block)
            )

    keep = [c for c in cards if c[0] not in math_slugs and c[0] not in MATH_SLUGS]
    print(
        f"{len(cards)} unique games · {len(math_slugs)} maths-category slugs skipped · "
        f"{len(keep)} candidates",
        flush=True,
    )
    if LIMIT:
        keep = keep[:LIMIT]

    results, done = [], 0
    with cf.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for res in pool.map(probe_game, keep):
            done += 1
            if res:
                results.append(res)
            if done % 100 == 0:
                print(f"  {done}/{len(keep)} checked, {len(results)} playable", flush=True)

    print(f"playable HTML5 HoodaMath builds: {len(results)}", flush=True)
    if DRY:
        out = ROOT.parent / ".tmp" / "hooda-results.json"
        out.parent.mkdir(exist_ok=True)
        out.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"dry run, wrote {out}", flush=True)
        return

    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    games = data["games"]

    # ---- an embedded publisher build is not an ad-supported portal build
    for g in games:
        if g.get("s") != "crazygames-official":
            continue
        host = re.sub(r"^https?://([^/]+).*", r"\1", g.get("u") or "")
        g["p"] = "pg" if host.endswith("crazygames.com") else "pf"

    # ---- swap matching portal titles for the HoodaMath build
    by_title = {}
    for r in results:
        by_title.setdefault(dedupe_key(r["t"]), []).append(r)

    swapped = 0
    for g in games:
        if g.get("p") not in ("pf", "pg", "sc"):
            continue
        cand = by_title.get(dedupe_key(g.get("t")))
        if not cand:
            continue
        src = cand.pop(0)
        g["p"] = "hm"
        g["s"] = "hoodamath"
        g["a"] = None
        g["u"] = src["u"]
        g["g"] = src["g"]
        if src["img"]:
            g["img"] = src["img"]
        g["note"] = src["note"]
        swapped += 1

    used_urls = {g["u"] for g in games if g.get("u")}
    used_ids = {g["id"] for g in games}
    used_titles = {dedupe_key(g.get("t")) for g in games}
    added = 0
    for src in results:
        key = dedupe_key(src["t"])
        if src["u"] in used_urls or src["id"] in used_ids or key in used_titles:
            continue
        games.append(src)
        used_urls.add(src["u"])
        used_ids.add(src["id"])
        used_titles.add(key)
        added += 1

    # ---- never route off-site
    before = len(games)
    games = [g for g in games if g.get("p") != "ex" and g.get("u")]
    dropped_external = before - len(games)

    # ---- dedupe, preferring the build that starts with no ad
    rank = {"lo": 0, "hm": 1, "pf": 2, "sc": 3, "pg": 4}
    order, best = [], {}
    for g in games:
        key = dedupe_key(g.get("t"))
        url = g.get("u")
        if key not in best:
            order.append(key)
            best[key] = g
            continue
        if rank.get(g.get("p"), 9) < rank.get(best[key].get("p"), 9):
            best[key] = g
    deduped, seen_urls, dropped_dupes = [], set(), 0
    for key in order:
        g = best[key]
        if g.get("u") in seen_urls:
            dropped_dupes += 1
            continue
        seen_urls.add(g["u"])
        deduped.append(g)
    dropped_dupes += len(games) - len(deduped) - dropped_dupes
    games = deduped

    data["games"] = games
    data["v"] = "2026-10-30"
    CATALOG.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    counts = {}
    for g in games:
        counts[g.get("p")] = counts.get(g.get("p"), 0) + 1
    srcs = {}
    for g in games:
        srcs[g.get("s")] = srcs.get(g.get("s"), 0) + 1

    print(f"swapped for HoodaMath: {swapped}")
    print(f"new HoodaMath games:    {added}")
    print(f"removed external-only:  {dropped_external}")
    print(f"removed duplicates:     {dropped_dupes}")
    print(f"catalogue now:          {len(games)}  {counts}")

    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    man["build"] = "2026-10-30T18:00:00.000Z"
    man["totals"] = {
        "entries": len(games),
        "playableOnSite": len(games),
        **counts,
        **srcs,
        "externalOnly": 0,
    }
    man["verification"] = {
        "method": (
            "Every entry is embedded in play.html. Portal titles are loaded from the "
            "publisher's own build URL; no entry links out."
        ),
        "hoodamath": (
            "Every HoodaMath game is played from their own build URL "
            "(hoodamath.com/mobile/games/<dir>/game.html), checked for HTTP 200 and for "
            "the absence of X-Frame-Options / CSP frame-ancestors. Maths categories are "
            "skipped; puzzle, logic and board games are kept."
        ),
        "scratch": "Every Scratch ID probed against the official Scratch API · official /embed player",
        "crazygames": (
            "Titles served from games.crazygames.com are embedded through that file host; "
            "publisher builds are embedded from their own domain."
        ),
        "providerNote": "pf games load from the publisher's own hosting with no portal shell.",
        "noExternalRouting": "Entries that could not run in the page were removed rather than linked out.",
    }
    MANIFEST.write_text(json.dumps(man, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
