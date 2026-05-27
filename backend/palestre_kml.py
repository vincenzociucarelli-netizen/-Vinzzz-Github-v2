"""
KML parser for Google My Maps — palestre list.

Fetches the public KML feed from the configured Google My Map and extracts
placemarks (name, address, description, lat/lng, folder/layer).

Lightweight in-memory cache (1h TTL) to avoid hammering Google.
"""
from __future__ import annotations
import os
import time
import re
import logging
import asyncio
from typing import List, Dict, Optional, Tuple
import urllib.request
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

KML_URL = os.environ.get(
    "PALESTRE_KML_URL",
    "https://www.google.com/maps/d/kml?mid=1yMgkjp8BvFZ5xPiEUPmKKWHLo9c&forcekml=1",
)

_CACHE: Dict[str, object] = {"ts": 0, "data": None}
_CACHE_TTL = 3600  # 1 hour
_NS = {"kml": "http://www.opengis.net/kml/2.2"}

# Italian province city → province code mapping (basic, covers all of Umbria and main IT cities)
# We use a hint-list rather than full DB to keep this fast & simple.
_PROVINCE_HINTS: List[Tuple[str, str]] = [
    # Umbria — Perugia
    ("perugia", "Perugia (PG)"),
    ("foligno", "Perugia (PG)"),
    ("assisi", "Perugia (PG)"),
    ("bastia", "Perugia (PG)"),
    ("spello", "Perugia (PG)"),
    ("gualdo tadino", "Perugia (PG)"),
    ("gualdo cattaneo", "Perugia (PG)"),
    ("castiglione del lago", "Perugia (PG)"),
    ("città della pieve", "Perugia (PG)"),
    ("citta della pieve", "Perugia (PG)"),
    ("città di castello", "Perugia (PG)"),
    ("citta di castello", "Perugia (PG)"),
    ("gubbio", "Perugia (PG)"),
    ("magione", "Perugia (PG)"),
    ("marsciano", "Perugia (PG)"),
    ("todi", "Perugia (PG)"),
    ("umbertide", "Perugia (PG)"),
    ("torgiano", "Perugia (PG)"),
    ("deruta", "Perugia (PG)"),
    ("corciano", "Perugia (PG)"),
    ("ellera", "Perugia (PG)"),
    ("ponte san giovanni", "Perugia (PG)"),
    ("ponte felcino", "Perugia (PG)"),
    ("ponte d'oddi", "Perugia (PG)"),
    ("ponte pattoli", "Perugia (PG)"),
    ("ponte valleceppi", "Perugia (PG)"),
    ("san sisto", "Perugia (PG)"),
    ("san martino in colle", "Perugia (PG)"),
    ("bettona", "Perugia (PG)"),
    ("nocera umbra", "Perugia (PG)"),
    ("trevi", "Perugia (PG)"),
    ("collazzone", "Perugia (PG)"),
    ("panicale", "Perugia (PG)"),
    ("passignano", "Perugia (PG)"),
    ("tuoro", "Perugia (PG)"),
    ("castel del piano", "Perugia (PG)"),
    ("castel ritaldi", "Perugia (PG)"),
    ("chiusi scalo", "Perugia (PG)"),
    # Spoleto e dintorni (provincia di PG)
    ("spoleto", "Perugia (PG)"),
    ("norcia", "Perugia (PG)"),
    ("cascia", "Perugia (PG)"),
    ("cannara", "Perugia (PG)"),
    ("bevagna", "Perugia (PG)"),
    ("montefalco", "Perugia (PG)"),
    ("giano dell'umbria", "Perugia (PG)"),
    ("sellano", "Perugia (PG)"),
    ("vallo di nera", "Perugia (PG)"),
    ("scheggino", "Perugia (PG)"),
    ("monteleone di spoleto", "Perugia (PG)"),
    ("sant'anatolia di narco", "Perugia (PG)"),
    ("sant anatolia di narco", "Perugia (PG)"),
    ("vallecorsa", "Perugia (PG)"),
    ("vallenarni", "Terni (TR)"),
    # Umbria — Terni
    ("arrone", "Terni (TR)"),
    ("terni", "Terni (TR)"),
    ("orvieto", "Terni (TR)"),
    ("narni scalo", "Terni (TR)"),
    ("narni", "Terni (TR)"),
    ("amelia", "Terni (TR)"),
    ("acquasparta", "Terni (TR)"),
    ("ferentillo", "Terni (TR)"),
    ("stroncone", "Terni (TR)"),
    ("calvi dell'umbria", "Terni (TR)"),
    ("baschi", "Terni (TR)"),
    ("avigliano umbro", "Terni (TR)"),
    ("attigliano", "Terni (TR)"),
    ("alviano", "Terni (TR)"),
    ("guardea", "Terni (TR)"),
    ("lugnano in teverina", "Terni (TR)"),
    ("montecastrilli", "Terni (TR)"),
    ("otricoli", "Terni (TR)"),
    ("polino", "Terni (TR)"),
    ("san gemini", "Terni (TR)"),
    # Other PG hamlets (frazioni)
    ("ficulle", "Terni (TR)"),
    ("fossato di vico", "Perugia (PG)"),
    ("mantignana", "Perugia (PG)"),
    ("pierantonio", "Perugia (PG)"),
    ("pietralunga", "Perugia (PG)"),
    ("rivotorto", "Perugia (PG)"),
    ("san feliciano", "Perugia (PG)"),
    ("monte castello", "Perugia (PG)"),
    ("monte santa maria tiberina", "Perugia (PG)"),
    ("paciano", "Perugia (PG)"),
    ("piegaro", "Perugia (PG)"),
    ("valfabbrica", "Perugia (PG)"),
    ("colfiorito", "Perugia (PG)"),
    ("costacciaro", "Perugia (PG)"),
    ("fratta todina", "Perugia (PG)"),
    ("massa martana", "Perugia (PG)"),
    ("monte santa maria", "Perugia (PG)"),
    ("monteleone d'orvieto", "Terni (TR)"),
    ("parrano", "Terni (TR)"),
    ("porano", "Terni (TR)"),
    ("alessi", "Perugia (PG)"),  # Liceo Alessi è a PG
    # Other main IT provinces (fallback)
    ("roma", "Roma (RM)"),
    ("milano", "Milano (MI)"),
    ("firenze", "Firenze (FI)"),
    ("siena", "Siena (SI)"),
    ("arezzo", "Arezzo (AR)"),
    ("ancona", "Ancona (AN)"),
    ("pesaro", "Pesaro-Urbino (PU)"),
    ("macerata", "Macerata (MC)"),
    ("ascoli piceno", "Ascoli Piceno (AP)"),
    ("rieti", "Rieti (RI)"),
    ("viterbo", "Viterbo (VT)"),
]

_TWO_LETTER_REGEX = re.compile(r"\b(\d{5})\s+([A-Za-zÀ-ÿ\s']+?)\s*\(?\s*([A-Z]{2})\s*\)?", re.UNICODE)


def _infer_province(name: str, address: str, description: str) -> str:
    """Best-effort province inference from text fields."""
    haystack = " ".join([name or "", address or "", description or ""]).lower()
    # 1) Exact 2-letter province code in parentheses (e.g. "06034 Foligno (PG)")
    m = _TWO_LETTER_REGEX.search(name + " " + address + " " + description)
    if m:
        prov_code = m.group(3)
        # Map common province codes to full names
        prov_full = {
            "PG": "Perugia (PG)", "TR": "Terni (TR)", "RM": "Roma (RM)",
            "FI": "Firenze (FI)", "SI": "Siena (SI)", "AR": "Arezzo (AR)",
            "AN": "Ancona (AN)", "MC": "Macerata (MC)", "PU": "Pesaro-Urbino (PU)",
            "AP": "Ascoli Piceno (AP)", "RI": "Rieti (RI)", "VT": "Viterbo (VT)",
            "MI": "Milano (MI)",
        }.get(prov_code, f"{prov_code}")
        return prov_full
    # 2) Match city name in hints
    for needle, label in _PROVINCE_HINTS:
        if needle in haystack:
            return label
    return "Altra provincia"


def _strip_ns(tag: str) -> str:
    return tag.split('}', 1)[-1]


def _parse_kml(xml_bytes: bytes) -> List[Dict]:
    """Parse KML and return list of placemarks."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        logger.error(f"KML parse error: {e}")
        return []

    places: List[Dict] = []

    def walk(element, folder_path: List[str]):
        for child in list(element):
            tag = _strip_ns(child.tag)
            if tag == "Folder":
                name_el = child.find("kml:name", _NS)
                folder_name = (name_el.text or "").strip() if name_el is not None else ""
                walk(child, folder_path + ([folder_name] if folder_name else []))
            elif tag == "Document":
                walk(child, folder_path)
            elif tag == "Placemark":
                name = ""
                description = ""
                address = ""
                lat: Optional[float] = None
                lng: Optional[float] = None
                for c in child:
                    ct = _strip_ns(c.tag)
                    if ct == "name":
                        name = (c.text or "").strip()
                    elif ct == "description":
                        # Strip HTML tags
                        raw = c.text or ""
                        # Some KMLs use CDATA / HTML
                        description = re.sub(r"<[^>]+>", " ", raw).strip()
                        description = re.sub(r"\s+", " ", description)
                    elif ct == "address":
                        address = (c.text or "").strip()
                    elif ct == "Point":
                        coords_el = c.find("kml:coordinates", _NS)
                        if coords_el is not None and coords_el.text:
                            parts = coords_el.text.strip().split(",")
                            if len(parts) >= 2:
                                try:
                                    lng = float(parts[0])
                                    lat = float(parts[1])
                                except ValueError:
                                    pass

                # Skip placemarks without geometry
                if lat is None or lng is None:
                    continue

                # If no address attribute, try to extract one from description
                if not address and description:
                    # Best effort: heuristic
                    addr_match = re.search(
                        r"((?:Via|Viale|Piazza|Corso|Strada|Largo|Vicolo|Loc(?:alit[aà])?|Piazzale)\s+[^,\n;]{3,80}(?:,\s*\d{5}\s+[^,;]{2,40})?)",
                        description,
                        re.IGNORECASE,
                    )
                    if addr_match:
                        address = addr_match.group(1).strip()

                province = _infer_province(name, address, description)
                folder = folder_path[-1] if folder_path else ""

                places.append({
                    "name": name or "Palestra senza nome",
                    "address": address,
                    "description": description,
                    "lat": lat,
                    "lng": lng,
                    "folder": folder,
                    "province": province,
                    "google_maps_url": f"https://www.google.com/maps/search/?api=1&query={lat},{lng}",
                })

    walk(root, [])
    return places


def _fetch_blocking() -> List[Dict]:
    try:
        req = urllib.request.Request(KML_URL, headers={"User-Agent": "RegistraTEAM/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
    except Exception as e:
        logger.warning(f"Palestre KML fetch failed: {e}")
        return []
    return _parse_kml(data)


async def get_palestre_list(force_refresh: bool = False) -> Dict:
    """Async wrapper with 1h cache."""
    now = time.time()
    if not force_refresh and _CACHE.get("data") and (now - float(_CACHE.get("ts", 0)) < _CACHE_TTL):
        cached: List[Dict] = _CACHE["data"]  # type: ignore
        return {"count": len(cached), "palestre": cached, "cached": True}

    loop = asyncio.get_event_loop()
    palestre = await loop.run_in_executor(None, _fetch_blocking)
    palestre.sort(key=lambda p: (p.get("province", ""), p.get("name", "").lower()))
    _CACHE["data"] = palestre
    _CACHE["ts"] = now
    return {"count": len(palestre), "palestre": palestre, "cached": False}
