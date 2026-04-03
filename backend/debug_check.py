import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def check():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME', 'registrateam')]
    
    # Search ALL users - check for Giulio or ROSI
    print("=== TUTTI GLI UTENTI ===")
    all_users = await db.users.find({}, {"_id": 0}).to_list(100)
    for u in all_users:
        print(f"  {u.get('first_name','?')} {u.get('last_name','?')} | role={u.get('role')} | email={u.get('email')} | status={u.get('status')} | society_id={u.get('society_id')} | has_consents={bool(u.get('consents'))} | id={u.get('id')}")
    
    # Search ALL athletes
    print("\n=== TUTTI GLI ATLETI ===")
    all_athletes = await db.athletes.find({}, {"_id": 0}).to_list(100)
    for a in all_athletes:
        print(f"  {a.get('first_name','?')} {a.get('last_name','?')} | parent_id={a.get('parent_id')} | second_parent_id={a.get('second_parent_id')} | society_id={a.get('society_id')} | team={a.get('team_id')} | id={a.get('id')}")
    
    # Check parent_link_requests
    print("\n=== RICHIESTE COLLEGAMENTO ===")
    requests = await db.parent_link_requests.find({}, {"_id": 0}).to_list(100)
    for r in requests:
        print(f"  requester={r.get('requester_id')} -> athlete={r.get('athlete_id')} | status={r.get('status')} | id={r.get('id')}")
    
    # Check GDPR documents
    print("\n=== DOCUMENTI GDPR (ultimi 10) ===")
    docs = await db.gdpr_documents.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    for d in docs:
        print(f"  user={d.get('user_id')} | type={d.get('document_type')} | signed={d.get('signed_at')} | id={d.get('id')}")
    
    # Check societies
    print("\n=== SOCIETA ===")
    societies = await db.societies.find({}, {"_id": 0}).to_list(10)
    for s in societies:
        print(f"  name={s.get('name')} | invite_code={s.get('invite_code')} | id={s.get('id')}")
    
    client.close()

asyncio.run(check())
