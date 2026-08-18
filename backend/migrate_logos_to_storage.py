"""
Migrazione una-tantum: sposta i loghi società da base64 (campo `logo` nella
collezione `settings`) a Emergent Object Storage (campo `logo_storage_path`).

Uso:
    cd /app/backend && python migrate_logos_to_storage.py

Idempotente: salta i doc già migrati (logo_storage_path valorizzato) o senza
logo base64. Dual-read già attivo lato API: se la migrazione fallisce su un doc,
il base64 resta e continua a funzionare.
"""
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()


async def main():
    from storage_util import store_image_from_datauri, storage_path_for

    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "test_database")]

    cursor = db.settings.find(
        {"type": "society", "logo": {"$exists": True, "$ne": ""}},
        {"_id": 0, "society_id": 1, "logo": 1, "logo_storage_path": 1},
    )
    migrated = skipped = failed = 0
    async for s in cursor:
        sid = s.get("society_id") or "shared"
        if s.get("logo_storage_path"):
            skipped += 1
            continue
        logo = s.get("logo") or ""
        if not logo.startswith("data:"):
            # raw base64 legacy → aggiungi prefisso PNG per il decoder
            logo = "data:image/png;base64," + logo if logo else ""
        if not logo:
            skipped += 1
            continue
        path = storage_path_for("logo", sid, sid)
        stored = await store_image_from_datauri(path, logo, max_dim=800, target_kb=180)
        if stored:
            await db.settings.update_one(
                {"type": "society", "society_id": s.get("society_id")},
                {"$set": {"logo_storage_path": stored, "logo": ""}},
            )
            migrated += 1
            print(f"[OK] society {sid} -> {stored}")
        else:
            failed += 1
            print(f"[FAIL] society {sid} (base64 mantenuto come fallback)")

    print(f"\nFatto. Migrati: {migrated} | Saltati: {skipped} | Falliti: {failed}")


if __name__ == "__main__":
    asyncio.run(main())
