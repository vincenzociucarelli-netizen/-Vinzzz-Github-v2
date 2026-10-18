"""One-time backfill: sync `inps_insured_elsewhere` on users/athletes from the
latest signed pension declaration (position A/B → True, else False)."""
import asyncio
from database import db
from routes.pension_declarations import _person_ids, _history_for


async def main():
    seen = set()
    updated = 0
    async for d in db.pension_declarations.find({}, {"_id": 0, "user_id": 1, "athlete_id": 1}):
        seed = d.get("user_id") or d.get("athlete_id")
        if not seed or seed in seen:
            continue
        ids = await _person_ids(d.get("user_id"), d.get("athlete_id"))
        key = tuple(sorted(ids))
        if key in seen:
            continue
        for i in ids:
            seen.add(i)
        seen.add(key)
        history = await _history_for(ids)
        latest = history[0] if history else None
        insured = bool(latest and latest.get("position") in ("A", "B"))
        if ids:
            r1 = await db.users.update_many({"id": {"$in": ids}}, {"$set": {"inps_insured_elsewhere": insured}})
            r2 = await db.athletes.update_many({"id": {"$in": ids}}, {"$set": {"inps_insured_elsewhere": insured}})
            updated += (r1.modified_count + r2.modified_count)
    print(f"Backfill done. Docs updated: {updated}")


if __name__ == "__main__":
    asyncio.run(main())
