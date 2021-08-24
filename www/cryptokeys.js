POPUP_ADD_ID = 1;
POPUP_EDIT_ID = 2;

cryptokeys_table_element = document.querySelector("#cryptokeys-table");

function display_cryptokeys() {
    for (var i = cryptokeys_table_element.rows.length-1; i > 0; i--) {
        cryptokeys_table_element.deleteRow(i);
    }
    cryptokey_containers_array = Object.values(cryptokey_containers)
    for (var i = 0; i < cryptokey_containers_array.length; i++) {
        var cryptokey_container = cryptokey_containers_array[cryptokey_containers_array.length - i - 1];
        var row = cryptokeys_table_element.insertRow(i+1);
        row.insertCell(0).innerHTML = cryptokey_container.id;
        row.insertCell(1).innerHTML = cryptokey_container.hash.substring(0, 4) + '********';
        row.insertCell(2).innerHTML = cryptokey_container.data.name;
        row.insertCell(3).innerHTML = cryptokey_container.data.description;
        row.addEventListener('click', edit_cryptokey_event);
        row.setAttribute("cryptokey-id", cryptokey_container.id);
    }
}

on_cryptokeys_parsed = display_cryptokeys;
display_cryptokeys();

function edit_cryptokey_event(event) {
    var row;
    if (event.target.tagName == "TD") {
        row = event.target.parentElement;
    } else {
        row = event.target;
    }
    var id = row.getAttribute("cryptokey-id");
    var cryptokey_container = cryptokey_containers[id];
    displayPopup(POPUP_EDIT_ID);
    edit_id_input_element.value = id;
    edit_name_input_element.value = cryptokey_container.data.name;
    edit_description_input_element.value = cryptokey_container.data.description;
}

add_popup_element = document.querySelector("#add-cryptokey-popup");
edit_popup_element = document.querySelector("#edit-cryptokey-popup");

function displayPopup(popup_id) {
    add_popup_element.hidden = true;
    edit_popup_element.hidden = true;
    if (popup_id == POPUP_ADD_ID) {
        add_popup_element.hidden = false;
        add_cryptokey_input_element.value = "";
        add_popup_code_descriptor_element.innerHTML = "";
        popup_container_element.hidden = false;
    } else if (popup_id == POPUP_EDIT_ID) {
        edit_popup_element.hidden = false;
        edit_id_input_element.value = 0
        edit_cryptokey_input_element.value = "";
        edit_repeat_cryptokey_input_element.value = "";
        edit_name_input_element.value = "";
        edit_description_input_element.value = "";
        edit_popup_code_descriptor_element.innerHTML = "";
        popup_container_element.hidden = false;
    } else {
        popup_container_element.hidden = true;
    }
}

add_cryptokey_input_element = add_popup_element.querySelector("input");
add_popup_code_descriptor_element = add_popup_element.querySelector(".code-descriptor");

async function add_cryptokey_go() {
    var cryptokey_password = add_cryptokey_input_element.value;
    add_cryptokey_input_element.value = "";
    var cryptokey_hash = await sha512(cryptokey_password+PASSWORD_SALT);
    var response;
    if (auth_tokens) {
        response = await authorized_fetch("api/access", {
            method: "GET",
            headers: {
                cryptokey_hash: cryptokey_hash,
                refresh_token: auth_tokens.refresh_token
            }
        });
    } else {
        response = await authorized_fetch("api/access", {
            method: "GET",
            headers: {
                cryptokey_hash: cryptokey_hash
            }
        });
    }
    
    if (response.status != 200) {
        add_popup_code_descriptor_element.innerHTML = "Code " + response.status;
    } else {
        var encrypted_cryptokey_container = await response.json();
        encrypted_cryptokey_container.key = await password_to_key(cryptokey_password);
        encrypted_cryptokey_container.hash = cryptokey_hash;
        cryptokey_containers[encrypted_cryptokey_container.id] = encrypted_cryptokey_container;
        if (encrypted_cryptokey_container.encrypted_data && encrypted_cryptokey_container.cryptokey_id) {
            cryptokey_containers[encrypted_cryptokey_container.id] = await decrypt_object(encrypted_cryptokey_container);
        } else {
            cryptokey_containers[encrypted_cryptokey_container.id].data = {"name": "", "description": ""};
        }
        auth_tokens = {
            refresh_token: response.headers.get('refresh_token'),
            access_token: response.headers.get('access_token'),
            death_time: response.headers.get('death_time')
        };
        displayPopup(null);
        display_cryptokeys();
    }
}

add_okay_button_element = add_popup_element.querySelector("button");
add_okay_button_element.addEventListener("click", add_cryptokey_go)
add_cryptokey_input_element.addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
        add_okay_button_element.click();
    }
});

edit_id_input_element = edit_popup_element.querySelector("#edit-id-input");
edit_cryptokey_input_element = edit_popup_element.querySelector("#edit-cryptokey-input");
edit_repeat_cryptokey_input_element = edit_popup_element.querySelector("#edit-repeat-cryptokey-input");
edit_name_input_element = edit_popup_element.querySelector("#edit-name-input");
edit_description_input_element = edit_popup_element.querySelector("#edit-description-input");
edit_popup_code_descriptor_element = edit_popup_element.querySelector(".code-descriptor");

async function edit_cryptokey_go() {
    // check password match
    var password = edit_cryptokey_input_element.value;
    var password_repeat = edit_repeat_cryptokey_input_element.value;
    edit_cryptokey_input_element.value = "";
    edit_repeat_cryptokey_input_element.value = "";
    if (password != password_repeat) {
        edit_popup_code_descriptor_element.innerHTML = "Secrets don't match";
        return;
    }
    // collect cryptokey
    var cryptokey = {
        id: edit_id_input_element.value,
        cryptokey_id: edit_id_input_element.value,
        data: {
            name: edit_name_input_element.value,
            description: edit_description_input_element.value
        }
    };
    // generate keys
    var hash = await sha512(password+PASSWORD_SALT);
    var key = await password_to_key(password);
    // encrypt cryptokey
    var encrypted_cryptokey = await encrypt_object(cryptokey, key);
    // send
    var response;
    if (cryptokey.id == 0) {
        response = await fetch("api/cryptokeys", {
            method: "POST",
            headers: {
                refresh_token: auth_tokens.refresh_token,
                cryptokey_hash: hash
            },
            body: JSON.stringify(encrypted_cryptokey)
        });
    } else {
        response = await fetch("api/cryptokeys/"+cryptokey.id, {
            method: "PUT",
            headers: {
                refresh_token: auth_tokens.refresh_token,
                cryptokey_hash: hash
            },
            body: JSON.stringify(encrypted_cryptokey)
        });
    }
    // analyze
    if (response.status != 200) {
        edit_popup_code_descriptor_element.innerHTML = "Code " + response.status;
        return;
    }
    // save new cryptokey
    encrypted_cryptokey = await response.json();
    encrypted_cryptokey.key = key
    encrypted_cryptokey.hash = hash;
    cryptokey_containers[encrypted_cryptokey.id] = encrypted_cryptokey;
    if (encrypted_cryptokey.encrypted_data && encrypted_cryptokey.cryptokey_id) {
        cryptokey_containers[encrypted_cryptokey.id] = await decrypt_object(encrypted_cryptokey);
    } else {
        cryptokey_containers[encrypted_cryptokey.id].data = {"name": "", "description": ""};
    }
    auth_tokens = {
        refresh_token: response.headers.get('refresh_token'),
        access_token: response.headers.get('access_token'),
        death_time: response.headers.get('death_time')
    };
    displayPopup(null);
    display_cryptokeys();
}

edit_okay_button_element = edit_popup_element.querySelector("button");
edit_okay_button_element.addEventListener("click", edit_cryptokey_go);

add_cryptokey_button_element = document.querySelector("#add-cryptokey-button");
add_cryptokey_button_element.addEventListener("click", () => {
    displayPopup(POPUP_ADD_ID);
});
create_cryptokey_button_element = document.querySelector("#create-cryptokey-button");
create_cryptokey_button_element.addEventListener("click", () => {
    displayPopup(POPUP_EDIT_ID);
});