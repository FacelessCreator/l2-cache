keywords_table_element = document.querySelector("#keywords-table");

keywords_search_word_input_element = document.querySelector("#keyword-search-word-input");
keywords_search_okay_button_element = document.querySelector("#keyword-search-okay-button");

keywords_search_okay_button_element.addEventListener('click', display_keywords);
keywords_search_word_input_element.addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
        keywords_search_okay_button_element.click();
    }
});

function display_keywords() {
    var filter = keywords_search_word_input_element.value;
    for (var i = keywords_table_element.rows.length-1; i > 0; i--) {
        keywords_table_element.deleteRow(i);
    }
    keywords_array = Object.values(keywords).filter(keyword => {
        return keyword.data.name.includes(filter) || keyword.data.description.includes(filter);
    });
    for (var i = 0; i < keywords_array.length; i++) {
        var keyword = keywords_array[i];
        var row = keywords_table_element.insertRow(i+1);
        row.insertCell(0).innerHTML = keyword.id;
        var date = new Date(0);
        date.setSeconds(keyword.creation_time);
        row.insertCell(1).innerHTML = date.toUTCString();
        row.insertCell(2).innerHTML = keyword.cryptokey_id;
        row.insertCell(3).innerHTML = keyword.data.name;
        row.insertCell(4).innerHTML = keyword.data.description;
        row.addEventListener('click', edit_keyword_event);
        row.setAttribute("keyword_id", keyword.id);
    }
}
on_keywords_parsed = display_keywords;
display_keywords();

add_popup_element = document.querySelector("#add-popup");
add_id_input_element = add_popup_element.querySelector("#add-id-input");
add_name_input_element = add_popup_element.querySelector("#add-name-input");
add_description_input_element = add_popup_element.querySelector("#add-description-input");
add_save_button_element = add_popup_element.querySelector("#add-save-button");
add_delete_button_element = add_popup_element.querySelector("#add-delete-button");
add_code_descriptor_element = add_popup_element.querySelector("#add-code-descriptor");

add_cryptokey_id_select_element = add_popup_element.querySelector("#add-cryptokey-id-select");

function display_cryptokeys_select() {
    add_cryptokey_id_select_element.innerHTML = "";
    var cryptokey_ids = Object.keys(cryptokey_containers);
    for (var i in cryptokey_ids) {
        var id = cryptokey_ids[i];
        var id_element = document.createElement("option");
        id_element.value = id;
        id_element.text = cryptokey_containers[id].data.name;
        add_cryptokey_id_select_element.add(id_element, null);
    }
}
on_cryptokeys_parsed = display_cryptokeys_select;
display_cryptokeys_select();

function display_add_popup() {
    add_id_input_element.value = 0;
    add_name_input_element.value = "";
    add_description_input_element.value = "";
    add_code_descriptor_element.innerHTML = "";
    add_popup_element.hidden = false;
    popup_container_element.hidden = false;
}

add_new_keyword_button = document.querySelector("#add-new-keyword-button");
add_new_keyword_button.addEventListener('click', display_add_popup);

function edit_keyword_event(event) {
    var row;
    if (event.target.tagName == "TD") {
        row = event.target.parentElement;
    } else {
        row = event.target;
    }
    var id = row.getAttribute("keyword_id");
    var keyword = keywords[id];
    display_add_popup();
    add_id_input_element.value = id;
    add_name_input_element.value = keyword.data.name;
    add_description_input_element.value = keyword.data.description;
    add_cryptokey_id_select_element.value = keyword.cryptokey_id;
}

async function edit_keyword_go() {
    // collect
    var keyword = {
        id: add_id_input_element.value,
        cryptokey_id: add_cryptokey_id_select_element.value,
        data: {
            name: add_name_input_element.value,
            description: add_description_input_element.value
        }
    };
    var encrypted_keyword = await encrypt_object(keyword);
    // send
    var response;
    if (keyword.id == 0) {
        response = await authorized_fetch('api/keywords', {
            method: 'POST',
            body: JSON.stringify(encrypted_keyword)
        });
    } else {
        response = await authorized_fetch('api/keywords/'+keyword.id, {
            method: 'PUT',
            body: JSON.stringify(encrypted_keyword)
        });
    }
    // receive
    if (response.status != 200) {
        add_code_descriptor_element.innerHTML = "Code " + response.status;
        return;
    }
    hide_popup();
    get_keywords();
}
add_save_button_element.addEventListener('click', edit_keyword_go);

async function delete_keyword_go() {
    var id = add_id_input_element.value;
    if (id == 0) {
        hide_popup();
        return;
    }
    var response = await authorized_fetch('api/keywords/'+id, {
        method: 'DELETE'
    });
    if (response.status != 200) {
        add_code_descriptor_element.innerHTML = "Code " + response.status;
        return;
    }
    hide_popup();
    get_keywords();
}
add_delete_button_element.addEventListener('click', delete_keyword_go)