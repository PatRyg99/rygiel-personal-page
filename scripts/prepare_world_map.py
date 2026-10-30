#!/usr/bin/env python3
"""Prepare the locally served world-map geometry; no build-time download is needed.

Download SOURCE_URL to a local file, then run:
    python3 scripts/prepare_world_map.py /path/to/ne_110m_admin_0_countries.geojson

Natural Earth data is public domain. The pinned 5.1.1 source already splits
polygons at the antimeridian; reject unsplit rings to avoid world-spanning edges.
The SVG uses an equirectangular projection, longitude -180..180 and latitude
-60..85. Antarctica is outside this map's scope. Use fill-rule="evenodd" when
rendering paths so polygon holes remain empty.
"""

import argparse
import hashlib
import json
from pathlib import Path

REVISION = "9380cca83db5f9aef52d5e762765100745f84b27"
SOURCE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    f"{REVISION}/geojson/ne_110m_admin_0_countries.geojson"
)
ROOT = Path(__file__).resolve().parent.parent


def projected_point(point):
    longitude, latitude = point[:2]
    if not (-180.000001 <= longitude <= 180.000001 and -60 <= latitude <= 85):
        raise ValueError(f"Coordinate outside the map: {point}")
    x, y = (longitude + 180) * 2.5, (85 - latitude) * 2.5
    return f"{x:.2f},{y:.2f}"


def polygon_path(ring):
    if len(ring) < 4 or ring[0] != ring[-1]:
        raise ValueError("Expected a closed polygon ring")
    if any(abs(a[0] - b[0]) > 180 for a, b in zip(ring, ring[1:])):
        raise ValueError("Unsplit antimeridian crossing in source geometry")
    points = [projected_point(point) for point in ring[:-1]]
    return "M" + "L".join(points) + "Z"


def prepare(source):
    document = json.loads(source)
    countries = []
    for feature in document["features"]:
        properties = feature["properties"]
        if properties["ISO_A2"] == "AQ":
            continue
        code = properties.get("ISO_A2")
        if code is None or len(code) != 2:
            code = properties.get("ISO_A2_EH")
        # Natural Earth represents two disputed areas without ISO country codes.
        # Retain their outlines, but never invent a country code for them.
        if code == "-99":
            code = None
        if code is not None and (len(code) != 2 or not code.isalpha()):
            raise ValueError(f"Invalid country code: {code}")
        geometry = feature["geometry"]
        if geometry["type"] == "Polygon":
            polygons = [geometry["coordinates"]]
        elif geometry["type"] == "MultiPolygon":
            polygons = geometry["coordinates"]
        else:
            raise ValueError(f"Unsupported geometry: {geometry['type']}")
        countries.append({
            "id": properties["ADM0_A3"],
            "code": code,
            "name": properties["NAME_EN"],
            "path": "".join(polygon_path(ring) for polygon in polygons for ring in polygon),
        })
    codes = [country["code"] for country in countries if country["code"]]
    if len(codes) != len(set(codes)):
        raise ValueError("Duplicate country codes in geometry")
    if not {"FR", "NO", "NL", "PL", "GB", "US"}.issubset(codes):
        raise ValueError("Expected country codes are missing")
    return {
        "viewbox": "0 0 900 362.5",
        "projection": "Equirectangular; longitude -180..180, latitude -60..85",
        "source": {
            "name": "Natural Earth 1:110m Admin 0 – Countries",
            "url": SOURCE_URL,
            "version": "5.1.1",
            "revision": REVISION,
            "sha256": hashlib.sha256(source).hexdigest(),
            "license": "Public domain",
            "license_url": "https://www.naturalearthdata.com/about/terms-of-use/",
        },
        "countries": sorted(countries, key=lambda country: country["name"]),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local Natural Earth 110m country GeoJSON")
    parser.add_argument("--output", type=Path, default=ROOT / "_data/world_map.json")
    args = parser.parse_args()
    result = prepare(args.source.read_bytes())
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Prepared {len(result['countries'])} country outlines: {args.output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
