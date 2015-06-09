'use strict';

// handles the final part of page generation. I created this so I would take
// some stuff out of generator.js since that file was becoming a huge mess

// also, manipulations that are not persistent are meant to be directly
// requested from this module

var gridFs = require('./gridFsHandler');
var serializer = require('jsdom').serializeDocument;
var miscOps = require('./miscOps');
var settings = require('../boot').getGeneralSettings();
var verbose = settings.verbose;
var jsdom = require('jsdom').jsdom;
var siteTitle = settings.siteTitle || 'Undefined site title';
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
var reportCellTemplate;
var closedReportCellTemplate;
var closedReportsPageTemplate;
var bansPageTemplate;
var banCellTemplate;
var uploadCellTemplate;

var sizeOrders = [ 'B', 'KB', 'MB', 'GB', 'TB' ];

require('jsdom').defaultDocumentFeatures = {
  FetchExternalResources : false,
  ProcessExternalResources : false,
  // someone said it might break stuff. If weird bugs, disable.
  MutationEvents : false
};

function loadEmailTemplates(fePath, templateSettings) {

  var recoveryEmailPath = fePath + templateSettings.recoveryEmail;
  recoveryEmailTemplate = fs.readFileSync(recoveryEmailPath);
  resetEmailTemplate = fs.readFileSync(fePath + templateSettings.resetEmail);

}

function loadCellTemplates(fePath, templateSettings) {
  opTemplate = fs.readFileSync(fePath + templateSettings.opCell);
  staffCellTemplate = fs.readFileSync(fePath + templateSettings.staffCell);
  postTemplate = fs.readFileSync(fePath + templateSettings.postCell);
  reportCellTemplate = fs.readFileSync(fePath + templateSettings.reportCell);

  uploadCellTemplate = fs.readFileSync(fePath + templateSettings.uploadCell);

  var closedReportPath = fePath + templateSettings.closedReportCell;
  closedReportCellTemplate = fs.readFileSync(closedReportPath);

  var volunteerPath = fePath + templateSettings.volunteerCell;
  volunteerCellTemplate = fs.readFileSync(volunteerPath);

  banCellTemplate = fs.readFileSync(fePath + templateSettings.banCell);
}

function loadMainTemplates(fePath, templateSettings) {

  bManagementTemplate = fs.readFileSync(fePath + templateSettings.bManagement);
  bansPageTemplate = fs.readFileSync(fePath + templateSettings.bansPage);
  frontPageTemplate = fs.readFileSync(fePath + templateSettings.index);
  threadTemplate = fs.readFileSync(fePath + templateSettings.threadPage);
  boardTemplate = fs.readFileSync(fePath + templateSettings.boardPage);
  notFoundTemplate = fs.readFileSync(fePath + templateSettings.notFoundPage);
  messageTemplate = fs.readFileSync(fePath + templateSettings.messagePage);
  loginTemplate = fs.readFileSync(fePath + templateSettings.loginPage);
  accountTemplate = fs.readFileSync(fePath + templateSettings.accountPage);
  gManagementTemplate = fs.readFileSync(fePath + templateSettings.gManagement);

  var closedReportsPath = fePath + templateSettings.closedReportsPage;
  closedReportsPageTemplate = fs.readFileSync(closedReportsPath);
}

exports.loadTemplates = function() {

  var fePath = boot.getFePath() + '/templates/';
  var templateSettings = boot.getTemplateSettings();

  loadMainTemplates(fePath, templateSettings);
  loadEmailTemplates(fePath, templateSettings);
  loadCellTemplates(fePath, templateSettings);

};

function padDateField(value) {
  if (value < 10) {
    value = '0' + value;
  }

  return value;
}

function formatDateToDisplay(d) {
  var day = padDateField(d.getDate());

  var weekDays = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];

  var month = padDateField(d.getMonth() + 1);

  var year = d.getFullYear() + 1;

  var weekDay = weekDays[d.getDay()];

  var hour = padDateField(d.getHours());

  var minute = padDateField(d.getMinutes());

  var second = padDateField(d.getSeconds());

  var toReturn = month + '/' + day + '/' + year;

  return toReturn + ' (' + weekDay + ') ' + hour + ':' + minute + ':' + second;
}

function setBanCell(ban, cell) {

  cell.getElementsByClassName('reasonLabel')[0].innerHTML = ban.reason;

  var expirationLabel = cell.getElementsByClassName('expirationLabel')[0];
  expirationLabel.innerHTML = formatDateToDisplay(ban.expiration);

  var appliedByLabel = cell.getElementsByClassName('appliedByLabel')[0];
  appliedByLabel.innerHTML = ban.appliedBy;

  var boardLabel = cell.getElementsByClassName('boardLabel')[0];
  boardLabel.innerHTML = ban.boardUri ? ban.boardUri : 'All boards';

  cell.getElementsByClassName('idIdentifier')[0].setAttribute('value', ban._id);

}

exports.bans = function(bans) {

  try {

    var document = jsdom(bansPageTemplate);

    document.title = 'Bans';

    var bansDiv = document.getElementById('bansDiv');

    for (var i = 0; i < bans.length; i++) {

      var ban = bans[i];
      var cell = document.createElement('form');
      cell.innerHTML = banCellTemplate;

      setFormCellBoilerPlate(cell, '/liftBan.js', 'banCell');

      setBanCell(ban, cell);
      bansDiv.appendChild(cell);
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

function getReportLink(report) {
  var link = '/' + report.boardUri + '/res/';
  link += report.threadId + '.html#';

  if (report.postId) {
    link += report.postId;
  } else {
    link += report.threadId;
  }

  return link;
}

function setClosedReportCell(cell, report) {
  if (report.reason) {
    var reason = cell.getElementsByClassName('reasonLabel')[0];
    reason.innerHTML = report.reason;
  }

  var reportLink = cell.getElementsByClassName('link')[0];
  reportLink.setAttribute('href', getReportLink(report));

  var closedBy = cell.getElementsByClassName('closedByLabel')[0];
  closedBy.innerHTML = report.closedBy;

  var closedDate = cell.getElementsByClassName('closedDateLabel')[0];
  closedDate.innerHTML = report.closing;
}

exports.closedReports = function(reports, callback) {
  try {

    var document = jsdom(closedReportsPageTemplate);

    document.title = 'Closed reports';

    var reportsDiv = document.getElementById('reportDiv');

    for (var i = 0; i < reports.length; i++) {

      var report = reports[i];
      var cell = document.createElement('div');

      cell.innerHTML = closedReportCellTemplate;
      cell.setAttribute('class', 'closedReportCell');

      setClosedReportCell(cell, report);

      reportsDiv.appendChild(cell);

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

function setBoardControlIdentifiers(document, boardData) {
  document.getElementById('addVolunteerBoardIdentifier').setAttribute('value',
      boardData.boardUri);

  document.getElementById('deletionIdentifier').setAttribute('value',
      boardData.boardUri);

  document.getElementById('transferBoardIdentifier').setAttribute('value',
      boardData.boardUri);
}

function setBoardOwnerControls(document, boardData) {

  setBoardControlIdentifiers(document, boardData);

  var volunteersDiv = document.getElementById('volunteersDiv');

  var volunteers = boardData.volunteers || [];

  for (var i = 0; i < volunteers.length; i++) {

    var cell = document.createElement('form');
    cell.innerHTML = volunteerCellTemplate;

    setFormCellBoilerPlate(cell, '/setVolunteer.js', 'volunteerCell');

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        volunteers[i]);

    cell.getElementsByClassName('userLabel')[0].innerHTML = volunteers[i];

    cell.getElementsByClassName('boardIdentifier')[0].setAttribute('value',
        boardData.boardUri);

    volunteersDiv.appendChild(cell);

  }

}

function setFormCellBoilerPlate(cell, action, cssClass) {
  cell.method = 'post';
  cell.enctype = 'multipart/form-data';
  cell.action = action;
  cell.setAttribute('class', cssClass);
}

function setReportCell(cell, report) {
  if (report.reason) {
    var reason = cell.getElementsByClassName('reasonLabel')[0];
    reason.innerHTML = report.reason;
  }

  var identifier = cell.getElementsByClassName('idIdentifier')[0];
  identifier.setAttribute('value', report._id);

  var reportLink = cell.getElementsByClassName('link')[0];
  reportLink.setAttribute('href', getReportLink(report));
}

function setReportList(document, reports) {

  var reportDiv = document.getElementById('reportDiv');

  for (var i = 0; i < reports.length; i++) {
    var report = reports[i];

    var cell = document.createElement('form');

    cell.innerHTML = reportCellTemplate;

    setFormCellBoilerPlate(cell, '/closeReport.js', 'reportCell');

    setReportCell(cell, report);

    reportDiv.appendChild(cell);

  }

}

function setBoardManagementLinks(document, boardData) {
  var closedReportsLink = document.getElementById('closedReportsLink');

  var closedReportsUrl = '/closedReports.js?boardUri=' + boardData.boardUri;
  closedReportsLink.setAttribute('href', closedReportsUrl);

  var bansUrl = '/bans.js?boardUri=' + boardData.boardUri;

  document.getElementById('bansLink').href = bansUrl;
}

exports.boardManagement = function(login, boardData, reports) {

  try {

    var document = jsdom(bManagementTemplate);

    document.title = '/' + boardData.boardUri + '/ - ' + boardData.boardName;

    setBoardManagementLinks(document, boardData);

    var boardLabel = document.getElementById('boardLabel');

    var label = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    boardLabel.innerHTML = label;

    setReportList(document, reports);

    if (login === boardData.owner) {
      setBoardOwnerControls(document, boardData);
    } else {
      document.getElementById('ownerControlDiv').style.display = 'none';

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
    cell.innerHTML = staffCellTemplate;

    setFormCellBoilerPlate(cell, '/setGlobalRole.js', 'staffCell');

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        user.login);

    cell.getElementsByClassName('userLabel')[0].innerHTML = user.login + ': ';

    setRoleComboBox(document, cell.getElementsByClassName('roleCombo')[0],
        possibleRoles, user);

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

function setBansLink(userRole, document) {
  var bansLink = document.getElementById('bansLink');

  var displayBans = userRole < miscOps.getMaxStaffRole();

  if (!displayBans) {
    bansLink.style.display = 'none';
  }
}

exports.globalManagement = function(userRole, userLogin, staff, reports) {

  try {
    var document = jsdom(gManagementTemplate);

    document.title = 'Global management';

    setReportList(document, reports);

    var newStaffForm = document.getElementById('addStaffForm');

    setBansLink(userRole, document);

    if (userRole < 2) {
      setNewStaffComboBox(document, userRole);
    } else {
      newStaffForm.style.display = 'none';
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

    document.title = 'Welcome, ' + login;

    var loginLabel = document.getElementById('labelLogin');

    loginLabel.innerHTML = login;

    var gManagementLink = document.getElementById('globalManagementLink');

    var globalStaff = globalRole <= miscOps.getMaxStaffRole();

    if (!globalStaff) {
      gManagementLink.style.display = 'none';
    }

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

    document.title = 'Login, register or reset passsword';

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

  document.title = 'File not found';

  gridFs.writeData(serializer(document), '/404.html', 'text/html', {
    status : 404
  }, callback);
};

exports.message = function(message, link) {

  try {

    var document = jsdom(messageTemplate);

    document.title = message;

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

    document.title = siteTitle;

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

function setThreadLinks(document, boardData, threadData) {

  var linkModeration = '/mod.js?boardUri=' + boardData.boardUri;
  linkModeration += '&threadId=' + threadData.threadId;

  var moderationElement = document.getElementById('linkMod');
  moderationElement.href = linkModeration;

  var linkManagement = document.getElementById('linkManagement');
  linkManagement.href = '/boardManagement.js?boardUri=' + boardData.boardUri;
}

function setModdingInformation(document, boardUri, boardData, threadData,
    posts, callback) {

  document.getElementById('controlBoardIdentifier').setAttribute('value',
      boardUri);
  document.getElementById('controlThreadIdentifier').setAttribute('value',
      threadData.threadId);

  callback(null, serializer(document));

}

function hideModElements(document) {
  document.getElementById('inputBan').style.display = 'none';
  document.getElementById('divExpiration').style.display = 'none';
  document.getElementById('divControls').style.display = 'none';
}

function setThreadTitle(document, boardUri, threadData) {
  var title = '/' + boardUri + '/ - ';

  if (threadData.subject) {
    title += threadData.subject;
  } else {
    title += threadData.message.substring(0, 256);
  }

  document.title = title;
}

function setModElements(modding, document, boardUri, boardData, threadData,
    posts, callback) {

  if (modding) {

    setModdingInformation(document, boardUri, boardData, threadData, posts,
        callback);

  } else {
    hideModElements(document);
    var ownName = 'res/' + threadData.threadId + '.html';

    gridFs.writeData(serializer(document), '/' + boardUri + '/' + ownName,
        'text/html', {
          boardUri : boardUri,
          type : 'thread',
          threadId : threadData.threadId
        }, callback);
  }
}

exports.thread = function(boardUri, boardData, threadData, posts, callback,
    modding) {

  try {
    var document = jsdom(threadTemplate);

    setThreadTitle(document, boardUri, threadData);

    setThreadLinks(document, boardData, threadData);

    var titleHeader = document.getElementById('labelName');

    titleHeader.innerHTML = boardUri;

    var descriptionHeader = document.getElementById('labelDescription');

    titleHeader.innerHTML = '/' + boardUri + '/ - ' + boardData.boardName;
    descriptionHeader.innerHTML = boardData.boardDescription;

    setThreadHiddenIdentifiers(document, boardUri, threadData);

    addThread(document, threadData, posts, boardUri, true);

    setModElements(modding, document, boardUri, boardData, threadData, posts,
        callback);

  } catch (error) {
    callback(error);
  }

};

function formatFileSize(size) {

  var orderIndex = 0;

  while (orderIndex < sizeOrders.length - 1 && size > 1024) {

    orderIndex++;
    size /= 1024;

  }

  return size.toFixed(2) + sizeOrders[orderIndex];

}

function setLinks(document, cell, file) {
  var thumbLink = cell.getElementsByClassName('imageLink')[0];
  thumbLink.href = file.path;

  var img = document.createElement('img');
  img.src = file.thumb;

  thumbLink.appendChild(img);

  var nameLink = cell.getElementsByClassName('nameLink')[0];
  nameLink.href = file.path;
  nameLink.innerHTML = file.name;
}

function addFiles(document, node, files) {

  if (!files) {
    return;
  }

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var cell = document.createElement('div');
    cell.innerHTML = uploadCellTemplate;
    cell.setAttribute('class', 'uploadCell');

    setLinks(document, cell, file);

    var infoString = formatFileSize(file.size);

    if (file.width) {
      infoString += ', ' + file.width + 'x' + file.height;
    }

    cell.getElementsByClassName('infoLabel')[0].innerHTML = infoString;

    node.appendChild(cell);
  }

}

function setPostComplexElements(postCell, post, boardUri, threadId, document) {
  var link = postCell.getElementsByClassName('linkSelf')[0];
  link.innerHTML = post.postId;
  link.href = '/' + boardUri + '/res/' + threadId + '.html#' + post.postId;

  var checkboxName = boardUri + '-' + threadId + '-' + post.postId;
  postCell.getElementsByClassName('deletionCheckBox')[0].setAttribute('name',
      checkboxName);

  addFiles(document, postCell.getElementsByClassName('panelUploads')[0],
      post.files);
}

function setPostInnerElements(document, boardUri, threadId, post, postCell) {

  post.name = post.name || 'Anonymous';

  var linkName = postCell.getElementsByClassName('linkName')[0];

  linkName.innerHTML = post.name;

  if (post.email) {
    linkName.href = 'mailto:' + post.email;
  }

  var subjectLabel = postCell.getElementsByClassName('labelSubject')[0];
  if (post.subject) {
    subjectLabel.innerHTML = post.subject;
  } else {
    subjectLabel.style.display = 'none';
  }

  var labelCreated = postCell.getElementsByClassName('labelCreated')[0];
  labelCreated.innerHTML = formatDateToDisplay(post.creation);

  postCell.getElementsByClassName('divMessage')[0].innerHTML = post.message;

  setPostComplexElements(postCell, post, boardUri, threadId, document);

}

function addPosts(document, posts, boardUri, threadId) {

  var divThreads = document.getElementById('divPostings');

  for (var i = 0; i < posts.length; i++) {
    var postCell = document.createElement('div');
    postCell.innerHTML = postTemplate;
    postCell.setAttribute('class', 'postCell');

    var post = posts[i];

    postCell.id = post.postId;

    setPostInnerElements(document, boardUri, threadId, post, postCell);

    divThreads.appendChild(postCell);

  }

}

function setThreadComplexElements(boardUri, thread, threadCell, innerPage) {

  if (!thread.pinned) {
    var pinIndicator = threadCell.getElementsByClassName('pinIndicator')[0];
    pinIndicator.style.display = 'none';
  }

  if (!thread.locked) {
    var lockIndicator = threadCell.getElementsByClassName('lockIndicator')[0];
    lockIndicator.style.display = 'none';
  }

  var linkReply = threadCell.getElementsByClassName('linkReply')[0];
  if (innerPage) {
    linkReply.style.display = 'none';
  } else {
    linkReply.href = 'res/' + thread.threadId + '.html';
  }

  threadCell.getElementsByClassName('deletionCheckBox')[0].setAttribute('name',
      boardUri + '-' + thread.threadId);

  var linkSelf = threadCell.getElementsByClassName('linkSelf')[0];
  linkSelf.innerHTML = thread.threadId;

  var link = '/' + boardUri + '/res/' + thread.threadId + '.html#';
  linkSelf.href = link + thread.threadId;

}

function setThreadSimpleElements(threadCell, thread) {

  thread.name = thread.name || 'Anonymous';

  var linkName = threadCell.getElementsByClassName('linkName')[0];

  linkName.innerHTML = thread.name;

  if (thread.email) {
    linkName.href = 'mailto:' + thread.email;
  }

  var subjectLabel = threadCell.getElementsByClassName('labelSubject')[0];
  if (thread.subject) {
    subjectLabel.innerHTML = thread.subject;
  } else {
    subjectLabel.style.display = 'none';
  }

  var labelCreation = threadCell.getElementsByClassName('labelCreated')[0];
  labelCreation.innerHTML = formatDateToDisplay(thread.creation);

  var divMessage = threadCell.getElementsByClassName('divMessage')[0];
  divMessage.innerHTML = thread.message;
}

function addThread(document, thread, posts, boardUri, innerPage) {

  var threadCell = document.createElement('div');
  threadCell.innerHTML = opTemplate;
  threadCell.setAttribute('class', 'opCell');
  threadCell.id = thread.threadId;

  setThreadComplexElements(boardUri, thread, threadCell, innerPage);

  setThreadSimpleElements(threadCell, thread);

  addFiles(document, threadCell.getElementsByClassName('panelUploads')[0],
      thread.files);

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

    document.title = '/' + board + '/' + ' - ' + boardData.boardName;

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
