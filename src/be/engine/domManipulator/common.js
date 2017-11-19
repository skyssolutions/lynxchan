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

// Section 2: Shared posting elements {
exports.setSharedSimpleElements = function(postingCell, posting, innerPage,
    removable, language) {

  postingCell = postingCell.replace('__linkName_inner__', posting.name);

  if (posting.email) {

    var email = 'mailto:' + posting.email;

    postingCell = postingCell.replace('__linkName_href__', email);
    postingCell = postingCell.replace('__linkName_class__', '');

  } else {
    postingCell = postingCell.replace('__linkName_class__', ' noEmailName');
    postingCell = postingCell.replace('href=\"__linkName_href__\"', '');
  }

  postingCell = postingCell.replace('__labelCreated_inner__', exports
      .formatDateToDisplay(posting.creation, null, language));

  postingCell = exports.addMessage(innerPage, postingCell, posting, removable);

  return postingCell;

};

exports.setPostingFlag = function(posting, postingCell, removable) {

  if (posting.flag) {

    postingCell = postingCell
        .replace('__imgFlag_location__', removable.imgFlag);

    postingCell = postingCell.replace('__imgFlag_src__', posting.flag);
    postingCell = postingCell.replace('__imgFlag_title__', posting.flagName);

    if (posting.flagCode) {

      var flagClass = ' flag' + posting.flagCode;

      postingCell = postingCell.replace(' __imgFlag_class__', flagClass);
    } else {
      postingCell = postingCell.replace(' __imgFlag_class__', '');
    }

  } else {
    postingCell = postingCell.replace('__imgFlag_location__', '');
  }

  return postingCell;

};

exports.setPostingLinks = function(postingCell, posting, innerPage, removable) {

  var boardUri = posting.boardUri;

  if (!posting.postId) {

    if (innerPage) {
      postingCell = postingCell.replace('__linkReply_location__', '');
    } else {
      postingCell = postingCell.replace('__linkReply_location__',
          removable.linkReply);

      var replyHref = '/' + boardUri + '/res/' + posting.threadId + '.html';

      postingCell = postingCell.replace('__linkReply_href__', replyHref);

    }
  }

  var linkStart = '/' + boardUri + '/res/' + posting.threadId + '.html#';

  var selfId = posting.postId || posting.threadId;

  var linkSelf = linkStart + selfId;
  postingCell = postingCell.replace('__linkSelf_href__', linkSelf);

  var linkQuote = linkStart + 'q' + selfId;
  postingCell = postingCell.replace('__linkQuote_href__', linkQuote).replace(
      '__linkQuote_inner__', selfId);

  return postingCell;

};

exports.setPostingModdingElements = function(modding, posting, cell, bData,
    userRole, removable) {

  if (modding) {
    var editLink = '/edit.js?boardUri=' + posting.boardUri;

    if (posting.postId) {
      editLink += '&postId=' + posting.postId;
    } else {
      editLink += '&threadId=' + posting.threadId;
    }

    cell = cell.replace('__linkEdit_location__', removable.linkEdit).replace(
        '__linkEdit_href__', editLink);
  } else {
    cell = cell.replace('__linkEdit_location__', '');
  }

  if (modding && posting.ip) {
    cell = cell.replace('__panelIp_location__', removable.panelIp);
    cell = exports.setPostingIp(cell, posting, bData, userRole, removable);
  } else {
    cell = cell.replace('__panelIp_location__', '');
  }

  return cell;

};

exports.setPostingComplexElements = function(posting, postingCell, language,
    removable) {

  if (posting.signedRole) {
    postingCell = postingCell.replace('__labelRole_location__',
        removable.labelRole).replace('__labelRole_inner__', posting.signedRole);

  } else {
    postingCell = postingCell.replace('__labelRole_location__', '');
  }

  var checkboxName = posting.boardUri + '-' + posting.threadId;
  if (posting.postId) {
    checkboxName += '-' + posting.postId;
  }

  postingCell = postingCell.replace('__deletionCheckBox_name__', checkboxName);

  return postingCell;

};

exports.setSharedHideableElements = function(posting, removable, postingCell,
    language) {

  if (posting.lastEditTime) {

    var formatedDate = exports.formatDateToDisplay(posting.lastEditTime, null,
        language);

    postingCell = postingCell.replace('__labelLastEdit_location__',
        removable.labelLastEdit).replace(
        '__labelLastEdit_inner__',
        lang(language).guiEditInfo.replace('{$date}', formatedDate).replace(
            '{$login}', posting.lastEditLogin));

  } else {
    postingCell = postingCell.replace('__labelLastEdit_location__', '');
  }

  postingCell = exports.setPostingFlag(posting, postingCell, removable);

  if (posting.subject) {
    postingCell = postingCell.replace('__labelSubject_location__',
        removable.labelSubject).replace('__labelSubject_inner__',
        posting.subject);
  } else {
    postingCell = postingCell.replace('__labelSubject_location__', '');
  }

  if (posting.id) {
    postingCell = postingCell.replace('__spanId_location__', removable.spanId)
        .replace('__labelId_inner__', posting.id).replace('__labelId_style__',
            'background-color: #' + posting.id);
  } else {
    postingCell = postingCell.replace('__spanId_location__', '');
  }

  if (!posting.banMessage) {
    postingCell = postingCell.replace('__divBanMessage_location__', '');
  } else {
    postingCell = postingCell.replace('__divBanMessage_location__',
        removable.divBanMessage).replace('__divBanMessage_inner__',
        posting.banMessage);
  }

  return postingCell;

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
// Section 2: Shared posting elements {

// Section 3: Thread content {
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

  cell = exports.setPostingModdingElements(modding, thread, cell, bData,
      userRole, removable);

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

  var threadCell = '<div class=\"' + classToUse + '\" data-boarduri=\"';
  threadCell += thread.boardUri + '\" id=\"' + thread.threadId + '\">';

  return threadCell;

};

exports.getThreadContent = function(thread, posts, innerPage, boardUri,
    modding, userRole, boardData, language) {

  var threadCell = exports.setOmittedInformation(thread, posts, innerPage,
      language);

  var removable = templateHandler(language, true).opCell.removable;

  threadCell = exports.setSharedHideableElements(thread, removable, threadCell,
      language);

  threadCell = exports
      .setPostingLinks(threadCell, thread, innerPage, removable);

  threadCell = exports.setPostingComplexElements(thread, threadCell, innerPage,
      removable);

  threadCell = exports.setThreadHiddeableElements(thread, threadCell, modding,
      boardUri, boardData, userRole, removable);

  threadCell = exports.setSharedSimpleElements(threadCell, thread, innerPage,
      removable, language);

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

  threadCell = threadCell.replace('__divPosts_children__', exports.getPosts(
      posts || [], modding, boardData, userRole, innerPage, language));

  document.getElementById('divThreads').innerHTML += threadCell + '</div>';

};

// Section 3.1: Post content {
exports.generatePostHTML = function(post, language, innerPage, modding,
    preview, boardData, userRole, cacheField) {

  var template = templateHandler(language, true).postCell;

  var postCell = exports.setSharedSimpleElements(template.template, post,
      innerPage, template.removable, language);

  postCell = exports.setSharedHideableElements(post, template.removable,
      postCell, language);

  postCell = exports.setPostingLinks(postCell, post, innerPage,
      template.removable);

  postCell = exports.setPostingModdingElements(modding, post, postCell,
      boardData, userRole, template.removable);

  postCell = exports.setPostingComplexElements(post, postCell, innerPage,
      template.removable);

  postCell = postCell.replace('__panelUploads_children__', exports
      .setUploadCell(post.files, modding, language));

  if (individualCaches) {

    var isAThread = post.threadId === post.postId;

    exports.saveCache(cacheField, language, postCell,
        isAThread ? threadsCollection : postsCollection, post.boardUri,
        isAThread ? 'threadId' : 'postId', post.postId);

  }

  return postCell;

};

exports.getPostInnerElements = function(post, preview, modding, boardData,
    userRole, innerPage, language) {

  var cacheField = exports.getCacheField(preview, innerPage, modding, userRole,
      language);

  var currentCache = exports.getPostingCache(cacheField, post, language);

  if (individualCaches && currentCache) {
    return currentCache;
  }

  return exports.generatePostHTML(post, language, innerPage, modding, preview,
      boardData, userRole, cacheField);
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

exports.getPostCellBase = function(post) {

  var classToUse = 'postCell';

  if (post.files && post.files.length > 1) {
    classToUse += ' multipleUploads';
  }

  var postCell = '<div class=\"' + classToUse;
  postCell += '\" data-boarduri=\"' + post.boardUri + '\" id=\"';
  postCell += post.postId + '\">';

  return postCell;

};

exports.getPosts = function(posts, modding, boardData, userRole, innerPage,
    language) {

  var children = '';

  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];

    var postCell = exports.getPostCellBase(post);

    postCell += exports.getPostInnerElements(post, false, modding, boardData,
        userRole, innerPage, language);

    children += postCell + '</div>';

  }

  return children;

};
// } Section 3.1: Post content

// Section 3.2: Uploads {
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

  var img = '<img src=\"' + file.thumb + '\">';

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

    var cell = '<figure class=\"uploadCell\">' + t.template + '</figure>';

    cell = exports.setUploadModElements(t, modding, exports.setUploadLinks(
        cell, file), file);

    cell = cell.replace('__sizeLabel_inner__', exports.formatFileSize(
        file.size, language));

    cell = exports.setUploadDimensionLabel(cell, file, t);

    children += cell;

  }

  return children;

};
// } Section 3.2: Uploads

// } Section 3: Thread content

// Section 4: Ban div {
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
// } Section 4: Ban div

// Section 5: Header {
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
// } Section 5: Header

// Setion 6: Open reports {
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

    // TODO
    // exports.setPostInnerElements(document, posting, cell
    // .getElementsByClassName('postingDiv')[0], true, null, null, null, null,
    // language);
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
// } Section 6: Open reports
