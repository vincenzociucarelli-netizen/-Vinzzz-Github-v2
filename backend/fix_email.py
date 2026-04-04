import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
load_dotenv()

async def check():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("=== TUTTI GLI UTENTI ===")
    users = await db.users.find({}, {"_id": 0}).to_list(200)
    for u in users:
        fn = u.get('first_name') or '?'
        ln = u.get('last_name') or '?'
        em = u.get('email') or '?'
        ro = u.get('role') or '?'
        sid = u.get('society_id') or 'NONE'
        print(f"  {fn:15} {ln:15} | email={em:35} | role={ro:10} | society_id={sid}")
    
    client.close()

asyncio.run(check())
