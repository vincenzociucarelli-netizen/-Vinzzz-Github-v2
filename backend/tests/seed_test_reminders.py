# TEST_ seed for Solleciti rate UI testing. Usage: python seed_test_reminders.py seed|cleanup
# Creates TEST_ athletes + payments and deletes ONLY the ids it created (stored in /tmp/test_reminders_ids.json)
import os, sys, json, asyncio, uuid
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from motor.motor_asyncio import AsyncIOMotorClient

IDS_FILE = '/tmp/test_reminders_ids.json'
SOCIETY_ID = '697fdba0d218717959e73eea'
TEAM_ID = '697fec5d90eef140898ebfd7'


def _id():
    return 'TEST_' + uuid.uuid4().hex[:16]


async def seed(db):
    a1, a2, a3 = _id(), _id(), _id()
    athletes = [
        {"id": a1, "society_id": SOCIETY_ID, "team_id": TEAM_ID, "first_name": "MARIO", "last_name": "TEST_ROSSI",
         "phone_athlete": "3331112222", "phone_father": "+39 333 444 5555", "phone_mother": "0039 3336667777"},
        {"id": a2, "society_id": SOCIETY_ID, "team_id": TEAM_ID, "first_name": "LUCA", "last_name": "TEST_BIANCHI",
         "phone_father": "3201234567"},
        {"id": a3, "society_id": SOCIETY_ID, "team_id": TEAM_ID, "first_name": "ANNA", "last_name": "TEST_VERDI"},
    ]
    def pay(aid, n, amount, due, paid=False, paid_amount=None, name=None, desc=None, paid_date=None):
        d = {"id": _id(), "athlete_id": aid, "society_id": SOCIETY_ID, "amount": amount, "due_date": due,
             "paid": paid, "paid_date": paid_date}
        if n is not None:
            d["installment_number"] = n
            d["installment_name"] = name or f"Rata {n}"
        if desc:
            d["description"] = desc
        if paid_amount is not None:
            d["paid_amount"] = paid_amount
        return d
    payments = [
        # A1: rata1 scheduled unpaid + manual bonifico 'RATA 1' paid -> consolidated PAID
        pay(a1, 1, 150, "2026-10-01"),
        pay(a1, None, 150, None, paid=True, desc="Bonifico RATA 1", paid_date="2026-10-05"),
        pay(a1, 2, 150, "2026-10-15"),           # overdue
        pay(a1, 3, 150, "2027-01-15"),           # not overdue
        # A2: rata1 partial overdue, rata2 paid, rata3 future
        pay(a2, 1, 150, "2026-10-01", paid_amount=50, paid_date="2026-09-20"),
        pay(a2, 2, 150, "2026-10-15", paid=True, paid_date="2026-10-10"),
        pay(a2, 3, 150, "2026-12-30"),
        # A3: no phones, rata1 overdue; rata2 amount 0 placeholder (edge case)
        pay(a3, 1, 150, "2026-09-01"),
        pay(a3, 2, 0, "2026-10-15"),
    ]
    await db.athletes.insert_many(athletes)
    await db.payments.insert_many(payments)
    ids = {"athletes": [a["id"] for a in athletes], "payments": [p["id"] for p in payments]}
    json.dump(ids, open(IDS_FILE, 'w'))
    print("seeded", ids)


async def cleanup(db):
    ids = json.load(open(IDS_FILE))
    r1 = await db.payments.delete_many({"id": {"$in": ids["payments"]}})
    r2 = await db.athletes.delete_many({"id": {"$in": ids["athletes"]}})
    print("deleted payments", r1.deleted_count, "athletes", r2.deleted_count)


async def main():
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    await (seed(db) if sys.argv[1] == 'seed' else cleanup(db))

asyncio.run(main())
