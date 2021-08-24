import sqlite3
import json

OLD_DATABASE_PATH = 'database/cards-v2.db'
NEW_DATABASE_PATH = 'database/cards-v3.db'

NOCRYPTO_CRYPTOKEY = -1 # fantom cryptokey for non-encrypted objects

def html_to_style_code(html_code):
    result = html_code.replace('<p>','')
    result = result.replace('<h1>', '# ')
    result = result.replace('<h2>', '# ')
    result = result.replace('</h1>', '')
    result = result.replace('</h2>', '')
    result = result.replace('</p>', '')
    result = result.replace('<ul>', '')
    result = result.replace('</ul>', '')
    result = result.replace('<li>', '* ')
    result = result.replace('</li>', '')
    return result

old_conn = sqlite3.connect(OLD_DATABASE_PATH)
old_cur = old_conn.cursor()
new_conn = sqlite3.connect(NEW_DATABASE_PATH)
new_cur = new_conn.cursor()

for card_tuple in old_cur.execute('select * from cards').fetchall():
    id = card_tuple[0]
    creation_time = card_tuple[1]
    editing_time = card_tuple[2]
    data = {
        'body': html_to_style_code(card_tuple[3])
    }
    data_str = json.dumps(data)
    cryptokey_id = NOCRYPTO_CRYPTOKEY
    # we don't save tags
    new_cur.execute('insert into cards values (?, ?, ?, ?, ?)', (id, creation_time, editing_time, cryptokey_id, data_str))

new_conn.commit()
old_cur.close()
new_cur.close()
old_conn.close()
new_conn.close()
