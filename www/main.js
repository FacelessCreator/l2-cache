popup_container_element = document.querySelector(".popup-container");

function hide_popup() {
    popup_container_element.hidden = true;
}

function popup_container_click_event(e) {
    if (e.target !== popup_container_element)
        return;
    hide_popup();
}
popup_container_element.addEventListener("click", popup_container_click_event);

document.addEventListener('keyup', (event) => {
    if (event.key === "Escape" && !popup_container_element.hidden) {
        hide_popup();
    }
});

lock_button_element = document.querySelector("#lock-button");
lock_button_element.addEventListener("click", forget_authorization);

function uint8_to_hex(i) {
    return [...i]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

function hex_to_uint8(hexString) {
    if (hexString.length % 2 !== 0) {
        throw "Invalid hexString";
    }/*from  w w w.  j  av a 2s  . c  o  m*/
    var arrayBuffer = new Uint8Array(hexString.length / 2);

    for (var i = 0; i < hexString.length; i += 2) {
        var byteValue = parseInt(hexString.substr(i, 2), 16);
        if (isNaN(byteValue)) {
            throw "Invalid hexString";
        }
        arrayBuffer[i / 2] = byteValue;
    }

    return arrayBuffer;
}

function generate_iv() {
    return window.crypto.getRandomValues(new Uint8Array(16));
}

const text_encoder = new TextEncoder();
function text_to_blob(text) {
    var blob = text_encoder.encode(text);
    return blob;
}

const text_decoder = new TextDecoder();
function blob_to_text(blob) {
    return text_decoder.decode(blob);
}

PASSWORD_SALT = "brk,y246se1yt65shgslteg38";
PASSWORD_SALT_BLOB = text_to_blob(PASSWORD_SALT);

NOCRYPTO_CRYPTOKEY = -1; // fantom cryptokey for non-encrypted objects

async function password_to_key(password) {
    return await window.crypto.subtle.importKey(
        "raw",
        text_to_blob(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    ).then(keyMaterial => window.crypto.subtle.deriveKey(
        {
            "name": "PBKDF2",
            salt: PASSWORD_SALT_BLOB,
            "iterations": 100000,
            "hash": "SHA-256"
        },
        keyMaterial,
        { "name": "AES-CBC", "length": 256 },
        false,
        ["encrypt", "decrypt"]
    )
    )
}

async function sha512(text) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-512', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function encrypt_blob(blob, iv, key) {
    return await window.crypto.subtle.encrypt(
        { name: "AES-CBC", iv },
        key,
        blob
    );
}

async function decrypt_blob(blob, iv, key) {
    return await await window.crypto.subtle.decrypt(
        { name: "AES-CBC", iv },
        key,
        blob
    );
}

async function encrypt_object(obj, alter_key=null) {
    var encrypted_data;
    if (obj.cryptokey_id == NOCRYPTO_CRYPTOKEY) {
        encrypted_data = JSON.stringify(obj.data);
    } else {
        var key = alter_key ? alter_key : cryptokey_containers[obj.cryptokey_id].key;
        var iv = generate_iv();
        var data_json = JSON.stringify(obj.data);
        var data_blob = text_to_blob(data_json);
        var encrypted_blob = new Uint8Array(await encrypt_blob(data_blob, iv, key));
        var full_encrypted_blob = new Uint8Array([
            ...iv,
            ...encrypted_blob
        ]);
        encrypted_data = base64EncArr(full_encrypted_blob);
    }
    var new_obj = Object.assign({encrypted_data: encrypted_data}, obj);
    delete new_obj.data;
    return new_obj;
}

function read_file_binary_async(file) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();

        reader.onload = () => {
            resolve(reader.result);
        };

        reader.onerror = reject;

        reader.readAsArrayBuffer(file);
    })
}

async function encrypt_file_to_blob(file, cryptokey_id) {
    var data = await read_file_binary_async(file);
    var key = cryptokey_containers[cryptokey_id].key;
    var iv = generate_iv();
    var encrypted_data = new Uint8Array(await encrypt_blob(data, iv, key));
    var full_encrypted_data = new Uint8Array([
        ...iv,
        ...encrypted_data
    ]);
    return new Blob([full_encrypted_data]);
}

async function decrypt_object(obj, alter_key=null) {
    var data_json;
    if (obj.cryptokey_id == NOCRYPTO_CRYPTOKEY) {
        data_json = obj.encrypted_data;
    } else {
        var key = alter_key ? alter_key : cryptokey_containers[obj.cryptokey_id].key;
        var full_encrypted_data = base64DecToArr(obj.encrypted_data);
        var iv = full_encrypted_data.slice(0,16);
        var encrypted_data = full_encrypted_data.slice(16);
        var data_blob = await decrypt_blob(encrypted_data, iv, key);
        data_json = blob_to_text(data_blob);
    }
    var new_obj = Object.assign({data: JSON.parse(data_json)}, obj);
    delete new_obj.encrypted_data;
    return new_obj;
}

async function dectrypt_file_to_resource_url(full_encrypted_data, cryptokey_id) {
    var key = cryptokey_containers[cryptokey_id].key;
    var iv = full_encrypted_data.slice(0,16);
    var encrypted_data = full_encrypted_data.slice(16);
    var data = await decrypt_blob(encrypted_data, iv, key);
    var blob = new Blob([data]);
    return URL.createObjectURL(blob);
}

async function refresh_authorization() {
    fetch("api/refresh", {
        method: "GET",
        headers: {
            refresh_token: auth_tokens.refresh_token 
        }
    })
    .then((response) => {
        if (response.status == 200) {
            auth_tokens = {
                refresh_token: response.headers.get('refresh_token'),
                access_token: response.headers.get('access_token'),
                death_time: response.headers.get('death_time')
            };
        } else {
            console.error("cannot refresh tokens");
            forget_authorization();
        }
    });
}

function forget_authorization() {
    if (auth_tokens && auth_tokens.refresh_token) {
        fetch("api/access", {
            method: "DELETE",
            headers: {
                refresh_token: auth_tokens.refresh_token 
            }
        }).then((response) => {
            cryptokey_containers = {};
            auth_tokens = null;
            window.open("cryptokeys.html","_self");
        });
    } else {
        cryptokey_containers = {};
        auth_tokens = null;
        window.open("cryptokeys.html","_self");
    }
}

async function authorized_fetch(url, options) {
    if (auth_tokens != null) {
        if (auth_tokens.death_time < Date.now()*0.001) {
            await refresh_authorization();
        }
        if (!options.headers) {
            options.headers = {};
        }
        options.headers.access_token = auth_tokens.access_token;
    }
    return fetch(url, options);
}

async function get_keywords() {
    if (auth_tokens == null) {
        return;
    }
    var response = await authorized_fetch("api/keywords", {
        method: "GET"
    });
    if (response.status != 200) {
        if (response.status == 401) {
            forget_authorization();
        }
        return;
    }
    keywords = await response.json();
    async function decrypt_keyword_info(id) {
        keywords[id] = await decrypt_object(keywords[id]);
    }
    await Promise.all(Object.keys(keywords).map((id) => decrypt_keyword_info(id)));
    on_keywords_parsed();
}

/*
var iv = generate_iv();
var text = "Hello world!";
var key;
var password = "12345";

password_to_key(password).then((new_key) => {
    key = new_key;
    return encrypt_text(text, iv, key);
}).then((encrypted) => {
    return decrypt_text(encrypted, iv, key);
}).then((decrypted) => {
    console.log(decrypted);
});

sha512(password+PASSWORD_SALT).then((hash) => {
    console.log(hash);
});
*/

var cryptokey_containers = {};
var auth_tokens = JSON.parse(localStorage.getItem("auth_tokens"));
var keywords = {};
blob_headers = [];

var on_cryptokeys_parsed = function() {};
var on_keywords_parsed = function() {};
var on_blob_headers_parsed = function() {};

var DB_request = window.indexedDB.open("cards-v3", 3);
DB_request.onsuccess = function (event) {
    var db = event.target.result;
    var transaction = db.transaction(["cryptokey_containers"], "readwrite");
    var objectStore = transaction.objectStore("cryptokey_containers");

    console.log("loading database");
    var request = objectStore.openCursor();
    request.onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
            request = objectStore.get(cursor.key);
            request.onsuccess = function (event) {
                var cryptokey_container = event.target.result;
                var id = cryptokey_container.id;
                cryptokey_containers[id] = cryptokey_container;
            }
            cursor.continue();
        } else {
            // reached the end
            get_keywords();
            on_cryptokeys_parsed();
        }
    }

    window.addEventListener('beforeunload', (event) => {
        console.log("saving database");
        var transaction = db.transaction(["cryptokey_containers"], "readwrite");
        var objectStore = transaction.objectStore("cryptokey_containers");
        var request = objectStore.clear();
        request.onsuccess = function (event) {
            for (var i in cryptokey_containers) {
                objectStore.add(cryptokey_containers[i]);
            }
        }
        localStorage.setItem("auth_tokens", JSON.stringify(auth_tokens));
    });
};
DB_request.onupgradeneeded = function(event) {
    console.log("database upgrade");
    var db = event.target.result;
    var objectStore = db.createObjectStore("cryptokey_containers", { keyPath: "id" });
};
DB_request.onerror = function (event) {
    console.error("Indexed DB error");
};

function display_card_body(body_element, body) {
    body_element.innerHTML = "";
    body = body.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    rows = body.split('\n');
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.startsWith('#')) {
            var element = document.createElement('h1');
            element.innerHTML = row.slice(1);
            body_element.appendChild(element);
        } else if (row.startsWith('!blob ')) {
            var element = document.createElement('span');
            var blob_id = Number(row.slice(6));
            async function add_blob_element_when_ready(container_element, blob_header_id) {
                var blob_element = await element_from_blob(blob_header_id);
                container_element.appendChild(blob_element);
            }
            add_blob_element_when_ready(element, blob_id);
            body_element.appendChild(element);
        } else {
            var element = document.createElement('p');
            element.innerHTML = row;
            body_element.appendChild(element);
        }
    }
}

function display_card(card_element, card, keyword_event=function(){}, edit_event=function(){}) {
    // get elements
    var card_identifier_element = card_element.querySelector(".identifier");
    var card_creation_time_element = card_element.querySelector(".creation-time");
    var card_editing_time_element = card_element.querySelector(".editing-time");
    var card_cryptokey_name_element = card_element.querySelector(".cryptokey-name");
    var card_keywords_container_element = card_element.querySelector(".keywords-container");
    var card_edit_button_element = card_element.querySelector(".current-choise");
    var card_body_element = card_element.querySelector(".body");
    // setup
    card_identifier_element.innerHTML = "#" + card.id;
    var date = new Date(0);
    date.setSeconds(card.creation_time);
    card_creation_time_element.innerHTML = date.toUTCString();
    date = new Date(0);
    date.setSeconds(card.editing_time);
    card_editing_time_element.innerHTML = date.toUTCString();
    if (card.cryptokey_id in cryptokey_containers) {
        card_cryptokey_name_element.innerHTML = "cryptokey " + cryptokey_containers[card.cryptokey_id].data.name;
    } else {
        card_cryptokey_name_element.innerHTML = "cryptokey #" + card.cryptokey_id;
    }
    card_keywords_container_element.innerHTML = "";
    for (var i in card.keywords) {
        var id = card.keywords[i];
        var keyword_element = document.createElement("button");
        if (id in keywords) {
            keyword_element.innerHTML = keywords[id].data.name;
        } else {
            keyword_element.innerHTML = "#" + id;
        }
        keyword_element.setAttribute('keyword_id', id);
        keyword_element.addEventListener('click', keyword_event);
        card_keywords_container_element.appendChild(keyword_element);
    }
    card_edit_button_element.setAttribute('card_id', card.id);
    card_edit_button_element.addEventListener('click', edit_event);
    display_card_body(card_body_element, card.data.body);
    card_element.hidden = false;
}

async function get_blob_headers() {
    if (auth_tokens == null) {
        return;
    }
    var response = await authorized_fetch("api/blob_headers", {
        method: "GET"
    });
    if (response.status != 200) {
        if (response.status == 401) {
            forget_authorization();
        }
        return;
    }
    blob_headers = await response.json();
    async function decrypt_blob_header_info(id) {
        blob_headers[id] = await decrypt_object(blob_headers[id]);
    }
    await Promise.all(Object.keys(blob_headers).map((id) => decrypt_blob_header_info(id)));
    on_blob_headers_parsed();
}

function new_message_element(message) {
    var element = document.createElement("p");
    element.innerHTML = message;
    return element;
}

async function element_from_blob(blob_header_id) {
    var element;
    var blob_header = blob_headers[blob_header_id];
    if (!blob_header) {
        return new_message_element("Cannot find blob with id "+blob_header_id);
    }
    var response = await authorized_fetch("api/blobs/"+blob_header_id, {
        method: "GET"
    });
    if (response.status != 200) {
        return new_message_element("Cannot load blob with id "+blob_header_id);
    }
    var encrypted_data = await response.arrayBuffer();
    var url = await dectrypt_file_to_resource_url(encrypted_data, blob_header.cryptokey_id);
    if (blob_header.data.mimetype.includes('image')) {
        element = document.createElement('img');
        element.src = url;
        return element;
    } else if (blob_header.data.mimetype.includes('audio')) {
        element = document.createElement('audio');
        element.src = url;
        element.controls = true;
        return element;
    }
    return new_message_element("Unknown blob mimetype "+ blob_header.data.mimetype);
}