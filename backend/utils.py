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
    """Get current season name based on date (July to June)."""
    now = datetime.utcnow()
    if now.month >= 7:
        return f"{now.year}-{now.year + 1}"
    return f"{now.year - 1}-{now.year}"


__all__ = [
    "MONTH_NAMES",
    "to_rome_time",
    "format_rome_timestamp",
    "clean_mongo_doc",
    "clean_mongo_docs",
    "get_current_season",
]
