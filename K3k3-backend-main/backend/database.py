from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import Optional
import os

load_dotenv()

class Base(DeclarativeBase):
    pass

# SQLAlchemy Setup (for ORM)
DB_URL = os.getenv("SUPABASE_DB")
if not DB_URL or "your-project" in DB_URL:
    DB_URL = "sqlite:///./k3k3.db"
    print(f"Using fallback SQLite database: {DB_URL}")

engine = create_engine(DB_URL, pool_pre_ping=True, pool_recycle=300)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Supabase SDK Setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def get_supabase() -> Optional[Client]:
    if not SUPABASE_URL or "your-project" in SUPABASE_URL:
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def connect():
    import models
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine, checkfirst=True)

    
    # Auto-migrate schema mismatch
    with engine.begin() as conn:
        try:
            conn.execute(text('ALTER TABLE users RENAME COLUMN name TO fname;'))
            print("Renamed 'name' to 'fname'")
        except Exception:
            pass
            
        try:
            conn.execute(text('ALTER TABLE users ADD COLUMN lname VARCHAR(255) NOT NULL DEFAULT \'\';'))
            print("Added 'lname' column")
        except Exception:
            pass

        try:
            conn.execute(text('ALTER TABLE users ADD COLUMN dob DATE NULL;'))
            print("Added 'dob' column")
        except Exception:
            pass
            
        try:
            conn.execute(text('ALTER TABLE users ADD COLUMN nationality VARCHAR(255) NULL;'))
            print("Added 'nationality' column")
        except Exception:
            pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()