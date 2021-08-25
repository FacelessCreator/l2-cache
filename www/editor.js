card = {
    id: 0,
    creation_time: Math.floor(Date.now()*0.001),
    editing_time: Math.floor(Date.now()*0.001),
    cryptokey_id: 0,
    keywords: [],
    data: {
        body: ''
    }
};

async function load_card() {
    if (card.id != 0) {
        return; // prevent second loading
    }
    var url_params = new URLSearchParams(window.location.search);
    var card_id = url_params.get('card_id');
    if (card_id) {
        var response = await authorized_fetch("api/cards/"+card_id, {
            method: "GET"
        });
        if (response.status != 200) {
            action_card_code_descriptor_element.innerHTML = "Code " + response.status;
            return;
        }
        var encrypted_card = await response.json();
        card = await decrypt_object(encrypted_card);
    }
    // display info
    display_cryptokeys_select();
    display_card_editor();
    display_card(preview_card_element, card);
}
on_cryptokeys_parsed = () => {
    get_blob_headers();
};
on_blob_headers_parsed = () => {
    load_card();
}

card_identifier_element = document.querySelector("#card-identifier");
card_creation_time_element = document.querySelector("#card-creation-time");
card_editing_time_element = document.querySelector("#card-editing-time");
card_cryptokey_select_element = document.querySelector("#card-cryptokey-select");
card_keywords_container_element = document.querySelector("#card-keywords-container");
card_body_textarea_element = document.querySelector("#card-body-textarea");

add_keyword_input_element = document.querySelector("#add-keyword-input");
add_keyword_button_element = document.querySelector("#add-keyword-button");

preview_button_element = document.querySelector("#preview-button");
save_button_element = document.querySelector("#save-button");
delete_button_element = document.querySelector("#delete-button");
action_card_code_descriptor_element = document.querySelector("#action-card-code-descriptor");

preview_card_container_element = document.querySelector("#preview-card-container");
preview_card_element = preview_card_container_element.querySelector(".card");

did_you_mean_keyword_popup_element = popup_container_element.querySelector("#did-you-mean-keyword-popup");
did_you_mean_keyword_table_element = did_you_mean_keyword_popup_element.querySelector("table");
new_keyword_button = did_you_mean_keyword_popup_element.querySelector("#new-keyword-button");

new_keyword_popup_element = popup_container_element.querySelector("#new-keyword-popup");
new_keyword_name_input_element = new_keyword_popup_element.querySelector("#new-keyword-name-input");
new_keyword_description_input_element = new_keyword_popup_element.querySelector("#new-keyword-description-input");
new_keyword_okay_button_element = new_keyword_popup_element.querySelector("#new-keyword-okay-button");
new_keyword_code_descriptor_element = new_keyword_popup_element.querySelector("#new-keyword-code-descriptor");
new_keyword_cryptokey_id_select_element = new_keyword_popup_element.querySelector("#new-keyword-cryptokey-id-select");

function display_card_editor_keyword(id) {
    var keyword_element = document.createElement("button");
    if (id in keywords) {
        keyword_element.innerHTML = keywords[id].data.name;
    } else {
        keyword_element.innerHTML = "#" + id;
    }
    keyword_element.setAttribute('keyword_id', id);
    keyword_element.addEventListener('click', (event) => {
        event.target.remove();
    });
    card_keywords_container_element.appendChild(keyword_element);
}

function display_card_editor() {
    // main info
    card_identifier_element.innerHTML = "#" + card.id;
    var date = new Date(0);
    date.setSeconds(card.creation_time);
    card_creation_time_element.innerHTML = date.toUTCString();
    date = new Date(0);
    date.setSeconds(card.editing_time);
    card_editing_time_element.innerHTML = date.toUTCString();
    card_body_textarea_element.value = card.data.body;
    // keywords
    card_keywords_container_element.innerHTML = "";
    for (var i in card.keywords) {
        display_card_editor_keyword(card.keywords[i]);
    }
}

function display_cryptokeys_select() {
    // for card cryptokey
    card_cryptokey_select_element.innerHTML = "";
    var cryptokey_ids = Object.keys(cryptokey_containers);
    for (var i in cryptokey_ids) {
        var id = cryptokey_ids[i];
        var id_element = document.createElement("option");
        id_element.value = id;
        id_element.text = cryptokey_containers[id].data.name;
        card_cryptokey_select_element.add(id_element, null);
    }
    if (card.cryptokey_id in cryptokey_containers) {
        card_cryptokey_select_element.value = card.cryptokey_id;
    } else {
        card_cryptokey_select_element.value = cryptokey_ids[0];
    }
    // for new keyword cryptokey
    new_keyword_cryptokey_id_select_element.innerHTML = "";
    for (var i in cryptokey_ids) {
        var id = cryptokey_ids[i];
        var id_element = document.createElement("option");
        id_element.value = id;
        id_element.text = cryptokey_containers[id].data.name;
        new_keyword_cryptokey_id_select_element.add(id_element, null);
    }
    if (card.cryptokey_id in cryptokey_containers) {
        new_keyword_cryptokey_id_select_element.value = card.cryptokey_id;
    } else {
        new_keyword_cryptokey_id_select_element.value = cryptokey_ids[0];
    }
}

function autoheight_textarea_event(event) {
    var obj = event.target;
    obj.style.height = "auto";
    obj.style.height = (obj.scrollHeight) + "px";
}
card_body_textarea_element.addEventListener('input', autoheight_textarea_event);

function add_keyword_go() {
    // search keyword
    var filter = add_keyword_input_element.value;
    add_keyword_input_element.value = "";
    var correct_keyword = Object.values(keywords).find(keyword => {
        return keyword.data.name === filter;
    });
    if (correct_keyword) {
        // just add keyword
        display_card_editor_keyword(correct_keyword.id);
        return;
    }
    // extend search
    var keywords_array = Object.values(keywords).filter(keyword => {
        return keyword.data.name.includes(filter) || keyword.data.description.includes(filter);
    });
    // open popup
    if (keywords_array.length > 0) {
        display_did_you_mean_keyword_popup(keywords_array);
    } else {
        display_new_keyword_popup();
        new_keyword_name_input_element.value = filter;
    }
}
add_keyword_button_element.addEventListener('click', add_keyword_go);
add_keyword_input_element.addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
        add_keyword_button_element.click();
    }
});

function display_did_you_mean_keyword_popup(keywords_array) {
    did_you_mean_keyword_popup_element.hidden = false;
    new_keyword_popup_element.hidden = true;
    popup_container_element.hidden = false;
    for (var i = did_you_mean_keyword_table_element.rows.length-1; i > 0; i--) {
        did_you_mean_keyword_table_element.deleteRow(i);
    }
    for (var i = 0; i < keywords_array.length; i++) {
        var keyword = keywords_array[i];
        var row = did_you_mean_keyword_table_element.insertRow(i+1);
        row.insertCell(0).innerHTML = keyword.data.name;
        row.insertCell(1).innerHTML = keyword.data.description;
        row.addEventListener('click', did_you_mean_keyword_choice_event);
        row.setAttribute("keyword_id", keyword.id);
    }
}

function did_you_mean_keyword_choice_event(event) {
    var row;
    if (event.target.tagName == "TD") {
        row = event.target.parentElement;
    } else {
        row = event.target;
    }
    var id = row.getAttribute("keyword_id");
    display_card_editor_keyword(id);
    hide_popup();
}

new_keyword_button.addEventListener('click', display_new_keyword_popup);

function display_new_keyword_popup() {
    did_you_mean_keyword_popup_element.hidden = true;
    new_keyword_popup_element.hidden = false;
    popup_container_element.hidden = false;
    new_keyword_name_input_element.value = add_keyword_input_element.value;
    new_keyword_description_input_element.value = "";
    new_keyword_code_descriptor_element.innerHTML = "";
}

async function new_keyword_go() {
    // collect
    var keyword = {
        id: 0,
        cryptokey_id: new_keyword_cryptokey_id_select_element.value,
        data: {
            name: new_keyword_name_input_element.value,
            description: new_keyword_description_input_element.value
        }
    };
    var encrypted_keyword = await encrypt_object(keyword);
    // send
    var response = await authorized_fetch('api/keywords', {
        method: 'POST',
        body: JSON.stringify(encrypted_keyword)
    });
    // receive
    if (response.status != 200) {
        new_keyword_code_descriptor_element.innerHTML = "Code " + response.status;
        return;
    }
    encrypted_keyword = await response.json();
    hide_popup();
    await get_keywords();
    display_card_editor_keyword(encrypted_keyword.id);
}
new_keyword_okay_button_element.addEventListener('click', new_keyword_go);

function collect_card() {
    card.cryptokey_id = card_cryptokey_select_element.value;
    card.data.body = card_body_textarea_element.value;
    card.keywords = [];
    for (var i = 0; i < card_keywords_container_element.children.length; i++) {
        var keyword_id = card_keywords_container_element.children[i].getAttribute('keyword_id');
        card.keywords.push(keyword_id);
    }
}

preview_button_element.addEventListener('click', () => {
    collect_card();
    display_card(preview_card_element, card);
});

card_body_textarea_element.addEventListener('change', () => {
    preview_button_element.click();
});

async function save_card_go() {
    // collect
    collect_card();
    var encrypted_card = await encrypt_object(card);
    // send
    action_card_code_descriptor_element.innerHTML = "";
    var response;
    if (encrypted_card.id == 0) {
        response = await authorized_fetch('api/cards', {
            method: 'POST',
            body: JSON.stringify(encrypted_card)
        });
    } else {
        response = await authorized_fetch('api/cards/'+encrypted_card.id, {
            method: 'PUT',
            body: JSON.stringify(encrypted_card)
        });
    }
    // receive
    if (response.status != 200) {
        action_card_code_descriptor_element = "Code " + response.status;
        return;
    }
    // retranslate
    encrypted_card = await response.json();
    card.id = encrypted_card.id;
    card.creation_time = encrypted_card.creation_time;
    card.editing_time = encrypted_card.editing_time;
    display_card_editor();
    // close editor
    window.open("cards.html","_self");
}
save_button_element.addEventListener('click', save_card_go);

async function delete_card_go() {
    if (card.id == 0) {
        window.open("cards.html","_self");
        return;
    }
    var response = await authorized_fetch('api/cards/'+card.id, {
        method: 'DELETE'
    });
    if (response.status != 200) {
        action_card_code_descriptor_element = "Code " + response.status;
        return;
    }
    // close editor
    window.open("cards.html","_self");
}
delete_button_element.addEventListener('click', delete_card_go);

upload_file_input_element = document.querySelector("#upload-file-input");
upload_file_button_element = document.querySelector("#upload-file-button");

upload_file_button_element.addEventListener('click', () => {
    upload_file_input_element.click();
});

upload_file_input_element.addEventListener("change", () => {
    upload_file_go(upload_file_input_element.files[0]);
} );

async function upload_file_go(file) {
    action_card_code_descriptor_element.innerHTML = "";
    // collect
    var blob_header = {
        id: 0,
        cryptokey_id: card_cryptokey_select_element.value,
        data: {
            name: file.name,
            description: "Uploaded through editor",
            mimetype: file.type
        }
    };
    var encrypted_blob_header = await encrypt_object(blob_header);
    // send
    var response = await authorized_fetch('api/blob_headers', {
        method: 'POST',
        body: JSON.stringify(encrypted_blob_header)
    });
    // receive
    if (response.status != 200) {
        action_card_code_descriptor_element.innerHTML = "Code " + response.status;
        return;
    }
    blob_header = await response.json();
    get_blob_headers();
    // save file
    var blob = await encrypt_file_to_blob(file, blob_header.cryptokey_id);
    var formData = new FormData();
    formData.append('blob', blob);
    response = await authorized_fetch('api/blobs/'+blob_header.id, {
        method: 'PUT',
        body: formData
    });
    if (response.status != 200) {
        action_card_code_descriptor_element.innerHTML = "Code " + response.status;
        return;
    }
    // add row to card body
    card_body_textarea_element.value += '\n!blob ' + blob_header.id;
    preview_button_element.click();
}

function dropbox_enter_event(event) {
    event.stopPropagation();
    event.preventDefault();
}

function dropbox_over_event(event) {
    event.stopPropagation();
    event.preventDefault();
}

function dropbox_drop_event(event) {
    event.stopPropagation();
    event.preventDefault();
    var dataTransfer = event.dataTransfer;
    var file = dataTransfer.files[0];
    upload_file_go(file);
}

card_body_textarea_element.addEventListener('dragenter', dropbox_enter_event);
card_body_textarea_element.addEventListener('dragover', dropbox_over_event);
card_body_textarea_element.addEventListener('drop', dropbox_drop_event);
