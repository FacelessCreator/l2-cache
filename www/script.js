/*  ------
    PUBLIC
    ------  */

// ELEMENTS
var pageElements = {};
pageElements["search"] = document.querySelector("#search-page");
pageElements["edit"] = document.querySelector("#edit-page");
pageElements["tags_list"] = document.querySelector("#tags-list-page");

var popUpPageElements = {};
popUpPageElements["new_tag"] = document.querySelector("#new-tag-pop-up-page");
popUpPageElements["delete_tag"] = document.querySelector("#delete-tag-pop-up-page");
popUpPageElements["authorization"] = document.querySelector("#authorization-pop-up-page");
popUpPageElements["upload_file"] = document.querySelector("#upload-file-pop-up-page");

var cardTemplateElement = document.querySelector("#card-template");
var optionTemplateElement = document.querySelector("#template-option");
var buttonTemplateElement = document.querySelector("#template-button");
var tagButtonTemplateElement = document.querySelector("#template-tag-button");

// VARIABLES
var allTagsList = [];

// FUNCTIONS
function requestTags() {
    var url = 'tags';
    fetch(url, {
        credentials: 'include'
    })
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            allTagsList = data.tags;
            displayTagSelectSearchList();
            displayTagSelectEditList();
            displayTagsList();
            displayDeleteTag();
        });
}

function cardToElement(card) {
    var cardElement = cardTemplateElement.cloneNode(true);
    var creationTimeElement = cardElement.querySelector(".value-p");
    var date = new Date(card.creation_time * 1000); // Date uses milliseconds while database like seconds
    creationTimeElement.innerHTML = date.toString().slice(0,24); //WIP КОСТЫЛЬ, может не работать в других локалях
    var cardButtonListElement = cardElement.querySelector(".buttons-list");
    var tagsList = card.tags.split(' ');
    for (var j in tagsList) {
        var tag = tagsList[j];
        var tagElement = tagButtonTemplateElement.cloneNode(false);
        tagElement.innerHTML = tag;
        tagElement.addEventListener("click", searchByTagEvent);
        cardButtonListElement.appendChild(tagElement);
    }
    var cardContentElement = cardElement.querySelector(".card-content");
    cardContentElement.innerHTML = card.content;
    return cardElement;
}

function displayPage(name) {
    for (var i in pageElements) {
        pageElements[i].hidden = true;
    }
    pageElements[name].hidden = false;
}

function displayPopUpPage(name) {
    for (var i in popUpPageElements) {
        popUpPageElements[i].hidden = true;
    }
    if (name) {
        popUpPageElements[name].hidden = false;
    }
}

/*  --------- 
    SEARCHING
    ---------  */

// ELEMENTS
var searchButtonsRowElement = document.querySelector("#search-buttons-row");
var homeButtonSearchElement = searchButtonsRowElement.querySelector(".home-button");
var backButtonSearchElement = searchButtonsRowElement.querySelector(".back-button");
var nextButtonSearchElement = searchButtonsRowElement.querySelector(".next-button");
var newCardButtonSearchElement = searchButtonsRowElement.querySelector(".add-button");
var listValueSearchElement = searchButtonsRowElement.querySelector(".value-p");
var tagSelectSearchElement = searchButtonsRowElement.querySelector(".tag-select");
var tagsListButtonSearchElement = searchButtonsRowElement.querySelector(".tags-list-button");

// CONSTANTS
var SEARCH_LIST_SIZE = 5;

// VARIABLES
var searchTag = null;
var currentSearchListNumber = 0;
var searchCardsList = [];
var searchCardElementsList = [];

// FUNCTIONS
function displaySearchListNumber() {
    listValueSearchElement.innerHTML = currentSearchListNumber+1;
}

function displaySearchCardsList() {
    for (var i in searchCardElementsList) {
        var cardElement = searchCardElementsList[i];
        cardElement.remove();
    }
    searchCardElementsList = [];
    for (var i in searchCardsList) {
        var card = searchCardsList[i];
        var cardElement = cardToElement(card);
        var editButtonElement = cardElement.querySelector('.edit-button');
        editButtonElement.addEventListener("click", editCardEvent);
        var deleteButtonElement = cardElement.querySelector('.delete-button')   ;
        deleteButtonElement.addEventListener("click", deleteCardEvent);
        editButtonElement.setAttribute("card-number", i);
        deleteButtonElement.setAttribute("card-number", i);
        pageElements["search"].appendChild(cardElement);
        searchCardElementsList.push(cardElement);
    }
}

function displayTagSelectSearchList() {
    tagSelectSearchElement.innerHTML = '<option value="ANY">ANY</option>';
    for (var i in allTagsList) {
        var tag = allTagsList[i];
        var tagElement = optionTemplateElement.cloneNode(false);
        tagElement.innerHTML = tag.name;
        tagElement.value = tag.name;
        tagSelectSearchElement.appendChild(tagElement);
    }
}

function requestGetCards(offset, limit, tag=null) {
    url = 'cards?offset='+String(offset)+'&limit='+String(limit);
    if (tag != null) {
        url += '&tag='+tag;
    }
    fetch(url, {
        credentials: 'include'
    })
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            searchCardsList = data.cards;
            displaySearchListNumber();
            displaySearchCardsList();
        });
}

function loadCardsList() {
    requestGetCards(SEARCH_LIST_SIZE * currentSearchListNumber,SEARCH_LIST_SIZE, searchTag);
}

function editCardEvent(event) {
    var number = event.target.getAttribute("card-number");
    startEditCard(searchCardsList[number]);
}

function deleteCardEvent(event) {
    var number = event.target.getAttribute("card-number");
    var id = searchCardsList[number].id;
    fetch('cards/'+String(id), {
        method: 'DELETE',
        credentials: 'include'
    })
    .then((response) => {
        loadCardsList();
    })
}

function newCardEvent() {
    var card = {
        id: -1,
        creation_time: Date.now(), // WIP check is data correct
        editing_time: Date.now(), // WIP check is data correct
        content: "",
        tags: ""
    }
    startEditCard(card);
}
newCardButtonSearchElement.addEventListener('click', newCardEvent);

function searchByTagEvent(event) {
    searchTag = event.target.innerHTML;
    tagSelectSearchElement.value = searchTag;
    currentSearchListNumber = 0;
    loadCardsList();
}

tagSelectSearchElement.addEventListener('change', () => {
    searchTag = tagSelectSearchElement.value;
    if (searchTag == "ANY") {
        searchTag = null;
    }
    loadCardsList();
});

function homeListSearchEvent() {
    currentSearchListNumber = 0;
    loadCardsList();
}
homeButtonSearchElement.addEventListener("click", homeListSearchEvent);

function nextListSearchEvent() {
    currentSearchListNumber += 1;
    loadCardsList();
}
nextButtonSearchElement.addEventListener("click", nextListSearchEvent);

function previousListSearchEvent() {
    currentSearchListNumber -= 1;
    if (currentSearchListNumber < 0) {
        currentSearchListNumber = 0;
    }
    loadCardsList();
}
backButtonSearchElement.addEventListener("click", previousListSearchEvent);

function startSearch() {
    loadCardsList();
    displayPage("search");
}

tagsListButtonSearchElement.addEventListener("click", startViewTagsList);

/*  -------
    EDITING
    -------  */

// VARIABLES
var editCard = null;
var editCardElement = null;
var editTagElements = [];

// ELEMENTS
var editUpperButtonsRowElement = pageElements["edit"].querySelector("#edit-upper-buttons-row");
var saveButtonEditElement = editUpperButtonsRowElement.querySelector(".okay-button");
var abortButtonEditElement = editUpperButtonsRowElement.querySelector(".back-button");
var deleteButtonEditElement = editUpperButtonsRowElement.querySelector(".delete-button")
var editTagsListElement = pageElements["edit"].querySelector(".buttons-list");
var tagSelectEditElement = editTagsListElement.querySelector(".tag-select");
var codeTextareaEditElement = pageElements["edit"].querySelector(".code-textarea");
var editLowerButtonsRowElement = pageElements["edit"].querySelector("#edit-lower-buttons-row");
var viewResultButtonEditElement = editLowerButtonsRowElement.querySelector(".button-view");
var uploadFileEditButtonElement = editUpperButtonsRowElement.querySelector(".upload-file-button");

// FUNCTIONS
function displayNewTagEdit(tag) {
    var tagElement = tagButtonTemplateElement.cloneNode(false);
    tagElement.innerHTML = tag;
    tagElement.addEventListener('click', deleteTagEditEvent);
    editTagsListElement.insertBefore(tagElement, editTagsListElement.firstChild);
    var number = editTagElements.push(tagElement);
    tagElement.setAttribute("tag-number", number - 1);
}

function displayTagSelectEditList() {
    tagSelectEditElement.innerHTML = '<option value="ANY">Add tag</option>';
    for (var i in allTagsList) {
        var tag = allTagsList[i];
        var tagElement = optionTemplateElement.cloneNode(false);
        tagElement.innerHTML = tag.name;
        tagElement.value = tag.name;
        tagSelectEditElement.appendChild(tagElement);
    }
    var newTagOptionElement = optionTemplateElement.cloneNode(false);
    newTagOptionElement.innerHTML = "New tag";
    newTagOptionElement.value = "NEW";
    tagSelectEditElement.appendChild(newTagOptionElement);
}

function displayEditCard() {
    for (var i in editTagElements) {
        var tagElement = editTagElements[i];
        tagElement.remove();
    }
    editTagElements = [];
    var tagsList = editCard.tags.split(' ');
    for (var i in tagsList) {
        var tag = tagsList[i];
        displayNewTagEdit(tag);
    }
    codeTextareaEditElement.value = editCard.content;
}

function displayCardEditPreview() {
    if (editCardElement) {
        editCardElement.remove();
    }
    editCardElement = cardToElement(editCard);
    pageElements["edit"].appendChild(editCardElement);
}

function startEditCard(card) {
    editCard = card;
    displayEditCard();
    displayCardEditPreview();
    displayPage("edit");
}

function saveEditEvent() {
    if (editCard.id > 0) {
        fetch('cards/'+String(editCard.id), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(editCard)
        })
        .then((response) => {
            startSearch();
        })
    } else {
        fetch('cards', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(editCard)
        })
        .then((response) => {
            startSearch();
        })
    }
}
saveButtonEditElement.addEventListener('click', saveEditEvent);

function abortEditEvent() {
    startSearch();
}
abortButtonEditElement.addEventListener('click', abortEditEvent);

function deleteEditEvent() {
    if (editCard.id > 0) {
        fetch('cards/'+String(editCard.id), {
            method: 'DELETE',
            credentials: 'include'
        })
        .then((response) => {
            startSearch();
        })
    } else {
        abortEditEvent();
    }
}
deleteButtonEditElement.addEventListener('click', deleteEditEvent);

function viewEditResultEvent() {
    displayCardEditPreview();
}
viewResultButtonEditElement.addEventListener('click', viewEditResultEvent);

function changeCodeTextareaEditEvent() {
    editCard.content = codeTextareaEditElement.value;
    displayCardEditPreview(); // WIP it may cause lags
}
codeTextareaEditElement.addEventListener('change', changeCodeTextareaEditEvent);

function changeTagSelectEditEvent() {
    if (tagSelectEditElement.value == "NEW") {
        displayPopUpPage("new_tag");
        tagSelectEditElement.value = 'ANY';
    } else {
        var tag = tagSelectEditElement.value;
        if (editCard.tags.length > 0) {
            editCard.tags += ' ';
        }
        editCard.tags += String(tag);
        displayNewTagEdit(tag);
        tagSelectEditElement.value = 'ANY';
    }
}
tagSelectEditElement.addEventListener('change', changeTagSelectEditEvent);

function deleteTagEditEvent(event) {
    var tagElement = event.target;
    var tag = tagElement.innerHTML;
    editCard.tags = editCard.tags.replace(tag, '').replace('  ',' ').trim(); // костыль?
    var number = tagElement.getAttribute("tag-number");
    editTagElements.splice(number, 1);
    tagElement.remove();
}

function uploadFileEditEvent() {
    displayPopUpPage("upload_file");
}
uploadFileEditButtonElement.addEventListener('click', uploadFileEditEvent)

function addCodeEdit(code) {
    codeTextareaEditElement.value += code;
    changeCodeTextareaEditEvent();
}

/*  ---------
    TAGS LIST
    ---------  */

// ELEMENTS
var tagsListButtonsRowElement = pageElements["tags_list"].querySelector(".buttons-row");
var searchCardsTagsListButtonElement = tagsListButtonsRowElement.querySelector(".search-cards-button");
var newTagTagsListButtonElement = tagsListButtonsRowElement.querySelector(".add-button");
var deleteTagTagsListButtonElement = tagsListButtonsRowElement.querySelector(".delete-button");

// FUNCTIONS
function displayTagsList() {
    var tagElementsCollection = pageElements["tags_list"].getElementsByClassName("tag-button");
    while (tagElementsCollection.length > 0) {
        tagElementsCollection.item(0).remove();
    }
    for (var i in allTagsList) {
        var tag = allTagsList[i];
        var tagElement = tagButtonTemplateElement.cloneNode(false);
        tagElement.innerHTML = tag.name;
        tagElement.addEventListener('click', (event) => {
            searchByTagEvent(event);
            displayPage("search");
        });
        pageElements["tags_list"].appendChild(tagElement);
    }
}

function startViewTagsList() {
    displayPage("tags_list");
}

function newTagTagsListEvent() {
    displayPopUpPage("new_tag");
}
newTagTagsListButtonElement.addEventListener('click', newTagTagsListEvent);

function deleteTagTagsListEvent() {
    displayPopUpPage("delete_tag");
}
deleteTagTagsListButtonElement.addEventListener('click', deleteTagTagsListEvent);

searchCardsTagsListButtonElement.addEventListener('click', startSearch);

/*  -------
    NEW TAG
    -------  */

// ELEMENTS
var nameNewTagInputElement = popUpPageElements["new_tag"].querySelector("#new-tag-name-input");
var okayNewTagButtonElement = popUpPageElements["new_tag"].querySelector(".okay-button");
var abortNewTagButtonElement = popUpPageElements["new_tag"].querySelector(".back-button");

// FUNCTIONS
function okayNewTagEvent() {
    var tag = {
        name: nameNewTagInputElement.value
    };
    fetch('tags', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(tag)
    })
    .then((response) => {
        requestTags();
        displayPopUpPage(null);
    })
}
okayNewTagButtonElement.addEventListener('click', okayNewTagEvent);

function abortNewTagEvent() {
    displayPopUpPage(null);
}
abortNewTagButtonElement.addEventListener('click', abortNewTagEvent);

/*  ----------
    DELETE TAG
    ----------  */

// ELEMENTS
var tagSelectDeleteTagElement = popUpPageElements["delete_tag"].querySelector(".tag-select");
var okayDeleteTagButtonElement = popUpPageElements["delete_tag"].querySelector(".okay-button");
var abortDeleteTagButtonElement = popUpPageElements["delete_tag"].querySelector(".back-button");

// FUNCTIONS
function displayDeleteTag() {
    tagSelectDeleteTagElement.innerHTML = '<option value="ANY">Choose tag</option>';
    for (var i in allTagsList) {
        var tag = allTagsList[i];
        var tagElement = optionTemplateElement.cloneNode(false);
        tagElement.innerHTML = tag.name;
        tagElement.value = tag.name;
        tagSelectDeleteTagElement.appendChild(tagElement);
    }
}

function okayDeleteTagEvent() {
    var tagName = tagSelectDeleteTagElement.value;
    if (tagName == "ANY") {
        // ARE YOU AN IDIOT?
    } else {
        fetch('tags/'+String(tagName), {
            method: 'DELETE',
            credentials: 'include'
        })
        .then((response) => {
            requestTags();
            displayPopUpPage(null);
        })
    }
}
okayDeleteTagButtonElement.addEventListener('click', okayDeleteTagEvent);

function abortDeleteTagEvent() {
    displayPopUpPage(null);
}
abortDeleteTagButtonElement.addEventListener('click', abortDeleteTagEvent);

/*  -------------
    AUTHORIZATION
    -------------  */

// ELEMENTS
var secretKeyAuthorizationInputElement = popUpPageElements["authorization"].querySelector("#authorization-secret-key-input");
var okayAuthorizationButtonElement = popUpPageElements["authorization"].querySelector(".okay-button");

// FUNCTIONS
function checkAuthorization() {
    fetch('ping', {
        credentials: 'include'
    })
    .then((response) => {
        if (response.ok) {
            requestTags();
            startSearch();
            displayPopUpPage(null);
        } else {
            displayPopUpPage("authorization");
        }
    });
}

function okayAuthorizationEvent() {
    password = secretKeyAuthorizationInputElement.value;
    fetch('login', {
        headers: {
            'password': password
        }
    })
    .then((response) => {
        if (response.ok) {
            checkAuthorization();
        } else {
            // WIP
        }
    });
}
okayAuthorizationButtonElement.addEventListener('click', okayAuthorizationEvent);

/*  -----------
    UPLOAD FILE
    -----------  */

// ELEMENTS
var uploadFileInputElement = popUpPageElements["upload_file"].querySelector("#upload-file-input");
var okayUploadFileButtonElement = popUpPageElements["upload_file"].querySelector(".okay-button");
var abortFileUploadButtonElement = popUpPageElements["upload_file"].querySelector(".back-button");

// FUNCTIONS
function okayUploadFileEvent() {
    const formData = new FormData();
    formData.append('file', uploadFileInputElement.files[0]);
    fetch('blobs', {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then((response) => {
        displayPopUpPage(null);
        return response.text().then((text) => {
            addCodeEdit(text);
        })
    })
}
okayUploadFileButtonElement.addEventListener('click', okayUploadFileEvent);

function abortFileUploadEvent() {
    displayPopUpPage(null);
}
abortFileUploadButtonElement.addEventListener('click', abortFileUploadEvent);

/*  -------
    RUNNING
    -------  */

checkAuthorization();