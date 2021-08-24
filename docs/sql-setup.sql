/* TABLES */
create table cards (id integer primary key, creation_time integer, editing_time integer, cryptokey_id integer, encrypted_data text);
create table keywords (id integer primary key, creation_time integer, editing_time integer, cryptokey_id integer, encrypted_data text);
create table card_keywords (card_id integer, keyword_id integer);
create table card_references (from_card_id integer, to_card_id integer);
create table blob_headers (id integer primary key, creation_time integer, editing_time integer, cryptokey_id integer, encrypted_data text);
create table cryptokeys (id integer primary key, creation_time integer, editing_time integer, salt text, hash text, cryptokey_id integer, encrypted_data text);
create table refresh_tokens (token text primary key, id integer, ip text, creation_time integer, death_time integer);
create table refresh_token_cryptokeys (token_id integer, cryptokey_id integer);
create table access_tokens (token text primary key, id integer, ip text, creation_time integer, death_time integer);
create table access_token_cryptokeys (token_id integer, cryptokey_id integer);

insert into cryptokeys values (1, 0, 0, '1234', '417f373fdcff6025836a691427e9b2c14487f144b81e903afdb58cd72b2b7a3a0fa89efc9d68c245f1192526aa95a22ae84ffa7ae6c244edb453c189facd2e8f', null, null); /* default key='hello', pepper='brk,y246se1yt65shgslteg38' */
