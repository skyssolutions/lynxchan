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
var globalBoardModeration;
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

  globalBoardModeration = settings.allowGlobalBoardModeration;
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

exports.setRoleSignature = function(postingCell, posting, removable) {

  if (posting.signedRole) {
    postingCell = postingCell.replace('__labelRole_location__',
        removable.labelRole).replace('__labelRole_inner__', posting.signedRole);

  } else {
    postingCell = postingCell.replace('__labelRole_location__', '');
  }

  return postingCell;

};

exports.setPostingIp = function(cell, postingData, boardData, userRole,
    removable) {

  if (userRole <= minClearIpRole) {
    cell = cell.replace('__panelRange_location__', '');
  } else {
    cell = cell.replace('__panelRange_location__', removable.panelRange);

    cell = cell.replace('__labelBroadRange_inner__', miscOps.hashIpForDisplay(
        miscOps.getRange(postingData.ip), boardData.ipSalt));

    cell = cell.replace('__labelNarrowRange_inner__', miscOps.hashIpForDisplay(
        miscOps.getRange(postingData.ip, true), boardData.ipSalt));
  }

  cell = cell.replace('__labelIp_inner__', miscOps.hashIpForDisplay(
      postingData.ip, boardData.ipSalt, userRole));

  return cell;

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
    document.getElementById('flagsDiv').remove();

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
    document.getElementById('captchaDiv').remove();
  }

  if (settings.indexOf('forceAnonymity') > -1) {
    document.getElementById('divName').remove();
  }

  var locationFlagMode = boardData.locationFlagMode || 0;

  if (locationFlagMode !== 1) {
    document.getElementById('noFlagDiv').remove();
  }

  if (settings.indexOf('textBoard') > -1) {
    document.getElementById('divUpload').remove();
  } else {
    exports.setFileLimits(document, boardData, language);
  }

  var boardIdentifyInput = document.getElementById('boardIdentifier');

  boardIdentifyInput.setAttribute('value', boardData.boardUri);

  document.getElementById('labelMessageLength').innerHTML = messageLength;

};

exports.setSharedHideableElements = function(posting, removable,
    postingCellcell, language) {

  if (posting.lastEditTime) {

    var formatedDate = exports.formatDateToDisplay(posting.lastEditTime, null,
        language);

    postingCellcell = postingCellcell.replace('__labelLastEdit_location__',
        removable.labelLastEdit).replace(
        '__labelLastEdit_inner__',
        lang(language).guiEditInfo.replace('{$date}', formatedDate).replace(
            '{$login}', posting.lastEditLogin));

  } else {
    postingCellcell = postingCellcell.replace('__labelLastEdit_location__', '');
  }

  if (posting.flag) {

    postingCellcell = postingCellcell.replace('__imgFlag_location__',
        removable.imgFlag);

    postingCellcell = postingCellcell.replace('__imgFlag_src__', posting.flag);
    postingCellcell = postingCellcell.replace('__imgFlag_title__',
        posting.flagName);

    if (posting.flagCode) {

      var flagClass = ' flag' + posting.flagCode;

      postingCellcell = postingCellcell
          .replace(' __imgFlag_class__', flagClass);
    } else {
      postingCellcell = postingCellcell.replace(' __imgFlag_class__', '');
    }

  } else {
    postingCellcell = postingCellcell.replace('__imgFlag_location__', '');
  }

  return postingCellcell;

};

exports.addMessage = function(innerPage, cell, post, removable) {

  var markdown = post.markdown;

  if (!innerPage && (markdown.match(/<br>/g) || []).length > maxPreviewBreaks) {

    cell = cell.replace('__contentOmissionIndicator_location__',
        removable.contentOmissionIndicator);

    markdown = markdown.split('<br>', maxPreviewBreaks + 1).join('<br>');

    var href = '/' + post.boardUri + '/res/' + post.threadId + '.html';

    if (post.postId) {
      href += '#' + (post.postId || post.threadId);
    }

    cell = cell.replace('__linkFullText_href__', href);

  } else {
    cell = cell.replace('__contentOmissionIndicator_location__', '');
  }

  return cell.replace('__divMessage_inner__', markdown);

};

// Section 2: Thread content {
exports.setThreadModdingElements = function(modding, boardUri, thread, cell,
    bData, userRole, removable) {

  if (modding) {
    var editLink = '/edit.js?boardUri=' + boardUri;
    editLink += '&threadId=' + thread.threadId;

    cell = cell.replace('__linkEdit_location__', removable.linkEdit).replace(
        '__linkEdit_href__', editLink);
  } else {
    cell = cell.replace('__linkEdit_location__', '');
  }

  if (modding && thread.ip) {
    cell = cell.replace('__panelIp_location__', removable.panelIp);
    cell = exports.setPostingIp(cell, thread, bData, userRole, removable);
  } else {
    cell = cell.replace('__panelIp_location__', '');
  }

  return cell;

};

exports.setThreadHiddeableElements = function(thread, cell, modding, boardUri,
    bData, userRole, removable) {

  for ( var key in exports.indicatorsRelation) {
    var location = '__' + exports.indicatorsRelation[key] + '_location__';

    if (!thread[key]) {
      cell = cell.replace(location, '');
    } else {
      cell = cell.replace(location, removable[exports.indicatorsRelation[key]]);

    }
  }

  if (thread.id) {
    cell = cell.replace('__spanId_location__', removable.spanId).replace(
        '__labelId_inner__', thread.id).replace('__labelId_style__',
        'background-color: #' + thread.id);
  } else {
    cell = cell.replace('__spanId_location__', '');
  }

  cell = exports.setThreadModdingElements(modding, boardUri, thread, cell,
      bData, userRole, removable);

  return cell;

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

exports.setOmittedInformation = function(thread, posts, innerPage, language) {

  var template = templateHandler(language, true).opCell;

  var threadCell = template.template;

  if (innerPage || (thread.postCount || 0) <= (posts ? posts.length : 0)) {
    return threadCell.replace('__labelOmission_location__', '');
  }

  threadCell = threadCell.replace('__labelOmission_location__',
      template.removable.labelOmission);

  var displayedPosts = posts.length;
  var displayedImages = 0;

  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];

    if (post.files) {

      displayedImages += post.files.length;
    }
  }

  return threadCell.replace('__labelOmission_inner__', exports
      .assembleOmissionContent(thread, displayedImages, displayedPosts,
          language));

};

exports.getThreadCellBase = function(thread, language) {

  var classToUse = 'opCell';

  if (thread.files && thread.files.length > 1) {
    classToUse += ' multipleUploads';
  }

  var threadCell = '<div class=\'' + classToUse + '\' data-boarduri=\'';
  threadCell += thread.boardUri + '\' id=\'' + thread.threadId + '\'>';

  return threadCell;

};

exports.getThreadContent = function(thread, posts, innerPage, boardUri,
    modding, userRole, boardData, language) {

  var threadCell = exports.setOmittedInformation(thread, posts, innerPage,
      language);

  var removable = templateHandler(language, true).opCell.removable;

  threadCell = exports.setSharedHideableElements(thread, removable, threadCell,
      language);

  threadCell = exports.setThreadLinks(threadCell, thread, boardUri, innerPage,
      language);

  threadCell = exports.setThreadComplexElements(boardUri, thread, threadCell,
      innerPage, language);

  threadCell = exports.setThreadHiddeableElements(thread, threadCell, modding,
      boardUri, boardData, userRole, removable);

  threadCell = exports.setThreadSimpleElements(threadCell, thread, innerPage,
      language, removable);

  threadCell = threadCell.replace('__panelUploads_children__', exports
      .setUploadCell(thread.files, modding, language));

  return threadCell;

};

exports.addThread = function(document, thread, posts, innerPage, modding,
    boardData, userRole, language) {

  var boardUri = thread.boardUri;

  var threadCell = exports.getThreadCellBase(thread, language);

  var cacheField = exports.getCacheField(false, innerPage, modding, userRole,
      language);

  var currentCache = exports.getPostingCache(cacheField, thread, language);

  if (!currentCache || !individualCaches) {

    var threadContent = exports.getThreadContent(thread, posts, innerPage,
        boardUri, modding, userRole, boardData, language);

    threadCell += threadContent;

    if (individualCaches) {
      exports.saveCache(cacheField, language, threadContent, threadsCollection,
          boardUri, 'threadId', thread.threadId);
    }

  } else {
    threadCell += currentCache;
  }

  document.getElementById('divThreads').innerHTML += threadCell + '</div>';

  // TODO
  /*
   * exports.addPosts(document, posts || [], modding, threadCell
   * .getElementsByClassName('divPosts')[0], boardData, userRole, innerPage,
   * language);
   */
};

// Section 2.1: Post content {
exports.setPostHideableElements = function(postCell, post, language) {

  var subjectLabel = postCell.getElementsByClassName('labelSubject')[0];
  if (post.subject) {
    subjectLabel.innerHTML = post.subject;
  } else {
    subjectLabel.remove();
  }

  if (post.id) {
    var labelId = postCell.getElementsByClassName('labelId')[0];
    labelId.setAttribute('style', 'background-color: #' + post.id);
    labelId.innerHTML = post.id;
  } else {
    postCell.getElementsByClassName('spanId')[0].remove();
  }

  var banMessageLabel = postCell.getElementsByClassName('divBanMessage')[0];

  if (!post.banMessage) {
    banMessageLabel.remove();
  } else {
    banMessageLabel.innerHTML = post.banMessage;
  }

  // TODO
  // exports.setSharedHideableElements(post, postCell, language);
};

exports.setPostLinks = function(postCell, post, preview) {

  var link = postCell.getElementsByClassName('linkSelf')[0];

  var linkQuote = postCell.getElementsByClassName('linkQuote')[0];
  linkQuote.innerHTML = post.postId;

  var linkStart = '/' + post.boardUri + '/res/' + post.threadId + '.html#';
  link.href = linkStart + post.postId;
  linkQuote.href = linkStart + 'q' + post.postId;

  var deletionCheckbox = postCell.getElementsByClassName('deletionCheckBox')[0];

  if (!preview) {

    var checkboxName = post.boardUri + '-' + post.threadId + '-' + post.postId;
    deletionCheckbox.setAttribute('name', checkboxName);

  } else {
    deletionCheckbox.remove();
  }
};

exports.setPostComplexElements = function(postCell, post, document, preview,
    modding, language) {

  // TODO
  // exports.setRoleSignature(postCell, post);

  exports.setPostLinks(postCell, post, preview);

  postCell.getElementsByClassName('panelUploads')[0].innerHTML += exports
      .setUploadCell(post.files, modding, language);

};

exports.setPostModElements = function(post, modding, postCell, boardData,
    userRole) {

  if (modding && post.ip) {
    // TODO
    // exports.setPostingIp(postCell, post, boardData, userRole);
  } else {
    postCell.getElementsByClassName('panelIp')[0].remove();
  }

  if (modding) {
    var editLink = '/edit.js?boardUri=' + boardData.boardUri + '&postId=';
    editLink += post.postId;

    postCell.getElementsByClassName('linkEdit')[0].href = editLink;
  } else {
    postCell.getElementsByClassName('linkEdit')[0].remove();
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

  // TODO
  // exports.addMessage(innerPage, postCell, post);

  exports.setPostHideableElements(postCell, post, language);

  exports.setPostModElements(post, modding, postCell, boardData, userRole);

  exports.setPostComplexElements(postCell, post, document, preview, modding,
      language);

  if (individualCaches) {

    var isAThread = post.threadId === post.postId;

    exports.saveCache(cacheField, language, postCell.innerHTML,
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

exports.saveCache = function(cacheField, language, innerHTML, collection,
    boardUri, postingIdField, postingId) {

  var updateBlock = {
    $set : {}
  };

  if (!language) {
    updateBlock.$set[cacheField] = innerHTML;
  } else {
    var key = 'alternativeCaches.' + cacheField;

    updateBlock.$set[key] = innerHTML;
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
exports.setThreadLinks = function(threadCell, thread, boardUri, innerPage,
    language) {

  var removable = templateHandler(language, true).opCell.removable;

  if (innerPage) {
    threadCell = threadCell.replace('__linkReply_location__', '');
  } else {
    threadCell = threadCell.replace('__linkReply_location__',
        removable.linkReply);

    var replyHref = '/' + boardUri + '/res/' + thread.threadId + '.html';

    threadCell = threadCell.replace('__linkReply_href__', replyHref);

  }

  var linkStart = '/' + boardUri + '/res/' + thread.threadId + '.html#';

  var linkSelf = linkStart + thread.threadId;
  threadCell = threadCell.replace('__linkSelf_href__', linkSelf);

  var linkQuote = linkStart + 'q' + thread.threadId;
  threadCell = threadCell.replace('__linkQuote_href__', linkQuote).replace(
      '__linkQuote_inner__', thread.threadId);

  return threadCell;

};

exports.setThreadComplexElements = function(boardUri, thread, threadCell,
    language) {

  var removable = templateHandler(language, true).opCell.removable;

  threadCell = exports.setRoleSignature(threadCell, thread, removable);

  if (!thread.banMessage) {
    threadCell = threadCell.replace('__divBanMessage_location__', '');
  } else {
    threadCell = threadCell.replace('__divBanMessage_location__',
        removable.divBanMessage).replace('__divBanMessage_inner__',
        thread.banMessage);
  }

  var checkboxName = boardUri + '-' + thread.threadId;
  threadCell = threadCell.replace('__deletionCheckBox_name__', checkboxName);

  return threadCell;

};

exports.setThreadSimpleElements = function(threadCell, thread, innerPage,
    language, removable) {

  threadCell = threadCell.replace('__linkName_inner__', thread.name);

  if (thread.email) {
    var email = 'mailto:' + thread.email;

    threadCell = threadCell.replace('__linkName_href__', email);
    threadCell = threadCell.replace('__linkName_class__', '');

  } else {

    threadCell = threadCell.replace('__linkName_class__', ' noEmailName');
    threadCell = threadCell.replace('href=\"__linkName_href__\"', '');

  }

  if (thread.subject) {
    threadCell = threadCell.replace('__labelSubject_location__',
        removable.labelSubject).replace('__labelSubject_inner__',
        thread.subject);
  } else {
    threadCell = threadCell.replace('__labelSubject_location__', '');
  }

  threadCell = threadCell.replace('__labelCreated_inner__', exports
      .formatDateToDisplay(thread.creation, null, language));

  threadCell = exports.addMessage(innerPage, threadCell, thread, removable);

  return threadCell;

};

// Section 2.2: Uploads {
exports.setUploadLinks = function(cell, file) {

  cell = cell.replace('__imgLink_href__', file.path);
  cell = cell.replace('__imgLink_mime__', file.mime);

  if (file.width) {
    cell = cell.replace('__imgLink_width__', file.width);
    cell = cell.replace('__imgLink_height__', file.height);
  } else {
    cell = cell.replace('data-filewidth=\"__imgLink_width__\"', '');
    cell = cell.replace('data-fileheight=\"__imgLink_height__\"', '');
  }

  cell = cell.replace('__nameLink_href__', file.path);

  var img = '<img src=\'' + file.thumb + '\'>';

  cell = cell.replace('__imgLink_children__', img);

  cell = cell.replace('__originalNameLink_inner__', file.originalName);
  cell = cell.replace('__originalNameLink_href__', file.path);
  cell = cell.replace('__originalNameLink_download__', file.originalName);

  return cell;

};

exports.setUploadModElements = function(t, modding, cell, file) {

  if (!modding) {
    cell = cell.replace('__divHash_location__', '');
  } else {
    cell = cell.replace('__divHash_location__', t.removable.divHash);
    cell = cell.replace('__labelHash_inner__', file.md5);
  }

  return cell;

};

exports.setUploadDimensionLabel = function(cell, file, t) {

  if (file.width) {
    cell = cell.replace('__dimensionLabel_location__',
        t.removable.dimensionLabel);

    var dimensionString = file.width + 'x' + file.height;
    cell = cell.replace('__dimensionLabel_inner__', dimensionString);

  } else {
    cell = cell.replace('__dimensionLabel_location__', '');
  }

  return cell;

};

exports.setUploadCell = function(files, modding, language) {

  if (!files) {
    return '';
  }

  var children = '';

  var t = templateHandler(language, true).uploadCell;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];

    var cell = '<figure class=\'uploadCell\'>' + t.template + '</figure>';

    cell = exports.setUploadModElements(t, modding, exports.setUploadLinks(
        cell, file), file);

    cell = cell.replace('__sizeLabel_inner__', exports.formatFileSize(
        file.size, language));

    cell = exports.setUploadDimensionLabel(cell, file, t);

    children += cell;

  }

  return children;

};
// } Section 2.2: Uploads

// } Section 2: Thread content

// Section 3: Ban div {
exports.setBanCellHiddenElements = function(ban, cell, language) {

  if (!ban.denied && ban.appeal) {
    cell.getElementsByClassName('denyIdentifier')[0].setAttribute('value',
        ban._id);
  } else {
    cell.getElementsByClassName('denyForm')[0].remove();
  }

  cell.getElementsByClassName('liftIdentifier')[0].setAttribute('value',
      ban._id);

};

exports.setBanCell = function(ban, cell, globalPage, language) {

  if (ban.appeal) {
    var label = cell.getElementsByClassName('appealLabel')[0];
    label.innerHTML = ban.appeal;
  } else {
    cell.getElementsByClassName('appealPanel')[0].remove();
  }

  exports.setBanCellHiddenElements(ban, cell, language);

  cell.getElementsByClassName('idLabel')[0].innerHTML = ban._id;

  cell.getElementsByClassName('reasonLabel')[0].innerHTML = ban.reason;

  var expirationLabel = cell.getElementsByClassName('expirationLabel')[0];
  expirationLabel.innerHTML = exports.formatDateToDisplay(ban.expiration, null,
      language);

  var appliedByLabel = cell.getElementsByClassName('appliedByLabel')[0];
  appliedByLabel.innerHTML = ban.appliedBy;

  if (!globalPage || !globalBoardModeration || !ban.boardUri) {
    cell.getElementsByClassName('boardPanel')[0].remove();
  } else {
    cell.getElementsByClassName('boardLabel')[0].innerHTML = ban.boardUri;
  }

};

exports.setBanList = function(document, div, bans, globalPage, language) {

  for (var i = 0; i < bans.length; i++) {

    var ban = bans[i];
    var cell = document.createElement('div');
    cell.innerHTML = templateHandler(language).banCell;

    cell.setAttribute('class', 'banCell');

    exports.setBanCell(ban, cell, globalPage, language);
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
    document.getElementById('panelMessage').remove();
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
