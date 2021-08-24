import sqlite3
import time
from math import floor
import atexit
import os
import mimetypes
import hashlib
import string
import random
from threading import Thread

from flask import Flask, jsonify, abort, request, redirect, send_file, make_response
from werkzeug.utils import secure_filename

BLOBS_PATH = 'database/blobs-v3'
DATABASE_PATH = 'database/cards-v3.db'
PORT = 8888
WWW_FOLDER = 'www'

AUTOSAVE_INTERVAL = 30 * 60 # interval in seconds

app = Flask(__name__)
# WARNING! THREAD PROTECTION IS TURNED OFF
conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)

"""

PASSWORD_SHA512 = '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043' # default hash is 'hello'

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

"""

TOKEN_SECRET_LENGTH = 32
REFRESH_TOKEN_LIFE_TILE = 365 * 24 * 60 * 60 # time in seconds
ACCESS_TOKEN_LIFE_TIME = 10 * 60 # time in seconds
def generate_token_secret():
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(TOKEN_SECRET_LENGTH))

SALT_LENGTH = 8
def generate_salt():
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(SALT_LENGTH))

REFRESH_TOKEN_TYPE = 1
ACCESS_TOKEN_TYPE = 2

def set_for_sql(s: set):
    if len(s) > 0:
        return '(' + str(s)[1:-1] + ')'
    else:
        return '()'

def generate_token(ip: str, cryptokey_ids: set, token_type):
    # create token
    secret = generate_token_secret()
    creation_time = floor(time.time())
    id = creation_time
    death_time = creation_time + REFRESH_TOKEN_LIFE_TILE
    # save token
    cur = conn.cursor()
    table_name = ""
    if token_type == REFRESH_TOKEN_TYPE:
        table_name = "refresh_tokens"
    elif token_type == ACCESS_TOKEN_TYPE:
        table_name = "access_tokens"
    cur.execute('insert into '+table_name+' values (?, ?, ?, ?, ?)', (secret, id, ip, creation_time, death_time))
    table_name = ""
    if token_type == REFRESH_TOKEN_TYPE:
        table_name = "refresh_token_cryptokeys"
    elif token_type == ACCESS_TOKEN_TYPE:
        table_name = "access_token_cryptokeys"
    for cryptokey_id in cryptokey_ids:
        cur.execute('insert into '+table_name+' values (?, ?)', (id, cryptokey_id))
    # return token
    return secret, death_time

def abort_token(token: str, token_type):
    cur = conn.cursor()
    table_name = ""
    if token_type == REFRESH_TOKEN_TYPE:
        table_name = "refresh_tokens"
    elif token_type == ACCESS_TOKEN_TYPE:
        table_name = "access_tokens"
    id = cur.execute('select id from '+table_name+' where token=?', (token,)).fetchall()[0][0]
    cur.execute('delete from '+table_name+' where id=?', (id,))
    table_name = ""
    if token_type == REFRESH_TOKEN_TYPE:
        table_name = "refresh_token_cryptokeys"
    elif token_type == ACCESS_TOKEN_TYPE:
        table_name = "access_token_cryptokeys"
    cur.execute('delete from '+table_name+' where token_id=?', (id,))

def check_token(token: str, token_type):
    cur = conn.cursor()
    table_name = ""
    if token_type == REFRESH_TOKEN_TYPE:
        table_name = "refresh_tokens"
    elif token_type == ACCESS_TOKEN_TYPE:
        table_name = "access_tokens"
    sql_result = cur.execute('select death_time from '+table_name+' where token=?', (token,)).fetchall()
    if len(sql_result) == 0:
        return False
    death_time = sql_result[0][0]
    if death_time < floor(time.time()):
        return False
    return True

def get_token_cryptokeys(token: str, token_type):
    cur = conn.cursor()
    table_name = ""
    if token_type == REFRESH_TOKEN_TYPE:
        table_name = "refresh_tokens"
    elif token_type == ACCESS_TOKEN_TYPE:
        table_name = "access_tokens"
    id = cur.execute('select id from '+table_name+' where token=?', (token,)).fetchall()[0][0]
    table_name = ""
    if token_type == REFRESH_TOKEN_TYPE:
        table_name = "refresh_token_cryptokeys"
    elif token_type == ACCESS_TOKEN_TYPE:
        table_name = "access_token_cryptokeys"
    result = cur.execute('select cryptokey_id from '+table_name+' where token_id=?', (id,)).fetchall()
    cryptokey_ids = set()
    for row in result:
        cryptokey_ids.add(row[0])
    return cryptokey_ids

@app.route('/api/access', methods=['GET'])
def get_access():
    cryptokey_hash_1 = request.headers.get('cryptokey_hash', 'NO HASH')
    cur = conn.cursor()
    cryptokeys = cur.execute('select id, salt, hash from cryptokeys').fetchall()
    for cryptokey in cryptokeys:
        salt = cryptokey[1]
        cryptokey_hash = hashlib.sha512((cryptokey_hash_1+salt).encode('utf-8')).hexdigest()
        if cryptokey_hash != cryptokey[2]:
            continue
        # get accessed cryptokey info
        cryptokey_id = cryptokey[0]
        cryptokey_dict = dict()
        cryptokey_dict['id'], cryptokey_dict['creation_time'], cryptokey_dict['editing_time'], cryptokey_dict['cryptokey_id'], cryptokey_dict['encrypted_data'] = cur.execute('select id, creation_time, editing_time, cryptokey_id, encrypted_data from cryptokeys where id = ?', (cryptokey_id,)).fetchall()[0]
        resp = make_response(jsonify(cryptokey_dict))
        # generate tokens
        old_refresh_token = request.headers.get('refresh_token', 'NO TOKEN')
        cryptokey_ids = set()
        if old_refresh_token != 'NO TOKEN':
            cryptokey_ids = get_token_cryptokeys(old_refresh_token, REFRESH_TOKEN_TYPE)
            abort_token(old_refresh_token, REFRESH_TOKEN_TYPE)
        cryptokey_ids.add(cryptokey_id)
        resp.headers['refresh_token'], nothing = generate_token(request.remote_addr, cryptokey_ids, REFRESH_TOKEN_TYPE)
        resp.headers['access_token'], resp.headers['death_time'] = generate_token(request.remote_addr, cryptokey_ids, ACCESS_TOKEN_TYPE)
        return resp
    abort(404)

@app.route('/api/access', methods=['DELETE'])
def delete_access():
    refresh_token = request.headers.get('refresh_token', 'NO TOKEN')
    if not check_token(refresh_token, REFRESH_TOKEN_TYPE):
        abort(401)
    abort_token(refresh_token, REFRESH_TOKEN_TYPE)
    return "OK"

@app.route('/api/refresh', methods=['GET'])
def get_refresh():
    old_refresh_token = request.headers.get('refresh_token', 'NO TOKEN')
    if not check_token(old_refresh_token, REFRESH_TOKEN_TYPE):
        abort(401)
    cryptokey_ids = get_token_cryptokeys(old_refresh_token, REFRESH_TOKEN_TYPE)
    abort_token(old_refresh_token, REFRESH_TOKEN_TYPE)
    resp = make_response("OK")
    resp.headers['refresh_token'], nothing = generate_token(request.remote_addr, cryptokey_ids, REFRESH_TOKEN_TYPE)
    resp.headers['access_token'], resp.headers['death_time'] = generate_token(request.remote_addr, cryptokey_ids, ACCESS_TOKEN_TYPE)
    return resp

@app.route('/api/cryptokeys', methods=['GET'])
def get_cryptokeys():
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    allowed_cryptokeys = get_token_cryptokeys(access_token, ACCESS_TOKEN_TYPE)
    cur = conn.cursor()
    cryptokey_tuples = cur.execute('select id, creation_time, editing_time, cryptokey_id, encrypted_data from cryptokeys where cryptokey_id in '+set_for_sql(allowed_cryptokeys)).fetchall()
    cryptokey_dicts = dict()
    for cryptokey_tuple in cryptokey_tuples:
        cryptokey_dicts[cryptokey_tuple[0]] = {
            'id': cryptokey_tuple[0],
            'creation_time': cryptokey_tuple[1],
            'editing_time': cryptokey_tuple[2],
            'cryptokey_id': cryptokey_tuple[3],
            'encrypted_data': cryptokey_tuple[4]
        }
    return jsonify(cryptokey_dicts)

@app.route('/api/cryptokeys', methods=['POST'])
def post_cryptokeys():
    old_refresh_token = request.headers.get('refresh_token', 'NO TOKEN')
    if not check_token(old_refresh_token, REFRESH_TOKEN_TYPE):
        abort(401)
    # modify cryptokey
    cryptokey = request.get_json(force=True)
    cur = conn.cursor()
    cryptokey['id'] = cur.execute('select max(id) from cryptokeys').fetchall()[0][0] + 1
    cryptokey['creation_time'] = floor(time.time())
    cryptokey['editing_time'] = cryptokey['creation_time']
    if not ('cryptokey_id' in cryptokey) or (cryptokey['cryptokey_id'] == '0'):
        cryptokey['cryptokey_id'] = cryptokey['id']
    # save cryptokey
    secret = request.headers.get('cryptokey_hash')
    salt = generate_salt()
    hash = hashlib.sha512((secret+salt).encode('utf-8')).hexdigest()
    cur.execute('insert into cryptokeys values (?, ?, ?, ?, ?, ?, ?)', (cryptokey['id'], cryptokey['creation_time'], cryptokey['editing_time'], salt, hash, cryptokey['cryptokey_id'], cryptokey['encrypted_data']))
    # generate response
    resp = make_response(jsonify(cryptokey))
    # generate tokens
    cryptokey_ids = get_token_cryptokeys(old_refresh_token, REFRESH_TOKEN_TYPE)
    abort_token(old_refresh_token, REFRESH_TOKEN_TYPE)
    cryptokey_ids.add(cryptokey['id'])
    resp.headers['refresh_token'], nothing = generate_token(request.remote_addr, cryptokey_ids, REFRESH_TOKEN_TYPE)
    resp.headers['access_token'], resp.headers['death_time'] = generate_token(request.remote_addr, cryptokey_ids, ACCESS_TOKEN_TYPE)
    return resp

@app.route('/api/cryptokeys/<int:id>', methods=['GET'])
def get_cryptokey(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    allowed_cryptokeys = get_token_cryptokeys(access_token, ACCESS_TOKEN_TYPE)
    cur = conn.cursor()
    cryptokey_tuples = cur.execute('select id, creation_time, editing_time, cryptokey_id, encrypted_data from cryptokeys where id=? and cryptokey_id in '+set_for_sql(allowed_cryptokeys), (id,)).fetchall()
    if len(cryptokey_tuples) == 0:
        abort(404)
    cryptokey_tuple = cryptokey_tuples[0]
    cryptokey_dict = {
        'id': cryptokey_tuple[0],
        'creation_time': cryptokey_tuple[1],
        'editing_time': cryptokey_tuple[2],
        'cryptokey_id': cryptokey_tuple[3],
        'encrypted_data': cryptokey_tuple[4]
    }
    return jsonify(cryptokey_dict)

@app.route('/api/cryptokeys/<int:id>', methods=['PUT'])
def put_cryptokey(id):
    old_refresh_token = request.headers.get('refresh_token', 'NO TOKEN')
    if not check_token(old_refresh_token, REFRESH_TOKEN_TYPE):
        abort(401)
    # modify cryptokey
    cryptokey = request.get_json(force=True)
    cryptokey['id'] = id
    cryptokey['editing_time'] = floor(time.time())
    # save cryptokey
    secret = request.headers.get('cryptokey_hash')
    salt = generate_salt()
    hash = hashlib.sha512((secret+salt).encode('utf-8')).hexdigest()
    cur = conn.cursor()
    cur.execute('update cryptokeys set editing_time=?, salt=?, hash=?, cryptokey_id=?, encrypted_data=? where id=?', (cryptokey['editing_time'], salt, hash, cryptokey['cryptokey_id'], cryptokey['encrypted_data'], cryptokey['id']))
    # generate response
    resp = make_response(jsonify(cryptokey))
    # generate tokens
    cryptokey_ids = get_token_cryptokeys(old_refresh_token, REFRESH_TOKEN_TYPE)
    abort_token(old_refresh_token, REFRESH_TOKEN_TYPE)
    cryptokey_ids.add(cryptokey['id'])
    resp.headers['refresh_token'], nothing = generate_token(request.remote_addr, cryptokey_ids, REFRESH_TOKEN_TYPE)
    resp.headers['access_token'], resp.headers['death_time'] = generate_token(request.remote_addr, cryptokey_ids, ACCESS_TOKEN_TYPE)
    return resp

@app.route('/api/keywords', methods=['GET'])
def get_keywords():
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    allowed_cryptokeys = get_token_cryptokeys(access_token, ACCESS_TOKEN_TYPE)
    cur = conn.cursor()
    keyword_tuples = cur.execute('select * from keywords where cryptokey_id in '+set_for_sql(allowed_cryptokeys)).fetchall()
    response = dict()
    for keyword_tuple in keyword_tuples:
        keyword_dict = {
            'id': keyword_tuple[0],
            'creation_time': keyword_tuple[1],
            'editing_time': keyword_tuple[2],
            'cryptokey_id': keyword_tuple[3],
            'encrypted_data': keyword_tuple[4]
        }
        response[keyword_dict['id']] = keyword_dict
    return jsonify(response)

@app.route('/api/keywords', methods=['POST'])
def post_keywords():
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    # modify
    keyword = request.get_json(force=True)
    keyword['id'] = floor(time.time())
    keyword['creation_time'] = floor(time.time())
    keyword['editing_time'] = keyword['creation_time']
    # save
    cur = conn.cursor()
    cur.execute('insert into keywords values (?, ?, ?, ?, ?)', (keyword['id'], keyword['creation_time'], keyword['editing_time'], keyword['cryptokey_id'], keyword['encrypted_data']))
    return jsonify(keyword)

@app.route('/api/keywords/<int:id>', methods=['GET'])
def get_keyword(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    allowed_cryptokeys = get_token_cryptokeys(access_token, ACCESS_TOKEN_TYPE)
    cur = conn.cursor()
    keyword_tuples = cur.execute('select * from keywords where id=? and cryptokey_id in '+set_for_sql(allowed_cryptokeys), (id,)).fetchall()
    if len(keyword_tuples) == 0:
        abort(404)
    keyword_tuple = keyword_tuples[0]
    keyword_dict = {
        'id': keyword_tuple[0],
        'creation_time': keyword_tuple[1],
        'editing_time': keyword_tuple[2],
        'cryptokey_id': keyword_tuple[3],
        'encrypted_data': keyword_tuple[4]
    }
    return jsonify(keyword_dict)

@app.route('/api/keywords/<int:id>', methods=['PUT'])
def put_keyword(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    # modify
    keyword = request.get_json(force=True)
    keyword['id'] = id
    keyword['editing_time'] = floor(time.time())
    # save
    cur = conn.cursor()
    cur.execute('update keywords set editing_time=?, cryptokey_id=?, encrypted_data=? where id=?', (keyword['editing_time'], keyword['cryptokey_id'], keyword['encrypted_data'], keyword['id']))
    return jsonify(keyword)

@app.route('/api/keywords/<int:id>', methods=['DELETE'])
def delete_keyword(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    cur = conn.cursor()
    cur.execute('delete from keywords where id=?', (id,))
    return "OK"

@app.route('/api/cards', methods=['GET'])
def get_cards():
    # check auth
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    allowed_cryptokeys = get_token_cryptokeys(access_token, ACCESS_TOKEN_TYPE)
    # prepare search
    limit = request.args.get('limit', default=10, type=int)
    offset = request.args.get('offset', default=0, type=int)
    keywords = request.args.get('keywords', default=None, type=str)
    # search
    cur = conn.cursor()
    if not keywords:
        card_tuples = cur.execute('select * from cards where cryptokey_id in '+set_for_sql(allowed_cryptokeys)+' order by creation_time desc limit ? offset ?', (limit, offset)).fetchall()
    else:
        keywords = keywords.split(',')
        card_ids = set()
        for row in cur.execute('select card_id from card_keywords where keyword_id=?', (keywords.pop(),)):
            card_ids.add(row[0])
        for keyword in keywords:
            card_ids_2 = set()
            for row in cur.execute('select card_id from card_keywords where keyword_id=? and card_id in '+set_for_sql(card_ids), (keyword,)):
                card_ids_2.add(row[0])
            card_ids = card_ids_2
        card_tuples = cur.execute('select * from cards where cryptokey_id in '+set_for_sql(allowed_cryptokeys)+' and id in '+set_for_sql(card_ids)+' order by creation_time desc limit ? offset ?', (limit, offset)).fetchall()
    response = dict()
    for card_tuple in card_tuples:
        card_dict = {
            'id': card_tuple[0],
            'creation_time': card_tuple[1],
            'editing_time': card_tuple[2],
            'cryptokey_id': card_tuple[3],
            'encrypted_data': card_tuple[4]
        }
        card_dict['keywords'] = []
        for row in cur.execute('select keyword_id from card_keywords where card_id=?', (card_dict['id'],)):
            card_dict['keywords'].append(row[0])
        response[card_dict['id']] = card_dict
    return jsonify(response)

@app.route('/api/cards', methods=['POST'])
def post_cards():
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    # modify
    card = request.get_json(force=True)
    card['id'] = floor(time.time())
    card['creation_time'] = floor(time.time())
    card['editing_time'] = card['creation_time']
    # save
    cur = conn.cursor()
    cur.execute('insert into cards values (?, ?, ?, ?, ?)', (card['id'], card['creation_time'], card['editing_time'], card['cryptokey_id'], card['encrypted_data']))
    for keyword_id in card['keywords']:
        cur.execute('insert into card_keywords values (?, ?)', (card['id'], keyword_id))
    return jsonify(card)

@app.route('/api/cards/<int:id>', methods=['GET'])
def get_card(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    allowed_cryptokeys = get_token_cryptokeys(access_token, ACCESS_TOKEN_TYPE)
    cur = conn.cursor()
    card_tuples = cur.execute('select * from cards where id=? and cryptokey_id in '+set_for_sql(allowed_cryptokeys), (id,)).fetchall()
    if len(card_tuples) == 0:
        abort(404)
    card_tuple = card_tuples[0]
    card_dict = {
        'id': card_tuple[0],
        'creation_time': card_tuple[1],
        'editing_time': card_tuple[2],
        'cryptokey_id': card_tuple[3],
        'encrypted_data': card_tuple[4]
    }
    card_dict['keywords'] = []
    for row in cur.execute('select keyword_id from card_keywords where card_id=?', (card_dict['id'],)):
        card_dict['keywords'].append(row[0])
    return jsonify(card_dict)

@app.route('/api/cards/<int:id>', methods=['PUT'])
def put_card(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    # modify
    card = request.get_json(force=True)
    card['id'] = id
    card['editing_time'] = floor(time.time())
    # save
    cur = conn.cursor()
    cur.execute('update cards set editing_time=?, cryptokey_id=?, encrypted_data=? where id=?', (card['editing_time'], card['cryptokey_id'], card['encrypted_data'], card['id']))
    cur.execute('delete from card_keywords where card_id=?', (card['id'],))
    for keyword_id in card['keywords']:
        cur.execute('insert into card_keywords values (?, ?)', (card['id'], keyword_id))
    return jsonify(card)

@app.route('/api/cards/<int:id>', methods=['DELETE'])
def delete_card(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    cur = conn.cursor()
    cur.execute('delete from cards where id=?', (id,))
    cur.execute('delete from card_keywords where card_id=?', (id,))
    return "OK"

@app.route('/api/blob_headers', methods=['GET'])
def get_blob_headers():
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    allowed_cryptokeys = get_token_cryptokeys(access_token, ACCESS_TOKEN_TYPE)
    cur = conn.cursor()
    blob_header_tuples = cur.execute('select * from blob_headers where cryptokey_id in '+set_for_sql(allowed_cryptokeys)).fetchall()
    response = dict()
    for blob_header_tuple in blob_header_tuples:
        blob_header_dict = {
            'id': blob_header_tuple[0],
            'creation_time': blob_header_tuple[1],
            'editing_time': blob_header_tuple[2],
            'cryptokey_id': blob_header_tuple[3],
            'encrypted_data': blob_header_tuple[4]
        }
        response[blob_header_dict['id']] = blob_header_dict
    return jsonify(response)

@app.route('/api/blob_headers', methods=['POST'])
def post_blob_headers():
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    # modify
    blob_header = request.get_json(force=True)
    blob_header['id'] = floor(time.time())
    blob_header['creation_time'] = floor(time.time())
    blob_header['editing_time'] = blob_header['creation_time']
    # save
    cur = conn.cursor()
    cur.execute('insert into blob_headers values (?, ?, ?, ?, ?)', (blob_header['id'], blob_header['creation_time'], blob_header['editing_time'], blob_header['cryptokey_id'], blob_header['encrypted_data']))
    return jsonify(blob_header)

@app.route('/api/blob_headers/<int:id>', methods=['GET'])
def get_blob_header(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    allowed_cryptokeys = get_token_cryptokeys(access_token, ACCESS_TOKEN_TYPE)
    cur = conn.cursor()
    blob_header_tuples = cur.execute('select * from blob_headers where id=? and cryptokey_id in '+set_for_sql(allowed_cryptokeys), (id,)).fetchall()
    if len(blob_header_tuples) == 0:
        abort(404)
    blob_header_tuple = blob_header_tuples[0]
    blob_header_dict = {
        'id': blob_header_tuple[0],
        'creation_time': blob_header_tuple[1],
        'editing_time': blob_header_tuple[2],
        'cryptokey_id': blob_header_tuple[3],
        'encrypted_data': blob_header_tuple[4]
    }
    return jsonify(blob_header_dict)

@app.route('/api/blob_headers/<int:id>', methods=['PUT'])
def put_blob_header(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    # modify
    blob_header = request.get_json(force=True)
    blob_header['id'] = id
    blob_header['editing_time'] = floor(time.time())
    # save
    cur = conn.cursor()
    cur.execute('update blob_headers set editing_time=?, cryptokey_id=?, encrypted_data=? where id=?', (blob_header['editing_time'], blob_header['cryptokey_id'], blob_header['encrypted_data'], blob_header['id']))
    return jsonify(blob_header)

@app.route('/api/blob_headers/<int:id>', methods=['DELETE'])
def delete_blob_header(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    cur = conn.cursor()
    cur.execute('delete from blob_headers where id=?', (id,))
    path = BLOBS_PATH + '/b' + str(id)
    if os.path.isfile(path):
        os.remove(path)
    return "OK"

@app.route('/api/blobs/<int:id>', methods=['GET'])
def get_blob(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    # WIP check header author
    path = BLOBS_PATH + '/b' + str(id)
    if not os.path.isfile(path):
        abort(404)
    return send_file(path, max_age=0) # WIP do something with cache timeout

@app.route('/api/blobs/<int:id>', methods=['PUT'])
def post_blob(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    # WIP check header author
    f = request.files['blob']
    path = BLOBS_PATH + '/b' + str(id)
    if os.path.isfile(path):
        os.remove(path)
    f.save(path)
    return "OK"

@app.route('/api/blobs/<int:id>', methods=['DELETE'])
def delete_blob(id):
    access_token = request.headers.get('access_token', 'NO TOKEN')
    if not check_token(access_token, ACCESS_TOKEN_TYPE):
        abort(401)
    # WIP check header author
    path = BLOBS_PATH + '/b' + str(id)
    if not os.path.isfile(path):
        abort(404)
    os.remove(path)
    return "OK"

@app.route('/', methods=['GET'])
def get_root():
    return get_other_resource("cryptokeys.html")

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
    