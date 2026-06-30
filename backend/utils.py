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
    NON UTC. Così alle 01:00 del 1° luglio (ora italiana) la stagione è già la nuova."""
    now = to_rome_time(datetime.utcnow())
    settings = None
    if society_id:
        try:
            settings = await db.settings.find_one({"type": "society", "society_id": society_id})
        except Exception:
            settings = None
        # Fallback to legacy single-tenant settings if no society-scoped doc
        if not settings:
            try:
                settings = await db.settings.find_one({"type": "society"})
            except Exception:
                settings = None
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
    # Confronto in ora Rome naive (entrambi senza tzinfo)
    now_naive = now.replace(tzinfo=None)
    if now_naive >= season_start_this_year:
        return f"{now.year}-{now.year + 1}"
    return f"{now.year - 1}-{now.year}"


__all__ = [
    "MONTH_NAMES",
    "to_rome_time",
    "format_rome_timestamp",
    "clean_mongo_doc",
    "clean_mongo_docs",
    "get_current_season",
    "get_current_season_for_society",
]
