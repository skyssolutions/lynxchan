'use strict';

// handles the final part of page generation. I created this so I would take
// some stuff out of generator.js since that file was becoming a huge mess
// UPDATE
// now THIS file became a huge mess :^)

// also, manipulations that are not persistent are meant to be directly
// requested from this module instead of using a callback

var boot = require('../boot');
var settings = boot.getGeneralSettings();
var gridFs = require('./gridFsHandler');
var serializer = require('jsdom').serializeDocument;
var miscOps = require('./miscOps');
var jsdom = require('jsdom').jsdom;
var siteTitle = settings.siteTitle || 'My chan';
var debug = boot.debug();
var verbose = settings.verbose;
var accountCreationDisabled = settings.disableAccountCreation;
var boardCreationRestricted = settings.restrictBoardCreation;
var templateHandler = require('./templateHandler');

var sizeOrders = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
var availableLogTypes = {
  '' : 'All types',
  ban : 'Ban',
  deletion : 'Deletion',
  banLift : 'Ban lift',
  reportClosure : 'Reports closure',
  globalRoleChange : 'Global role change',
  boardDeletion : 'Board deletion',
  boardTransfer : 'Board ownership transfer'
};
var optionalStringLogParameters = [ 'user', 'boardUri', 'after', 'before' ];

// Section 1: Shared functions {

function setFormCellBoilerPlate(cell, action, cssClass) {
  cell.method = 'post';
  cell.enctype = 'multipart/form-data';
  cell.action = action;
  cell.setAttribute('class', cssClass);
}

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

// Section 1.1: Date formatting functions {
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

  var year = d.getFullYear();

  var weekDay = weekDays[d.getDay()];

  var hour = padDateField(d.getHours());

  var minute = padDateField(d.getMinutes());

  var second = padDateField(d.getSeconds());

  var toReturn = month + '/' + day + '/' + year;

  return toReturn + ' (' + weekDay + ') ' + hour + ':' + minute + ':' + second;
}
// } Section 1.1: Date formatting functions

function setReportList(document, reports) {

  var reportDiv = document.getElementById('reportDiv');

  for (var i = 0; i < reports.length; i++) {
    var report = reports[i];

    var cell = document.createElement('form');

    cell.innerHTML = templateHandler.reportCellTemplate();

    setFormCellBoilerPlate(cell, '/closeReport.js', 'reportCell');

    if (report.reason) {
      var reason = cell.getElementsByClassName('reasonLabel')[0];
      reason.innerHTML = report.reason;
    }

    var identifier = cell.getElementsByClassName('idIdentifier')[0];
    identifier.setAttribute('value', report._id);

    var reportLink = cell.getElementsByClassName('link')[0];
    reportLink.setAttribute('href', getReportLink(report));

    reportDiv.appendChild(cell);

  }

}

function setHeader(document, board, boardData) {

  var titleHeader = document.getElementById('labelName');
  titleHeader.innerHTML = '/' + board + '/ - ' + boardData.boardName;

  var descriptionHeader = document.getElementById('labelDescription');
  descriptionHeader.innerHTML = boardData.boardDescription;

  var linkBanner = '/randomBanner.js?boardUri=' + board;
  document.getElementById('bannerImage').src = linkBanner;

  var settings = boardData.settings;

  if (settings.indexOf('disableCaptcha') > -1) {
    var captchaDiv = document.getElementById('captchaDiv');
    captchaDiv.parentNode.removeChild(captchaDiv);
  }

  if (settings.indexOf('forceAnonymity') > -1) {
    var nameDiv = document.getElementById('divName');
    nameDiv.parentNode.removeChild(nameDiv);
  }

}

// Section 1.2: Thread content {
function setThreadHiddeableElements(thread, threadCell) {

  if (!thread.pinned) {
    var pinIndicator = threadCell.getElementsByClassName('pinIndicator')[0];
    pinIndicator.parentNode.removeChild(pinIndicator);
  }

  if (!thread.locked) {
    var lockIndicator = threadCell.getElementsByClassName('lockIndicator')[0];
    lockIndicator.parentNode.removeChild(lockIndicator);
  }

  if (thread.id) {
    threadCell.getElementsByClassName('labelId')[0].innerHTML = thread.id;
  } else {
    var spanId = threadCell.getElementsByClassName('spanId')[0];
    spanId.parentNode.removeChild(spanId);
  }
}

function addThread(document, thread, posts, boardUri, innerPage) {

  var threadCell = document.createElement('div');
  threadCell.innerHTML = templateHandler.opTemplate();
  threadCell.setAttribute('class', 'opCell');
  threadCell.id = thread.threadId;

  setThreaLinks(threadCell, thread, boardUri, innerPage);

  setThreadComplexElements(boardUri, thread, threadCell, innerPage);

  setThreadHiddeableElements(thread, threadCell);

  setThreadSimpleElements(threadCell, thread);

  setUploadCell(document, threadCell.getElementsByClassName('panelUploads')[0],
      thread.files);

  document.getElementById('divPostings').appendChild(threadCell);

  addPosts(document, posts || [], boardUri, thread.threadId, innerPage);

}

// Section 1.2.1: Post content {
function setPostHideableElements(postCell, post) {
  var subjectLabel = postCell.getElementsByClassName('labelSubject')[0];
  if (post.subject) {
    subjectLabel.innerHTML = post.subject;
  } else {
    subjectLabel.parentNode.removeChild(subjectLabel);
  }

  if (post.id) {
    postCell.getElementsByClassName('labelId')[0].innerHTML = post.id;
  } else {
    var spanId = postCell.getElementsByClassName('spanId')[0];
    spanId.parentNode.removeChild(spanId);
  }

  var banMessageLabel = postCell.getElementsByClassName('divBanMessage')[0];

  if (!post.banMessage) {
    banMessageLabel.parentNode.removeChild(banMessageLabel);
  } else {
    banMessageLabel.innerHTML = post.banMessage;
  }

}

function setPostComplexElements(postCell, post, boardUri, threadId, document,
    preview) {

  var labelRole = postCell.getElementsByClassName('labelRole')[0];

  if (post.signedRole) {
    labelRole.innerHTML = post.signedRole;
  } else {
    labelRole.parentNode.removeChild(labelRole);
  }

  var link = postCell.getElementsByClassName('linkSelf')[0];
  link.innerHTML = post.postId;

  var deletionCheckbox = postCell.getElementsByClassName('deletionCheckBox')[0];

  if (!preview) {
    link.href = '/' + boardUri + '/res/' + threadId + '.html#' + post.postId;

    var checkboxName = boardUri + '-' + threadId + '-' + post.postId;
    deletionCheckbox.setAttribute('name', checkboxName);
  } else {
    deletionCheckbox.parentNode.removeChild(deletionCheckbox);
  }

  setUploadCell(document, postCell.getElementsByClassName('panelUploads')[0],
      post.files);
}

function setPostInnerElements(document, boardUri, threadId, post, postCell,
    preview) {

  var linkName = postCell.getElementsByClassName('linkName')[0];

  linkName.innerHTML = post.name;

  if (post.email) {
    linkName.href = 'mailto:' + post.email;
  } else {
    linkName.className += ' noEmailName';
  }

  var labelCreated = postCell.getElementsByClassName('labelCreated')[0];
  labelCreated.innerHTML = formatDateToDisplay(post.creation);

  postCell.getElementsByClassName('divMessage')[0].innerHTML = post.markdown;

  setPostHideableElements(postCell, post);

  setPostComplexElements(postCell, post, boardUri, threadId, document, preview);

}

function addPosts(document, posts, boardUri, threadId) {

  var divThreads = document.getElementById('divPostings');

  for (var i = 0; i < posts.length; i++) {
    var postCell = document.createElement('div');
    postCell.innerHTML = templateHandler.postTemplate();
    postCell.setAttribute('class', 'postCell');

    var post = posts[i];

    postCell.id = post.postId;

    setPostInnerElements(document, boardUri, threadId, post, postCell);

    divThreads.appendChild(postCell);

  }

}
// } Section 1.2.1: Post content
function setThreaLinks(threadCell, thread, boardUri, innerPage) {
  var linkReply = threadCell.getElementsByClassName('linkReply')[0];
  if (innerPage) {
    linkReply.parentNode.removeChild(linkReply);
  } else {
    linkReply.href = 'res/' + thread.threadId + '.html';
  }

  var linkSelf = threadCell.getElementsByClassName('linkSelf')[0];
  linkSelf.innerHTML = thread.threadId;

  var link = '/' + boardUri + '/res/' + thread.threadId + '.html#';
  linkSelf.href = link + thread.threadId;
}

function setThreadComplexElements(boardUri, thread, threadCell) {

  var labelRole = threadCell.getElementsByClassName('labelRole')[0];

  if (thread.signedRole) {
    labelRole.innerHTML = thread.signedRole;
  } else {
    labelRole.parentNode.removeChild(labelRole);
  }

  var banMessageLabel = threadCell.getElementsByClassName('divBanMessage')[0];

  if (!thread.banMessage) {
    banMessageLabel.parentNode.removeChild(banMessageLabel);
  } else {
    banMessageLabel.innerHTML = thread.banMessage;
  }

  threadCell.getElementsByClassName('deletionCheckBox')[0].setAttribute('name',
      boardUri + '-' + thread.threadId);

}

function setThreadSimpleElements(threadCell, thread) {

  var linkName = threadCell.getElementsByClassName('linkName')[0];

  linkName.innerHTML = thread.name;

  if (thread.email) {
    linkName.href = 'mailto:' + thread.email;
  } else {
    linkName.className += ' noEmailName';
  }

  var subjectLabel = threadCell.getElementsByClassName('labelSubject')[0];
  if (thread.subject) {
    subjectLabel.innerHTML = thread.subject;
  } else {
    subjectLabel.parentNode.removeChild(subjectLabel);
  }

  var labelCreation = threadCell.getElementsByClassName('labelCreated')[0];
  labelCreation.innerHTML = formatDateToDisplay(thread.creation);

  var divMessage = threadCell.getElementsByClassName('divMessage')[0];
  divMessage.innerHTML = thread.markdown;
}

// Section 1.2.2: Uploads {
function formatFileSize(size) {

  var orderIndex = 0;

  while (orderIndex < sizeOrders.length - 1 && size > 1024) {

    orderIndex++;
    size /= 1024;

  }

  return size.toFixed(2) + ' ' + sizeOrders[orderIndex];

}

function setUploadLinks(document, cell, file) {
  var thumbLink = cell.getElementsByClassName('imageLink')[0];
  thumbLink.href = file.path;

  var img = document.createElement('img');
  img.src = file.thumb;

  thumbLink.appendChild(img);

  var nameLink = cell.getElementsByClassName('nameLink')[0];
  nameLink.href = file.path;
  nameLink.innerHTML = file.name;
}

function setUploadCell(document, node, files) {

  if (!files) {
    return;
  }

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var cell = document.createElement('div');
    cell.innerHTML = templateHandler.uploadCellTemplate();
    cell.setAttribute('class', 'uploadCell');

    setUploadLinks(document, cell, file);

    var infoString = formatFileSize(file.size);

    if (file.width) {
      infoString += ', ' + file.width + 'x' + file.height;
    }

    cell.getElementsByClassName('infoLabel')[0].innerHTML = infoString;

    node.appendChild(cell);
  }

}
// } Section 1.2.2: Uploads

// } Section 1.2: Thread content

// } Section 1: Shared functions

// Section 2: Dynamic pages {
exports.bannerManagement = function(boardUri, banners) {

  try {

    var document = jsdom(templateHandler.bannerManagementTemplate());

    document.title = 'Banners of /' + boardUri + '/';

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    var bannerDiv = document.getElementById('bannersDiv');

    for (var i = 0; i < banners.length; i++) {
      var banner = banners[i];

      var cell = document.createElement('form');
      cell.innerHTML = templateHandler.bannerCellTemplate();

      setFormCellBoilerPlate(cell, '/deleteBanner.js', 'bannerCell');

      cell.getElementsByClassName('bannerImage')[0].src = banner.filename;

      cell.getElementsByClassName('bannerIdentifier')[0].setAttribute('value',
          banner._id);

      bannerDiv.appendChild(cell);
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

exports.ban = function(reason, expiration, board) {

  try {

    var document = jsdom(templateHandler.banPageTemplate());

    document.title = 'b& :^)';

    document.getElementById('reasonLabel').innerHTML = reason;

    document.getElementById('boardLabel').innerHTML = board;

    expiration = formatDateToDisplay(expiration);

    document.getElementById('expirationLabel').innerHTML = expiration;

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

exports.error = function(code, message) {

  try {

    var document = jsdom(templateHandler.errorTemplate());

    document.title = 'Error';

    document.getElementById('codeLabel').innerHTML = code;

    document.getElementById('errorLabel').innerHTML = message;

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

// Section 2.1: Bans {
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

    var document = jsdom(templateHandler.bansPageTemplate());

    document.title = 'Bans';

    var bansDiv = document.getElementById('bansDiv');

    for (var i = 0; i < bans.length; i++) {

      var ban = bans[i];
      var cell = document.createElement('form');
      cell.innerHTML = templateHandler.banCellTemplate();

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
// } Section 2.1: Bans

// Section 2.2: Closed reports {
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

    var document = jsdom(templateHandler.closedReportsPageTemplate());

    document.title = 'Closed reports';

    var reportsDiv = document.getElementById('reportDiv');

    for (var i = 0; i < reports.length; i++) {

      var report = reports[i];
      var cell = document.createElement('div');

      cell.innerHTML = templateHandler.closedReportCellTemplate();
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
// } Section 2.2: Closed reports

// Section 2.3: Board control {
function setBoardControlIdentifiers(document, boardData) {
  document.getElementById('addVolunteerBoardIdentifier').setAttribute('value',
      boardData.boardUri);

  document.getElementById('deletionIdentifier').setAttribute('value',
      boardData.boardUri);

  document.getElementById('transferBoardIdentifier').setAttribute('value',
      boardData.boardUri);

  document.getElementById('boardSettingsIdentifier').setAttribute('value',
      boardData.boardUri);
}

function setBoardControlCheckBoxes(document, boardData) {

  var settings = boardData.settings;

  if (settings.indexOf('disableIds') > -1) {
    document.getElementById('disableIdsCheckbox').setAttribute('checked', true);
  }

  if (settings.indexOf('disableCaptcha') > -1) {
    document.getElementById('disableCaptchaCheckbox').setAttribute('checked',
        true);
  }

  if (settings.indexOf('forceAnonymity') > -1) {
    document.getElementById('forceAnonymityCheckbox').setAttribute('checked',
        true);
  }

}

function setBoardOwnerControls(document, boardData) {

  setBoardControlIdentifiers(document, boardData);

  setBoardControlCheckBoxes(document, boardData);

  var volunteersDiv = document.getElementById('volunteersDiv');

  var volunteers = boardData.volunteers || [];

  document.getElementById('boardNameField').setAttribute('value',
      boardData.boardName);

  document.getElementById('boardDescriptionField').setAttribute('value',
      boardData.boardDescription);

  document.getElementById('anonymousNameField').setAttribute('value',
      boardData.anonymousName || '');

  for (var i = 0; i < volunteers.length; i++) {

    var cell = document.createElement('form');
    cell.innerHTML = templateHandler.volunteerCellTemplate();

    setFormCellBoilerPlate(cell, '/setVolunteer.js', 'volunteerCell');

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        volunteers[i]);

    cell.getElementsByClassName('userLabel')[0].innerHTML = volunteers[i];

    cell.getElementsByClassName('boardIdentifier')[0].setAttribute('value',
        boardData.boardUri);

    volunteersDiv.appendChild(cell);

  }

}

function setBoardManagementLinks(document, boardData) {

  var closedReportsUrl = '/closedReports.js?boardUri=' + boardData.boardUri;
  document.getElementById('closedReportsLink').href = closedReportsUrl;

  var bansUrl = '/bans.js?boardUri=' + boardData.boardUri;
  document.getElementById('bansLink').href = bansUrl;

  var bannersUrl = '/bannerManagement.js?boardUri=' + boardData.boardUri;
  document.getElementById('bannerManagementLink').href = bannersUrl;

  var filtersUrl = '/filterManagement.js?boardUri=' + boardData.boardUri;
  document.getElementById('filterManagementLink').href = filtersUrl;
}

exports.boardManagement = function(login, boardData, reports) {

  try {

    var document = jsdom(templateHandler.bManagementTemplate());

    document.title = '/' + boardData.boardUri + '/ - ' + boardData.boardName;

    setBoardManagementLinks(document, boardData);

    var boardLabel = document.getElementById('boardLabel');

    var label = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    boardLabel.innerHTML = label;

    setReportList(document, reports);

    if (login === boardData.owner) {
      setBoardOwnerControls(document, boardData);
    } else {
      var controlDiv = document.getElementById('ownerControlDiv');
      controlDiv.parentNode.removeChild(controlDiv);

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
// } Section 2.3: Board control

// Section 2.4: Global Management {
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
    cell.innerHTML = templateHandler.staffCellTemplate();

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

function setGlobalBansLink(userRole, document) {
  var bansLink = document.getElementById('bansLink');

  var displayBans = userRole < miscOps.getMaxStaffRole();

  if (!displayBans) {
    bansLink.parentNode.removeChild(bansLink);
  }
}

exports.globalManagement = function(userRole, userLogin, staff, reports) {

  try {
    var document = jsdom(templateHandler.gManagementTemplate());

    document.title = 'Global management';

    setReportList(document, reports);

    var newStaffForm = document.getElementById('addStaffForm');

    setGlobalBansLink(userRole, document);

    if (userRole < 2) {
      setNewStaffComboBox(document, userRole);
    } else {
      newStaffForm.parentNode.removeChild(newStaffForm);
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
// } Section 2.4: Global Management

exports.resetEmail = function(password) {

  try {

    var document = jsdom(templateHandler.resetEmailTemplate());

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

    var document = jsdom(templateHandler.recoveryEmailTemplate());

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

// Section 2.5: Account {
function fillOwnedBoardsDiv(document, boardList) {
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

function setBoardCreationForm(userData, document) {

  var allowed = userData.globalRole < 2;

  if (boardCreationRestricted && !allowed) {
    var boardCreationForm = document.getElementById('boardCreationDiv');
    boardCreationForm.parentNode.removeChild(boardCreationForm);
  }
}

exports.account = function(userData) {

  try {

    var document = jsdom(templateHandler.accountTemplate());

    document.title = 'Welcome, ' + userData.login;

    var loginLabel = document.getElementById('labelLogin');

    loginLabel.innerHTML = userData.login;

    var gManagementLink = document.getElementById('globalManagementLink');

    var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

    setBoardCreationForm(userData, document);

    if (!globalStaff) {
      gManagementLink.parentNode.removeChild(gManagementLink);
    }

    if (userData.email && userData.email.length) {
      document.getElementById('emailField').setAttribute('value',
          userData.email);
    }

    if (userData.ownedBoards && userData.ownedBoards.length) {

      fillOwnedBoardsDiv(document, userData.ownedBoards);

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
// } Section 2.5: Account

// Section 2.6: Logs {
function fillComboBox(document, parameters) {

  var combobox = document.getElementById('comboboxType');

  for ( var type in availableLogTypes) {

    var option = document.createElement('option');

    option.innerHTML = availableLogTypes[type];
    option.value = type;

    if (parameters.type === type) {
      option.setAttribute('selected', 'selected');
    }

    combobox.appendChild(option);

  }

}

function fillSearchForm(parameters, document) {

  if (parameters.user) {
    document.getElementById('fieldUser').setAttribute('value', parameters.user);
  }

  if (parameters.excludeGlobals) {
    document.getElementById('checkboxExcludeGlobals').setAttribute('checked',
        true);
  }

  if (parameters.after) {
    document.getElementById('fieldAfter').setAttribute('value',
        parameters.after);
  }

  if (parameters.before) {
    document.getElementById('fieldBefore').setAttribute('value',
        parameters.before);
  }

  if (parameters.boardUri) {
    document.getElementById('fieldBoard').setAttribute('value',
        parameters.boardUri);
  }
}

function setLogEntry(logCell, log) {

  if (!log.global) {
    var globalIndicator = logCell.getElementsByClassName('indicatorGlobal')[0];
    globalIndicator.parentNode.removeChild(globalIndicator);
  }

  var labelType = logCell.getElementsByClassName('labelType')[0];
  labelType.innerHTML = availableLogTypes[log.type];

  var labelTime = logCell.getElementsByClassName('labelTime')[0];
  labelTime.innerHTML = formatDateToDisplay(log.time);

  var labelBoard = logCell.getElementsByClassName('labelBoard')[0];
  labelBoard.innerHTML = log.boardUri || '';

  var labelUser = logCell.getElementsByClassName('labelUser')[0];
  labelUser.innerHTML = log.user;

  var labelDescription = logCell.getElementsByClassName('labelDescription')[0];
  labelDescription.innerHTML = log.description;

}

function setLogPages(document, parameters, pageCount) {

  var pagesDiv = document.getElementById('divPages');

  for (var i = 1; i <= pageCount; i++) {

    var pageLink = document.createElement('a');

    pageLink.innerHTML = i;

    var url = '/logs.js?page=' + i;

    if (parameters.excludeGlobals) {
      url += '&excludeGlobals=on';
    }

    if (parameters.type && parameters.type.length) {
      url += '&type=' + parameters.type;
    }

    for (var j = 0; j < optionalStringLogParameters.length; j++) {

      var parameter = optionalStringLogParameters[j];

      if (parameters[parameter]) {
        url += '&' + parameter + '=' + parameters[parameter];
      }

    }

    pageLink.href = url;

    pagesDiv.appendChild(pageLink);

  }

}

exports.logs = function(logs, pageCount, parameters) {
  try {

    var document = jsdom(templateHandler.logsPageTemplate());

    document.title = 'Logs';

    fillSearchForm(parameters, document);

    fillComboBox(document, parameters);

    var divLogs = document.getElementById('divLogs');

    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];

      var logCell = document.createElement('div');
      logCell.setAttribute('class', 'logCell');
      logCell.innerHTML = templateHandler.logCellTemplate();

      setLogEntry(logCell, log);

      divLogs.appendChild(logCell);
    }

    setLogPages(document, parameters, pageCount);

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
// } Section 2.6: Logs

exports.message = function(message, link) {

  try {

    var document = jsdom(templateHandler.messageTemplate());

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

// Section 2.7: Filter management {

function setFilterCell(cell, boardUri, filter) {

  var labelOriginal = cell.getElementsByClassName('labelOriginal')[0];
  labelOriginal.innerHTML = filter.originalTerm;

  var labelReplacement = cell.getElementsByClassName('labelReplacement')[0];
  labelReplacement.innerHTML = filter.replacementTerm;

  var filterIdentifier = cell.getElementsByClassName('filterIdentifier')[0];
  filterIdentifier.setAttribute('value', filter.originalTerm);

  var boardIdentifier = cell.getElementsByClassName('boardIdentifier')[0];
  boardIdentifier.setAttribute('value', boardUri);
}

exports.filterManagement = function(boardUri, filters) {

  try {

    var document = jsdom(templateHandler.filterManagementPage());

    document.title = 'Filter management';

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    var filtersDiv = document.getElementById('divFilters');

    for (var i = 0; i < filters.length; i++) {

      var filter = filters[i];

      var filterCell = document.createElement('form');
      filterCell.innerHTML = templateHandler.filterCellTemplate();

      setFormCellBoilerPlate(filterCell, '/deleteFilter.js', 'filterCell');

      setFilterCell(filterCell, boardUri, filter);

      filtersDiv.appendChild(filterCell);
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
// } Section 2.7: Filter management

exports.boardModeration = function(boardData, ownerData) {

  try {

    var document = jsdom(templateHandler.boardModerationTemplate());

    document.title = 'Board moderation';

    document.getElementById('boardTransferIdentifier').setAttribute('value',
        boardData.boardUri);

    document.getElementById('boardDeletionIdentifier').setAttribute('value',
        boardData.boardUri);

    document.getElementById('labelOwner').innerHTML = ownerData.login;

    var title = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    document.getElementById('labelTitle').innerHTML = title;

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

// Section 2.8: Board listing {
function setBoardCell(board, boardCell) {

  var linkContent = '/' + board.boardUri + '/ - ' + board.boardName;
  var boardLink = boardCell.getElementsByClassName('linkBoard')[0];
  boardLink.href = '/' + board.boardUri + '/';
  boardLink.innerHTML = linkContent;

  var labelPPH = boardCell.getElementsByClassName('labelPostsPerHour')[0];
  labelPPH.innerHTML = board.postsPerHour || 0;

  var labelCount = boardCell.getElementsByClassName('labelPostCount')[0];
  labelCount.innerHTML = board.lastPostId || 0;

  var labelDescription = boardCell.getElementsByClassName('divDescription')[0];
  labelDescription.innerHTML = board.boardDescription;
}

function setPages(document, pageCount) {
  var pagesDiv = document.getElementById('divPages');

  for (var j = 1; j <= pageCount; j++) {

    var link = document.createElement('a');
    link.innerHTML = j;
    link.href = '/boards.js?page=' + j;

    pagesDiv.appendChild(link);
  }
}

exports.boards = function(boards, pageCount) {
  try {
    var document = jsdom(templateHandler.boardsTemplate());

    document.title = 'Boards';

    var divBoards = document.getElementById('divBoards');

    for (var i = 0; i < boards.length; i++) {
      var board = boards[i];

      var boardCell = document.createElement('div');
      boardCell.innerHTML = templateHandler.boardsCellTemplate();
      boardCell.setAttribute('class', 'boardsCell');

      setBoardCell(board, boardCell);

      divBoards.appendChild(boardCell);
    }

    setPages(document, pageCount);

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

// } Section 2.8: Board listing

// Section 2: Dynamic pages

// Section 3: Static pages {
exports.notFound = function(callback) {

  var document = jsdom(templateHandler.notFoundTemplate());

  document.title = 'File not found';

  gridFs.writeData(serializer(document), '/404.html', 'text/html', {
    status : 404
  }, callback);
};

exports.login = function(callback) {
  try {
    var document = jsdom(templateHandler.loginTemplate());

    document.title = 'Login, register or reset passsword';

    if (accountCreationDisabled) {
      var divCreation = document.getElementById('divCreation');
      divCreation.parentNode.removeChild(divCreation);
    }

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

exports.frontPage = function(boards, callback) {

  try {

    var document = jsdom(templateHandler.frontPageTemplate());

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

// Section 3.1: Thread {
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

  if (threadData.locked) {
    document.getElementById('checkboxLock').setAttribute('checked', true);
  }

  if (threadData.pinned) {
    document.getElementById('checkboxPin').setAttribute('checked', true);
  }

  document.getElementById('controlBoardIdentifier').setAttribute('value',
      boardUri);
  document.getElementById('controlThreadIdentifier').setAttribute('value',
      threadData.threadId);

  callback(null, serializer(document));

}

function hideModElements(document) {

  var inputBan = document.getElementById('inputBan');
  inputBan.parentNode.removeChild(inputBan);

  var divBanInput = document.getElementById('divBanInput');
  divBanInput.parentNode.removeChild(divBanInput);

  var divControls = document.getElementById('divControls');
  divControls.parentNode.removeChild(divControls);

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
    var document = jsdom(templateHandler.threadTemplate());

    setThreadTitle(document, boardUri, threadData);

    setThreadLinks(document, boardData, threadData);

    setHeader(document, boardUri, boardData);

    setThreadHiddenIdentifiers(document, boardUri, threadData);

    addThread(document, threadData, posts, boardUri, true);

    setModElements(modding, document, boardUri, boardData, threadData, posts,
        callback);

  } catch (error) {
    callback(error);
  }

};
// } Section 3.1: Thread

// Section 3.2: Board {
function generateThreadListing(document, boardUri, page, threads, latestPosts,
    callback) {

  var tempLatest = {};

  for (var i = 0; i < latestPosts.length; i++) {

    tempLatest[latestPosts[i]._id] = latestPosts[i].latestPosts;
  }

  latestPosts = tempLatest;

  for (i = 0; i < threads.length; i++) {
    var thread = threads[i];

    addThread(document, thread, latestPosts[thread.threadId], boardUri);

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

exports.page = function(board, page, threads, pageCount, boardData,
    latestPosts, cb) {

  try {

    var document = jsdom(templateHandler.boardTemplate());

    document.title = '/' + board + '/' + ' - ' + boardData.boardName;

    var linkManagement = document.getElementById('linkManagement');
    linkManagement.href = '/boardManagement.js?boardUri=' + board;

    var linkModeration = document.getElementById('linkModeration');
    linkModeration.href = '/boardModeration.js?boardUri=' + board;

    var boardIdentifyInput = document.getElementById('boardIdentifier');

    boardIdentifyInput.setAttribute('value', board);

    setHeader(document, board, boardData);

    addPagesLinks(document, pageCount);

    generateThreadListing(document, board, page, threads, latestPosts, cb);
  } catch (error) {
    cb(error);
  }
};
// } Section 3.2: Board

// Section 3.3: Catalog {

function setCellThumb(thumbLink, boardUri, document, thread) {
  thumbLink.href = '/' + boardUri + '/res/' + thread.threadId + '.html';

  if (thread.files && thread.files.length) {
    var thumbImage = document.createElement('img');

    if (thread.files[0].height > thread.files[0].width) {
      thumbImage.style.height = '128px';
    } else {
      thumbImage.style.width = '128px';
    }

    thumbImage.src = thread.files[0].thumb;
    thumbLink.appendChild(thumbImage);
  } else {
    thumbLink.innerHTML = 'Open';
  }
}

function setCell(boardUri, document, cell, thread) {

  setCellThumb(cell.getElementsByClassName('linkThumb')[0], boardUri, document,
      thread);

  var labelReplies = cell.getElementsByClassName('labelReplies')[0];
  labelReplies.innerHTML = thread.postCount || 0;

  var labelImages = cell.getElementsByClassName('labelImages')[0];
  labelImages.innerHTML = thread.fileCount || 0;
  cell.getElementsByClassName('labelPage')[0].innerHTML = thread.page;
  if (thread.subject) {
    cell.getElementsByClassName('labelSubject')[0].innerHTML = thread.subject;
  }

  if (!thread.pinned) {
    var pinIndicator = cell.getElementsByClassName('pinIndicator')[0];
    pinIndicator.parentNode.removeChild(pinIndicator);
  }

  if (!thread.locked) {
    var lockIndicator = cell.getElementsByClassName('lockIndicator')[0];
    lockIndicator.parentNode.removeChild(lockIndicator);
  }

  cell.getElementsByClassName('divMessage')[0].innerHTML = thread.markdown;

}

exports.catalog = function(boardUri, threads, callback) {

  try {

    var document = jsdom(templateHandler.catalogPageTemplate());

    document.title = '/' + boardUri + '/ - Catalog';

    document.getElementById('labelBoard').innerHTML = '/' + boardUri + '/';

    var threadsDiv = document.getElementById('divThreads');

    for (var i = 0; i < threads.length; i++) {
      var thread = threads[i];

      var cell = document.createElement('div');
      cell.innerHTML = templateHandler.catalogCellTemplate();
      cell.setAttribute('class', 'catalogCell');

      setCell(boardUri, document, cell, thread);

      threadsDiv.appendChild(cell);
    }

    gridFs.writeData(serializer(document), '/' + boardUri + '/catalog.html',
        'text/html', {
          boardUri : boardUri,
          type : 'catalog'
        }, callback);

  } catch (error) {
    callback(error);
  }

};

// } Section 3.3: Catalog

exports.preview = function(postingData, callback) {
  try {

    var document = jsdom(templateHandler.previewPageTemplate());

    var path = '/' + postingData.boardUri + '/preview/';

    var metadata = {
      boardUri : postingData.boardUri,
      threadId : postingData.threadId,
      type : 'preview'
    };

    if (postingData.postId) {
      metadata.postId = postingData.postId;

      path += postingData.postId;
    } else {
      postingData.postId = postingData.threadId;
      path += postingData.threadId;
    }

    path += '.html';

    var innerCell = document.createElement('div');
    innerCell.innerHTML = templateHandler.postTemplate();

    setPostInnerElements(document, postingData.boardUri, postingData.threadId,
        postingData, innerCell, true);

    document.getElementById('panelContent').appendChild(innerCell);

    gridFs.writeData(serializer(document), path, 'text/html', metadata,
        callback);

  } catch (error) {
    callback(error);
  }
};

// Section 3: Static pages
