"""
Seed the new K3K3 admin account with properly hashed password.
Run once to create the admin user with the specified credentials.
Password is NEVER stored in plain text - it is hashed using Argon2.
"""
import sys
sys.path.insert(0, '.')

from database import SessionLocal, connect
from models.models import Admin, GenderType
from utils.hashcode import hash_password

# Connect & ensure tables exist
connect()

db = SessionLocal()

TARGET_EMAIL = "k3k3rideadmin@gmail.com"

# Check if admin already exists
existing = db.query(Admin).filter(Admin.email == TARGET_EMAIL).first()

if existing:
    # Update existing record
    existing.name = "Admin"
    existing.phone = "0504842974"
    existing.password = hash_password("admin2026")
    existing.role_type = "admin"
    existing.is_active = True
    existing.gender = GenderType.male
    db.commit()
    print(f"[OK] Updated existing admin (id={existing.id}, email={existing.email})")
else:
    # Create new admin record
    new_admin = Admin(
        name="Admin",
        email=TARGET_EMAIL,
        phone="0504842974",
        password=hash_password("admin2026"),
        role_type="admin",
        is_active=True,
        gender=GenderType.male
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    print(f"[OK] Created admin account (id={new_admin.id}, email={new_admin.email})")

print("")
print("   Email:    k3k3rideadmin@gmail.com")
print("   Password: admin2026  (stored as secure Argon2 hash)")
print("   Name:     Admin")
print("   Phone:    0504842974")
print("   Role:     admin")
print("   Gender:   male")
print("   Active:   True")
db.close()
