"""
Database connection module.
Centralizes MongoDB client and database instance access.

Usage:
    from database import db
    user = await db.users.find_one({"id": user_id})
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load env from backend/.env (idempotent — already loaded in server.py)
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection (singleton)
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

__all__ = ["client", "db", "mongo_url"]
