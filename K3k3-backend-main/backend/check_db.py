import sqlite3
conn = sqlite3.connect('k3k3.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", [r[0] for r in c.fetchall()])
c.execute("SELECT id, fname, lname, email, password, role_type FROM users LIMIT 10")
print("USERS:")
for r in c.fetchall():
    print(" ", r)
c.execute("SELECT id, name, email, password FROM admins LIMIT 10")
print("ADMINS:")
for r in c.fetchall():
    print(" ", r)
conn.close()
