"""
Common utilities used across the backend.
- Rome timezone conversion (CET/CEST with DST)
- MongoDB document cleaning (remove _id)
- Italian month names
"""
from datetime import datetime, timedelta, timezone


# Italian month names (1-indexed)
MONTH_NAMES = {
    1: "Gennaio", 2: "Febbraio", 3: "Marzo", 4: "Aprile",
    5: "Maggio", 6: "Giugno", 7: "Luglio", 8: "Agosto",
    9: "Settembre", 10: "Ottobre", 11: "Novembre", 12: "Dicembre"
}

# 🚀 06/2026 — Cache in-process della configurazione stagione per società:
# { society_id: (season_start_month, season_start_day, expiry_epoch) }. TTL 600s.
_SEASON_CFG_CACHE: dict = {}


def to_rome_time(dt: datetime) -> datetime:
    """Convert UTC datetime to Rome timezone (CET/CEST handling DST)."""
    year = dt.year
    # Last Sunday of March
    march_last_sunday = datetime(year, 3, 31, 2, 0, tzinfo=timezone.utc)
    while march_last_sunday.weekday() != 6:  # 6 = Sunday
        march_last_sunday -= timedelta(days=1)
    # Last Sunday of October
    october_last_sunday = datetime(year, 10, 31, 3, 0, tzinfo=timezone.utc)
    while october_last_sunday.weekday() != 6:
        october_last_sunday -= timedelta(days=1)
    
    if march_last_sunday <= dt.replace(tzinfo=timezone.utc) < october_last_sunday:
        # Summer time (CEST) - UTC+2
        return dt + timedelta(hours=2)
    else:
        # Winter time (CET) - UTC+1
        return dt + timedelta(hours=1)


def format_rome_timestamp(dt: datetime) -> str:
    """Format datetime as Rome timezone string YYYY-MM-DD HH:MM:SS."""
    rome_dt = to_rome_time(dt)
    return rome_dt.strftime('%Y-%m-%d %H:%M:%S')


def clean_mongo_doc(doc):
    """Remove _id from MongoDB document and convert datetime fields for JSON serialization."""
    if doc:
        doc.pop('_id', None)
        # Convert datetime fields to ISO string WITH TIME AND TIMEZONE
        for key, value in list(doc.items()):
            if isinstance(value, datetime):
                doc[key] = value.replace(tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    return doc


def clean_mongo_docs(docs):
    """Remove _id from a list of MongoDB documents."""
    return [clean_mongo_doc(doc) for doc in docs]


def compress_base64_image(b64_str, max_dim: int = 1280, quality: int = 72, min_bytes: int = 350_000):
    """🚀 12/08/2026 — Compressione automatica immagini (stile WhatsApp).
    Prende una stringa base64 (con o senza prefisso data URI), ridimensiona il
    lato lungo a `max_dim` px e ricodifica in JPEG con qualità `quality`.
    Ritorna base64 RAW (senza prefisso). Se l'immagine è già piccola
    (< min_bytes) la lascia com'è (solo strip del prefisso). In caso di errore
    ritorna l'input invariato per non perdere mai la foto.
    """
    if not b64_str or not isinstance(b64_str, str):
        return b64_str
    try:
        import base64 as _b64, io as _io
        from PIL import Image as _Image, ImageOps as _ImageOps

        raw = b64_str
        if raw.startswith('data:'):
            raw = raw.split(',', 1)[1]
        img_bytes = _b64.b64decode(raw)
        if len(img_bytes) < min_bytes:
            return raw  # già leggera
        img = _Image.open(_io.BytesIO(img_bytes))
        # Rispetta l'orientamento EXIF (foto da smartphone)
        img = _ImageOps.exif_transpose(img)
        if img.mode in ('RGBA', 'P', 'LA'):
            img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        img.thumbnail((max_dim, max_dim))
        out = _io.BytesIO()
        img.save(out, format='JPEG', quality=quality, optimize=True)
        return _b64.b64encode(out.getvalue()).decode('ascii')
    except Exception:
        return b64_str



def get_current_season() -> str:
    """Get current season name based on Rome local date (July to June)."""
    # 🆕 01/07/2026 — Usa ora di Roma (CET/CEST) invece di UTC: alle 01:27 ora
    # italiana del 1° luglio siamo già nella nuova stagione (in UTC era 23:27 del 30/06).
    now = to_rome_time(datetime.utcnow())
    if now.month >= 7:
        return f"{now.year}-{now.year + 1}"
    return f"{now.year - 1}-{now.year}"


async def get_current_season_for_society(db, society_id: str) -> str:
    """🆕 30/06/2026 — Stagione corrente leggendo `season_start_month`/`season_start_day`
    dalle impostazioni della società. Cade su luglio/1 se non configurato.
    🆕 01/07/2026 — Usa ora di Roma (Europe/Rome, CET/CEST) per la data odierna,
    NON UTC. Così alle 01:00 del 1° luglio (ora italiana) la stagione è già la nuova.
    🚀 06/2026 PERF — Due ottimizzazioni CRITICHE (questa funzione è chiamata a OGNI
    richiesta di lista): (1) PROJECTION → legge solo season_start_month/day e NON
    trascina il logo base64 (fino a ~519KB) del doc settings ad ogni richiesta;
    (2) CACHE in-process per società (TTL 10 min) → azzera le query ripetute durante
    i burst di apertura cartelle. La stagione cambia solo al confine stagionale."""
    now = to_rome_time(datetime.utcnow())

    # Cache: (season_start_month, season_start_day) per società — TTL 600s.
    import time as _t
    _key = society_id or "__default__"
    _cached = _SEASON_CFG_CACHE.get(_key)
    if _cached and _cached[2] > _t.time():
        season_start_month, season_start_day = _cached[0], _cached[1]
    else:
        _proj = {"_id": 0, "season_start_month": 1, "season_start_day": 1}
        settings = None
        if society_id:
            try:
                settings = await db.settings.find_one({"type": "society", "society_id": society_id}, _proj)
            except Exception:
                settings = None
            if not settings:
                try:
                    settings = await db.settings.find_one({"type": "society"}, _proj)
                except Exception:
                    settings = None
        try:
            season_start_month = int((settings or {}).get("season_start_month", 7) or 7)
            season_start_day = int((settings or {}).get("season_start_day", 1) or 1)
        except Exception:
            season_start_month, season_start_day = 7, 1
        _SEASON_CFG_CACHE[_key] = (season_start_month, season_start_day, _t.time() + 600)

    try:
        season_start_this_year = datetime(now.year, season_start_month, season_start_day)
    except Exception:
        season_start_this_year = datetime(now.year, 7, 1)
    # Confronto in ora Rome naive (entrambi senza tzinfo)
    now_naive = now.replace(tzinfo=None)
    if now_naive >= season_start_this_year:
        return f"{now.year}-{now.year + 1}"
    return f"{now.year - 1}-{now.year}"


async def get_next_receipt_number(db, society_id: str) -> str:
    """🆕 10/08/2026 — Numero ricevuta progressivo per stagione: RIC-26/27-0001.
    Condiviso tra pagamenti manuali (server.py) e pagamenti Stripe (routes/stripe_payments.py)
    così anche gli incassi online ricevono un N. Prog. cronologico.
    """
    now = datetime.utcnow()
    settings = None
    if society_id:
        settings = await db.settings.find_one({"type": "society", "society_id": society_id})
    if not settings:
        settings = await db.settings.find_one({"type": "society"})
    season_start_month = (settings or {}).get("season_start_month", 7)
    season_start_day = (settings or {}).get("season_start_day", 1)
    try:
        season_start_month = int(season_start_month or 7)
        season_start_day = int(season_start_day or 1)
    except Exception:
        season_start_month, season_start_day = 7, 1
    try:
        season_start_this_year = datetime(now.year, season_start_month, season_start_day)
    except Exception:
        season_start_this_year = datetime(now.year, 7, 1)
    if now >= season_start_this_year:
        season_start_year, season_end_year = now.year, now.year + 1
    else:
        season_start_year, season_end_year = now.year - 1, now.year
    prefix = f"RIC-{season_start_year % 100:02d}/{season_end_year % 100:02d}-"
    last_payment = await db.payments.find_one(
        {"receipt_number": {"$regex": f"^{prefix}"}},
        sort=[("receipt_number", -1)],
    )
    next_num = 1
    if last_payment and last_payment.get("receipt_number"):
        try:
            next_num = int(last_payment["receipt_number"].split("-")[-1]) + 1
        except Exception:
            next_num = 1
    return f"{prefix}{next_num:04d}"


__all__ = [
    "MONTH_NAMES",
    "to_rome_time",
    "format_rome_timestamp",
    "clean_mongo_doc",
    "clean_mongo_docs",
    "get_current_season",
    "get_current_season_for_society",
    "get_next_receipt_number",
]
