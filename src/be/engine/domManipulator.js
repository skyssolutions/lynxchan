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
var lang = require('./langOps').languagePack();
var siteTitle = settings.siteTitle || lang.titDefaultChanTitle;
var debug = boot.debug();
var verbose = settings.verbose;
var accountCreationDisabled = settings.disableAccountCreation;
var boardCreationRestricted = settings.restrictBoardCreation;
var templateHandler = require('./templateHandler');

var indicatorsRelation = {
  pinned : 'pinIndicator',
  locked : 'lockIndicator',
  cyclic : 'cyclicIndicator'
};
var accountSettingsRelation = {
  alwaysSignRole : 'checkboxAlwaysSign'
};
var boardSettingsRelation = {
  disableIds : 'disableIdsCheckbox',
  disableCaptcha : 'disableCaptchaCheckbox',
  forceAnonymity : 'forceAnonymityCheckbox',
  allowCode : 'allowCodeCheckbox'
};
var sizeOrders = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
var availableLogTypes = {
  '' : lang.guiAllTypes,
  ban : lang.guiTypeBan,
  rangeBan : lang.guiTypeRange,
  banLift : lang.guiTypeBanLift,
  deletion : lang.guiTypeDeletion,
  reportClosure : lang.guiTypeReportClosure,
  globalRoleChange : lang.guiTypeGlobalRoleChange,
  boardDeletion : lang.guiTypeBoardDeletion,
  boardTransfer : lang.guiTypeBoardTransfer,
  hashBan : lang.guiTypeHashBan,
  hashBanLift : lang.guiTypeHashBanLift
};
var optionalStringLogParameters = [ 'user', 'boardUri', 'after', 'before' ];

var boardManagementLinks = [ {
  page : 'closedReports',
  element : 'closedReportsLink'
}, {
  page : 'bans',
  element : 'bansLink'
}, {
  page : 'bannerManagement',
  element : 'bannerManagementLink'
}, {
  page : 'filterManagement',
  element : 'filterManagementLink'
}, {
  page : 'rangeBans',
  element : 'rangeBansLink'
}, {
  page : 'rules',
  element : 'ruleManagementLink'
}, {
  page : 'hashBans',
  element : 'hashBansLink'
}, {
  page : 'flags',
  element : 'flagManagementLink'
} ];

var displayMaxSize = formatFileSize(boot.maxFileSize());
var displayMaxBannerSize = formatFileSize(boot.maxBannerSize());
var displayMaxFlagSize = formatFileSize(boot.maxFlagSize());

// Section 1: Shared functions {

function setFormCellBoilerPlate(cell, action, cssClass) {
  cell.method = 'post';
  cell.enctype = 'multipart/form-data';
  cell.action = action;
  cell.setAttribute('class', cssClass);
}

function removeElement(element) {
  element.parentNode.removeChild(element);
}

function setRoleSignature(postingCell, posting) {
  var labelRole = postingCell.getElementsByClassName('labelRole')[0];

  if (posting.signedRole) {
    labelRole.innerHTML = posting.signedRole;
  } else {
    removeElement(labelRole);
  }
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
  var day = padDateField(d.getUTCDate());

  var month = padDateField(d.getUTCMonth() + 1);

  var year = d.getUTCFullYear();

  var weekDay = lang.guiWeekDays[d.getUTCDay()];

  var hour = padDateField(d.getUTCHours());

  var minute = padDateField(d.getUTCMinutes());

  var second = padDateField(d.getUTCSeconds());

  var toReturn = lang.guiDateFormat.replace('{$month}', month).replace(
      '{$day}', day).replace('{$year}', year);

  return toReturn + ' (' + weekDay + ') ' + hour + ':' + minute + ':' + second;
}
// } Section 1.1: Date formatting functions

function setReportList(document, reports) {

  var reportDiv = document.getElementById('reportDiv');

  for (var i = 0; i < reports.length; i++) {
    var report = reports[i];

    var cell = document.createElement('form');

    cell.innerHTML = templateHandler.reportCell;

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

function setCustomCss(board, document) {
  var link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('type', 'text/css');
  link.setAttribute('href', '/' + board + '/custom.css');
  document.getElementsByTagName('head')[0].appendChild(link);
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
    removeElement(document.getElementById('captchaDiv'));
  }

  if (settings.indexOf('forceAnonymity') > -1) {
    removeElement(document.getElementById('divName'));
  }

  if (boardData.usesCustomCss) {
    setCustomCss(board, document);
  }

  document.getElementById('labelMaxFileSize').innerHTML = displayMaxSize;

}

function setLastEditedLabel(posting, cell) {

  var editedLabel = cell.getElementsByClassName('labelLastEdit')[0];

  if (posting.lastEditTime) {

    var formatedDate = formatDateToDisplay(posting.lastEditTime);

    editedLabel.innerHTML = lang.guiEditInfo.replace('{$date}', formatedDate)
        .replace('{$login}', posting.lastEditLogin);

  } else {
    removeElement(editedLabel);
  }

}

// Section 1.2: Thread content {
function setThreadHiddeableElements(thread, cell, modding, boardUri) {

  for ( var key in indicatorsRelation) {
    if (!thread[key]) {
      removeElement(cell.getElementsByClassName(indicatorsRelation[key])[0]);
    }
  }

  if (thread.id) {
    cell.getElementsByClassName('labelId')[0].innerHTML = thread.id;
  } else {
    removeElement(cell.getElementsByClassName('spanId')[0]);
  }

  if (modding) {
    var editLink = '/edit.js?boardUri=' + boardUri;
    editLink += '&threadId=' + thread.threadId;

    cell.getElementsByClassName('linkEdit')[0].href = editLink;
  } else {
    removeElement(cell.getElementsByClassName('linkEdit')[0]);
  }

  if (modding && thread.ip) {
    var labelRange = cell.getElementsByClassName('labelRange')[0];
    labelRange.innerHTML = miscOps.getRange(thread.ip);
  } else {
    removeElement(cell.getElementsByClassName('panelRange')[0]);
  }

}

function assembleOmissionContent(thread, displayedImages, displayedPosts) {
  var pieces = lang.guiOmmitedInfo;
  var postDifference = thread.postCount - displayedPosts;
  var startPiece = postDifference > 1 ? pieces.startPiecePlural
      : pieces.startPiece;
  var content = startPiece.replace('{$postAmount}', postDifference);

  if (thread.fileCount > displayedImages) {
    var fileDifference = thread.fileCount - displayedImages;

    var filePiece = fileDifference > 1 ? pieces.filesPiecePlural
        : pieces.filesPiece;

    content += filePiece.replace('{$imageAmount}', fileDifference);
  }

  content += pieces.finalPiece;

  return content;
}

function setOmittedInformation(thread, threadCell, posts, innerPage) {

  var omissionLabel = threadCell.getElementsByClassName('labelOmission')[0];

  var displayedPosts = posts.length;
  var displayedImages = 0;

  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];

    if (post.files) {

      displayedImages += post.files.length;
    }
  }

  omissionLabel.innerHTML = assembleOmissionContent(thread, displayedImages,
      displayedPosts);

}

function getThreadCellBase(document, thread) {

  var threadCell = document.createElement('div');
  threadCell.innerHTML = templateHandler.opCell;
  threadCell.setAttribute('class', 'opCell');
  threadCell.id = thread.threadId;
  if (thread.files && thread.files.length > 1) {
    threadCell.className += ' multipleUploads';
  }

  return threadCell;
}

function addThread(document, thread, posts, boardUri, innerPage, modding) {

  var threadCell = getThreadCellBase(document, thread);

  var notEnougPosts = !thread.postCount;
  notEnougPosts = notEnougPosts || thread.postCount <= boot.latestPostCount();

  if (innerPage || notEnougPosts) {
    removeElement(threadCell.getElementsByClassName('labelOmission')[0]);
  } else {
    setOmittedInformation(thread, threadCell, posts, innerPage);
  }

  setLastEditedLabel(thread, threadCell);

  setThreadLinks(threadCell, thread, boardUri, innerPage);

  setThreadComplexElements(boardUri, thread, threadCell, innerPage);

  setThreadHiddeableElements(thread, threadCell, modding, boardUri);

  setThreadSimpleElements(threadCell, thread);

  setUploadCell(document, threadCell.getElementsByClassName('panelUploads')[0],
      thread.files, modding);

  document.getElementById('divThreads').appendChild(threadCell);

  addPosts(document, posts || [], boardUri, thread.threadId, modding,
      threadCell.getElementsByClassName('divPosts')[0]);

}

// Section 1.2.1: Post content {
function setPostHideableElements(postCell, post) {
  var subjectLabel = postCell.getElementsByClassName('labelSubject')[0];
  if (post.subject) {
    subjectLabel.innerHTML = post.subject;
  } else {
    removeElement(subjectLabel);
  }

  if (post.id) {
    postCell.getElementsByClassName('labelId')[0].innerHTML = post.id;
  } else {
    removeElement(postCell.getElementsByClassName('spanId')[0]);
  }

  var banMessageLabel = postCell.getElementsByClassName('divBanMessage')[0];

  if (!post.banMessage) {
    removeElement(banMessageLabel);
  } else {
    banMessageLabel.innerHTML = post.banMessage;
  }

  setLastEditedLabel(post, postCell);

}

function setPostLinks(postCell, post, boardUri, link, threadId, linkQuote,
    deletionCheckbox) {
  var linkStart = '/' + boardUri + '/res/' + threadId + '.html#';
  link.href = linkStart + post.postId;
  linkQuote.href = linkStart + 'q' + post.postId;

  var checkboxName = boardUri + '-' + threadId + '-' + post.postId;
  deletionCheckbox.setAttribute('name', checkboxName);

  var linkPreview = '/' + boardUri + '/preview/' + post.postId + '.html';

  postCell.getElementsByClassName('linkPreview')[0].href = linkPreview;
}

function setPostComplexElements(postCell, post, boardUri, threadId, document,
    preview, modding) {

  setRoleSignature(postCell, post);

  var link = postCell.getElementsByClassName('linkSelf')[0];

  var linkQuote = postCell.getElementsByClassName('linkQuote')[0];
  linkQuote.innerHTML = post.postId;

  var deletionCheckbox = postCell.getElementsByClassName('deletionCheckBox')[0];

  if (!preview) {
    setPostLinks(postCell, post, boardUri, link, threadId, linkQuote,
        deletionCheckbox);
  } else {
    removeElement(deletionCheckbox);
    removeElement(postCell.getElementsByClassName('linkPreview')[0]);
  }

  setUploadCell(document, postCell.getElementsByClassName('panelUploads')[0],
      post.files, modding);
}

function setPostModElements(post, modding, postCell, boardUri, threadId) {

  if (modding && post.ip) {

    var labelRange = postCell.getElementsByClassName('labelRange')[0];
    labelRange.innerHTML = miscOps.getRange(post.ip);
  } else {
    removeElement(postCell.getElementsByClassName('panelRange')[0]);
  }

  if (modding) {
    var editLink = '/edit.js?boardUri=' + boardUri + '&postId=' + post.postId;

    postCell.getElementsByClassName('linkEdit')[0].href = editLink;
  } else {
    removeElement(postCell.getElementsByClassName('linkEdit')[0]);
  }

}

function setPostInnerElements(document, boardUri, threadId, post, postCell,
    preview, modding) {

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

  setPostModElements(post, modding, postCell, boardUri, threadId);

  setPostComplexElements(postCell, post, boardUri, threadId, document, preview,
      modding);

}

function addPosts(document, posts, boardUri, threadId, modding, divPosts) {

  for (var i = 0; i < posts.length; i++) {
    var postCell = document.createElement('div');
    postCell.innerHTML = templateHandler.postCell;
    postCell.setAttribute('class', 'postCell');

    var post = posts[i];
    if (post.files && post.files.length > 1) {
      postCell.className += ' multipleUploads';
    }

    postCell.id = post.postId;

    setPostInnerElements(document, boardUri, threadId, post, postCell, false,
        modding);

    divPosts.appendChild(postCell);

  }

}
// } Section 1.2.1: Post content
function setThreadLinks(threadCell, thread, boardUri, innerPage) {
  var linkReply = threadCell.getElementsByClassName('linkReply')[0];
  if (innerPage) {
    removeElement(linkReply);
  } else {
    linkReply.href = 'res/' + thread.threadId + '.html';
  }

  var linkPreview = '/' + boardUri + '/preview/' + thread.threadId + '.html';

  threadCell.getElementsByClassName('linkPreview')[0].href = linkPreview;

  var linkSelf = threadCell.getElementsByClassName('linkSelf')[0];

  var linkQuote = threadCell.getElementsByClassName('linkQuote')[0];
  linkQuote.innerHTML = thread.threadId;

  var linkStart = '/' + boardUri + '/res/' + thread.threadId + '.html#';
  linkSelf.href = linkStart + thread.threadId;
  linkQuote.href = linkStart + 'q' + thread.threadId;
}

function setThreadComplexElements(boardUri, thread, threadCell) {

  setRoleSignature(threadCell, thread);

  var banMessageLabel = threadCell.getElementsByClassName('divBanMessage')[0];

  if (!thread.banMessage) {
    removeElement(banMessageLabel);
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
    removeElement(subjectLabel);
  }

  var labelCreation = threadCell.getElementsByClassName('labelCreated')[0];
  labelCreation.innerHTML = formatDateToDisplay(thread.creation);

  var divMessage = threadCell.getElementsByClassName('divMessage')[0];
  divMessage.innerHTML = thread.markdown;
}

// Section 1.2.2: Uploads {
function formatFileSize(size) {

  var orderIndex = 0;

  while (orderIndex < sizeOrders.length - 1 && size > 1023) {

    orderIndex++;
    size /= 1024;

  }

  return size.toFixed(2) + ' ' + sizeOrders[orderIndex];

}

function setUploadAttributes(file, thumbLink) {
  if (file.width) {
    thumbLink.setAttribute('data-filewidth', file.width);
    thumbLink.setAttribute('data-fileheight', file.height);
  }

  thumbLink.setAttribute('data-filemime', file.mime);
}

function setUploadLinks(document, cell, file) {
  var thumbLink = cell.getElementsByClassName('imgLink')[0];
  thumbLink.href = file.path;

  setUploadAttributes(file, thumbLink);

  var img = document.createElement('img');
  img.src = file.thumb;

  thumbLink.appendChild(img);

  var nameLink = cell.getElementsByClassName('nameLink')[0];
  nameLink.href = file.path;
  nameLink.innerHTML = file.name;

  var originalLink = cell.getElementsByClassName('originalNameLink')[0];
  originalLink.innerHTML = file.originalName;
  originalLink.href = file.path + '/alias/' + file.originalName;
}

function setUploadModElements(modding, cell, file) {
  if (!modding) {
    removeElement(cell.getElementsByClassName('divHash')[0]);
  } else {
    cell.getElementsByClassName('labelHash')[0].innerHTML = file.md5;
  }
}

function getUploadCellBase(document) {
  var cell = document.createElement('figure');
  cell.innerHTML = templateHandler.uploadCell;
  cell.setAttribute('class', 'uploadCell');

  return cell;
}

function setUploadCell(document, node, files, modding) {

  if (!files) {
    return;
  }

  for (var i = 0; i < files.length; i++) {
    var file = files[i];

    var cell = getUploadCellBase(document);

    setUploadLinks(document, cell, file);

    setUploadModElements(modding, cell, file);

    var sizeString = formatFileSize(file.size);
    cell.getElementsByClassName('sizeLabel')[0].innerHTML = sizeString;

    var dimensionLabel = cell.getElementsByClassName('dimensionLabel')[0];

    if (file.width) {
      dimensionLabel.innerHTML = file.width + 'x' + file.height;
    } else {
      removeElement(dimensionLabel);
    }

    node.appendChild(cell);
  }

}
// } Section 1.2.2: Uploads

// } Section 1.2: Thread content

// } Section 1: Shared functions

// Section 2: Dynamic pages {
exports.bannerManagement = function(boardUri, banners) {

  try {

    var document = jsdom(templateHandler.bannerManagementPage);

    document.title = lang.titBanners.replace('{$board}', boardUri);

    document.getElementById('maxSizeLabel').innerHTML = displayMaxBannerSize;

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    var bannerDiv = document.getElementById('bannersDiv');

    for (var i = 0; i < banners.length; i++) {
      var banner = banners[i];

      var cell = document.createElement('form');
      cell.innerHTML = templateHandler.bannerCell;

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

exports.ban = function(ban, board) {

  try {

    var document = jsdom(ban.range ? templateHandler.rangeBanPage
        : templateHandler.banPage);

    document.title = lang.titBan;

    document.getElementById('boardLabel').innerHTML = board;

    if (ban.range) {
      document.getElementById('rangeLabel').innerHTML = ban.range;
    } else {
      document.getElementById('reasonLabel').innerHTML = ban.reason;

      document.getElementById('idLabel').innerHTML = ban._id;

      ban.expiration = formatDateToDisplay(ban.expiration);
      document.getElementById('expirationLabel').innerHTML = ban.expiration;
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

exports.error = function(code, message) {

  try {

    var document = jsdom(templateHandler.errorPage);

    document.title = lang.titError;

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

  cell.getElementsByClassName('idLabel')[0].innerHTML = ban._id;

  cell.getElementsByClassName('reasonLabel')[0].innerHTML = ban.reason;

  var expirationLabel = cell.getElementsByClassName('expirationLabel')[0];
  expirationLabel.innerHTML = formatDateToDisplay(ban.expiration);

  var appliedByLabel = cell.getElementsByClassName('appliedByLabel')[0];
  appliedByLabel.innerHTML = ban.appliedBy;

  var boardLabel = cell.getElementsByClassName('boardLabel')[0];
  boardLabel.innerHTML = ban.boardUri ? ban.boardUri : lang.miscAllBoards;

  cell.getElementsByClassName('idIdentifier')[0].setAttribute('value', ban._id);

}

exports.bans = function(bans) {

  try {

    var document = jsdom(templateHandler.bansPage);

    document.title = lang.titBansManagement;

    var bansDiv = document.getElementById('bansDiv');

    for (var i = 0; i < bans.length; i++) {

      var ban = bans[i];
      var cell = document.createElement('form');
      cell.innerHTML = templateHandler.banCell;

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

    var document = jsdom(templateHandler.closedReportsPage);

    document.title = lang.titClosedReports;

    var reportsDiv = document.getElementById('reportDiv');

    for (var i = 0; i < reports.length; i++) {

      var report = reports[i];
      var cell = document.createElement('div');

      cell.innerHTML = templateHandler.closedReportCell;
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

  document.getElementById('customCssIdentifier').setAttribute('value',
      boardData.boardUri);
}

function setBoardControlCheckBoxes(document, boardData) {

  var settings = boardData.settings;

  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];
    document.getElementById(boardSettingsRelation[setting]).setAttribute(
        'checked', true);
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
    cell.innerHTML = templateHandler.volunteerCell;

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

  for (var i = 0; i < boardManagementLinks.length; i++) {
    var link = boardManagementLinks[i];

    var url = '/' + link.page + '.js?boardUri=' + boardData.boardUri;
    document.getElementById(link.element).href = url;

  }

}

exports.boardManagement = function(login, boardData, reports) {

  try {

    var document = jsdom(templateHandler.bManagement);

    document.title = lang.titBoardManagement.replace('{$board}',
        boardData.boardUri);

    setBoardManagementLinks(document, boardData);

    var boardLabel = document.getElementById('boardLabel');

    var label = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    boardLabel.innerHTML = label;

    setReportList(document, reports);

    if (login === boardData.owner) {
      setBoardOwnerControls(document, boardData);
    } else {
      removeElement(document.getElementById('ownerControlDiv'));
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
    cell.innerHTML = templateHandler.staffCell;

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

  var displayBans = userRole < miscOps.getMaxStaffRole();

  if (!displayBans) {
    removeElement(document.getElementById('hashBansLink'));
    removeElement(document.getElementById('rangeBansLink'));
    removeElement(document.getElementById('bansLink'));
  }
}

exports.globalManagement = function(userRole, userLogin, staff, reports) {

  try {
    var document = jsdom(templateHandler.gManagement);

    document.title = lang.titGlobalManagement;

    setReportList(document, reports);

    setGlobalBansLink(userRole, document);

    if (userRole < 2) {
      setNewStaffComboBox(document, userRole);
    } else {
      removeElement(document.getElementById('addStaffForm'));
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

    var document = jsdom(templateHandler.resetEmail);

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

    var document = jsdom(templateHandler.recoveryEmail);

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
  if (!boardList || !boardList.length) {
    return;
  }

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
    removeElement(document.getElementById('boardCreationDiv'));
  }
}

function setAccountSettingsCheckbox(settings, document) {

  if (!settings || !settings.length) {
    return;
  }

  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];

    var checkbox = document.getElementById(accountSettingsRelation[setting]);

    checkbox.setAttribute('checked', true);
  }

}

exports.account = function(userData) {

  try {
    var document = jsdom(templateHandler.accountPage);

    document.title = lang.titAccount.replace('{$login}', userData.login);

    var loginLabel = document.getElementById('labelLogin');

    loginLabel.innerHTML = userData.login;

    var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

    setBoardCreationForm(userData, document);

    if (!globalStaff) {
      removeElement(document.getElementById('globalManagementLink'));
    }

    setAccountSettingsCheckbox(userData.settings, document);

    if (userData.email && userData.email.length) {
      document.getElementById('emailField').setAttribute('value',
          userData.email);
    }

    fillOwnedBoardsDiv(document, userData.ownedBoards);

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
      option.setAttribute('selected', true);
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
    removeElement(logCell.getElementsByClassName('indicatorGlobal')[0]);
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

    var document = jsdom(templateHandler.logsPage);

    document.title = lang.titLogs;

    fillSearchForm(parameters, document);

    fillComboBox(document, parameters);

    var divLogs = document.getElementById('divLogs');

    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];

      var logCell = document.createElement('div');
      logCell.setAttribute('class', 'logCell');
      logCell.innerHTML = templateHandler.logCell;

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

    var document = jsdom(templateHandler.messagePage);

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

    var document = jsdom(templateHandler.filterManagement);

    document.title = lang.titFilters.replace('{$board}', boardUri);

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    var filtersDiv = document.getElementById('divFilters');

    for (var i = 0; i < filters.length; i++) {

      var filter = filters[i];

      var filterCell = document.createElement('form');
      filterCell.innerHTML = templateHandler.filterCell;

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

    var document = jsdom(templateHandler.boardModerationPage);

    document.title = lang.titBoardModeration.replace('{$board}',
        boardData.boardUri);

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
    var document = jsdom(templateHandler.boardsPage);

    document.title = lang.titBoards;

    var divBoards = document.getElementById('divBoards');

    for (var i = 0; i < boards.length; i++) {
      var board = boards[i];

      var boardCell = document.createElement('div');
      boardCell.innerHTML = templateHandler.boardsCell;
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

exports.noCookieCaptcha = function(parameters, captchaId) {

  try {

    var document = jsdom(templateHandler.noCookieCaptchaPage);

    document.title = lang.titNoCookieCaptcha;

    if (!parameters.solvedCaptcha) {
      removeElement(document.getElementById('divSolvedCaptcha'));
    } else {
      var labelSolved = document.getElementById('labelCaptchaId');
      labelSolved.innerHTML = parameters.solvedCaptcha;
    }

    var captchaPath = '/captcha.js?captchaId=' + captchaId;
    document.getElementById('imageCaptcha').src = captchaPath;

    document.getElementById('inputCaptchaId').setAttribute('value', captchaId);

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

// Section 2.9: Range bans {
function setRangeBanCells(document, rangeBans) {

  var bansDiv = document.getElementById('rangeBansDiv');

  for (var i = 0; i < rangeBans.length; i++) {
    var rangeBan = rangeBans[i];

    var banCell = document.createElement('form');
    banCell.innerHTML = templateHandler.rangeBanCell;
    setFormCellBoilerPlate(banCell, '/liftBan.js', 'rangeBanCell');

    banCell.getElementsByClassName('rangeLabel')[0].innerHTML = rangeBan.range;
    banCell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        rangeBan._id);

    bansDiv.appendChild(banCell);

  }

}

exports.rangeBans = function(rangeBans, boardUri) {

  try {

    var document = jsdom(templateHandler.rangeBansPage);

    document.title = lang.titRangeBans;

    var boardIdentifier = document.getElementById('boardIdentifier');

    if (boardUri) {
      boardIdentifier.setAttribute('value', boardUri);
    } else {
      removeElement(boardIdentifier);
    }

    setRangeBanCells(document, rangeBans);

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
// } Section 2.9: Range bans

// Section 2.10: Hash bans {
function setHashBanCells(document, hashBans) {

  var bansDiv = document.getElementById('hashBansDiv');

  for (var i = 0; i < hashBans.length; i++) {
    var hashBan = hashBans[i];

    var banCell = document.createElement('form');
    banCell.innerHTML = templateHandler.hashBanCell;
    setFormCellBoilerPlate(banCell, '/liftHashBan.js', 'hashBanCell');

    banCell.getElementsByClassName('hashLabel')[0].innerHTML = hashBan.md5;
    banCell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        hashBan._id);

    bansDiv.appendChild(banCell);
  }

}

exports.hashBans = function(hashBans, boardUri) {

  try {

    var document = jsdom(templateHandler.hashBansPage);

    document.title = lang.titHashBans;

    var boardIdentifier = document.getElementById('boardIdentifier');

    if (boardUri) {
      boardIdentifier.setAttribute('value', boardUri);
    } else {
      removeElement(boardIdentifier);
    }

    setHashBanCells(document, hashBans);

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

// } Section 2.10: Hash bans

// Section 2.11: Rule management {
function setRuleManagementCells(document, boardUri, rules) {
  var rulesDiv = document.getElementById('divRules');

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];

    var cell = document.createElement('form');
    setFormCellBoilerPlate(cell, '/deleteRule.js', 'ruleManagementCell');
    cell.innerHTML = templateHandler.ruleManagementCell;
    cell.getElementsByClassName('textLabel')[0].innerHTML = rule;

    cell.getElementsByClassName('boardIdentifier')[0].setAttribute('value',
        boardUri);
    cell.getElementsByClassName('indexIdentifier')[0].setAttribute('value', i);

    rulesDiv.appendChild(cell);
  }
}

exports.ruleManagement = function(boardUri, rules) {

  try {

    var document = jsdom(templateHandler.ruleManagementPage);

    document.title = lang.titRuleManagement;

    var boardIdentifier = document.getElementById('boardIdentifier');

    boardIdentifier.setAttribute('value', boardUri);

    setRuleManagementCells(document, boardUri, rules);

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
// } Section 2.11: Rule management

exports.edit = function(parameters, message) {
  try {

    var document = jsdom(templateHandler.editPage);

    document.title = lang.titEdit;

    document.getElementById('fieldMessage').defaultValue = message;

    document.getElementById('boardIdentifier').setAttribute('value',
        parameters.boardUri);

    if (parameters.threadId) {
      document.getElementById('threadIdentifier').setAttribute('value',
          parameters.threadId);

      removeElement(document.getElementById('postIdentifier'));

    } else {
      document.getElementById('postIdentifier').setAttribute('value',
          parameters.postId);
      removeElement(document.getElementById('threadIdentifier'));
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

// Section 2.12: Flag management {
function addFlagCells(document, flags, boardUri) {

  var flagsDiv = document.getElementById('flagsDiv');

  for (var i = 0; i < flags.length; i++) {
    var flag = flags[i];

    var cell = document.createElement('form');

    setFormCellBoilerPlate(cell, '/deleteFlag.js', 'flagCell');

    cell.innerHTML = templateHandler.flagCell;

    var flagUrl = '/' + boardUri + '/flags/' + flag._id;

    cell.getElementsByClassName('flagImg')[0].src = flagUrl;

    cell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        flag._id);

    cell.getElementsByClassName('nameLabel')[0].innerHTML = flag.name;

    flagsDiv.appendChild(cell);
  }

}

exports.flagManagement = function(boardUri, flags, callback) {
  try {

    var document = jsdom(templateHandler.flagsPage);

    document.title = lang.titFlagManagement;

    document.getElementById('maxSizeLabel').innerHTML = displayMaxFlagSize;

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    addFlagCells(document, flags, boardUri);

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

// } Section 2.12: Flag management

// Section 2: Dynamic pages

// Section 3: Static pages {
exports.notFound = function(callback) {

  var document = jsdom(templateHandler.notFoundPage);

  document.title = lang.titNotFound;

  gridFs.writeData(serializer(document), '/404.html', 'text/html', {
    status : 404
  }, callback);
};

exports.login = function(callback) {
  try {
    var document = jsdom(templateHandler.loginPage);

    document.title = lang.titLogin;

    if (accountCreationDisabled) {
      removeElement(document.getElementById('divCreation'));
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

    var document = jsdom(templateHandler.index);

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

function setModdingInformation(document, boardUri, boardData, threadData,
    posts, callback) {

  if (threadData.locked) {
    document.getElementById('checkboxLock').setAttribute('checked', true);
  }

  if (threadData.pinned) {
    document.getElementById('checkboxPin').setAttribute('checked', true);
  }

  if (threadData.cyclic) {
    document.getElementById('checkboxCyclic').setAttribute('checked', true);
  }

  document.getElementById('controlBoardIdentifier').setAttribute('value',
      boardUri);
  document.getElementById('controlThreadIdentifier').setAttribute('value',
      threadData.threadId);

  callback(null, serializer(document));

}

function hideModElements(document) {

  removeElement(document.getElementById('inputBan'));
  removeElement(document.getElementById('divBanInput'));
  removeElement(document.getElementById('divControls'));

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
    var document = jsdom(templateHandler.threadPage);

    setThreadTitle(document, boardUri, threadData);

    var linkModeration = '/mod.js?boardUri=' + boardData.boardUri;
    linkModeration += '&threadId=' + threadData.threadId;

    var moderationElement = document.getElementById('linkMod');
    moderationElement.href = linkModeration;

    var linkManagement = document.getElementById('linkManagement');
    linkManagement.href = '/boardManagement.js?boardUri=' + boardData.boardUri;

    setHeader(document, boardUri, boardData);

    setThreadHiddenIdentifiers(document, boardUri, threadData);

    addThread(document, threadData, posts, boardUri, true, modding);

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

function addPagesLinks(document, pageCount, currentPage) {

  var previous = document.getElementById('linkPrevious');
  if (currentPage === 1) {
    removeElement(previous);
  } else {
    previous.href = currentPage > 2 ? currentPage - 1 + '.html' : 'index.html';
  }

  var next = document.getElementById('linkNext');
  if (pageCount === currentPage) {
    removeElement(next);
  } else {
    next.href = (currentPage + 1) + '.html';
  }

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

    var document = jsdom(templateHandler.boardPage);

    document.title = '/' + board + '/' + ' - ' + boardData.boardName;

    var linkManagement = document.getElementById('linkManagement');
    linkManagement.href = '/boardManagement.js?boardUri=' + board;

    var linkModeration = document.getElementById('linkModeration');
    linkModeration.href = '/boardModeration.js?boardUri=' + board;

    var boardIdentifyInput = document.getElementById('boardIdentifier');

    boardIdentifyInput.setAttribute('value', board);

    setHeader(document, board, boardData);

    addPagesLinks(document, pageCount, page);

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

    thumbImage.src = thread.files[0].thumb;
    thumbLink.appendChild(thumbImage);
  } else {
    thumbLink.innerHTML = lang.guiOpen;
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

  for ( var key in indicatorsRelation) {
    if (!thread[key]) {
      removeElement(cell.getElementsByClassName(indicatorsRelation[key])[0]);
    }
  }

  cell.getElementsByClassName('divMessage')[0].innerHTML = thread.markdown;

}

exports.catalog = function(boardUri, threads, callback) {

  try {

    var document = jsdom(templateHandler.catalogPage);

    document.title = lang.titCatalog.replace('{$board}', boardUri);

    document.getElementById('labelBoard').innerHTML = '/' + boardUri + '/';

    var threadsDiv = document.getElementById('divThreads');

    for (var i = 0; i < threads.length; i++) {
      var thread = threads[i];

      var cell = document.createElement('div');
      cell.innerHTML = templateHandler.catalogCell;
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

    var document = jsdom(templateHandler.previewPage);

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
    innerCell.innerHTML = templateHandler.postCell;

    setPostInnerElements(document, postingData.boardUri, postingData.threadId,
        postingData, innerCell, true);

    document.getElementById('panelContent').appendChild(innerCell);

    gridFs.writeData(serializer(document), path, 'text/html', metadata,
        callback);

  } catch (error) {
    callback(error);
  }
};

exports.rules = function(boardUri, rules, callback) {
  try {

    var document = jsdom(templateHandler.rulesPage);

    document.title = lang.titRules.replace('{$board}', boardUri);
    document.getElementById('boardLabel').innerHTML = boardUri;
    var rulesDiv = document.getElementById('divRules');

    for (var i = 0; i < rules.length; i++) {
      var cell = document.createElement('div');
      cell.innerHTML = templateHandler.ruleCell;

      cell.getElementsByClassName('textLabel')[0].innerHTML = rules[i];
      cell.getElementsByClassName('indexLabel')[0].innerHTML = i + 1;

      rulesDiv.appendChild(cell);
    }

    gridFs.writeData(serializer(document), '/' + boardUri + '/rules.html',
        'text/html', {
          boardUri : boardUri,
          type : 'rules'
        }, callback);

  } catch (error) {
    callback(error);
  }
};

exports.maintenance = function(callback) {
  try {

    var document = jsdom(templateHandler.maintenancePage);

    document.title = lang.titMaintenance;

    gridFs.writeData(serializer(document), '/maintenance.html', 'text/html', {
      status : 200
    }, callback);

  } catch (error) {
    callback(error);
  }
};
// Section 3: Static pages
