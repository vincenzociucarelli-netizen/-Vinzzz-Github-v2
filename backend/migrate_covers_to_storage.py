"""
Migrazione una-tantum: sposta le copertine campagne pre-stagione da base64
(campo cover_image in MongoDB) a Emergent Object Storage (cover_storage_path).

Uso:
    cd /app/backend && python migrate_covers_to_storage.py

Idempotente: salta le campagne già migrate (cover_storage_path valorizzato) o
senza cover_image base64. Dual-read già attivo lato API: se la migrazione fallisce
su una campagna, il base64 resta e continua a funzionare.
"""
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()


async def main():
    # Import lazy per riusare gli helper già definiti in server.py
    import server as srv

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ.get("DB_NAME", "test_database")]

    cursor = db.preseason_campaigns.find(
        {"cover_image": {"$exists": True, "$ne": ""}},
        {"_id": 0, "id": 1, "society_id": 1, "cover_image": 1, "cover_storage_path": 1},
    )
    migrated = 0
    skipped = 0
    failed = 0
    async for c in cursor:
        cid = c.get("id")
        if c.get("cover_storage_path"):
            skipped += 1
            continue
        cover = c.get("cover_image") or ""
        if not cover.startswith("data:"):
            skipped += 1
            continue
        path = await srv._store_cover_from_datauri(c.get("society_id", ""), cid, cover)
        if path:
            await db.preseason_campaigns.update_one(
                {"id": cid}, {"$set": {"cover_storage_path": path, "cover_image": ""}}
            )
            migrated += 1
            print(f"[OK] {cid} -> {path}")
        else:
            failed += 1
            print(f"[FAIL] {cid} (base64 mantenuto come fallback)")

    print(f"\nFatto. Migrate: {migrated} | Saltate: {skipped} | Fallite: {failed}")


if __name__ == "__main__":
    asyncio.run(main())
