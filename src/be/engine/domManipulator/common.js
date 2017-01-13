'use strict';

// contains common operations to the multiple parts of the domManipulator module
var kernel = require('../../kernel');
var individualCaches = !kernel.debug();
individualCaches = individualCaches && !kernel.feDebug();
var allowedJs;
var forceCaptcha;
var lang;
var db = require('../../db');
var threadsCollection = db.threads();
var postsCollection = db.posts();
var templateHandler;
var miscOps;
var maxAllowedFiles;
var clearIpRole;
var minClearIpRole;
var maxFileSizeMB;
var messageLength;

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

  clearIpRole = settings.clearIpMinRole;
  messageLength = settings.messageLength;
  maxAllowedFiles = settings.maxFiles;
  minClearIpRole = settings.clearIpMinRole;
  allowedJs = settings.allowBoardCustomJs;
  forceCaptcha = settings.forceCaptcha;
  maxFileSizeMB = settings.maxFileSizeMB;
  displayMaxSize = exports.formatFileSize(settings.maxFileSizeB);

};

exports.loadDependencies = function() {

  lang = require('../langOps').languagePack;
  templateHandler = require('../templateHandler').getTemplates;
  miscOps = require('../miscOps');

};

exports.formatFileSize = function(size, language) {

  if (size === Infinity) {
    return lang(language).guiUnlimited;
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

exports.setPostingIp = function(cell, postingData, boardData, userRole) {

  if (userRole <= minClearIpRole) {
    exports.removeElement(cell.getElementsByClassName('panelRange')[0]);
  } else {
    var labelBroadRange = cell.getElementsByClassName('labelBroadRange')[0];
    labelBroadRange.innerHTML = miscOps.hashIpForDisplay(miscOps
        .getRange(postingData.ip), boardData.ipSalt);

    var labelNarrowRange = cell.getElementsByClassName('labelNarrowRange')[0];
    labelNarrowRange.innerHTML = miscOps.hashIpForDisplay(miscOps.getRange(
        postingData.ip, true), boardData.ipSalt);
  }

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

exports.formatDateToDisplay = function(d, noTime, language) {
  var day = exports.padDateField(d.getUTCDate());

  var month = exports.padDateField(d.getUTCMonth() + 1);

  var year = d.getUTCFullYear();

  var toReturn = lang(language).guiDateFormat.replace('{$month}', month)
      .replace('{$day}', day).replace('{$year}', year);

  if (noTime) {
    return toReturn;
  }

  var weekDay = lang(language).guiWeekDays[d.getUTCDay()];

  var hour = exports.padDateField(d.getUTCHours());

  var minute = exports.padDateField(d.getUTCMinutes());

  var second = exports.padDateField(d.getUTCSeconds());

  return toReturn + ' (' + weekDay + ') ' + hour + ':' + minute + ':' + second;
};
// } Section 1: Date formatting functions

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

exports.setFlags = function(document, board, flagData, language) {

  if (!flagData || !flagData.length) {
    exports.removeElement(document.getElementById('flagsDiv'));

    return;
  }

  var combobox = document.getElementById('flagCombobox');

  var option = document.createElement('option');
  option.innerHTML = lang(language).guiNoFlag;
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

exports.setBoardPosting = function(boardData, document, thread, language) {

  var settings = boardData.settings;

  var captchaMode = boardData.captchaMode || 0;

  if ((captchaMode < 1 || (captchaMode < 2 && thread)) && !forceCaptcha) {
    exports.removeElement(document.getElementById('captchaDiv'));
  }

  if (settings.indexOf('forceAnonymity') > -1) {
    exports.removeElement(document.getElementById('divName'));
  }

  var locationFlagMode = boardData.locationFlagMode || 0;

  if (locationFlagMode !== 1) {
    exports.removeElement(document.getElementById('noFlagDiv'));
  }

  if (settings.indexOf('textBoard') > -1) {
    exports.removeElement(document.getElementById('divUpload'));
  } else {
    exports.setFileLimits(document, boardData, language);
  }

  var boardIdentifyInput = document.getElementById('boardIdentifier');

  boardIdentifyInput.setAttribute('value', boardData.boardUri);

  document.getElementById('labelMessageLength').innerHTML = messageLength;

};

exports.setSharedHideableElements = function(posting, cell, language) {

  var editedLabel = cell.getElementsByClassName('labelLastEdit')[0];

  if (posting.lastEditTime) {

    var formatedDate = exports.formatDateToDisplay(posting.lastEditTime, null,
        language);

    editedLabel.innerHTML = lang(language).guiEditInfo.replace('{$date}',
        formatedDate).replace('{$login}', posting.lastEditLogin);

  } else {
    exports.removeElement(editedLabel);
  }

  var imgFlag = cell.getElementsByClassName('imgFlag')[0];

  if (posting.flag) {
    imgFlag.src = posting.flag;
    imgFlag.title = posting.flagName;

    if (posting.flagCode) {
      imgFlag.className += ' flag' + posting.flagCode;
    }
  } else {
    exports.removeElement(imgFlag);
  }

};

exports.addMessage = function(innerPage, cell, post) {

  var markdown = post.markdown;

  if (!innerPage && (markdown.match(/<br>/g) || []).length > maxPreviewBreaks) {
    markdown = markdown.split('<br>', maxPreviewBreaks + 1).join('<br>');

    var link = cell.getElementsByClassName('linkFullText')[0];

    var href = '/' + post.boardUri + '/res/' + post.threadId + '.html';

    if (post.postId) {
      href += '#' + (post.postId || post.threadId);
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
    var labelId = cell.getElementsByClassName('labelId')[0];
    labelId.setAttribute('style', 'background-color: #' + thread.id);
    labelId.innerHTML = thread.id;
  } else {
    exports.removeElement(cell.getElementsByClassName('spanId')[0]);
  }

  exports.setThreadModdingElements(modding, boardUri, thread, cell, bData,
      userRole);

};

exports.assembleOmissionContent = function(thread, displayedImages,
    displayedPosts, language) {

  var pieces = lang(language).guiOmittedInfo;
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

exports.setOmittedInformation = function(thread, threadCell, posts, innerPage,
    language) {

  var omissionLabel = threadCell.getElementsByClassName('labelOmission')[0];

  if (innerPage || (thread.postCount || 0) <= (posts ? posts.length : 0)) {
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
      displayedImages, displayedPosts, language);
};

exports.getThreadCellBase = function(document, thread) {

  var threadCell = document.createElement('div');

  threadCell.setAttribute('data-boarduri', thread.boardUri);
  threadCell.setAttribute('class', 'opCell');
  threadCell.id = thread.threadId;
  if (thread.files && thread.files.length > 1) {
    threadCell.className += ' multipleUploads';
  }

  return threadCell;
};

exports.setThreadContent = function(thread, threadCell, posts, innerPage,
    boardUri, modding, userRole, document, boardData, language) {

  exports.setOmittedInformation(thread, threadCell, posts, innerPage, language);

  exports.setSharedHideableElements(thread, threadCell, language);

  exports.setThreadLinks(threadCell, thread, boardUri, innerPage);

  exports.setThreadComplexElements(boardUri, thread, threadCell, innerPage);

  exports.setThreadHiddeableElements(thread, threadCell, modding, boardUri,
      boardData, userRole);

  exports.setThreadSimpleElements(threadCell, thread, innerPage, language);

  exports.setUploadCell(document, threadCell
      .getElementsByClassName('panelUploads')[0], thread.files, modding,
      language);

};

exports.addThread = function(document, thread, posts, innerPage, modding,
    boardData, userRole, language) {

  var boardUri = thread.boardUri;

  var threadCell = exports.getThreadCellBase(document, thread);

  var cacheField = exports.getCacheField(false, innerPage, modding, userRole,
      language);

  var currentCache = exports.getPostingCache(cacheField, thread, language);

  if (!currentCache || !individualCaches) {
    threadCell.innerHTML = templateHandler(language).opCell;

    exports.setThreadContent(thread, threadCell, posts, innerPage, boardUri,
        modding, userRole, document, boardData, language);

    if (individualCaches) {
      exports.saveCache(cacheField, language, threadCell, threadsCollection,
          boardUri, 'threadId', thread.threadId);
    }

  } else {
    threadCell.innerHTML = currentCache;
  }

  document.getElementById('divThreads').appendChild(threadCell);

  exports.addPosts(document, posts || [], modding, threadCell
      .getElementsByClassName('divPosts')[0], boardData, userRole, innerPage,
      language);
};

// Section 2.1: Post content {
exports.setPostHideableElements = function(postCell, post, language) {

  var subjectLabel = postCell.getElementsByClassName('labelSubject')[0];
  if (post.subject) {
    subjectLabel.innerHTML = post.subject;
  } else {
    exports.removeElement(subjectLabel);
  }

  if (post.id) {
    var labelId = postCell.getElementsByClassName('labelId')[0];
    labelId.setAttribute('style', 'background-color: #' + post.id);
    labelId.innerHTML = post.id;
  } else {
    exports.removeElement(postCell.getElementsByClassName('spanId')[0]);
  }

  var banMessageLabel = postCell.getElementsByClassName('divBanMessage')[0];

  if (!post.banMessage) {
    exports.removeElement(banMessageLabel);
  } else {
    banMessageLabel.innerHTML = post.banMessage;
  }

  exports.setSharedHideableElements(post, postCell, language);
};

exports.setPostLinks = function(postCell, post, preview) {

  var link = postCell.getElementsByClassName('linkSelf')[0];

  var linkQuote = postCell.getElementsByClassName('linkQuote')[0];
  linkQuote.innerHTML = post.postId;

  var linkStart = '/' + post.boardUri + '/res/' + post.threadId + '.html#';
  link.href = linkStart + post.postId;
  linkQuote.href = linkStart + 'q' + post.postId;

  var linkPreview = '/' + post.boardUri + '/preview/' + post.postId + '.html';
  var deletionCheckbox = postCell.getElementsByClassName('deletionCheckBox')[0];

  if (!preview) {

    var checkboxName = post.boardUri + '-' + post.threadId + '-' + post.postId;
    deletionCheckbox.setAttribute('name', checkboxName);

    postCell.getElementsByClassName('linkPreview')[0].href = linkPreview;
  } else {
    exports.removeElement(postCell.getElementsByClassName('linkPreview')[0]);
    exports.removeElement(deletionCheckbox);
  }
};

exports.setPostComplexElements = function(postCell, post, document, preview,
    modding, language) {

  exports.setRoleSignature(postCell, post);

  exports.setPostLinks(postCell, post, preview);

  exports
      .setUploadCell(document,
          postCell.getElementsByClassName('panelUploads')[0], post.files,
          modding, language);
};

exports.setPostModElements = function(post, modding, postCell, boardData,
    userRole) {

  if (modding && post.ip) {
    exports.setPostingIp(postCell, post, boardData, userRole);
  } else {
    exports.removeElement(postCell.getElementsByClassName('panelIp')[0]);
  }

  if (modding) {
    var editLink = '/edit.js?boardUri=' + boardData.boardUri + '&postId=';
    editLink += post.postId;

    postCell.getElementsByClassName('linkEdit')[0].href = editLink;
  } else {
    exports.removeElement(postCell.getElementsByClassName('linkEdit')[0]);
  }
};

exports.setPostLinkName = function(postCell, post) {

  var linkName = postCell.getElementsByClassName('linkName')[0];

  linkName.innerHTML = post.name;

  if (post.email) {
    linkName.href = 'mailto:' + post.email;
  } else {
    linkName.className += ' noEmailName';
  }

};

exports.generatePostHTML = function(postCell, post, language, innerPage,
    modding, document, preview, boardData, userRole, cacheField) {

  postCell.innerHTML = templateHandler(language).postCell;

  exports.setPostLinkName(postCell, post);

  var labelCreated = postCell.getElementsByClassName('labelCreated')[0];
  labelCreated.innerHTML = exports.formatDateToDisplay(post.creation, null,
      language);

  exports.addMessage(innerPage, postCell, post);

  exports.setPostHideableElements(postCell, post, language);

  exports.setPostModElements(post, modding, postCell, boardData, userRole);

  exports.setPostComplexElements(postCell, post, document, preview, modding,
      language);

  if (individualCaches) {

    var isAThread = post.threadId === post.postId;

    exports.saveCache(cacheField, language, postCell,
        isAThread ? threadsCollection : postsCollection, post.boardUri,
        isAThread ? 'threadId' : 'postId', post.postId);
  }

};

exports.setPostInnerElements = function(document, post, postCell, preview,
    modding, boardData, userRole, innerPage, language) {

  var cacheField = exports.getCacheField(preview, innerPage, modding, userRole,
      language);

  var currentCache = exports.getPostingCache(cacheField, post, language);

  if (individualCaches && currentCache) {

    postCell.innerHTML = currentCache;
    return;
  }

  exports.generatePostHTML(postCell, post, language, innerPage, modding,
      document, preview, boardData, userRole, cacheField);
};

exports.getCacheField = function(preview, innerPage, modding, userRole,
    language) {

  var toReturn;

  if (preview) {
    toReturn = 'previewCache';
  } else if (!innerPage) {
    toReturn = 'outerCache';
  } else if (!modding) {
    toReturn = 'innerCache';
  } else if (userRole <= clearIpRole) {
    toReturn = 'clearCache';
  } else {
    toReturn = 'hashedCache';
  }

  if (language) {
    toReturn += language.headerValues.join('-');
  }

  return toReturn;

};

exports.getPostingCache = function(field, posting, language) {

  if (!language) {
    return posting[field];
  } else {
    return (posting.alternativeCaches || {})[field];
  }

};

exports.saveCache = function(cacheField, language, cell, collection, boardUri,
    postingIdField, postingId) {

  var updateBlock = {
    $set : {}
  };

  if (!language) {
    updateBlock.$set[cacheField] = cell.innerHTML;
  } else {
    var key = 'alternativeCaches.' + cacheField;

    updateBlock.$set[key] = cell.innerHTML;
  }

  var queryBlock = {
    boardUri : boardUri
  };

  queryBlock[postingIdField] = postingId;

  collection.updateOne(queryBlock, updateBlock);

};

exports.getPostCellBase = function(document, post) {

  var postCell = document.createElement('div');
  postCell.setAttribute('class', 'postCell');
  postCell.setAttribute('data-boarduri', post.boardUri);
  postCell.id = post.postId;

  if (post.files && post.files.length > 1) {
    postCell.className += ' multipleUploads';
  }

  return postCell;

};

exports.addPosts = function(document, posts, modding, divPosts, boardData,
    userRole, innerPage, language) {

  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];

    var postCell = exports.getPostCellBase(document, post);

    exports.setPostInnerElements(document, post, postCell, false, modding,
        boardData, userRole, innerPage, language);

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

exports.setThreadSimpleElements = function(threadCell, thread, innerPage,
    language) {

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
  labelCreation.innerHTML = exports.formatDateToDisplay(thread.creation, null,
      language);

  exports.addMessage(innerPage, threadCell, thread);

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
  originalLink.href = file.path;
  originalLink.setAttribute('download', file.originalName);
};

exports.setUploadModElements = function(modding, cell, file) {

  if (!modding) {
    exports.removeElement(cell.getElementsByClassName('divHash')[0]);
  } else {
    cell.getElementsByClassName('labelHash')[0].innerHTML = file.md5;
  }
};

exports.getUploadCellBase = function(document, language) {

  var cell = document.createElement('figure');
  cell.innerHTML = templateHandler(language).uploadCell;
  cell.setAttribute('class', 'uploadCell');

  return cell;
};

exports.setUploadCell = function(document, node, files, modding, language) {

  if (!files) {
    return;
  }

  for (var i = 0; i < files.length; i++) {
    var file = files[i];

    var cell = exports.getUploadCellBase(document, language);

    exports.setUploadLinks(document, cell, file);

    exports.setUploadModElements(modding, cell, file);

    var sizeString = exports.formatFileSize(file.size, language);
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
exports.setBanCell = function(ban, cell, language) {

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
  expirationLabel.innerHTML = exports.formatDateToDisplay(ban.expiration, null,
      language);

  var appliedByLabel = cell.getElementsByClassName('appliedByLabel')[0];
  appliedByLabel.innerHTML = ban.appliedBy;

  cell.getElementsByClassName('liftIdentifier')[0].setAttribute('value',
      ban._id);

};

exports.setBanList = function(document, div, bans, language) {

  for (var i = 0; i < bans.length; i++) {

    var ban = bans[i];
    var cell = document.createElement('div');
    cell.innerHTML = templateHandler(language).banCell;

    cell.setAttribute('class', 'banCell');

    exports.setBanCell(ban, cell, language);
    div.appendChild(cell);
  }

};
// } Section 3: Ban div

// Section 4: Header {
exports.setFileLimits = function(document, bData, language) {

  var fileLimitToUse;

  if (bData.maxFiles) {
    fileLimitToUse = bData.maxFiles < maxAllowedFiles ? bData.maxFiles
        : maxAllowedFiles;
  } else {
    fileLimitToUse = maxAllowedFiles;
  }

  document.getElementById('labelMaxFiles').innerHTML = fileLimitToUse;

  var sizeToUse;

  if (bData.maxFileSizeMB && bData.maxFileSizeMB < maxFileSizeMB) {
    sizeToUse = exports.formatFileSize(bData.maxFileSizeMB * 1048576, language);
  } else {
    sizeToUse = displayMaxSize;
  }

  document.getElementById('labelMaxFileSize').innerHTML = sizeToUse;

};

exports.setBoardCustomization = function(boardData, document, board) {

  var descriptionHeader = document.getElementById('labelDescription');
  descriptionHeader.innerHTML = boardData.boardDescription;

  if (boardData.usesCustomCss) {
    exports.setCustomCss(board, document);
  }

  if (boardData.usesCustomJs && allowedJs) {
    exports.setCustomJs(board, document);
  }

  if (boardData.boardMarkdown && boardData.boardMarkdown.length) {
    document.getElementById('divMessage').innerHTML = boardData.boardMarkdown;
  } else {
    exports.removeElement(document.getElementById('panelMessage'));
  }

};

exports.setHeader = function(document, board, boardData, flagData, thread,
    language) {

  var titleHeader = document.getElementById('labelName');
  titleHeader.innerHTML = '/' + board + '/ - ' + boardData.boardName;

  var linkBanner = '/randomBanner.js?boardUri=' + board;
  document.getElementById('bannerImage').src = linkBanner;

  exports.setBoardPosting(boardData, document, thread, language);

  exports.setBoardCustomization(boardData, document, board);

  exports.setFlags(document, board, flagData, language);

};
// } Section 4: Header

// Setion 5: Open reports {
exports.getReportLink = function(report) {

  var link = '/mod.js?boardUri=' + report.boardUri + '&threadId=';
  link += report.threadId + '#';

  if (report.postId) {
    link += report.postId;
  } else {
    link += report.threadId;
  }

  return link;

};

exports.setReportCell = function(document, report, language) {

  var cell = document.createElement('div');
  cell.setAttribute('class', 'reportCell');

  cell.innerHTML = templateHandler(language).reportCell;

  if (report.reason) {
    var reason = cell.getElementsByClassName('reasonLabel')[0];
    reason.innerHTML = report.reason;
  }

  var checkbox = cell.getElementsByClassName('closureCheckbox')[0];
  checkbox.setAttribute('name', 'report-' + report._id);

  var reportLink = cell.getElementsByClassName('link')[0];
  reportLink.setAttribute('href', exports.getReportLink(report));

  var posting = report.associatedPost;

  if (posting) {

    exports.setPostInnerElements(document, posting, cell
        .getElementsByClassName('postingDiv')[0], true, null, null, null, null,
        language);
  }

  return cell;

};

exports.setReportList = function(document, reports, language) {

  var reportDiv = document.getElementById('reportDiv');

  for (var i = 0; i < reports.length; i++) {
    reportDiv
        .appendChild(exports.setReportCell(document, reports[i], language));
  }

};
// } Section 5: Open reports
