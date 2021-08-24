blob_headers_table_element = document.querySelector("#blob-headers-table");

blob_headers_search_word_input_element = document.querySelector("#blob-header-search-word-input");
blob_headers_search_okay_button_element = document.querySelector("#blob-header-search-okay-button");

blob_headers_search_okay_button_element.addEventListener('click', display_blob_headers);
blob_headers_search_word_input_element.addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
        blob_headers_search_okay_button_element.click();
    }
});

function display_blob_headers() {
    var filter = blob_headers_search_word_input_element.value;
    for (var i = blob_headers_table_element.rows.length-1; i > 0; i--) {
        blob_headers_table_element.deleteRow(i);
    }
    blob_headers_array = Object.values(blob_headers).filter(blob_header => {
        return blob_header.data.name.includes(filter) || blob_header.data.description.includes(filter);
    });
    for (var i = 0; i < blob_headers_array.length; i++) {
        var blob_header = blob_headers_array[blob_headers_array.length - i - 1];
        var row = blob_headers_table_element.insertRow(i+1);
        row.insertCell(0).innerHTML = blob_header.id;
        var date = new Date(0);
        date.setSeconds(blob_header.creation_time);
        row.insertCell(1).innerHTML = date.toUTCString();
        row.insertCell(2).innerHTML = blob_header.cryptokey_id;
        row.insertCell(3).innerHTML = blob_header.data.name;
        row.insertCell(4).innerHTML = blob_header.data.description;
        row.insertCell(5).innerHTML = blob_header.data.mimetype;
        var view_button_element = document.createElement('button');
        view_button_element.innerHTML = "view";
        view_button_element.setAttribute("blob_header_id", blob_header.id);
        view_button_element.addEventListener('click', view_blob_event);
        row.insertCell(6).appendChild(view_button_element);
        row.addEventListener('click', edit_blob_event);
        row.setAttribute("blob_header_id", blob_header.id);
    }
}

edit_blob_popup_element = popup_container_element.querySelector("#edit-blob-popup");
edit_blob_id_input_element = edit_blob_popup_element.querySelector("#edit-blob-id-input");
edit_blob_name_input_element = edit_blob_popup_element.querySelector("#edit-blob-name-input");
edit_blob_description_input_element = edit_blob_popup_element.querySelector("#edit-blob-description-input");
edit_blob_save_button_element = edit_blob_popup_element.querySelector("#edit-blob-save-button");
edit_blob_delete_button_element = edit_blob_popup_element.querySelector("#edit-blob-delete-button");
edit_blob_code_descriptor_element = edit_blob_popup_element.querySelector("#edit-blob-code-descriptor");
edit_blob_cryptokey_id_select_element = edit_blob_popup_element.querySelector("#edit-blob-cryptokey-id-select");
edit_blob_file_input_element = edit_blob_popup_element.querySelector("#edit-blob-file-input");

view_blob_popup_element = popup_container_element.querySelector("#view-blob-popup");
view_blob_container_element = view_blob_popup_element.querySelector("#view-blob-container");

function display_cryptokeys_select() {
    edit_blob_cryptokey_id_select_element.innerHTML = "";
    var cryptokey_ids = Object.keys(cryptokey_containers);
    for (var i in cryptokey_ids) {
        var id = cryptokey_ids[i];
        var id_element = document.createElement("option");
        id_element.value = id;
        id_element.text = cryptokey_containers[id].data.name;
        edit_blob_cryptokey_id_select_element.add(id_element, null);
    }
}

on_blob_headers_parsed = display_blob_headers;
on_cryptokeys_parsed = () => {
    get_blob_headers();
    display_cryptokeys_select();
}

function display_edit_blob_popup() {
    edit_blob_id_input_element.value = 0;
    edit_blob_name_input_element.value = "";
    edit_blob_description_input_element.value = "";
    edit_blob_code_descriptor_element.innerHTML = "";
    edit_blob_popup_element.hidden = false;
    view_blob_popup_element.hidden = true;
    popup_container_element.hidden = false;
    edit_blob_file_input_element.value = "";
}

add_new_blob_button = document.querySelector("#add-new-blob-button");
add_new_blob_button.addEventListener('click', display_edit_blob_popup);

function edit_blob_event(event) {
    var row;
    if (event.target.tagName == "BUTTON") {
        return; // ignore button click
    } else if (event.target.tagName == "TD") {
        row = event.target.parentElement;
    } else {
        row = event.target;
    }
    var id = row.getAttribute("blob_header_id");
    var blob_header = blob_headers[id];
    display_edit_blob_popup();
    edit_blob_id_input_element.value = id;
    edit_blob_name_input_element.value = blob_header.data.name;
    edit_blob_description_input_element.value = blob_header.data.description;
    edit_blob_cryptokey_id_select_element.value = blob_header.cryptokey_id;
}

async function edit_blob_go() {
    // collect
    var blob_header = {
        id: edit_blob_id_input_element.value,
        cryptokey_id: edit_blob_cryptokey_id_select_element.value,
        data: {
            name: edit_blob_name_input_element.value,
            description: edit_blob_description_input_element.value,
            mimetype: ""
        }
    };
    if (edit_blob_file_input_element.files.length > 0) {
        blob_header.data.mimetype = edit_blob_file_input_element.files[0].type;
    } else if (blob_header.id != 0) {
        blob_header.data.mimetype = blob_headers[blob_header.id].data.mimetype;
    }
    var encrypted_blob_header = await encrypt_object(blob_header);
    // send
    var response;
    if (blob_header.id == 0) {
        response = await authorized_fetch('api/blob_headers', {
            method: 'POST',
            body: JSON.stringify(encrypted_blob_header)
        });
    } else {
        response = await authorized_fetch('api/blob_headers/'+blob_header.id, {
            method: 'PUT',
            body: JSON.stringify(encrypted_blob_header)
        });
    }
    // receive
    if (response.status != 200) {
        edit_blob_code_descriptor_element.innerHTML = "Code " + response.status;
        return;
    }
    blob_header = await response.json();
    get_blob_headers();
    // save file
    if (edit_blob_file_input_element.files.length > 0) {
        var file = edit_blob_file_input_element.files[0];
        var blob = await encrypt_file_to_blob(file, blob_header.cryptokey_id);
        var formData = new FormData();
        formData.append('blob', blob);
        response = await authorized_fetch('api/blobs/'+blob_header.id, {
            method: 'PUT',
            body: formData
        });
        if (response.status != 200) {
            edit_blob_code_descriptor_element.innerHTML = "Code " + response.status;
            return;
        }
    }
    hide_popup();
}
edit_blob_save_button_element.addEventListener('click', edit_blob_go);

async function delete_blob_go() {
    var id = edit_blob_id_input_element.value;
    if (id == 0) {
        hide_popup();
        return;
    }
    var response = await authorized_fetch('api/blob_headers/'+id, {
        method: 'DELETE'
    });
    if (response.status != 200) {
        edit_blob_code_descriptor_element.innerHTML = "Code " + response.status;
        return;
    }
    hide_popup();
    get_blob_headers();
}
edit_blob_delete_button_element.addEventListener('click', delete_blob_go);

async function display_view_blob_popup(blob_header_id) {
    edit_blob_popup_element.hidden = true;
    view_blob_popup_element.hidden = false;
    popup_container_element.hidden = false;
    view_blob_container_element.innerHTML = "";
    var blob_element = await element_from_blob(blob_header_id);
    view_blob_container_element.appendChild(blob_element);
}

async function view_blob_event(event) {
    var blob_header_id = event.target.getAttribute('blob_header_id');
    display_view_blob_popup(blob_header_id);
}