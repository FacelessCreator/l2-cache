search_keywords_container_element = document.querySelector("#search-keywords-container");
search_add_keyword_input_element = document.querySelector("#search-add-keyword-input");
search_add_keyword_button_element = document.querySelector("#search-add-keyword-button");
search_go_button_element = document.querySelector("#search-go-button");

found_home_button_element = document.querySelector("#found-home-button");
found_previous_button_element = document.querySelector("#found-previous-button");
found_page_number_input_element = document.querySelector("#found-page-number-input");
found_next_button_element = document.querySelector("#found-next-button");

card_template_element = document.querySelector("#card-template");
card_container_element = document.querySelector("#card-container");

did_you_mean_keyword_popup_element = popup_container_element.querySelector("#did-you-mean-keyword-popup");
did_you_mean_keyword_table_element = did_you_mean_keyword_popup_element.querySelector("table");
new_keyword_button = did_you_mean_keyword_popup_element.querySelector("#new-keyword-button");

search_code_descriptor_element = document.querySelector("#search-code-descriptor");

found_prevent_display_blob_images_checkbox = document.querySelector("#found-prevent-display-blob-images-checkbox");
prevent_display_blob_images = found_prevent_display_blob_images_checkbox.checked;
function prevent_display_blob_images_click_event(event) {
    prevent_display_blob_images = found_prevent_display_blob_images_checkbox.checked;
    search_go();
}
found_prevent_display_blob_images_checkbox.addEventListener('click', prevent_display_blob_images_click_event);

function display_search_keyword(id) {
    var keyword_element = document.createElement("button");
    if (id in keywords) {
        keyword_element.innerHTML = keywords[id].data.name;
    } else {
        keyword_element.innerHTML = "#" + id;
    }
    keyword_element.setAttribute('keyword_id', id);
    keyword_element.addEventListener('click', search_keyword_click_event);
    search_keywords_container_element.appendChild(keyword_element);
}

function search_keyword_click_event(event) {
    event.target.remove();
    search_go_home();
}

function search_add_keyword_go() {
    // search keyword
    var filter = search_add_keyword_input_element.value;
    search_add_keyword_input_element.value = "";
    var correct_keyword = Object.values(keywords).find(keyword => {
        return keyword.data.name === filter;
    });
    if (correct_keyword) {
        // just add keyword
        display_search_keyword(correct_keyword.id);
        search_go_home();
        return;
    }
    // extend search
    var keywords_array = Object.values(keywords).filter(keyword => {
        return keyword.data.name.includes(filter) || keyword.data.description.includes(filter);
    });
    // open popup
    display_did_you_mean_keyword_popup(keywords_array);
}
search_add_keyword_button_element.addEventListener('click', search_add_keyword_go);
search_add_keyword_input_element.addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
        search_add_keyword_button_element.click();
    }
});

function display_did_you_mean_keyword_popup(keywords_array) {
    did_you_mean_keyword_popup_element.hidden = false;
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
    display_search_keyword(id);
    search_go_home();
    hide_popup();
}

const CARDS_PAGE_SIZE = 5;
async function search_go() {
    // collect request
    search_keywords = [];
    for (var i = 0; i < search_keywords_container_element.children.length; i++) {
        var keyword_id = search_keywords_container_element.children[i].getAttribute('keyword_id');
        search_keywords.push(keyword_id);
    }
    var offset = CARDS_PAGE_SIZE * (found_page_number_input_element.value-1);
    var limit = CARDS_PAGE_SIZE;
    // request
    var url = 'api/cards?limit=' + limit + '&offset=' + offset;
    if (search_keywords.length > 0) {
        url += '&keywords=';
        for (var i = 0; i < search_keywords.length; ++i) {
            if (i > 0) {
                url += ',';
            }
            url += search_keywords[i];
        }
    }
    var response = await authorized_fetch(url, {
        method: 'GET'
    });
    // response
    if (response.status != 200) {
        search_code_descriptor_element = "Code " + response.status;
        return;
    }
    // retranslate
    cards = await response.json();
    async function decrypt_card_info(id) {
        cards[id] = await decrypt_object(cards[id]);
    }
    await Promise.all(Object.keys(cards).map((id) => decrypt_card_info(id)));
    display_cards(cards);
}
found_page_number_input_element.addEventListener('input', search_go);

async function search_go_home() {
    found_page_number_input_element.value = 1;
    search_go();
}
found_home_button_element.addEventListener('click', search_go_home);
search_go_button_element.addEventListener('click', search_go_home);

async function search_go_next() {
    found_page_number_input_element.value = Number(found_page_number_input_element.value) + 1;
    search_go();
}
found_next_button_element.addEventListener('click', search_go_next);

async function search_go_previous() {
    if (found_page_number_input_element.value > 1) {
        found_page_number_input_element.value -= 1;
    }
    search_go();
}
found_previous_button_element.addEventListener('click', search_go_previous);

on_keywords_parsed = () => {
    get_blob_headers();
};
on_blob_headers_parsed = () => {
    search_go();
}

function display_cards(cards) {
    card_container_element.innerHTML = "";
    cards_list = Object.values(cards);
    for (var i in cards_list) {
        var card = cards_list[i];
        var card_element = card_template_element.cloneNode(true);
        display_card(card_element, card, card_keyword_click_event, card_edit_click_event);
        card_container_element.insertBefore(card_element, card_container_element.firstChild);
    }
}

function card_keyword_click_event(event) {
    var id = event.target.getAttribute('keyword_id');
    display_search_keyword(id);
    search_go_home();
}

function card_edit_click_event(event) {
    var id = event.target.getAttribute('card_id');
    window.open("editor.html?card_id="+id,"_self");
}