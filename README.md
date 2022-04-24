# L2-cache
This is the first try to create second memory for people. An alternative to diary, common documents and archieves. Safe in encryption.

## The main idea
Write cards in markdown format to easily record your ideas. Add pictures, music, videos and other files for better expression. Use keywords to orient in your knowledges.

Use a few cryptokeys to divide cards and files on groups, depend on people who has permission to knowledges. For example, something is allowed to colleagues, something is allowed to relatives and other is only for yourself.

## Implementation
This is python flask web server with ssl. Web pages are universal for both PC and phone.

There is client-side encryption. Clients data is stored on server in two formats: sqlite for cards and files for blobs. Server never knows the encryption key, so even if it was stolen, your data is safe.

## Still vulnerable
The developer makes mistakes. So, there is no warranity that L2-cache is the best way to store sensitive data. 

Also, there are some other problems:
- If the server is compromised, client code may be compromised too. It breaks client-side encryption
- Client browsers store encryption keys in indexedDB and also may store unencrypted data cache. It's convenient but unsafe. You can delete data on each logoff to prevent this
- If you use a few cryptokeys in one login and chose wrong key for card or blob, the data is opened for everyone else who knows this cryptokey

## How to start
Generate self-signed certificate for ssl:
```
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout selfsigned.key -out selfsigned.crt
```

Set these keys in ```server.py``` ```app.run function``` (or remove ssl_context to test server without https).

Also set server PORT in ```server.py```.

Install ```make```, ```python``` and ```python-flask```.

Run ```make setup``` to generate default database.

Run ```make run``` to launch server.

Connect to https://localhost:YOUR_PORT, ignore browser warning (it happens because ssl certificate is self-signed) and open page.

Open cryptokeys, press **add cryptokey** and input default key **hello**.

If cryptokey is showed in table, you successfully logged into L2-cache.


