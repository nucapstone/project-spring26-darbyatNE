#!/usr/bin/env python3
"""Build a static demo snapshot for GitHub Pages mode.

This script calls local backend endpoints and writes JSON files into src/data/demo/
so the static dashboard can be served from docs/ without a public API.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


def fetch_json(url: str):
    with urlopen(url) as response:  # nosec B310 - user-controlled host is intentional for local snapshot tooling
        payload = response.read().decode("utf-8")
    return json.loads(payload)


def write_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Build static demo snapshot files for GitHub Pages")
    parser.add_argument("--backend-url", default="http://127.0.0.1:8000", help="Backend base URL")
    parser.add_argument("--start-year", type=int, default=2024, help="Snapshot start year")
    parser.add_argument("--end-year", type=int, default=2024, help="Snapshot end year")
    parser.add_argument(
        "--months",
        default="1,2,3,4,5,6,7,8,9,10,11,12",
        help="Comma-separated months (1-12)",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    out_dir = repo_root / "src" / "data" / "demo"

    base = args.backend_url.rstrip("/")
    territories_url = f"{base}/api/service-terr"
    lmps_url = f"{base}/api/retail_lmps"
    price_query = urlencode(
        {
            "startYear": args.start_year,
            "endYear": args.end_year,
            "months": args.months,
        }
    )
    price_url = f"{base}/api/service_territory_price_data?{price_query}"

    territories = fetch_json(territories_url)
    lmps = fetch_json(lmps_url)
    price_data = fetch_json(price_url)

    write_json(out_dir / "service_territories.geojson", territories)
    write_json(out_dir / "retail_lmps.json", lmps)
    write_json(out_dir / "service_territory_price_data.json", price_data)

    print("Wrote demo snapshot files:")
    print(f"- {out_dir / 'service_territories.geojson'}")
    print(f"- {out_dir / 'retail_lmps.json'}")
    print(f"- {out_dir / 'service_territory_price_data.json'}")


if __name__ == "__main__":
    main()
