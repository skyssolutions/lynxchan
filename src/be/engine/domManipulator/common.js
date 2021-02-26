'use strict';

// contains common operations to the multiple parts of the domManipulator module
var kernel = require('../../kernel');
var individualCaches = !kernel.feDebug();
var allowedJs;
var forceCaptcha;
var lang;
var db = require('../../db');
var threadsCollection = db.threads();
var postsCollection = db.posts();
var templateHandler;
var postingContent;
var maxAllowedFiles;
var globalBoardModeration;
var miscOps;
var clearIpRole;
var unboundBoardLimits;
var maxFileSizeMB;
var messageLength;
var verbose;
var validMimes;
var reportCategories;
var thumbSize;
var latestLimit;

exports.indicatorsRelation = {
  pinned : 'pinIndicator',
  locked : 'lockIndicator',
  cyclic : 'cyclicIndicator',
  autoSage : 'bumpLockIndicator',
  archived : 'archiveIndicator'
};

exports.sizeOrders = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
var displayMaxSize;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  reportCategories = settings.reportCategories;
  thumbSize = settings.thumbSize;
  latestLimit = settings.latestPostsAmount;
  unboundBoardLimits = settings.unboundBoardLimits;
  verbose = settings.verboseCache || settings.verbose;
  globalBoardModeration = settings.allowGlobalBoardModeration;
  clearIpRole = settings.clearIpMinRole;
  messageLength = settings.messageLength;
  maxAllowedFiles = settings.maxFiles;
  allowedJs = settings.allowBoardCustomJs;
  forceCaptcha = settings.forceCaptcha;
  maxFileSizeMB = settings.maxFileSizeMB;
  displayMaxSize = exports.formatFileSize(settings.maxFileSizeB);
  validMimes = settings.acceptedMimes;

};

exports.loadDependencies = function() {

  lang = require('../langOps').languagePack;
  templateHandler = require('../templateHandler').getTemplates;
  postingContent = require('./postingContent');
  miscOps = require('../miscOps');

};

exports.matchCodeTags = function(markdown) {

  var closingIndex = markdown.indexOf('</code>');

  if (closingIndex >= 0 && closingIndex < markdown.indexOf('<code>')) {
    markdown = '<code>' + markdown;
  }

  var delta = markdown.split('<code>').length;
  delta -= markdown.split('</code>').length;

  if (delta < 0) {

    for (delta; delta !== 0; delta++) {
      markdown = '<code>' + markdown;
    }

  } else if (delta > 0) {

    for (delta; delta !== 0; delta--) {
      markdown = markdown + '</code>';

    }

  }

  return markdown;

};

exports.setReportCategories = function(template) {

  var document = template.template;

  if (!reportCategories || !reportCategories.length) {

    return document.replace('__reportCategoriesDiv_location__', '');
  }

  document = document.replace('__reportCategoriesDiv_location__',
      template.removable.reportCategoriesDiv);

  var content = '';

  for (var i = 0; i < reportCategories.length; i++) {
    content += '<option>' + reportCategories[i] + '</option>';
  }

  return document.replace('__reportComboboxCategory_children__', content);

};

exports.formatFileSize = function(size, language) {

  if (size === Infinity) {
    return lang(language).guiUnlimited;
  }

  var orderIndex = 0;

  while (orderIndex < exports.sizeOrders.length - 1 && size > 1023) {

    orderIndex++;
    size /= 1024;

  }

  return size.toFixed(2) + ' ' + exports.sizeOrders[orderIndex];

};

exports.clean = function(toClean) {

  if (typeof toClean !== 'string') {
    return toClean;
  }

  return toClean.replace(/_/g, '&#95;').replace(/\$/g, '&#36;');
};

exports.getFormCellBoilerPlate = function(cell, action, cssClass) {

  var toRet = '<form class="' + cssClass + '" action="' + action;
  toRet += '" method="post" enctype="multipart/form-data">' + cell;
  return toRet + '</form>';

};

exports.getReportLink = function(report) {

  var link = '/mod.js?boardUri=' + exports.clean(report.boardUri);
  link += '&threadId=' + report.threadId + '#';

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
    var validMaxFiles = bData.maxFiles < maxAllowedFiles || unboundBoardLimits;

    fileLimitToUse = validMaxFiles ? bData.maxFiles : maxAllowedFiles;
  } else {
    fileLimitToUse = maxAllowedFiles;
  }

  document = document.replace('__labelMaxFiles_inner__', fileLimitToUse);

  var sizeToUse;

  if (bData.maxFileSizeMB) {

    var validMaxFileSize = bData.maxFileSizeMB < maxFileSizeMB;
    validMaxFileSize = validMaxFileSize || unboundBoardLimits;

    sizeToUse = validMaxFileSize ? exports.formatFileSize(
        bData.maxFileSizeMB * 1048576, language) : displayMaxSize;
  } else {
    sizeToUse = displayMaxSize;
  }

  var useMimes = bData.acceptedMimes && unboundBoardLimits;

  document = document.replace('__inputFiles_accept__',
      (useMimes ? bData.acceptedMimes : validMimes).join(', '));

  return document.replace('__labelMaxFileSize_inner__', sizeToUse);

};

exports.setBoardCustomization = function(document, boardData, removable) {

  if (boardData.boardDescription) {

    document = document.replace('__labelDescription_location__',
        removable.labelDescription).replace('__labelDescription_inner__',
        exports.clean(boardData.boardDescription));

  } else {
    document = document.replace('__labelDescription_location__', '');
  }

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

  var title = '/' + boardUri + '/ - ' + exports.clean(bData.boardName);
  var document = exports.setReportCategories(template).replace(
      '__labelName_inner__', title);

  var linkBanner = '/randomBanner.js?boardUri=' + boardUri;
  document = document.replace('__bannerImage_src__', linkBanner);

  document = exports.setBoardPosting(bData, flagData, document, thread,
      language, template.removable);

  return exports.setBoardCustomization(document, bData, template.removable);

};
// } Section 2: Board content

// Section 3: Thread content {
exports.setOpLinks = function(cell, removable, thread, modding) {

  cell = cell.replace('__linkReply_location__', removable.linkReply);

  var boardUri = thread.boardUri;

  if (!modding) {
    var replyHref = '/' + boardUri + '/res/' + thread.threadId + '.html';
  } else {
    replyHref = '/mod.js?boardUri=' + boardUri + '&threadId=';
    replyHref += thread.threadId;
  }

  return cell.replace('__linkReply_href__', replyHref);

};

exports.setThreadHiddeableElements = function(thread, cell, removable,
    innerPage, modding) {

  for ( var key in exports.indicatorsRelation) {
    var location = '__' + exports.indicatorsRelation[key] + '_location__';

    if (!thread[key]) {
      cell = cell.replace(location, '');
    } else {
      cell = cell.replace(location, removable[exports.indicatorsRelation[key]]);
    }
  }

  if (innerPage || (thread.postCount || 0) <= latestLimit) {

    cell = cell.replace('__linkLast_location__', '');

  } else {

    cell = cell.replace('__linkLast_location__', removable.linkLast).replace(
        '__linkLast_href__',
        '/' + thread.boardUri + '/last/' + thread.threadId + '.html');

  }

  if (innerPage) {
    return cell.replace('__linkReply_location__', '');
  } else {
    return exports.setOpLinks(cell, removable, thread, modding);
  }

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

  var template = templateHandler(language).opCell;

  var threadCell = template.template;

  posts = posts || [];

  if (innerPage || (thread.postCount || 0) <= posts.length) {
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

  var threadCell = '<div class="' + classToUse + '" data-boarduri="';
  threadCell += exports.clean(thread.boardUri) + '" id="' + thread.threadId;

  return threadCell + '">';

};

exports.getThreadContent = function(thread, posts, innerPage, modding,
    userRole, boardData, language) {

  var threadCell = exports.setOmittedInformation(thread, posts, innerPage,
      language);

  var removable = templateHandler(language).opCell.removable;

  threadCell = exports.setThreadHiddeableElements(thread, threadCell,
      removable, innerPage, modding);

  return postingContent.setAllSharedPostingElements(threadCell, thread,
      removable, language, modding, innerPage, userRole, boardData);

};

exports.getThread = function(thread, posts, innerPage, modding, boardData,
    userRole, language, operations, last) {

  var threadCell = exports.getThreadCellBase(thread, language);

  var cacheField = exports.getCacheField(false, innerPage, modding, userRole,
      language);

  var currentCache = exports.getPostingCache(cacheField, thread, language);

  if ((!currentCache || !individualCaches) && !thread.tempCache) {

    var threadContent = exports.getThreadContent(thread, posts, innerPage,
        modding, userRole, boardData, language);

    if (!last && !modding && innerPage) {
      thread.tempCache = threadContent;
    }

    threadCell += threadContent;

    if (individualCaches) {
      exports.saveCache(cacheField, language, threadContent, thread.boardUri,
          'threadId', thread.threadId, operations);
    }

  } else {
    threadCell += currentCache || thread.tempCache;
  }

  threadCell = threadCell.replace('__divPosts_children__', exports.getPosts(
      posts, modding, boardData, userRole, innerPage, language, operations,
      last));

  return threadCell + '</div>';

};

// Section 3.1: Post content {
exports.generatePostHTML = function(post, language, innerPage, modding,
    preview, boardData, userRole, cacheField, operations, last) {

  var template = templateHandler(language).postCell;

  var postCell = postingContent.setAllSharedPostingElements(template.template,
      post, template.removable, language, modding, innerPage, userRole,
      boardData, preview);

  if (individualCaches) {

    var isAThread = post.threadId === post.postId;

    exports.saveCache(cacheField, language, postCell, post.boardUri,
        isAThread ? 'threadId' : 'postId', post.postId, operations);

  }

  return postCell;

};

exports.getPostInnerElements = function(post, preview, language, operations,
    modding, boardData, userRole, innerPage, last) {

  var cacheField = exports.getCacheField(preview, innerPage, modding, userRole,
      language);

  var currentCache = exports.getPostingCache(cacheField, post, language);

  if ((individualCaches && currentCache) || post.tempCache) {
    return currentCache || post.tempCache;
  }

  var innerContent = exports.generatePostHTML(post, language, innerPage,
      modding, preview, boardData, userRole, cacheField, operations, last);

  if (!last && !modding && innerPage) {
    post.tempCache = innerContent;
  }

  return innerContent;
};

exports.getCacheField = function(preview, innerPage, modding, userRole,
    language) {

  var toReturn;

  var clearIp = userRole <= clearIpRole;

  if (modding && !innerPage && clearIp) {
    toReturn = 'outerClearCache';
  } else if (modding && !innerPage && !clearIp) {
    toReturn = 'outerHashedCache';
  } else if (preview && clearIp) {
    toReturn = 'previewCache';
  } else if (preview && !clearIp) {
    toReturn = 'previewHashedCache';
  } else if (!innerPage) {
    toReturn = 'outerCache';
  } else if (!modding) {
    toReturn = 'innerCache';
  } else if (clearIp) {
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

exports.saveCache = function(cacheField, language, innerHTML, boardUri,
    postingIdField, postingId, operations, last) {

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

  operations.push({
    idField : postingIdField,
    op : {
      updateOne : {
        filter : queryBlock,
        update : updateBlock
      }
    }
  });

};

exports.getPostCellBase = function(post) {

  var classToUse = 'postCell';

  var postCell = '<div class="' + classToUse;
  postCell += '" data-boarduri="' + exports.clean(post.boardUri) + '" id="';
  postCell += (post.postId || post.threadId) + '">';

  return postCell;

};

exports.runOps = function(operations, postsOps, threadsOps) {

  var toWait = 0;

  var saveCallback = function(error) {
    if (error && verbose) {
      console.log(error);
    }

    toWait--;

    if (!toWait) {
      exports.handleOps(operations);
    }

  };

  if (postsOps.length) {
    toWait++;
    postsCollection.bulkWrite(postsOps, saveCallback);
  }

  if (threadsOps.length) {
    toWait++;
    threadsCollection.bulkWrite(threadsOps, saveCallback);
  }

};

exports.handleOps = function(operations) {

  if (!operations.length) {
    return;
  }

  var chunk = operations.splice(0, 50);

  if (verbose) {
    console.log('Writing ' + chunk.length + ' individual caches');
  }

  var postsOps = [];
  var threadsOps = [];

  for (var i = 0; i < chunk.length; i++) {
    var op = chunk[i];
    (op.idField === 'threadId' ? threadsOps : postsOps).push(op.op);
  }

  exports.runOps(operations, postsOps, threadsOps);

};

exports.getPosts = function(posts, modding, boardData, userRole, innerPage,
    language, operations, last) {

  var children = '';

  for (var i = 0; posts && i < posts.length; i++) {
    var post = posts[i];

    var postCell = exports.getPostCellBase(post);

    postCell += exports.getPostInnerElements(post, false, language, operations,
        modding, boardData, userRole, innerPage, last);

    children += postCell + '</div>';

  }

  return children;

};
// } Section 3.1: Post content

// Section 3.2: Uploads {
exports.getImgTag = function(file) {

  var img = '<img loading="lazy" src="' + file.thumb + '"';

  if (file.thumb.length > 71 && file.width) {

    var fixedHeight;

    if (file.width < file.height) {
      fixedHeight = thumbSize;
    } else {
      fixedHeight = Math.trunc((thumbSize / file.width) * file.height);
    }

    img += ' height="' + fixedHeight + '"';

  } else {
    img += ' class="variableHeight"';
  }

  return img + '>';

};

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

  cell = cell.replace('__imgLink_children__', exports.getImgTag(file));

  var originalName = exports.clean(file.originalName);

  cell = cell.replace('__originalNameLink_inner__', originalName);
  cell = cell.replace('__originalNameLink_download__', originalName);
  cell = cell.replace('__originalNameLink_href__', file.path);

  return cell;

};

exports.setUploadModElements = function(template, modding, cell, file, index,
    posting) {

  if (!modding) {
    cell = cell.replace('__divHash_location__', '').replace(
        '__unlinkLink_location__', '').replace(
        '__unlinkAndDeleteLink_location__', '');
  } else {

    var activeId;
    var activeField;

    if (posting.postId === posting.threadId) {
      activeId = posting.threadId;
      activeField = 'threadId';
    } else {
      activeId = posting.postId || posting.threadId;
      activeField = posting.postId ? 'postId' : 'threadId';
    }

    var unlinkStart = '/unlinkSingle.js?boardUri=' + posting.boardUri + '&';
    unlinkStart += activeField + '=' + activeId + '&index=' + index;

    cell = cell.replace('__unlinkAndDeleteLink_location__',
        template.removable.unlinkAndDeleteLink).replace(
        '__unlinkLink_location__', template.removable.unlinkLink).replace(
        '__divHash_location__', template.removable.divHash).replace(
        '__labelHash_inner__', file.sha256).replace('__unlinkLink_href__',
        unlinkStart).replace('__unlinkAndDeleteLink_href__',
        unlinkStart + '&delete=1');

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

exports.setUploadCell = function(posting, modding, language) {

  var children = '';

  var files = posting.files;

  var template = templateHandler(language).uploadCell;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];

    var cell = '<figure class="uploadCell">' + template.template;
    cell += '</figure>';

    cell = exports.setUploadModElements(template, modding, exports
        .setUploadLinks(cell, file), file, i, posting);

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
exports.setBanCellHiddenElements = function(ban, template, language) {

  var cell = template.template;

  if (!ban.denied && ban.appeal) {

    cell = cell.replace('__denyForm_location__', template.removable.denyForm);
    cell = cell.replace('__denyIdentifier_value__', ban._id);

  } else {
    cell = cell.replace('__denyForm_location__', '');
  }

  return cell.replace('__liftIdentifier_value__', ban._id);

};

exports.setTargetLabel = function(ban, cell, userRole, template) {

  if ((ban.ip || ban.range) && userRole <= clearIpRole) {

    return cell.replace('__targetLabel_location__',
        template.removable.targetLabel).replace('__targetLabel_inner__',
        miscOps.formatIp(ban.ip || ban.range, ban.ipv6)).replace(
        '__asnPanel_location__', '');

  } else {

    if (ban.asn) {
      cell = cell.replace('__asnPanel_location__', template.removable.asnPanel)
          .replace('__asnLabel_inner__', ban.asn);
    } else {
      cell = cell.replace('__asnPanel_location__', '');
    }

    return cell.replace('__targetLabel_location__', '');

  }

};

exports.setHistoryBanLinks = function(ban, userRole, template, cell) {

  if (ban.ip || ban.bypassId) {

    var affix = '?banId=' + ban._id;

    cell = cell.replace('__postHistoryLink_location__',
        template.removable.postHistoryLink).replace(
        '__offenseRecordLink_location__', template.removable.offenseRecordLink)
        .replace('__offenseRecordLink_href__', '/offenseRecord.js' + affix)
        .replace('__postHistoryLink_href__', '/latestPostings.js' + affix);

    if (userRole <= miscOps.getMaxStaffRole()) {
      cell = cell.replace('__fileHistoryLink_location__',
          template.removable.fileHistoryLink).replace(
          '__fileHistoryLink_href__', '/mediaManagement.js' + affix);
    } else {
      cell = cell.replace('__fileHistoryLink_location__', '');
    }

  } else {
    cell = cell.replace('__postHistoryLink_location__', '').replace(
        '__offenseRecordLink_location__', '').replace(
        '__fileHistoryLink_location__', '');

  }

  return exports.setTargetLabel(ban, cell, userRole, template);

};

exports.setOptionalBanElements = function(ban, userRole, cell, template,
    language) {

  if (ban.appeal) {

    cell = cell.replace('__appealPanel_location__',
        template.removable.appealPanel);
    cell = cell.replace('__appealLabel_inner__', exports.clean(ban.appeal));

  } else {
    cell = cell.replace('__appealPanel_location__', '');
  }

  if (ban.reason) {
    cell = cell.replace('__reasonPanel_location__',
        template.removable.reasonPanel).replace('__reasonLabel_inner__',
        exports.clean(ban.reason));
  } else {
    cell = cell.replace('__reasonPanel_location__', '');
  }

  if (ban.expiration) {

    cell = cell.replace('__expirationPanel_location__',
        template.removable.expirationPanel).replace(
        '__expirationLabel_inner__',
        exports.formatDateToDisplay(ban.expiration, null, language));
  } else {
    cell = cell.replace('__expirationPanel_location__', '');
  }

  return exports.setHistoryBanLinks(ban, userRole, template, cell);

};

exports.getBanCell = function(ban, userRole, globalPage, language) {

  var template = templateHandler(language).banCell;

  var cell = exports.setBanCellHiddenElements(ban, template, language);

  cell = exports
      .setOptionalBanElements(ban, userRole, cell, template, language);

  cell = cell.replace('__idLabel_inner__', ban._id);
  cell = cell.replace('__appliedByLabel_inner__', exports.clean(ban.appliedBy));

  if (!globalPage || !globalBoardModeration || !ban.boardUri) {
    cell = cell.replace('__boardPanel_location__', '');
  } else {
    cell = cell.replace('__boardPanel_location__',
        template.removable.boardPanel);

    cell = cell.replace('__boardLabel_inner__', exports.clean(ban.boardUri));
  }

  return cell;

};

exports.getBanList = function(bans, globalPage, userRole, language) {

  var children = '';

  for (var i = 0; i < bans.length; i++) {
    var cell = exports.getBanCell(bans[i], userRole, globalPage, language);
    children += '<div class="banCell">' + cell + '</div>';
  }

  return children;

};
// } Section 4: Ban div
