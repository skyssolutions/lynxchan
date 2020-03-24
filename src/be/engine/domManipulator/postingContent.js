'use strict';

var lang;
var common;
var minClearIpRole;
var miscOps;
var redactedModNames;

exports.maxPreviewBreaks = 16;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  redactedModNames = settings.redactModNames;
  minClearIpRole = settings.clearIpMinRole;

};

exports.loadDependencies = function() {
  lang = require('../langOps').languagePack;
  common = require('./common');
  miscOps = require('../miscOps');
};

exports.setSharedSimpleElements = function(postingCell, posting, innerPage,
    modding, removable, language) {

  var name = common.clean(posting.name);

  postingCell = postingCell.replace('__linkName_inner__', name);

  if (posting.email) {

    var email = 'mailto:' + common.clean(posting.email);

    postingCell = postingCell.replace('__linkName_href__', email);
    postingCell = postingCell.replace('__linkName_class__', '');

  } else {
    postingCell = postingCell.replace('__linkName_class__', ' noEmailName');
    postingCell = postingCell.replace('href="__linkName_href__"', '');
  }

  postingCell = postingCell.replace('__labelCreated_inner__', common
      .formatDateToDisplay(posting.creation, null, language));

  postingCell = exports.addMessage(innerPage, modding, postingCell, posting,
      removable);

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

exports.setPostingLinks = function(postingCell, posting, innerPage, modding,
    removable) {

  var boardUri = common.clean(posting.boardUri);

  var linkStart = '';

  if (!innerPage) {
    if (modding) {
      linkStart = '/mod.js?boardUri=' + boardUri + '&threadId=';
      linkStart += posting.threadId;
    } else {
      linkStart = '/' + boardUri + '/res/' + posting.threadId + '.html';
    }

  }

  linkStart += '#';

  var selfId = posting.postId || posting.threadId;

  var linkSelf = linkStart + selfId;
  postingCell = postingCell.replace('__linkSelf_href__', linkSelf);

  var linkQuote = linkStart + 'q' + selfId;
  postingCell = postingCell.replace('__linkQuote_href__', linkQuote).replace(
      '__linkQuote_inner__', selfId);

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

  return cell.replace('__labelIp_inner__', miscOps.hashIpForDisplay(
      postingData.ip, boardData.ipSalt, userRole));

};

exports.setNonIpModdingElements = function(modding, posting, cell, boardData,
    userRole, removable) {

  if (modding) {
    var editLink = '/edit.js?boardUri=' + common.clean(posting.boardUri);

    if (posting.postId && posting.postId !== posting.threadId) {
      editLink += '&postId=' + posting.postId;
    } else {
      editLink += '&threadId=' + posting.threadId;
    }

    cell = cell.replace('__linkEdit_location__', removable.linkEdit).replace(
        '__linkEdit_href__', editLink);
  } else {
    cell = cell.replace('__linkEdit_location__', '');
  }

  if (modding && posting.bypassId) {

    cell = cell.replace('__panelBypassId_location__', removable.panelBypassId)
        .replace(
            '__labelBypassId_inner__',
            miscOps.hashIpForDisplay([ posting.bypassId ], boardData.ipSalt,
                userRole));
  } else {
    cell = cell.replace('__panelBypassId_location__', '');
  }

  return cell;

};

exports.setModdingLinks = function(cell, modding, postingData, removable) {

  if (modding && (postingData.ip || postingData.bypassId)) {
    var urlAffix = '?boardUri=' + postingData.boardUri + '&';

    if (postingData.postId && postingData.postId !== postingData.threadId) {
      urlAffix += 'postId=' + postingData.postId;
    } else {
      urlAffix += 'threadId=' + postingData.threadId;
    }

    cell = cell.replace('__linkHistory_location__', removable.linkHistory)
        .replace('__linkFileHistory_location__', removable.linkFileHistory)
        .replace('__linkOffenseRecord_location__', removable.linkOffenseRecord)
        .replace('__linkHistory_href__', '/latestPostings.js' + urlAffix)
        .replace('__linkFileHistory_href__', '/mediaManagement.js' + urlAffix)
        .replace('__linkOffenseRecord_href__', '/offenseRecord.js' + urlAffix);

  } else {
    cell = cell.replace('__linkHistory_location__', '').replace(
        '__linkFileHistory_location__', '').replace(
        '__linkOffenseRecord_location__', '');
  }

  return cell;

};

exports.setPostingModdingElements = function(modding, posting, cell, bData,
    userRole, removable) {

  bData = bData || {};

  cell = exports.setNonIpModdingElements(modding, posting, cell, bData,
      userRole, removable);

  if (modding && posting.asn) {
    cell = cell.replace('__panelASN_location__', removable.panelASN).replace(
        '__labelASN_inner__', posting.asn);
  } else {
    cell = cell.replace('__panelASN_location__', '');
  }

  // Due to technical limitations regarding individual caches, I decided to show
  // the link to users that are not in the global staff.
  if (modding && posting.ip) {
    cell = cell.replace('__panelIp_location__', removable.panelIp);

    cell = exports.setPostingIp(cell, posting, bData, userRole, removable);

  } else {
    cell = cell.replace('__panelIp_location__', '');
  }

  return exports.setModdingLinks(cell, modding, posting, removable);

};

exports.setPostingComplexElements = function(posting, postingCell, removable) {

  if (posting.signedRole) {
    postingCell = postingCell.replace('__labelRole_location__',
        removable.labelRole).replace('__labelRole_inner__', posting.signedRole);

  } else {
    postingCell = postingCell.replace('__labelRole_location__', '');
  }

  var checkboxName = common.clean(posting.boardUri) + '-' + posting.threadId;
  if (posting.postId && posting.postId !== posting.threadId) {
    checkboxName += '-' + posting.postId;
  }

  postingCell = postingCell.replace('__deletionCheckBox_name__', checkboxName);

  return postingCell;

};

exports.setLabels = function(cell, posting, language, removable, preview) {

  if (!preview) {
    cell = cell.replace('__labelBoard_location__', '');
  } else {
    cell = cell.replace('__labelBoard_location__', removable.labelBoard)
        .replace('__labelBoard_inner__',
            '/' + common.clean(posting.boardUri) + '/');
  }

  if (posting.lastEditTime) {

    var formatedDate = common.formatDateToDisplay(posting.lastEditTime, null,
        language);

    cell = cell.replace('__labelLastEdit_location__', removable.labelLastEdit)
        .replace(
            '__labelLastEdit_inner__',
            lang(language).guiEditInfo.replace('{$date}', formatedDate)
                .replace(
                    '{$login}',
                    redactedModNames ? lang(language).guiRedactedName : common
                        .clean(posting.lastEditLogin)));

  } else {
    cell = cell.replace('__labelLastEdit_location__', '');
  }

  if (!posting.banMessage) {
    cell = cell.replace('__divBanMessage_location__', '');
  } else {
    cell = cell.replace('__divBanMessage_location__', removable.divBanMessage)
        .replace('__divBanMessage_inner__', common.clean(posting.banMessage));
  }

  return cell;

};

exports.setSharedHideableElements = function(posting, removable, postingCell,
    preview, language) {

  postingCell = exports.setLabels(exports.setPostingFlag(posting, postingCell,
      removable), posting, language, removable, preview);

  if (posting.subject) {
    postingCell = postingCell.replace('__labelSubject_location__',
        removable.labelSubject).replace('__labelSubject_inner__',
        common.clean(posting.subject));
  } else {
    postingCell = postingCell.replace('__labelSubject_location__', '');
  }

  if (posting.id) {
    return postingCell.replace('__spanId_location__', removable.spanId)
        .replace('__labelId_inner__', posting.id).replace('__labelId_style__',
            'background-color: #' + posting.id);
  } else {
    return postingCell.replace('__spanId_location__', '');
  }

};

exports.addMessage = function(innerPage, modding, cell, posting, removable) {

  var markdown = posting.markdown;

  var arrayToUse = (markdown.match(/\n/g) || []);

  if (!innerPage && arrayToUse.length > exports.maxPreviewBreaks) {

    cell = cell.replace('__contentOmissionIndicator_location__',
        removable.contentOmissionIndicator);

    markdown = markdown.split('\n', exports.maxPreviewBreaks + 1).join('\n');

    if (!modding) {
      var href = '/' + posting.boardUri + '/res/' + posting.threadId + '.html';
    } else {
      href = '/mod.js?boardUri=' + posting.boardUri + '&threadId=';
      href += posting.threadId;
    }

    href += '#' + (posting.postId || posting.threadId);

    cell = cell.replace('__linkFullText_href__', href);

  } else {
    cell = cell.replace('__contentOmissionIndicator_location__', '');
  }

  return cell.replace('__divMessage_inner__', common.clean(common
      .matchCodeTags(markdown)));

};

exports.setAllSharedPostingElements = function(postingCell, posting, removable,
    language, modding, innerPage, userRole, boardData, preview) {

  postingCell = exports.setPostingModdingElements(modding || preview, posting,
      postingCell, preview ? boardData[posting.boardUri] : boardData, userRole,
      removable);

  postingCell = exports.setSharedHideableElements(posting, removable,
      postingCell, preview, language);

  postingCell = exports.setPostingLinks(postingCell, posting, innerPage,
      modding, removable);

  postingCell = exports.setPostingComplexElements(posting, postingCell,
      removable);

  postingCell = exports.setSharedSimpleElements(postingCell, posting,
      innerPage, modding, removable, language);

  if (!posting.files || !posting.files.length) {
    return postingCell.replace('__panelUploads_location__', '');
  }

  postingCell = postingCell.replace('__panelUploads_location__',
      removable.panelUploads);

  postingCell = postingCell.replace(' __panelUploads_class__',
      posting.files.length > 1 ? ' multipleUploads' : '');

  return postingCell.replace('__panelUploads_children__', common.setUploadCell(
      posting, modding || preview, language));

};
