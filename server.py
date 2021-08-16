import sqlite3
import time
from math import floor
import atexit
import os
import mimetypes
import hashlib
from threading import Thread

from flask import Flask, jsonify, abort, request, redirect, send_file, make_response
from werkzeug.utils import secure_filename

BLOBS_PATH = 'database/blobs'
DATABASE_PATH = 'database/cards.db'
PORT = 8888
WWW_FOLDER = 'www'

PASSWORD_SHA512 = '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043' # default hash is 'hello'

AUTOSAVE_INTERVAL = 1 * 60 # interval in seconds

app = Flask(__name__)
# WARNING! THREAD PROTECTION IS TURNED OFF
conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)

secret_keys = dict()

def card_tuple_to_json(card_tuple):
    card_json = {
        "id": card_tuple[0],
        "creation_time": card_tuple[1],
        "editing_time": card_tuple[2],
        "content": card_tuple[3],
        "tags": card_tuple[4]
    }
    return card_json

def card_json_to_tuple(card_json):
    card_tuple = (
        card_json["id"] if "id" in card_json else None,
        card_json["creation_time"] if "creation_time" in card_json else None,
        card_json["editing_time"] if "editing_time" in card_json else None,
        card_json["content"],
        card_json["tags"]
    )
    return card_tuple

def check_secret_key():
    global auth_errors_count
    key = request.cookies.get('secret_key')
    ip = request.remote_addr
    if not key:
        abort(401)
    if not (ip in secret_keys) or secret_keys[ip] != key:
        abort(403)

def generate_secret_key():
    pre_hash = PASSWORD_SHA512 + str(time.time_ns())
    key = hashlib.sha512(pre_hash.encode('utf-8')).hexdigest()
    ip = request.remote_addr
    secret_keys[ip] = key
    return key

@app.route('/login', methods=['GET'])
def get_login():
    password = request.headers.get('password')
    if not password:
        abort(401)
    password_sha512 = hashlib.sha512(password.encode('utf-8')).hexdigest()
    if password_sha512 != PASSWORD_SHA512:
        abort(403)
    key = generate_secret_key()
    response = make_response("OK")
    response.set_cookie('secret_key', key, secure=True, samesite='Strict')
    return response

@app.route('/ping', methods=['GET'])
def get_ping():
    check_secret_key()
    return "PONG"

@app.route('/cards', methods=['GET'])
def get_cards():
    check_secret_key()
    limit = request.args.get('limit', default=10, type=int)
    offset = request.args.get('offset', default=0, type=int)
    tag = request.args.get('tag', default=None, type=str)
    # WIP check for DB error
    cur = conn.cursor()
    if tag:
        try:
            cards_tuple = cur.execute('select * from cards where id in (select id from tag_'+tag+') order by creation_time desc limit ? offset ?;', (limit, offset)).fetchall()
        except sqlite3.OperationalError:
            cards_tuple = []
    else:
        cards_tuple = cur.execute('select * from cards order by creation_time desc limit ? offset ?;', (limit, offset)).fetchall()
    answer = {"cards": []}
    for card_tuple in cards_tuple:
        card_json = card_tuple_to_json(card_tuple)
        answer["cards"].append(card_json)
    return jsonify(answer)

@app.route('/cards/<int:id>', methods=['GET'])
def get_card(id):
    check_secret_key()
    # WIP check for DB error
    cur = conn.cursor()
    cards_tuple = cur.execute('select * from cards where id = ?', (id,)).fetchall()
    if len(cards_tuple) == 0:
        abort(404)
    card_tuple = cards_tuple[0]
    card_json = card_tuple_to_json(card_tuple)
    return jsonify(card_json)

@app.route('/cards', methods=['POST'])
def post_card():
    check_secret_key()
    if not request.is_json:
        abort(400)
    card_json = request.get_json(force=True)
    if not "content" in card_json or not "tags" in card_json:
        abort(400)
    card_json["creation_time"] = floor(time.time())
    card_json["editing_time"] = floor(time.time())
    card_tuple = card_json_to_tuple(card_json)
    # WIP check for DB error
    cur = conn.cursor()
    cur.execute('insert into cards (creation_time, editing_time, content, tags) values (?, ?, ?, ?);', card_tuple[1:])
    id = cur.execute('select id from cards where editing_time = ?', (card_json["editing_time"],)).fetchall()[0][0]
    for tag_name in card_json["tags"].split():
        # WIP check for DB error
        try:
            cur.execute('insert into tag_'+tag_name+' values (?);', (id,))
        except sqlite3.OperationalError:
            pass
    return str(id), 201

@app.route('/cards/<int:id>', methods=['PUT'])
def put_card(id):
    check_secret_key()
    if not request.is_json:
        abort(400)
    card_json = request.get_json(force=True)
    if not "content" in card_json or not "tags" in card_json:
        abort(400)
    card_json["editing_time"] = floor(time.time())
    card_tuple = card_json_to_tuple(card_json)
    # WIP check for DB error
    cur = conn.cursor()
    res = cur.execute('select tags from cards where id = ?;', (id,))
    if res.rowcount == 0:
        abort(404)
    old_tags = res.fetchall()[0][0]
    for tag_name in old_tags.split():
        # WIP check for DB error
        try:
            cur.execute('delete from tag_'+tag_name+' where id = ?;', (id,))
        except sqlite3.OperationalError:
            pass # tag was deleted but card still had it
    res = cur.execute('update cards set editing_time = ?, content = ?, tags = ? where id = ?;', card_tuple[2:]+(id,))
    for tag_name in card_json["tags"].split():
        # WIP check for DB error
        cur.execute('insert into tag_'+tag_name+' values (?);', (id,))
    return "OK"

@app.route('/cards/<int:id>', methods=['DELETE'])
def delete_card(id):
    check_secret_key()
    # WIP check for DB error
    cur = conn.cursor()
    res = cur.execute('select tags from cards where id = ?;', (id,))
    if res.rowcount == 0:
        abort(404)
    old_tags = res.fetchall()[0][0]
    for tag_name in old_tags.split():
        # WIP check for DB error
        try:
            cur.execute('delete from tag_'+tag_name+' where id = ?;', (id,))
        except sqlite3.OperationalError:
            pass # tag was deleted but card still had it
    cur.execute('delete from cards where id = ?;', (id,))
    return "OK"

@app.route('/tags', methods=['GET'])
def get_tags():
    check_secret_key()
    cur = conn.cursor()
    tags_tuple = cur.execute('select * from tags;').fetchall()
    tags_json = {"tags": []}
    for tag_tuple in tags_tuple:
        tag_json = {
            "name": tag_tuple[0]
        }
        tags_json["tags"].append(tag_json)
    return jsonify(tags_json)

@app.route('/tags/<name>', methods=['GET'])
def get_tag(name):
    check_secret_key()
    cur = conn.cursor()
    tags_tuple = cur.execute('select * from tags where name = ?;', (name,)).fetchall()
    if len(tags_tuple) == 0:
        abort(404)
    tag_tuple = tags_tuple[0]
    tag_json = {
        "name": tag_tuple[0]
    }
    return jsonify(tag_json)

@app.route('/tags', methods=['POST'])
def post_tags():
    check_secret_key()
    if not request.is_json:
        abort(400)
    tag_json = request.get_json(force=True)
    if not "name" in tag_json:
        abort(400)
    tag_name = tag_json["name"]
    tag_tuple = (tag_name,)
    # WIP check for DB error
    cur = conn.cursor()
    cur.execute('insert into tags values (?);', tag_tuple)
    cur.execute('create table tag_'+tag_name+' (id integer);')
    return str(id), 201

@app.route('/tags/<name>', methods=['DELETE'])
def delete_tags(name):
    check_secret_key()
    # WIP check for DB error
    cur = conn.cursor()
    res = cur.execute('delete from tags where name = ?;', (name,))
    if res.rowcount == 0:
        abort(404)
    cur.execute('drop table tag_'+name)
    return "OK"

@app.route('/blobs', methods=['POST'])
def post_blob():
    check_secret_key()
    f = request.files['file']
    new_file_name = 'f' + str(time.time_ns()) + os.path.splitext(f.filename)[1]
    path = BLOBS_PATH+'/'+new_file_name
    f.save(path)
    mim = mimetypes.guess_type(path)[0] # WIP catch None if mimetype is unknown
    if 'image' in mim:
        return '<img src="blobs/{}">'.format(new_file_name)
    elif 'audio' in mim:
        return '<audio src="blobs/{}" controls></audio>'.format(new_file_name)
    else:
        return '<a href="blobs/{}" target="_blank">File</a>'.format(new_file_name)
    
@app.route('/blobs/<name>', methods=['GET'])
def get_blob(name):
    check_secret_key()
    path = BLOBS_PATH+'/'+name
    if not os.path.isfile(path):
        abort(404)
    mim = mimetypes.guess_type(path)[0] # WIP catch None if mimetype is unknown
    return send_file(path, mimetype=mim, max_age=0) # WIP do something with cache timeout

@app.route('/', methods=['GET'])
def get_root():
    return get_other_resource("index.html")

@app.route('/<path:subpath>', methods=['GET'])
def get_other_resource(subpath):
    path = WWW_FOLDER+'/'+subpath
    if not os.path.isfile(path):
        abort(404)
    mim = mimetypes.guess_type(path)[0] # WIP catch None if mimetype is unknown
    return send_file(path, mimetype=mim, max_age=0) # WIP do something with cache timeout

def save_database():
    print('saving database...')
    conn.commit()

def shutdown_event():
    save_database()
    conn.close()

def autosave_thread_function():
    while True:
        time.sleep(AUTOSAVE_INTERVAL)
        save_database()

if __name__ == '__main__':
    atexit.register(shutdown_event)
    autosave_thread = Thread(target=autosave_thread_function, daemon=True)
    autosave_thread.start()
    app.run(port=PORT, host='0.0.0.0', ssl_context=('cert.pem', 'key.pem'))
    