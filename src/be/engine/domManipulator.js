'use strict';

// handles the final part of page generation. I created this so I would take
// some stuff out of generator.js since that file was becoming a huge mess

// also, manipulations that are not persistent are meant to be directly
// requested from this module

var gridFs = require('./gridFsHandler');
var serializer = require('jsdom').serializeDocument;
var miscOps = require('./miscOps');
var verbose = require('../boot').getGeneralSettings().verbose;
var jsdom = require('jsdom').jsdom;
var boot = require('../boot');
var debug = boot.debug();
var fs = require('fs');

// templates
var frontPageTemplate;
var threadTemplate;
var boardTemplate;
var notFoundTemplate;
var messageTemplate;
var loginTemplate;
var opTemplate;
var postTemplate;
var recoveryEmailTemplate;
var resetEmailTemplate;
var accountTemplate;
var gManagementTemplate;
var staffCellTemplate;
var bManagementTemplate;
var volunteerCellTemplate;

require('jsdom').defaultDocumentFeatures = {
  FetchExternalResources : false,
  ProcessExternalResources : false,
  // someone said it might break stuff. If weird bugs, disable.
  MutationEvents : false
};

function loadEmailTemplates(fs, fePath, templateSettings) {

  var recoveryEmailPath = fePath + templateSettings.recoveryEmail;
  recoveryEmailTemplate = fs.readFileSync(recoveryEmailPath);
  resetEmailTemplate = fs.readFileSync(fePath + templateSettings.resetEmail);

}

function loadCellTemplates(fs, fePath, templateSettings) {
  opTemplate = fs.readFileSync(fePath + templateSettings.opCell);
  staffCellTemplate = fs.readFileSync(fePath + templateSettings.staffCell);
  postTemplate = fs.readFileSync(fePath + templateSettings.postCell);

  var volunteerPath = fePath + templateSettings.volunteerCell;
  volunteerCellTemplate = fs.readFileSync(volunteerPath);
}

exports.loadTemplates = function() {

  var fePath = boot.getFePath() + '/templates/';
  var templateSettings = boot.getTemplateSettings();

  frontPageTemplate = fs.readFileSync(fePath + templateSettings.index);
  threadTemplate = fs.readFileSync(fePath + templateSettings.threadPage);
  boardTemplate = fs.readFileSync(fePath + templateSettings.boardPage);
  notFoundTemplate = fs.readFileSync(fePath + templateSettings.notFoundPage);
  messageTemplate = fs.readFileSync(fePath + templateSettings.messagePage);
  loginTemplate = fs.readFileSync(fePath + templateSettings.loginPage);
  accountTemplate = fs.readFileSync(fePath + templateSettings.accountPage);
  gManagementTemplate = fs.readFileSync(fePath + templateSettings.gManagement);
  bManagementTemplate = fs.readFileSync(fePath + templateSettings.bManagement);

  loadEmailTemplates(fs, fePath, templateSettings);
  loadCellTemplates(fs, fePath, templateSettings);

};

function setBoardOwnerControls(document, boardData) {

  document.getElementById('addVolunteerForm').style.display = 'block';

  document.getElementById('boardIdentifier').setAttribute('value',
      boardData.boardUri);

  var volunteersDiv = document.getElementById('volunteersDiv');

  var volunteers = boardData.volunteers || [];

  for (var i = 0; i < volunteers.length; i++) {

    var cell = document.createElement('form');
    cell.enctype = 'multipart/form-data';
    cell.action = '/setVolunteer.js';
    cell.method = 'post';

    cell.innerHTML = volunteerCellTemplate;

    for (var j = 0; j < cell.childNodes.length; j++) {
      var node = cell.childNodes[j];

      switch (node.id) {
      case 'userIdentifier':
        node.setAttribute('value', volunteers[i]);
        break;
      case 'userLabel':
        node.innerHTML = volunteers[i];
        break;
      case 'boardIdentifier':
        node.setAttribute('value', boardData.boardUri);
        break;
      }

    }

    volunteersDiv.appendChild(cell);

  }

}

exports.boardManagement = function(login, boardData) {
  try {

    var document = jsdom(bManagementTemplate);

    var boardLabel = document.getElementById('boardLabel');

    var label = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    boardLabel.innerHTML = label;

    if (login === boardData.owner) {
      setBoardOwnerControls(document, boardData);
    } else {
      document.getElementById('addVolunteerForm').style.display = 'none';

    }

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }

};

function setRoleComboBox(document, node, possibleRoles, user) {
  for (var k = 0; k < possibleRoles.length; k++) {

    var role = possibleRoles[k];

    var option = document.createElement('option');
    option.value = role.value;
    option.innerHTML = role.label;

    if (role.value === user.globalRole) {
      option.setAttribute('selected', 'selected');
    }

    node.add(option);

  }

}

function fillStaffDiv(document, possibleRoles, staff) {
  var divStaff = document.getElementById('divStaff');

  for (var i = 0; i < staff.length; i++) {

    var user = staff[i];

    var cell = document.createElement('form');
    cell.setAttribute('class', 'staffCell');
    cell.method = 'post';
    cell.enctype = 'multipart/form-data';
    cell.action = '/setGlobalRole.js';
    cell.innerHTML = staffCellTemplate;

    for (var j = 0; j < cell.childNodes.length; j++) {

      var node = cell.childNodes[j];

      switch (node.id) {
      case 'userIdentifier':
        node.setAttribute('value', user.login);
        break;
      case 'userLabel':
        node.innerHTML = user.login + ': ';
        break;
      case 'roleCombo':
        setRoleComboBox(document, node, possibleRoles, user);

        break;
      }

    }

    divStaff.appendChild(cell);

  }
}

function getPossibleRoles(role) {

  var roles = [];

  for (var i = role + 1; i <= miscOps.getMaxStaffRole() + 1; i++) {
    var toPush = {
      value : i,
      label : miscOps.getGlobalRoleLabel(i)
    };

    roles.push(toPush);

  }

  return roles;
}

function setNewStaffComboBox(document, userRole) {

  var comboBox = document.getElementById('newStaffCombo');

  for (var i = userRole + 1; i <= miscOps.getMaxStaffRole(); i++) {

    var option = document.createElement('option');
    option.value = i;
    option.innerHTML = miscOps.getGlobalRoleLabel(i);

    comboBox.add(option);

  }

}

exports.globalManagement = function(userRole, userLogin, staff) {

  try {
    var document = jsdom(gManagementTemplate);

    var newStaffForm = document.getElementById('addStaffForm');

    newStaffForm.style.display = userRole < 2 ? 'block' : 'none';

    if (userRole < 2) {
      setNewStaffComboBox(document, userRole);
    }

    var userLabel = document.getElementById('userLabel');

    var userLabelContent = userLogin + ': ';
    userLabelContent += miscOps.getGlobalRoleLabel(userRole);

    userLabel.innerHTML = userLabelContent;

    fillStaffDiv(document, getPossibleRoles(userRole), staff);

    return serializer(document);
  } catch (error) {

    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }
};

exports.resetEmail = function(password) {

  try {

    var document = jsdom(resetEmailTemplate);

    var link = document.getElementById('labelNewPass');
    link.innerHTML = password;

    return serializer(document);
  } catch (error) {

    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }
};

exports.recoveryEmail = function(recoveryLink) {

  try {

    var document = jsdom(recoveryEmailTemplate);

    var link = document.getElementById('linkRecovery');
    link.href = recoveryLink;

    return serializer(document);
  } catch (error) {

    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }
};

function fillBoardsDiv(document, boardList) {
  var boardDiv = document.getElementById('boardsDiv');

  for (var i = 0; i < boardList.length; i++) {
    var link = document.createElement('a');

    if (i) {
      boardDiv.appendChild(document.createElement('br'));
    }

    link.innerHTML = '/' + boardList[i] + '/';
    link.href = link.innerHTML;

    boardDiv.appendChild(link);

  }

}

exports.account = function(globalRole, login, boardList) {

  try {

    var document = jsdom(accountTemplate);

    var loginLabel = document.getElementById('labelLogin');

    loginLabel.innerHTML = login;

    var gManagementLink = document.getElementById('globalManagementLink');

    var isInStaff = globalRole <= miscOps.getMaxStaffRole();

    gManagementLink.style.display = isInStaff ? 'block' : 'none';

    if (boardList && boardList.length) {

      fillBoardsDiv(document, boardList);

    }

    return serializer(document);
  } catch (error) {

    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }
};

exports.login = function(callback) {
  try {
    var document = jsdom(loginTemplate);

    gridFs.writeData(serializer(document), '/login.html', 'text/html', {},
        callback);

  } catch (error) {

    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }

};

exports.notFound = function(callback) {

  var document = jsdom(notFoundTemplate);

  gridFs.writeData(serializer(document), '/404.html', 'text/html', {
    status : 404
  }, callback);
};

exports.message = function(message, link) {

  try {

    var document = jsdom(messageTemplate);

    var messageLabel = document.getElementById('labelMessage');

    messageLabel.innerHTML = message;

    var redirectLink = document.getElementById('linkRedirect');

    redirectLink.href = link;

    var meta = document.createElement('META');

    meta.httpEquiv = 'refresh';
    meta.content = '3; url=' + link;

    document.getElementsByTagName('head')[0].appendChild(meta);

    return serializer(document);
  } catch (error) {
    if (verbose) {
      console.log('error ' + error);
    }

    if (debug) {
      throw error;
    }

    return error.toString;
  }

};

exports.frontPage = function(boards, callback) {

  if (verbose) {
    console.log('Got boards\n' + JSON.stringify(boards));
  }

  try {

    var document = jsdom(frontPageTemplate);

    var boardsDiv = document.getElementById('divBoards');

    for (var i = 0; i < boards.length; i++) {

      var board = boards[i];

      var link = document.createElement('a');

      link.href = '/' + board.boardUri + '/';
      link.innerHTML = '/' + board.boardUri + '/ - ' + board.boardName;

      if (i) {
        boardsDiv.appendChild(document.createElement('br'));
      }

      boardsDiv.appendChild(link);

    }

    gridFs.writeData(serializer(document), '/', 'text/html', {}, callback);
  } catch (error) {
    callback(error);
  }
};

function setThreadHiddenIdentifiers(document, boardUri, threadData) {
  var boardIdentifyInput = document.getElementById('boardIdentifier');

  boardIdentifyInput.setAttribute('value', boardUri);

  var threadIdentifyInput = document.getElementById('threadIdentifier');

  threadIdentifyInput.setAttribute('value', threadData.threadId);
}

exports.thread = function(boardUri, boardData, threadData, posts, callback) {

  try {
    var document = jsdom(threadTemplate);

    var linkManagement = document.getElementById('linkManagement');
    linkManagement.href = '/boardManagement.js?boardUri=' + boardUri;

    var titleHeader = document.getElementById('labelName');

    titleHeader.innerHTML = boardUri;

    var descriptionHeader = document.getElementById('labelDescription');

    titleHeader.innerHTML = '/' + boardUri + '/ - ' + boardData.boardName;
    descriptionHeader.innerHTML = boardData.boardDescription;

    setThreadHiddenIdentifiers(document, boardUri, threadData);

    addThread(document, threadData, posts, boardUri, true);

    var ownName = 'res/' + threadData.threadId + '.html';

    gridFs.writeData(serializer(document), '/' + boardUri + '/' + ownName,
        'text/html', {
          boardUri : boardUri,
          type : 'thread',
          threadId : threadData.threadId
        }, callback);
  } catch (error) {
    callback(error);
  }

};

function addFiles(document, node, files) {

  if (!files) {
    return;
  }

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var link = document.createElement('a');

    link.href = file.path;

    var img = document.createElement('img');

    img.src = file.thumb;

    link.appendChild(img);

    node.appendChild(link);
  }

}

function addPosts(document, posts, boardUri, threadId) {

  var divThreads = document.getElementById('divPostings');

  for (var i = 0; i < posts.length; i++) {
    var postCell = document.createElement('div');
    postCell.innerHTML = postTemplate;
    postCell.setAttribute('class', 'postCell');

    var post = posts[i];

    for (var j = 0; j < postCell.childNodes.length; j++) {
      var node = postCell.childNodes[j];

      switch (node.id) {
      case 'labelName':
        node.innerHTML = post.name;
        break;
      case 'labelEmail':
        node.innerHTML = post.email;
        break;
      case 'labelSubject':
        node.innerHTML = post.subject;
        break;
      case 'panelUploads':
        addFiles(document, node, post.files);
        break;
      case 'labelCreated':
        node.innerHTML = post.creation;
        break;
      case 'divMessage':
        node.innerHTML = post.message;
        break;
      case 'linkSelf':
        postCell.id = post.postId;
        node.innerHTML = post.postId;
        var link = '/' + boardUri + '/res/' + threadId + '.html#';
        node.href = link + post.postId;
        break;
      }
    }

    divThreads.appendChild(postCell);

  }

}

function addThread(document, thread, posts, boardUri, innerPage) {

  var threadCell = document.createElement('div');
  threadCell.innerHTML = opTemplate;
  threadCell.setAttribute('class', 'opCell');

  for (var i = 0; i < threadCell.childNodes.length; i++) {
    var node = threadCell.childNodes[i];

    switch (node.id) {
    case 'labelName':
      node.innerHTML = thread.name;
      break;
    case 'labelEmail':
      node.innerHTML = thread.email;
      break;
    case 'labelSubject':
      node.innerHTML = thread.subject;
      break;
    case 'labelCreated':
      node.innerHTML = thread.creation;
      break;
    case 'divMessage':
      node.innerHTML = thread.message;
      break;
    case 'panelUploads':
      addFiles(document, node, thread.files);
      break;
    case 'linkSelf':
      node.innerHTML = thread.threadId;
      var link = '/' + boardUri + '/res/' + thread.threadId + '.html#';
      node.href = link + thread.threadId;
      threadCell.id = thread.threadId;
      break;
    case 'linkReply':
      if (innerPage) {
        node.style.display = 'none';
      } else {
        node.href = 'res/' + thread.threadId + '.html';
      }
      break;

    }
  }

  document.getElementById('divPostings').appendChild(threadCell);

  addPosts(document, posts || [], boardUri, thread.threadId, innerPage);

}

function generateThreadListing(document, boardUri, page, threads, preview,
    callback) {

  var tempPreview = {};

  for (var i = 0; i < preview.length; i++) {

    tempPreview[preview[i]._id] = preview[i].preview;
  }

  preview = tempPreview;

  for (i = 0; i < threads.length; i++) {
    var thread = threads[i];

    addThread(document, thread, preview[thread.threadId], boardUri);

  }

  var ownName = page === 1 ? '' : page + '.html';

  gridFs.writeData(serializer(document), '/' + boardUri + '/' + ownName,
      'text/html', {
        boardUri : boardUri,
        type : 'board'
      }, callback);
}

function addPagesLinks(document, pageCount) {
  var pagesDiv = document.getElementById('divPages');

  for (var i = 0; i < pageCount; i++) {

    var pageName = i ? (i + 1) + '.html' : 'index.html';

    var link = document.createElement('a');
    link.href = pageName;
    link.innerHTML = i + 1;

    pagesDiv.appendChild(link);

  }
}

exports.page = function(board, page, threads, pageCount, boardData, preview,
    callback) {

  try {

    var document = jsdom(boardTemplate);

    var linkManagement = document.getElementById('linkManagement');
    linkManagement.href = '/boardManagement.js?boardUri=' + board;

    var boardIdentifyInput = document.getElementById('boardIdentifier');

    boardIdentifyInput.setAttribute('value', board);

    var titleHeader = document.getElementById('labelName');

    titleHeader.innerHTML = board;

    var descriptionHeader = document.getElementById('labelDescription');

    titleHeader.innerHTML = '/' + board + '/ - ' + boardData.boardName;
    descriptionHeader.innerHTML = boardData.boardDescription;

    addPagesLinks(document, pageCount);

    generateThreadListing(document, board, page, threads, preview, callback);
  } catch (error) {
    callback(error);
  }
};
