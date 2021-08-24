import sqlite3
import os

BLOBS_PATH = 'database/blobs-v3'
DATABASE_PATH = 'database/cards-v3.db'
SQL_SETUP_SCRIPT_PATH = 'docs/sql-setup.sql'

os.system("rm -r "+BLOBS_PATH)
os.system("rm "+DATABASE_PATH)
os.system("mkdir "+BLOBS_PATH)

conn = sqlite3.connect(DATABASE_PATH)
cur = conn.cursor()

sql_script_file = open(SQL_SETUP_SCRIPT_PATH)
sql_script = sql_script_file.read()
cur.executescript(sql_script)

conn.commit()
cur.close()
conn.close()
