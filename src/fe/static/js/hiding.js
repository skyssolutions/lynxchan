var hiding = {};

hiding.init = function() {

  hiding.updateHidingData();

  hiding.filtered = [];

  document.body.addEventListener('click', function clicked() {

    if (hiding.shownMenu) {
      hiding.shownMenu.remove();
      delete hiding.shownMenu;
    }

  }, true);

  var links = document.getElementsByClassName('linkSelf');

  for (var i = 0; i < links.length; i++) {
    hiding.setHideMenu(links[i]);
  }

  hiding.checkFilters();

};

hiding.updateHidingData = function() {

  var storedHidingData = localStorage.hidingData;

  if (!storedHidingData) {
    hiding.storedHidingData = {};
    return;
  }

  hiding.storedHidingData = JSON.parse(storedHidingData);

};

hiding.filterMatches = function(string, filter) {

  var toRet;

  if (!filter.regex) {
    toRet = string.indexOf(filter.filter) >= 0;
  } else {
    toRet = string.match(new RegExp(filter.filter)) ? true : false;
  }

  return toRet;

};

hiding.hideForFilter = function(linkSelf) {

  var toHide = linkSelf.parentNode.parentNode.parentNode;

  toHide.style.display = 'none';
  hiding.filtered.push(toHide);

  return true;

};

hiding.checkFilters = function() {

  for (var i = 0; i < hiding.filtered.length; i++) {
    hiding.filtered[i].style.display = 'block';
  }

  hiding.filtered = [];

  var links = document.getElementsByClassName('linkSelf');

  for (var i = 0; i < links.length; i++) {
    hiding.checkFilterHiding(links[i]);
  }

};

hiding.checkFilterHiding = function(linkSelf) {

  for (var i = 0; i < settingsMenu.loadedFilters.length; i++) {

    var filter = settingsMenu.loadedFilters[i];

    if (filter.type < 2) {
      var name = linkSelf.parentNode.getElementsByClassName('linkName')[0].innerHTML;

      if (name.indexOf('#') >= 0) {

        var trip = name.substring(name.lastIndexOf('#') + 1);

        name = name.substring(0, name.indexOf('#'));

      }

    }

    switch (filter.type) {

    case 0: {
      if (hiding.filterMatches(name, filter)) {
        return hiding.hideForFilter(linkSelf);
      }
      break;
    }

    case 1: {
      if (trip && hiding.filterMatches(trip, filter)) {
        return hiding.hideForFilter(linkSelf);
      }
      break;
    }

    case 2: {
      var subjectLabel = linkSelf.parentNode
          .getElementsByClassName('labelSubject')[0];

      if (subjectLabel && hiding.filterMatches(subjectLabel.innerHTML, filter)) {
        return hiding.hideForFilter(linkSelf);
      }
      break;
    }

    case 3: {
      if (hiding.filterMatches(linkSelf.parentNode.parentNode
          .getElementsByClassName('divMessage')[0].innerHTML, filter)) {
        return hiding.hideForFilter(linkSelf);
      }
      break;
    }

    case 4: {
      var labelId = linkSelf.parentNode.getElementsByClassName('labelId')[0];

      if (labelId) {
        if (hiding.buildPostFilterId(linkSelf, labelId.innerHTML) === filter.filter) {
          return hiding.hideForFilter(linkSelf);
        }
      }
      break;
    }

    }

  }

};

hiding.registerHiding = function(board, thread, post, unhiding) {

  var storedData = localStorage.hidingData;

  var hidingData = storedData ? JSON.parse(storedData) : {};

  var boardData = hidingData[board] || {
    threads : [],
    posts : []
  };

  var listToUse = post ? boardData.posts : boardData.threads;

  if (!unhiding) {
    if (listToUse.indexOf(post || thread) < 0) {
      listToUse.push(post || thread);
    }
  } else {
    listToUse.splice(listToUse.indexOf(post || thread), 1);
  }

  hidingData[board] = boardData;

  localStorage.hidingData = JSON.stringify(hidingData);

  hiding.storedHidingData = hidingData;

};

hiding.hidePost = function(linkSelf, board, thread, post) {

  hiding.toggleHidden(linkSelf.parentNode.parentNode, true);

  hiding.registerHiding(board, thread, post);

  var unhidePostButton = document.createElement('span');

  var unhideHTML = '[Unhide ' + (post ? 'post' : 'OP') + ' ' + board + '/'
      + post + ']';

  unhidePostButton.innerHTML = unhideHTML;
  unhidePostButton.className = 'unhideButton glowOnHover';

  linkSelf.parentNode.parentNode.parentNode.insertBefore(unhidePostButton,
      linkSelf.parentNode.parentNode);

  unhidePostButton.onclick = function() {

    hiding.registerHiding(board, thread, post, true);
    unhidePostButton.remove();

    hiding.toggleHidden(linkSelf.parentNode.parentNode, false);

  };

};

hiding.hideThread = function(linkSelf, board, thread) {

  hiding.toggleHidden(linkSelf.parentNode.parentNode.parentNode, true);
  var unhideThreadButton = document.createElement('span');

  unhideThreadButton.innerHTML = '[Unhide thread ' + board + '/' + thread + ']';
  unhideThreadButton.className = 'unhideButton glowOnHover';
  linkSelf.parentNode.parentNode.parentNode.parentNode.insertBefore(
      unhideThreadButton, linkSelf.parentNode.parentNode.parentNode);

  hiding.registerHiding(board, thread);

  unhideThreadButton.onclick = function() {
    hiding.toggleHidden(linkSelf.parentNode.parentNode.parentNode, false);
    unhideThreadButton.remove();
    hiding.registerHiding(board, thread, null, true);
  }

};

hiding.buildPostFilterId = function(linkSelf, id) {

  var checkbox = linkSelf.parentNode.getElementsByClassName('deletionCheckBox')[0];
  var postData = checkbox.name.split('-');
  var board = postData[0];
  var threadId = postData[1];

  return board + '-' + threadId + '-' + id;

};

hiding.buildHideMenu = function(board, thread, post, linkSelf, hideMenu) {

  var postHideButton;
  postHideButton = document.createElement('div');

  if (post) {

    postHideButton.innerHTML = 'Hide post';
    hideMenu.appendChild(postHideButton);

  } else {

    postHideButton.innerHTML = 'Hide OP';
    hideMenu.appendChild(postHideButton);

    hideMenu.appendChild(document.createElement('hr'));

    var threadHideButton = document.createElement('div');
    threadHideButton.innerHTML = 'Hide thread';
    hideMenu.appendChild(threadHideButton);

  }

  hideMenu.appendChild(document.createElement('hr'));

  var name = linkSelf.parentNode.getElementsByClassName('linkName')[0].innerHTML;

  var trip;

  if (name.indexOf('#') >= 0) {
    trip = name.substring(name.lastIndexOf('#') + 1);
    name = name.substring(0, name.indexOf('#'));
  }

  var filterNameButton = document.createElement('div');
  filterNameButton.innerHTML = 'Filter name';
  filterNameButton.onclick = function() {
    settingsMenu.createFilter(name, false, 0);
  };
  hideMenu.appendChild(filterNameButton);

  hideMenu.appendChild(document.createElement('hr'));

  if (trip) {

    var filterTripButton = document.createElement('div');
    filterTripButton.innerHTML = 'Filter tripcode';
    filterTripButton.onclick = function() {
      settingsMenu.createFilter(trip, false, 1);
    };
    hideMenu.appendChild(filterTripButton);

    hideMenu.appendChild(document.createElement('hr'));
  }

  var labelId = linkSelf.parentNode.getElementsByClassName('labelId')[0];

  if (labelId) {
    var filterIdButton = document.createElement('div');
    filterIdButton.innerHTML = 'Filter id';
    filterIdButton.onclick = function() {
      settingsMenu.createFilter(hiding.buildPostFilterId(linkSelf,
          labelId.innerHTML), false, 4);
    };
    hideMenu.appendChild(filterIdButton);

    hideMenu.appendChild(document.createElement('hr'));
  }

  postHideButton.onclick = function() {
    hiding.hidePost(linkSelf, board, thread, post || thread);
  };

  if (!post) {

    threadHideButton.onclick = function() {
      hiding.hideThread(linkSelf, board, thread);
    }

  }

};

hiding.toggleHidden = function(element, hide) {

  var className = element.className;

  if (hide) {
    element.className += ' hidden';
  } else {
    element.className = className.replace(' hidden', '');
  }

};

hiding.setHideMenu = function(linkSelf) {

  var hideButton = document.createElement('span');
  hideButton.className = 'hideButton glowOnHover coloredIcon';
  hideButton.title = "Hide";

  var parentNode = linkSelf.parentNode;

  var checkbox = parentNode.getElementsByClassName('deletionCheckBox')[0];

  if (!checkbox) {

    var href = linkSelf.href;

    var parts = href.split('/');

    var board = parts[3];

    var finalParts = parts[5].split('.');

    var thread = finalParts[0];

    var post = finalParts[1].split('#')[1];

    if (post === thread) {
      post = undefined;
    }

  } else {

    parts = checkbox.name.split('-');

    board = parts[0];
    thread = parts[1];
    post = parts[2];
  }

  parentNode.insertBefore(hideButton, checkbox ? checkbox.nextSibling
      : parentNode.childNodes[0]);

  hideButton.onclick = function() {

    var rect = hideButton.getBoundingClientRect();

    var hideMenu = document.createElement('div');
    hideMenu.className = 'floatingMenu hideMenu';

    hideButton.appendChild(hideMenu);

    hiding.shownMenu = hideMenu;

    hiding.buildHideMenu(board, thread, post, linkSelf, hideMenu);

  };

  var boardData = hiding.storedHidingData[board];

  if (!boardData) {
    return;
  }

  if (boardData.posts.indexOf(post || thread) > -1) {
    hiding.hidePost(linkSelf, board, thread, post || thread);
  }

  if (!post && boardData.threads.indexOf(thread) > -1) {
    hiding.hideThread(linkSelf, board, thread);
  }

  hiding.checkFilterHiding(linkSelf);

};

hiding.init();