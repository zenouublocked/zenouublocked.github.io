#!/usr/bin/env python3
"""Re-check every CrazyGames embed for the in-game "exclusive" gate.

A CrazyGames slug is served through a wrapper page at
    https://games.crazygames.com/en_US/<slug>/index.html
and that wrapper carries a JSON config with a `disableEmbedding` flag. When it
is true the build refuses to run anywhere except crazygames.com and shows
"This version of <game> can be played exclusively on CrazyGames.com".

Reading that flag lets us stop sending people into a dead frame: those titles
become external-only entries that open the publisher's official page.

Usage: python scripts/verify-crazygames.py [--workers 16]
"""
import concurrent.futures as cf
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "catalog" / "games.json"
MANIFEST = ROOT / "catalog" / "manifest.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

WORKERS = 16
for i, a in enumerate(sys.argv):
    if a == "--workers" and i + 1 < len(sys.argv):
        WORKERS = int(sys.argv[i + 1])

FLAG = re.compile(r'"disableEmbedding"\s*:\s*(true|false)')
SLUG = re.compile(r"/en_US/([^/]+)/")


def probe(url):
    """True = cannot embed, False = fine, None = could not tell."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for _ in range(2):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                html = r.read(200_000).decode("utf-8", "replace")
            m = FLAG.search(html)
            if not m:
                return None
            return m.group(1) == "true"
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                return None
            return None
        except Exception:
            continue
    return None


def main():
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    games = data["games"]

    targets = []
    for g in games:
        if g.get("p") != "pg":
            continue
        m = SLUG.search(g.get("u") or "")
        if not m:
            continue
        targets.append((g, m.group(1)))

    print(f"checking {len(targets)} CrazyGames embeds with {WORKERS} workers", flush=True)

    results = {}
    done = 0
    with cf.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {
            pool.submit(probe, f"https://games.crazygames.com/en_US/{slug}/index.html"): slug
            for _, slug in targets
        }
        for fut in cf.as_completed(futures):
            slug = futures[fut]
            try:
                results[slug] = fut.result()
            except Exception:
                results[slug] = None
            done += 1
            if done % 250 == 0:
                print(f"  {done}/{len(targets)}", flush=True)

    blocked = 0
    for g, slug in targets:
        verdict = results.get(slug)
        if verdict is True:
            blocked += 1
            g["p"] = "ex"
            g["s"] = "crazygames-official"
            g["note"] = (
                "The publisher's build only runs on crazygames.com, so it opens there "
                "in a new tab instead of showing a blocked frame here."
            )
        elif verdict is False:
            g["p"] = "pg"

    CATALOG.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    counts = {
        "pg": sum(1 for x in games if x.get("p") == "pg"),
        "ex": sum(1 for x in games if x.get("p") == "ex"),
        "pf": sum(1 for x in games if x.get("p") == "pf"),
        "sc": sum(1 for x in games if x.get("p") == "sc"),
        "lo": sum(1 for x in games if x.get("p") == "lo"),
    }
    print(f"blocked (now external-only): {blocked}")
    print("counts:", counts)

    try:
        man = json.loads(MANIFEST.read_text(encoding="utf-8"))
        man["build"] = man.get("build")
        man["totals"] = {
            "entries": len(games),
            "playableOnSite": counts["pg"] + counts["pf"] + counts["sc"] + counts["lo"],
            "crazygamesFileIframes": counts["pg"],
            "providerFileIframes": counts["pf"],
            "scratchEmbeds": counts["sc"],
            "selfHosted": counts["lo"],
            "externalOnly": counts["ex"],
        }
        man["verification"]["method"] = (
            "Per-game embeddability re-read from the official CrazyGames wrapper config "
            "(disableEmbedding flag) for every slug. Titles with the flag set are listed as "
            "external-only so no visitor is dropped into the 'exclusively on CrazyGames.com' screen."
        )
        MANIFEST.write_text(json.dumps(man, indent=2) + "\n", encoding="utf-8")
    except Exception as e:
        print("manifest not updated:", e)


if __name__ == "__main__":
    main()
