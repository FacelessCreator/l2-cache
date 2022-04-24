import sqlite3
import os

DATABASE_PATH = 'database/cards-v3.db'
SQL_SETUP_SCRIPT_PATH = 'docs/sql-setup.sql'

conn = sqlite3.connect(DATABASE_PATH)
cur = conn.cursor()

sql_script_file = open(SQL_SETUP_SCRIPT_PATH)
sql_script = sql_script_file.read()
cur.executescript(sql_script)

conn.commit()
cur.close()
conn.close()
