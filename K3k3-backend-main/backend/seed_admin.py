"""
Script to seed the admin account with a properly hashed password.
Run once to create the admin user.
"""
import sys
sys.path.insert(0, '.')

from database import SessionLocal, connect
from models.models import Admin
from utils.hashcode import hash_password

# Connect & ensure tables exist
connect()

db = SessionLocal()

# Check if admin already exists
existing = db.query(Admin).filter(Admin.email == "admin@k3k3.com").first()
if existing:
    # Update the password to a properly hashed one
    existing.password = hash_password("Admin@1234")
    db.commit()
    print(f"✅ Updated existing admin password (id={existing.id}, email={existing.email})")
else:
    # Create a new admin
    admin = Admin(
        name="Super Admin",
        email="admin@k3k3.com",
        phone="+233000000000",
        password=hash_password("Admin@1234"),
        role_type="admin",
        is_active=True,
        gender=None
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print(f"✅ Created admin account (id={admin.id}, email={admin.email})")

print("   Email:    admin@k3k3.com")
print("   Password: Admin@1234")
db.close()
