'use strict';

// contains common operations to the multiple parts of the domManipulator module

var allowedJs;
var forceCaptcha;
var latestPostCount;
var lang;
var templateHandler;
var miscOps;

exports.indicatorsRelation = {
  pinned : 'pinIndicator',
  locked : 'lockIndicator',
  cyclic : 'cyclicIndicator',
  autoSage : 'bumpLockIndicator'
};

var sizeOrders = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
var displayMaxSize;
var maxPreviewBreaks = 16;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  allowedJs = settings.allowBoardCustomJs;
  forceCaptcha = settings.forceCaptcha;
  latestPostCount = settings.latestPostCount;
  displayMaxSize = exports.formatFileSize(settings.maxFileSizeB);

};

exports.loadDependencies = function() {

  lang = require('../langOps').languagePack();
  templateHandler = require('../templateHandler');
  miscOps = require('../miscOps');

};

exports.formatFileSize = function(size) {

  if (size === Infinity) {
    return lang.guiUnlimited;
  }

  var orderIndex = 0;

  while (orderIndex < sizeOrders.length - 1 && size > 1023) {

    orderIndex++;
    size /= 1024;

  }

  return size.toFixed(2) + ' ' + sizeOrders[orderIndex];

};

exports.setFormCellBoilerPlate = function(cell, action, cssClass) {
  cell.method = 'post';
  cell.enctype = 'multipart/form-data';
  cell.action = action;
  cell.setAttribute('class', cssClass);
};

exports.removeElement = function(element) {
  element.parentNode.removeChild(element);
};

exports.setRoleSignature = function(postingCell, posting) {
  var labelRole = postingCell.getElementsByClassName('labelRole')[0];

  if (posting.signedRole) {
    labelRole.innerHTML = posting.signedRole;
  } else {
    exports.removeElement(labelRole);
  }
};

exports.getReportLink = function(report) {
  var link = '/' + report.boardUri + '/res/';
  link += report.threadId + '.html#';

  if (report.postId) {
    link += report.postId;
  } else {
    link += report.threadId;
  }

  return link;
};

exports.setPostingIp = function(cell, postingData, boardData, userRole) {

  var labelRange = cell.getElementsByClassName('labelRange')[0];
  labelRange.innerHTML = miscOps.getRange(postingData.ip).join('.');

  var labelIp = cell.getElementsByClassName('labelIp')[0];
  labelIp.innerHTML = miscOps.hashIpForDisplay(postingData.ip,
      boardData.ipSalt, userRole);

};

// Section 1: Date formatting functions {
exports.padDateField = function(value) {
  if (value < 10) {
    value = '0' + value;
  }

  return value;
};

exports.formatDateToDisplay = function(d, noTime) {
  var day = exports.padDateField(d.getUTCDate());

  var month = exports.padDateField(d.getUTCMonth() + 1);

  var year = d.getUTCFullYear();

  var toReturn = lang.guiDateFormat.replace('{$month}', month).replace(
      '{$day}', day).replace('{$year}', year);

  if (noTime) {
    return toReturn;
  }

  var weekDay = lang.guiWeekDays[d.getUTCDay()];

  var hour = exports.padDateField(d.getUTCHours());

  var minute = exports.padDateField(d.getUTCMinutes());

  var second = exports.padDateField(d.getUTCSeconds());

  return toReturn + ' (' + weekDay + ') ' + hour + ':' + minute + ':' + second;
};
// } Section 1: Date formatting functions

exports.setReportList = function(document, reports) {

  var reportDiv = document.getElementById('reportDiv');

  for (var i = 0; i < reports.length; i++) {
    var report = reports[i];

    var cell = document.createElement('form');

    cell.innerHTML = templateHandler.reportCell;

    exports.setFormCellBoilerPlate(cell, '/closeReport.js', 'reportCell');

    if (report.reason) {
      var reason = cell.getElementsByClassName('reasonLabel')[0];
      reason.innerHTML = report.reason;
    }

    var identifier = cell.getElementsByClassName('idIdentifier')[0];
    identifier.setAttribute('value', report._id);

    var reportLink = cell.getElementsByClassName('link')[0];
    reportLink.setAttribute('href', exports.getReportLink(report));

    reportDiv.appendChild(cell);

  }

};

exports.setCustomCss = function(board, document) {
  var link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('type', 'text/css');
  link.setAttribute('href', '/' + board + '/custom.css');
  document.getElementsByTagName('head')[0].appendChild(link);
};

exports.setCustomJs = function(board, document) {

  var script = document.createElement('script');
  script.setAttribute('src', '/' + board + '/custom.js');

  document.getElementsByTagName('body')[0].appendChild(script);
};

exports.setFlags = function(document, board, flagData) {

  if (!flagData || !flagData.length) {
    exports.removeElement(document.getElementById('flagsDiv'));

    return;
  }

  var combobox = document.getElementById('flagCombobox');

  var option = document.createElement('option');
  option.innerHTML = lang.guiNoFlag;
  option.value = '';
  combobox.appendChild(option);

  for (var i = 0; i < flagData.length; i++) {
    var flag = flagData[i];

    option = document.createElement('option');
    option.innerHTML = flag.name;
    option.value = flag._id;

    combobox.appendChild(option);
  }

};

exports.setBoardToggleableElements = function(boardData, document, thread) {
  var settings = boardData.settings;

  var captchaMode = boardData.captchaMode || 0;

  if ((captchaMode < 1 || (captchaMode < 2 && thread)) && !forceCaptcha) {
    exports.removeElement(document.getElementById('captchaDiv'));
  }

  if (settings.indexOf('forceAnonymity') > -1) {
    exports.removeElement(document.getElementById('divName'));
  }

  if (boardData.boardMarkdown && boardData.boardMarkdown.length) {
    document.getElementById('divMessage').innerHTML = boardData.boardMarkdown;
  } else {
    exports.removeElement(document.getElementById('panelMessage'));
  }
};

exports.setHeader = function(document, board, boardData, flagData, thread) {

  var titleHeader = document.getElementById('labelName');
  titleHeader.innerHTML = '/' + board + '/ - ' + boardData.boardName;

  var descriptionHeader = document.getElementById('labelDescription');
  descriptionHeader.innerHTML = boardData.boardDescription;

  var linkBanner = '/randomBanner.js?boardUri=' + board;
  document.getElementById('bannerImage').src = linkBanner;

  exports.setBoardToggleableElements(boardData, document, thread);

  if (boardData.usesCustomCss) {
    exports.setCustomCss(board, document);
  }

  if (boardData.usesCustomJs && allowedJs) {
    exports.setCustomJs(board, document);
  }

  exports.setFlags(document, board, flagData);

  document.getElementById('labelMaxFileSize').innerHTML = displayMaxSize;

};

exports.setSharedHideableElements = function(posting, cell) {

  var editedLabel = cell.getElementsByClassName('labelLastEdit')[0];

  if (posting.lastEditTime) {

    var formatedDate = exports.formatDateToDisplay(posting.lastEditTime);

    editedLabel.innerHTML = lang.guiEditInfo.replace('{$date}', formatedDate)
        .replace('{$login}', posting.lastEditLogin);

  } else {
    exports.removeElement(editedLabel);
  }

  var imgFlag = cell.getElementsByClassName('imgFlag')[0];

  if (posting.flag) {
    imgFlag.src = posting.flag;
    imgFlag.title = posting.flagName;
  } else {
    exports.removeElement(imgFlag);
  }

};

exports.addMessage = function(innerPage, cell, markdown, boardUri, threadId,
    postId) {

  if (!innerPage && (markdown.match(/<br>/g) || []).length > maxPreviewBreaks) {
    markdown = markdown.split('<br>', maxPreviewBreaks + 1).join('<br>');

    var link = cell.getElementsByClassName('linkFullText')[0];

    var href = '/' + boardUri + '/res/' + threadId + '.html';

    if (postId) {
      href += '#' + (postId || threadId);
    }

    link.href = href;

  } else {
    exports.removeElement(cell
        .getElementsByClassName('contentOmissionIndicator')[0]);
  }

  cell.getElementsByClassName('divMessage')[0].innerHTML = markdown;

};

// Section 2: Thread content {
exports.setThreadModdingElements = function(modding, boardUri, thread, cell,
    bData, userRole) {

  if (modding) {
    var editLink = '/edit.js?boardUri=' + boardUri;
    editLink += '&threadId=' + thread.threadId;

    cell.getElementsByClassName('linkEdit')[0].href = editLink;
  } else {
    exports.removeElement(cell.getElementsByClassName('linkEdit')[0]);
  }

  if (modding && thread.ip) {
    exports.setPostingIp(cell, thread, bData, userRole);
  } else {
    exports.removeElement(cell.getElementsByClassName('panelIp')[0]);
  }

};

exports.setThreadHiddeableElements = function(thread, cell, modding, boardUri,
    bData, userRole) {

  for ( var key in exports.indicatorsRelation) {
    if (!thread[key]) {
      exports.removeElement(cell
          .getElementsByClassName(exports.indicatorsRelation[key])[0]);
    }
  }

  if (thread.id) {
    cell.getElementsByClassName('labelId')[0].innerHTML = thread.id;
  } else {
    exports.removeElement(cell.getElementsByClassName('spanId')[0]);
  }

  exports.setThreadModdingElements(modding, boardUri, thread, cell, bData,
      userRole);

};

exports.assembleOmissionContent = function(thread, displayedImages,
    displayedPosts) {

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
};

exports.setOmittedInformation = function(thread, threadCell, posts, innerPage) {

  var omissionLabel = threadCell.getElementsByClassName('labelOmission')[0];

  var notEnougPosts = !thread.postCount;
  notEnougPosts = notEnougPosts || thread.postCount <= latestPostCount;

  if (innerPage || notEnougPosts) {
    exports.removeElement(omissionLabel);

    return;
  }

  var displayedPosts = posts.length;
  var displayedImages = 0;

  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];

    if (post.files) {

      displayedImages += post.files.length;
    }
  }

  omissionLabel.innerHTML = exports.assembleOmissionContent(thread,
      displayedImages, displayedPosts);
};

exports.getThreadCellBase = function(document, thread) {

  var threadCell = document.createElement('div');
  threadCell.innerHTML = templateHandler.opCell;
  threadCell.setAttribute('class', 'opCell');
  threadCell.id = thread.threadId;
  if (thread.files && thread.files.length > 1) {
    threadCell.className += ' multipleUploads';
  }

  return threadCell;
};

exports.addThread = function(document, thread, posts, innerPage, modding,
    boardData, userRole) {

  var boardUri = thread.boardUri;

  var threadCell = exports.getThreadCellBase(document, thread);
  threadCell.setAttribute('data-boarduri', boardUri);

  exports.setOmittedInformation(thread, threadCell, posts, innerPage);

  exports.setSharedHideableElements(thread, threadCell);

  exports.setThreadLinks(threadCell, thread, boardUri, innerPage);

  exports.setThreadComplexElements(boardUri, thread, threadCell, innerPage);

  exports.setThreadHiddeableElements(thread, threadCell, modding, boardUri,
      boardData, userRole);

  exports.setThreadSimpleElements(threadCell, thread, innerPage);

  exports.setUploadCell(document, threadCell
      .getElementsByClassName('panelUploads')[0], thread.files, modding);

  document.getElementById('divThreads').appendChild(threadCell);

  exports.addPosts(document, posts || [], boardUri, thread.threadId, modding,
      threadCell.getElementsByClassName('divPosts')[0], boardData, userRole,
      innerPage);
};

// Section 2.1: Post content {
exports.setPostHideableElements = function(postCell, post) {

  var subjectLabel = postCell.getElementsByClassName('labelSubject')[0];
  if (post.subject) {
    subjectLabel.innerHTML = post.subject;
  } else {
    exports.removeElement(subjectLabel);
  }

  if (post.id) {
    postCell.getElementsByClassName('labelId')[0].innerHTML = post.id;
  } else {
    exports.removeElement(postCell.getElementsByClassName('spanId')[0]);
  }

  var banMessageLabel = postCell.getElementsByClassName('divBanMessage')[0];

  if (!post.banMessage) {
    exports.removeElement(banMessageLabel);
  } else {
    banMessageLabel.innerHTML = post.banMessage;
  }

  exports.setSharedHideableElements(post, postCell);
};

exports.setPostLinks = function(postCell, post, boardUri, link, threadId,
    linkQuote, deletionCheckbox) {

  var linkStart = '/' + boardUri + '/res/' + threadId + '.html#';
  link.href = linkStart + post.postId;
  linkQuote.href = linkStart + 'q' + post.postId;

  var checkboxName = boardUri + '-' + threadId + '-' + post.postId;
  deletionCheckbox.setAttribute('name', checkboxName);

  var linkPreview = '/' + boardUri + '/preview/' + post.postId + '.html';

  postCell.getElementsByClassName('linkPreview')[0].href = linkPreview;
};

exports.setPostComplexElements = function(postCell, post, boardUri, threadId,
    document, preview, modding) {

  exports.setRoleSignature(postCell, post);

  var link = postCell.getElementsByClassName('linkSelf')[0];

  var linkQuote = postCell.getElementsByClassName('linkQuote')[0];
  linkQuote.innerHTML = post.postId;

  var deletionCheckbox = postCell.getElementsByClassName('deletionCheckBox')[0];

  if (!preview) {
    exports.setPostLinks(postCell, post, boardUri, link, threadId, linkQuote,
        deletionCheckbox);
  } else {
    exports.removeElement(deletionCheckbox);
    exports.removeElement(postCell.getElementsByClassName('linkPreview')[0]);
  }

  exports.setUploadCell(document, postCell
      .getElementsByClassName('panelUploads')[0], post.files, modding);
};

exports.setPostModElements = function(post, modding, postCell, boardUri,
    threadId, boardData, userRole) {

  if (modding && post.ip) {
    exports.setPostingIp(postCell, post, boardData, userRole);
  } else {
    exports.removeElement(postCell.getElementsByClassName('panelIp')[0]);
  }

  if (modding) {
    var editLink = '/edit.js?boardUri=' + boardUri + '&postId=' + post.postId;

    postCell.getElementsByClassName('linkEdit')[0].href = editLink;
  } else {
    exports.removeElement(postCell.getElementsByClassName('linkEdit')[0]);
  }
};

exports.setPostInnerElements = function(document, boardUri, threadId, post,
    postCell, preview, modding, boardData, userRole, innerPage) {

  var linkName = postCell.getElementsByClassName('linkName')[0];

  linkName.innerHTML = post.name;

  if (post.email) {
    linkName.href = 'mailto:' + post.email;
  } else {
    linkName.className += ' noEmailName';
  }

  var labelCreated = postCell.getElementsByClassName('labelCreated')[0];
  labelCreated.innerHTML = exports.formatDateToDisplay(post.creation);

  exports.addMessage(innerPage, postCell, post.markdown, boardUri, threadId,
      post.postId);

  exports.setPostHideableElements(postCell, post);

  exports.setPostModElements(post, modding, postCell, boardUri, threadId,
      boardData, userRole);

  exports.setPostComplexElements(postCell, post, boardUri, threadId, document,
      preview, modding);
};

exports.addPosts = function(document, posts, boardUri, threadId, modding,
    divPosts, boardData, userRole, innerPage) {

  for (var i = 0; i < posts.length; i++) {
    var postCell = document.createElement('div');
    postCell.innerHTML = templateHandler.postCell;
    postCell.setAttribute('class', 'postCell');
    postCell.setAttribute('data-boarduri', boardUri);

    var post = posts[i];
    if (post.files && post.files.length > 1) {
      postCell.className += ' multipleUploads';
    }

    postCell.id = post.postId;

    exports.setPostInnerElements(document, boardUri, threadId, post, postCell,
        false, modding, boardData, userRole, innerPage);

    divPosts.appendChild(postCell);
  }
};

// } Section 2.1: Post content
exports.setThreadLinks = function(threadCell, thread, boardUri, innerPage) {

  var linkReply = threadCell.getElementsByClassName('linkReply')[0];
  if (innerPage) {
    exports.removeElement(linkReply);
  } else {
    linkReply.href = '/' + boardUri + '/res/' + thread.threadId + '.html';
  }

  var linkPreview = '/' + boardUri + '/preview/' + thread.threadId + '.html';

  threadCell.getElementsByClassName('linkPreview')[0].href = linkPreview;

  var linkSelf = threadCell.getElementsByClassName('linkSelf')[0];

  var linkQuote = threadCell.getElementsByClassName('linkQuote')[0];
  linkQuote.innerHTML = thread.threadId;

  var linkStart = '/' + boardUri + '/res/' + thread.threadId + '.html#';
  linkSelf.href = linkStart + thread.threadId;
  linkQuote.href = linkStart + 'q' + thread.threadId;
};

exports.setThreadComplexElements = function(boardUri, thread, threadCell) {

  exports.setRoleSignature(threadCell, thread);

  var banMessageLabel = threadCell.getElementsByClassName('divBanMessage')[0];

  if (!thread.banMessage) {
    exports.removeElement(banMessageLabel);
  } else {
    banMessageLabel.innerHTML = thread.banMessage;
  }

  threadCell.getElementsByClassName('deletionCheckBox')[0].setAttribute('name',
      boardUri + '-' + thread.threadId);
};

exports.setThreadSimpleElements = function(threadCell, thread, innerPage) {

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
    exports.removeElement(subjectLabel);
  }

  var labelCreation = threadCell.getElementsByClassName('labelCreated')[0];
  labelCreation.innerHTML = exports.formatDateToDisplay(thread.creation);

  exports.addMessage(innerPage, threadCell, thread.markdown, thread.boardUri,
      thread.threadId);

};

// Section 2.2: Uploads {
exports.setUploadAttributes = function(file, thumbLink) {

  if (file.width) {
    thumbLink.setAttribute('data-filewidth', file.width);
    thumbLink.setAttribute('data-fileheight', file.height);
  }

  thumbLink.setAttribute('data-filemime', file.mime);
};

exports.setUploadLinks = function(document, cell, file) {

  var thumbLink = cell.getElementsByClassName('imgLink')[0];
  thumbLink.href = file.path;

  exports.setUploadAttributes(file, thumbLink);

  var img = document.createElement('img');
  img.src = file.thumb;

  thumbLink.appendChild(img);

  var nameLink = cell.getElementsByClassName('nameLink')[0];
  nameLink.href = file.path;

  var originalLink = cell.getElementsByClassName('originalNameLink')[0];
  originalLink.innerHTML = file.originalName;
  originalLink.href = file.path + '/alias/' + file.originalName;
};

exports.setUploadModElements = function(modding, cell, file) {

  if (!modding) {
    exports.removeElement(cell.getElementsByClassName('divHash')[0]);
  } else {
    cell.getElementsByClassName('labelHash')[0].innerHTML = file.md5;
  }
};

exports.getUploadCellBase = function(document) {

  var cell = document.createElement('figure');
  cell.innerHTML = templateHandler.uploadCell;
  cell.setAttribute('class', 'uploadCell');

  return cell;
};

exports.setUploadCell = function(document, node, files, modding) {

  if (!files) {
    return;
  }

  for (var i = 0; i < files.length; i++) {
    var file = files[i];

    var cell = exports.getUploadCellBase(document);

    exports.setUploadLinks(document, cell, file);

    exports.setUploadModElements(modding, cell, file);

    var sizeString = exports.formatFileSize(file.size);
    cell.getElementsByClassName('sizeLabel')[0].innerHTML = sizeString;

    var dimensionLabel = cell.getElementsByClassName('dimensionLabel')[0];

    if (file.width) {
      dimensionLabel.innerHTML = file.width + 'x' + file.height;
    } else {
      exports.removeElement(dimensionLabel);
    }

    node.appendChild(cell);
  }
};
// } Section 2.2: Uploads

// } Section 2: Thread content

// Section 3: Ban div {
exports.setBanCell = function(ban, cell) {

  if (ban.appeal) {
    var label = cell.getElementsByClassName('appealLabel')[0];
    label.innerHTML = ban.appeal;
  } else {
    exports.removeElement(cell.getElementsByClassName('appealPanel')[0]);
  }

  if (!ban.denied && ban.appeal) {
    cell.getElementsByClassName('denyIdentifier')[0].setAttribute('value',
        ban._id);
  } else {
    exports.removeElement(cell.getElementsByClassName('denyForm')[0]);
  }

  cell.getElementsByClassName('idLabel')[0].innerHTML = ban._id;

  cell.getElementsByClassName('reasonLabel')[0].innerHTML = ban.reason;

  var expirationLabel = cell.getElementsByClassName('expirationLabel')[0];
  expirationLabel.innerHTML = exports.formatDateToDisplay(ban.expiration);

  var appliedByLabel = cell.getElementsByClassName('appliedByLabel')[0];
  appliedByLabel.innerHTML = ban.appliedBy;

  cell.getElementsByClassName('liftIdentifier')[0].setAttribute('value',
      ban._id);

};

exports.setBanList = function(document, div, bans) {

  for (var i = 0; i < bans.length; i++) {

    var ban = bans[i];
    var cell = document.createElement('div');
    cell.innerHTML = templateHandler.banCell;

    cell.setAttribute('class', 'banCell');

    exports.setBanCell(ban, cell);
    div.appendChild(cell);
  }

};
// } Section 3: Ban div
