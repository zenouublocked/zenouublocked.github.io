#!/usr/bin/env python3
"""Append popular Scratch projects to catalog/games.json.

Scratch projects are CC BY-SA 2.0 and play in Scratch's official embed, which
carries no advertising. This script only adds metadata + the official embed URL;
nothing is copied or re-hosted.

Usage: python scripts/fetch-scratch.py [target_count]
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "catalog" / "games.json"
API = "https://api.scratch.mit.edu/search/projects"
UA = "zenou-catalog/1.0 (+https://github.com/zenoutools)"

QUERIES = [
    "game", "platformer", "racing", "shooter", "puzzle",
    "tycoon", "horror", "soccer", "tower defense", "escape",
    "mario", "minecraft", "parkour", "car", "zombie", "clicker", "battle",
    "bike", "stunt", "drift", "truck", "motorcycle", "moto x3m", "hill climb",
    "driving", "gta", "slope", "subway", "skate", "police", "city builder",
    "basketball", "football", "golf", "tennis", "boxing", "samurai", "ninja",
    "dungeon", "survival", "crafting", "space", "robot", "dragon", "pokemon",
    "fnaf", "granny", "stealth", "pixel art", "rhythm", "music", "farming",
    "fishing", "cooking", "restaurant", "hospital", "airport", "train",
]
PAGES = 14          # 40 results per page
MIN_VIEWS = 12_000
TARGET = int(sys.argv[1]) if len(sys.argv) > 1 else 1000

SKIP_WORDS = (
    "animation", "animatic", "art collab", "meme", "trailer",
    "credits", "music video", "comic", "storytime",
)

CATEGORY_RULES = [
    ("racing", ("race", "racing", "drift", " car", "truck", "bike", "moto", "kart", "speed")),
    ("platformer", ("mario", "platform", "sonic", "parkour", "jump")),
    ("shooter", ("shoot", "gun", "tank", "war", "fps", "zombie", "battle royale")),
    ("puzzle", ("puzzle", "2048", "sudoku", "tetris", "match", "maze", "quiz", "trivia")),
    ("sports", ("soccer", "football", "basketball", "tennis", "golf", "baseball", "hockey")),
    ("horror", ("horror", "scary", "fnaf", "granny", "escape")),
    ("tycoon", ("tycoon", "simulator", "idle", "clicker", "factory", "city builder")),
    ("adventure", ("adventure", "rpg", "quest", "dungeon")),
    ("arcade", ("arcade", "flappy", "snake", "breakout", "space invaders", "pacman")),
]


def clean(text, limit=90):
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    return text[:limit]


def category_for(title, instructions):
    hay = (title + " " + instructions).lower()
    for cat, needles in CATEGORY_RULES:
        if any(n in hay for n in needles):
            return cat
    return "arcade"


def fetch(query, offset):
    params = urllib.parse.urlencode({
        "q": query, "limit": 40, "offset": offset,
        "language": "en", "mode": "popular",
    })
    req = urllib.request.Request(f"{API}?{params}", headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            wait = 4 * (attempt + 1)
            print(f"    429 on {query}@{offset}; waiting {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError("rate limited")


def dump(data, games, added):
    base = [g for g in games if not g["id"].startswith("sc-new-")]
    data["games"] = base + added
    CATALOG.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def main():
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    games = data["games"]
    seen_ids = {g["id"] for g in games}
    seen_titles = {g["t"].strip().lower() for g in games}
    added = []

    for query in QUERIES:
        if len(added) >= TARGET:
            break
        for page in range(PAGES):
            if len(added) >= TARGET:
                break
            try:
                rows = fetch(query, page * 40)
            except Exception as e:
                print(f"  ! {query} offset {page * 40}: {e}")
                time.sleep(1.0)
                continue
            for p in rows:
                if len(added) >= TARGET:
                    break
                pid = p.get("id")
                title = clean(p.get("title"))
                if not pid or len(title) < 3:
                    continue
                if p["stats"].get("views", 0) < MIN_VIEWS:
                    continue
                key = title.lower()
                if key in seen_titles or len(key.split()) > 14:
                    continue
                hay = f"{title} {p.get('instructions', '')}".lower()
                if any(w in hay for w in SKIP_WORDS):
                    continue
                gid = f"sc-{pid}"
                if gid in seen_ids:
                    continue
                cat = category_for(title, p.get("instructions", ""))
                cats = [cat, "scratch"]
                if any(n in hay for n in ("multiplayer", "online", "silver", ".io")):
                    if "multiplayer" not in cats:
                        cats.insert(1, "multiplayer")
                added.append({
                    "id": gid,
                    "t": title,
                    "cs": cats,
                    "s": "scratch",
                    "a": p["author"]["username"],
                    "p": "sc",
                    "u": f"https://scratch.mit.edu/projects/{pid}/embed?autostart=true",
                    "g": f"https://scratch.mit.edu/projects/{pid}",
                    "img": f"https://cdn2.scratch.mit.edu/get_image/project/{pid}_480x360.png",
                    "pc": p["stats"]["views"],
                })
                seen_ids.add(gid)
                seen_titles.add(key)
                if len(added) % 40 == 0:
                    dump(data, games, added)
            print(f"{query:14} +{len(added):4} total")
            time.sleep(1.4)

    dump(data, games, added)
    print(f"added {len(added)} games; catalogue now {len(games)}")


if __name__ == "__main__":
    main()
