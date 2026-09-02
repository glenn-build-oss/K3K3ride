import sys
sys.path.insert(0, '.')
from database import get_db
from sqlalchemy import text

db = next(get_db())

print("=== riders table columns ===")
result = db.execute(text(
    "SELECT column_name, data_type, is_nullable "
    "FROM information_schema.columns "
    "WHERE table_name = 'riders' "
    "ORDER BY ordinal_position"
))
for row in result:
    print(f"  {row[0]} | {row[1]} | nullable={row[2]}")

print()
print("=== users table columns ===")
result2 = db.execute(text(
    "SELECT column_name, data_type, is_nullable "
    "FROM information_schema.columns "
    "WHERE table_name = 'users' "
    "ORDER BY ordinal_position"
))
for row in result2:
    print(f"  {row[0]} | {row[1]} | nullable={row[2]}")

db.close()
