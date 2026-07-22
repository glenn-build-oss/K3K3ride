import sqlite3

conn = sqlite3.connect('k3k3.db')
c = conn.cursor()

# Check existing columns
c.execute("PRAGMA table_info(trips)")
cols = [row[1] for row in c.fetchall()]
print("Existing columns:", cols)

added = []
if 'pickup_label' not in cols:
    c.execute("ALTER TABLE trips ADD COLUMN pickup_label TEXT")
    added.append('pickup_label')

if 'dest_label' not in cols:
    c.execute("ALTER TABLE trips ADD COLUMN dest_label TEXT")
    added.append('dest_label')

conn.commit()
conn.close()

if added:
    print(f"Migration OK — added columns: {added}")
else:
    print("Already up to date — no columns added")
