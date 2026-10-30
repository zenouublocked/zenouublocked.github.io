"""Build catalog/media.json for the YouTube library tab.

Every entry is verified against YouTube's public oEmbed endpoint, so the library
only ever lists videos that actually exist and allows embedding signals. Titles
and channel names come from oEmbed, no guessing.

Usage:  python scripts/build-media.py
"""
import concurrent.futures
import json
import pathlib
import urllib.parse
import urllib.request

CANDIDATES = {
    "music": """dQw4w9WgXcQ kJQP7kiw5Fk 9bZkp7q19f0 JGwWNGJdvx8 RgKAFK5djSk OPf0YbXqDm0
        CevxZvSJLk8 fJ9rUzIMcZQ hTWKbfoikeg 1w7OgIMMRc4 YQHsXMglC9A 09R8_2nJtjg 60ItHLz5WEA
        7wtfhZwyrcc ktvTqknDobU kXYiU_JCYtU eVTXPUF4Oz4 2Vv-BfVoq4g pRpeEdMmmQ0 uelHwf8o7_U
        rYEDA3JcQqw sOnqjkJTMaA ZbZSe6N_BXs hT_nvWreIhg lp-EO5I60KA fRh_vgS2dFE CvBfHwUxHIk
        e-ORhEE9VVg nfWlot6h_JM 4NRXx6U8ABQ XXYlFuWEuKI 8UVNT4wvIGY QcIy9NiNbmo QK8mJJJvaes
        sOnqjkJTMaA ZbZSe6N_BXs""",
    "lofi": """jfKfPfyJRdk 4xDzrJKXOOY lTRiuFIWV54 5qap5aO4i9A""",
    "talks": """iCvmsMzlF7o qp0HIF3SfI4 8KkKuTCFvzI RcGyVTAoXEU""",
    "gaming": """QkkoHAzjnUs QdBZY2fkU-0 eaW0tYpxyp0 zw47_q9wbBE 8X2kIfS6fb8
        E3Huy2cdih0 MmB9b5njVbA 2gUtfBmw86Y""",
    "science": """HeQX2HjkcNo WUvTyaaNkzM aircAruvnKk IHZwWFHWa-w e-P5IFTqB98
        JXeJANDKwDc wjZofJX0v4M""",
    "learning": """kjBOesZCoqc fNk_zzaMoSs Ilg3gGewQ5U tIeHLnjs5U8 Yocja_N5s1I""",
}

OUT = pathlib.Path(__file__).resolve().parent.parent / "catalog" / "media.json"


def check(item):
    cat, vid = item
    url = "https://www.youtube.com/oembed?url=" + urllib.parse.quote(
        f"https://www.youtube.com/watch?v={vid}", safe=""
    ) + "&format=json"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.load(res)
        return {
            "id": vid,
            "title": data.get("title") or vid,
            "channel": data.get("author_name") or "YouTube",
            "cat": cat,
        }
    except Exception as exc:  # noqa: BLE001 - reported, then skipped
        return {"id": vid, "error": str(exc)[:80], "cat": cat}


def main():
    pairs = [(cat, vid) for cat, ids in CANDIDATES.items() for vid in ids.split()]
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(check, pairs))
    good = [r for r in results if "title" in r]
    bad = [r for r in results if "error" in r]
    payload = {
        "generated": "2026-10-30",
        "source": "YouTube oEmbed verification",
        "videos": good,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(good)} videos to {OUT}")
    for r in bad:
        print("skipped", r["id"], r["error"])


if __name__ == "__main__":
    main()
