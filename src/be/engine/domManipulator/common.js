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

exports.clean = function(toClean) {

  if (typeof toClean === 'string') {
    return toClean.replace(/__/g, '&#95;&#95;');
  }

  for ( var key in toClean) {

    var value = toClean[key];

    if (typeof value === 'string') {
      toClean[key] = exports.clean(toClean[key]);
    }

  }
};

exports.setFormCellBoilerPlate = function(cell, action, cssClass) {
  cell.method = 'post';
  cell.enctype = 'multipart/form-data';
  cell.action = action;
  cell.setAttribute('class', cssClass);
};

exports.getFormCellBoilerPlate = function(cell, action, cssClass) {

  var toRet = '<form class="' + cssClass + '" action="' + action;
  toRet += '" method="post" enctype="multipart/form-data">' + cell;
  return toRet + '</form>';

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

// Section 2: Board content{
exports.setCustomCss = function(boardUri, document) {

  var link = '<link rel="stylesheet" type="text/css" href="/';
  link += boardUri + '/custom.css">';

  return document.replace('__head_children__', link);
};

exports.setCustomJs = function(board, document) {

  var script = '<script src="/' + board + '/custom.js"></script>';
  return document.replace('__body_children__', script);
};

exports.setFlags = function(document, flagData, language, removable) {

  if (!flagData || !flagData.length) {
    return document.replace('__flagsDiv_location__', '');
  }

  document = document.replace('__flagsDiv_location__', removable.flagsDiv);

  var children = '<option>' + lang(language).guiNoFlag + '</option>';

  for (var i = 0; i < flagData.length; i++) {
    var flag = flagData[i];

    children += '<option value="' + flag._id + '">' + exports.clean(flag.name);
    children += '</option>';

  }

  return document.replace('__flagCombobox_children__', children);

};

exports.setBoardPostingNameAndCaptcha = function(bData, document, thread,
    removable) {

  var captchaMode = bData.captchaMode || 0;

  if ((captchaMode < 1 || (captchaMode < 2 && thread)) && !forceCaptcha) {
    document = document.replace('__captchaDiv_location__', '');
  } else {
    document = document
        .replace('__captchaDiv_location__', removable.captchaDiv);
  }

  if (bData.settings.indexOf('forceAnonymity') > -1) {
    document = document.replace('__divName_location__', '');
  } else {
    document = document.replace('__divName_location__', removable.divName);
  }

  return document;

};

exports.setBoardPosting = function(boardData, flagData, document, thread,
    language, removable) {

  document = exports.setBoardPostingNameAndCaptcha(boardData, document, thread,
      removable);

  var locationFlagMode = boardData.locationFlagMode || 0;

  if (locationFlagMode !== 1) {
    document = document.replace('__noFlagDiv_location__', '');
  } else {
    document = document.replace('__noFlagDiv_location__', removable.noFlagDiv);
  }

  if (boardData.settings.indexOf('textBoard') > -1) {
    document = document.replace('__divUpload_location__', '');
  } else {
    document = document.replace('__divUpload_location__', removable.divUpload);
    document = exports.setFileLimits(document, boardData, language);
  }

  document = document.replace('__boardIdentifier_value__', exports
      .clean(boardData.boardUri));
  document = document.replace('__labelMessageLength_inner__', messageLength);

  return exports.setFlags(document, flagData, language, removable);

};

exports.setFileLimits = function(document, bData, language) {

  var fileLimitToUse;

  if (bData.maxFiles) {
    fileLimitToUse = bData.maxFiles < maxAllowedFiles ? bData.maxFiles
        : maxAllowedFiles;
  } else {
    fileLimitToUse = maxAllowedFiles;
  }

  document = document.replace('__labelMaxFiles_inner__', fileLimitToUse);

  var sizeToUse;

  if (bData.maxFileSizeMB && bData.maxFileSizeMB < maxFileSizeMB) {
    sizeToUse = exports.formatFileSize(bData.maxFileSizeMB * 1048576, language);
  } else {
    sizeToUse = displayMaxSize;
  }

  return document.replace('__labelMaxFileSize_inner__', sizeToUse);

};

exports.setBoardCustomization = function(document, boardData, removable) {

  document = document.replace('__labelDescription_inner__', exports
      .clean(boardData.boardDescription));

  var boardUri = exports.clean(boardData.boardUri);

  if (boardData.usesCustomCss) {
    document = exports.setCustomCss(boardUri, document);
  } else {
    document = document.replace('__head_children__', '');
  }
  if (boardData.usesCustomJs && allowedJs) {
    document = exports.setCustomJs(boardUri, document);
  } else {
    document = document.replace('__body_children__', '');
  }

  if (boardData.boardMarkdown && boardData.boardMarkdown.length) {
    document = document.replace('__panelMessage_location__',
        removable.panelMessage);

    document = document.replace('__divMessage_inner__', exports
        .clean(boardData.boardMarkdown));

  } else {
    document = document.replace('__panelMessage_location__', '');
  }

  return document;
};

exports.setHeader = function(template, language, bData, flagData, thread) {

  var boardUri = exports.clean(bData.boardUri);

  var title = '/' + boardUri + '/ - ' + bData.boardName;
  var document = template.template.replace('__labelName_inner__', title);

  var linkBanner = '/randomBanner.js?boardUri=' + boardUri;
  document = document.replace('__bannerImage_src__', linkBanner);

  document = exports.setBoardPosting(bData, flagData, document, thread,
      language, template.removable);

  return exports.setBoardCustomization(document, bData, template.removable);

};
// } Section 2: Board content

// Section 2.1: Shared posting elements {
exports.setSharedSimpleElements = function(postingCell, posting, innerPage,
    removable, language) {

  postingCell = postingCell.replace('__linkName_inner__', posting.name);

  if (posting.email) {

    var email = 'mailto:' + posting.email;

    postingCell = postingCell.replace('__linkName_href__', email);
    postingCell = postingCell.replace('__linkName_class__', '');

  } else {
    postingCell = postingCell.replace('__linkName_class__', ' noEmailName');
    postingCell = postingCell.replace('href="__linkName_href__"', '');
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

exports.setPostingLinks = function(postingCell, posting, removable) {

  var boardUri = posting.boardUri;

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

exports.setPostingComplexElements = function(posting, postingCell, removable,
    preview) {

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

  if (preview) {
    postingCell = postingCell.replace('__deletionCheckBox_location__', '');
  } else {
    postingCell = postingCell.replace('__deletionCheckBox_location__',
        removable.deletionCheckBox);

    postingCell = postingCell
        .replace('__deletionCheckBox_name__', checkboxName);
  }

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

exports.addMessage = function(innerPage, cell, posting, removable) {

  var markdown = posting.markdown;

  if (!innerPage && (markdown.match(/<br>/g) || []).length > maxPreviewBreaks) {

    cell = cell.replace('__contentOmissionIndicator_location__',
        removable.contentOmissionIndicator);

    markdown = markdown.split('<br>', maxPreviewBreaks + 1).join('<br>');

    var href = '/' + posting.boardUri + '/res/' + posting.threadId + '.html';

    if (posting.postId) {
      href += '#' + (posting.postId || posting.threadId);
    }

    cell = cell.replace('__linkFullText_href__', href);

  } else {
    cell = cell.replace('__contentOmissionIndicator_location__', '');
  }

  return cell.replace('__divMessage_inner__', markdown);

};

exports.setAllSharedPostingElements = function(postingCell, posting, removable,
    language, modding, innerPage, userRole, boardData, preview) {

  postingCell = exports.setPostingModdingElements(modding, posting,
      postingCell, boardData, userRole, removable);

  postingCell = exports.setSharedHideableElements(posting, removable,
      postingCell, language);

  postingCell = exports.setPostingLinks(postingCell, posting, removable);

  postingCell = exports.setPostingComplexElements(posting, postingCell,
      removable, preview);

  postingCell = exports.setSharedSimpleElements(postingCell, posting,
      innerPage, removable, language);

  return postingCell.replace('__panelUploads_children__', exports
      .setUploadCell(posting.files, modding, language));

};
// } Section 2.1: Shared posting elements

// Section 3: Thread content {
exports.setThreadHiddeableElements = function(thread, cell, removable,
    innerPage) {

  for ( var key in exports.indicatorsRelation) {
    var location = '__' + exports.indicatorsRelation[key] + '_location__';

    if (!thread[key]) {
      cell = cell.replace(location, '');
    } else {
      cell = cell.replace(location, removable[exports.indicatorsRelation[key]]);

    }
  }

  if (innerPage) {
    cell = cell.replace('__linkReply_location__', '');
  } else {

    cell = cell.replace('__linkReply_location__', removable.linkReply);

    var boardUri = thread.boardUri;
    var replyHref = '/' + boardUri + '/res/' + thread.threadId + '.html';

    cell = cell.replace('__linkReply_href__', replyHref);

  }

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

exports.getThreadCellBase = function(thread) {

  var classToUse = 'opCell';

  if (thread.files && thread.files.length > 1) {
    classToUse += ' multipleUploads';
  }

  var threadCell = '<div class="' + classToUse + '" data-boarduri="';
  threadCell += thread.boardUri + '" id="' + thread.threadId + '">';

  return threadCell;

};

exports.getThreadContent = function(thread, posts, innerPage, modding,
    userRole, boardData, language) {

  var threadCell = exports.setOmittedInformation(thread, posts, innerPage,
      language);

  var removable = templateHandler(language, true).opCell.removable;

  threadCell = exports.setThreadHiddeableElements(thread, threadCell,
      removable, innerPage);

  return exports.setAllSharedPostingElements(threadCell, thread, removable,
      language, modding, innerPage, userRole, boardData);

};

// TODO remove
exports.addThread = function(document, thread, posts, innerPage, modding,
    boardData, userRole, language) {

  var threadCell = exports.getThreadCellBase(thread, language);

  var cacheField = exports.getCacheField(false, innerPage, modding, userRole,
      language);

  var currentCache = exports.getPostingCache(cacheField, thread, language);

  if (!currentCache || !individualCaches) {
    exports.clean(thread);

    var threadContent = exports.getThreadContent(thread, posts, innerPage,
        modding, userRole, boardData, language);

    threadCell += threadContent;

    if (individualCaches) {
      exports.saveCache(cacheField, language, threadContent, threadsCollection,
          thread.boardUri, 'threadId', thread.threadId);
    }

  } else {
    threadCell += currentCache;
  }

  threadCell = threadCell.replace('__divPosts_children__', exports.getPosts(
      posts || [], modding, boardData, userRole, innerPage, language));

  document.getElementById('divThreads').innerHTML += threadCell + '</div>';

};

exports.getThread = function(thread, posts, innerPage, modding, boardData,
    userRole, language) {

  var threadCell = exports.getThreadCellBase(thread, language);

  var cacheField = exports.getCacheField(false, innerPage, modding, userRole,
      language);

  var currentCache = exports.getPostingCache(cacheField, thread, language);

  if (!currentCache || !individualCaches) {
    exports.clean(thread);

    var threadContent = exports.getThreadContent(thread, posts, innerPage,
        modding, userRole, boardData, language);

    threadCell += threadContent;

    if (individualCaches) {
      exports.saveCache(cacheField, language, threadContent, threadsCollection,
          thread.boardUri, 'threadId', thread.threadId);
    }

  } else {
    threadCell += currentCache;
  }

  threadCell = threadCell.replace('__divPosts_children__', exports.getPosts(
      posts, modding, boardData, userRole, innerPage, language));

  return threadCell + '</div>';

};

// Section 3.1: Post content {
exports.generatePostHTML = function(post, language, innerPage, modding,
    preview, boardData, userRole, cacheField) {

  var template = templateHandler(language, true).postCell;

  var postCell = exports.setAllSharedPostingElements(template.template, post,
      template.removable, language, modding, innerPage, userRole, boardData,
      preview);

  if (individualCaches) {

    var isAThread = post.threadId === post.postId;

    exports.saveCache(cacheField, language, postCell,
        isAThread ? threadsCollection : postsCollection, post.boardUri,
        isAThread ? 'threadId' : 'postId', post.postId);

  }

  return postCell;

};

exports.getPostInnerElements = function(post, preview, language, modding,
    boardData, userRole, innerPage) {

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

  var postCell = '<div class="' + classToUse;
  postCell += '" data-boarduri="' + post.boardUri + '" id="';
  postCell += post.postId + '">';

  return postCell;

};

exports.getPosts = function(posts, modding, boardData, userRole, innerPage,
    language) {

  var children = '';

  for (var i = 0; posts && i < posts.length; i++) {
    var post = posts[i];

    exports.clean(post);

    var postCell = exports.getPostCellBase(post);

    postCell += exports.getPostInnerElements(post, false, language, modding,
        boardData, userRole, innerPage);

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
    cell = cell.replace('data-filewidth="__imgLink_width__"', '');
    cell = cell.replace('data-fileheight="__imgLink_height__"', '');
  }

  cell = cell.replace('__nameLink_href__', file.path);

  var img = '<img src="' + file.thumb + '">';

  cell = cell.replace('__imgLink_children__', img);

  cell = cell.replace('__originalNameLink_inner__', file.originalName);
  cell = cell.replace('__originalNameLink_href__', file.path);
  cell = cell.replace('__originalNameLink_download__', file.originalName);

  return cell;

};

exports.setUploadModElements = function(template, modding, cell, file) {

  if (!modding) {
    cell = cell.replace('__divHash_location__', '');
  } else {
    cell = cell.replace('__divHash_location__', template.removable.divHash);
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

  var template = templateHandler(language, true).uploadCell;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];

    exports.clean(file);

    var cell = '<figure class="uploadCell">' + template.template;
    cell += '</figure>';

    cell = exports.setUploadModElements(template, modding, exports
        .setUploadLinks(cell, file), file);

    cell = cell.replace('__sizeLabel_inner__', exports.formatFileSize(
        file.size, language));

    cell = exports.setUploadDimensionLabel(cell, file, template);

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

// Setion 5: Open reports {
exports.getReportCell = function(report, language) {

  var cell = '<div class="reportCell">';
  cell += templateHandler(language, true).reportCell.template + '</div>';

  cell = cell.replace('__reasonLabel_inner__', report.reason || '');
  cell = cell.replace('__closureCheckbox_name__', 'report-' + report._id);

  var link = exports.getReportLink(report);

  if (report.postId) {
    link += report.postId;
  } else {
    link += report.threadId;
  }

  cell = cell.replace('__link_href__', link);

  if (report.associatedPost) {

    exports.clean(report.associatedPost);

    return cell.replace('__postingDiv_inner__', exports.getPostInnerElements(
        report.associatedPost, true, language));

  } else {
    return cell.replace('__postingDiv_inner__', '');
  }

};

exports.setReportList = function(document, reports, language) {

  var reportDiv = document.getElementById('reportDiv');

  var children = '';

  for (var i = 0; i < reports.length; i++) {
    children += exports.getReportCell(reports[i], language);
  }

  reportDiv.innerHTML += children;

};
// } Section 5: Open reports
