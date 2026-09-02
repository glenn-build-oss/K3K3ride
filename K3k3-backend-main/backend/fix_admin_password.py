"""
Minimal script to update admin password — uses only SQLAlchemy + passlib (already installed).
Does NOT import the full app stack, avoiding the supabase dependency.
"""
import sys
import os

# Add the backend directory to the path so local modules can be found
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# Use Supabase DB or fallback to local SQLite
DB_URL = os.getenv("SUPABASE_DB", "sqlite:///./k3k3.db")
if "your-project" in DB_URL:
    DB_URL = "sqlite:///./k3k3.db"

print(f"Connecting to: {DB_URL[:50]}...")

engine = create_engine(DB_URL, pool_pre_ping=True)
Session = sessionmaker(bind=engine)

# argon2 context (same as utils/hashcode.py)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

TARGET_EMAIL = "admin@k3k3.com"
TARGET_PASSWORD = "Admin@1234"
hashed = pwd_context.hash(TARGET_PASSWORD)

with Session() as db:
    result = db.execute(
        text("SELECT id, email, password FROM admins WHERE email = :email"),
        {"email": TARGET_EMAIL}
    ).fetchone()

    if result:
        admin_id, email, current_pw = result
        print(f"Found admin id={admin_id}, email={email}")

        # Check if already hashed (argon2 hashes start with $argon2)
        if current_pw and current_pw.startswith("$argon2"):
            print("✅ Password is already hashed (argon2). No update needed.")
            # Verify it works
            if pwd_context.verify(TARGET_PASSWORD, current_pw):
                print("✅ Password verification PASSED — admin login should work.")
            else:
                print("⚠️  Hash exists but verification FAILED — resetting password.")
                db.execute(
                    text("UPDATE admins SET password = :pw WHERE email = :email"),
                    {"pw": hashed, "email": TARGET_EMAIL}
                )
                db.commit()
                print(f"✅ Admin password reset successfully.")
        else:
            print(f"  Current password (plain or old hash): {(current_pw or '')[:30]}...")
            db.execute(
                text("UPDATE admins SET password = :pw WHERE email = :email"),
                {"pw": hashed, "email": TARGET_EMAIL}
            )
            db.commit()
            print(f"✅ Admin password updated to argon2 hash.")
    else:
        print(f"No admin found with email={TARGET_EMAIL}. Creating one...")
        db.execute(
            text("""
                INSERT INTO admins (name, email, phone, password, role_type, is_active)
                VALUES (:name, :email, :phone, :pw, :role, :active)
            """),
            {
                "name": "Super Admin",
                "email": TARGET_EMAIL,
                "phone": "+233000000000",
                "pw": hashed,
                "role": "admin",
                "active": True
            }
        )
        db.commit()
        print(f"✅ Admin account created.")

print()
print("=== Admin Credentials ===")
print(f"  Email:    {TARGET_EMAIL}")
print(f"  Password: {TARGET_PASSWORD}")
