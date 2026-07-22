import sqlalchemy as sa
import os
from dotenv import load_dotenv

def fix_db():
    load_dotenv()
    db_url = os.getenv('SUPABASE_DB')
    print(f"Connecting to database...")
    engine = sa.create_engine(db_url)
    
    with engine.connect() as conn:
        with conn.begin():
            try:
                conn.execute(sa.text('ALTER TABLE users RENAME COLUMN name TO fname;'))
                print('Successfully renamed column "name" to "fname".')
            except Exception as e:
                print(f'Failed to rename "name" to "fname" (it might already be renamed): {e}')
                
            try:
                conn.execute(sa.text('ALTER TABLE users ADD COLUMN lname VARCHAR(255) NOT NULL DEFAULT \'\';'))
                print('Successfully added column "lname".')
            except Exception as e:
                print(f'Failed to add column "lname" (it might already exist): {e}')

if __name__ == '__main__':
    fix_db()
