'use strict';

// handles moderation pages. The difference between moderation and management is
// that moderation is focused on restricting users

var templateHandler;
var lang;
var miscOps;
var common;

exports.boardModerationIdentifiers = [ 'boardTransferIdentifier',
    'boardDeletionIdentifier', 'specialSettingsIdentifier' ];

exports.specialSettingsRelation = {
  sfw : 'checkboxSfw',
  locked : 'checkboxLocked'
};

exports.loadDependencies = function() {

  miscOps = require('../../miscOps');
  templateHandler = require('../../templateHandler').getTemplates;
  lang = require('../../langOps').languagePack;
  common = require('..').common;

};

exports.bans = function(bans, globalPage, language) {

  var document = templateHandler(language).bansPage.template.replace(
      '__title__', lang(language).titBansManagement);

  return document.replace('__bansDiv_children__', common.getBanList(bans,
      globalPage, language));

};

exports.closedReports = function(reports, language) {

  var document = templateHandler(language).closedReportsPage.template.replace(
      '__title__', lang(language).titClosedReports);

  var children = '';

  var cellTemplate = templateHandler(language).closedReportCell;

  for (var i = 0; i < reports.length; i++) {

    var report = reports[i];

    var cell = '<div class="closedReportCell">' + cellTemplate.template;

    cell = cell.replace('__reasonLabel_inner__', report.reason ? common
        .clean(report.reason) : '');

    cell = cell.replace('__link_href__', common.getReportLink(report));

    cell = cell.replace('__closedByLabel_inner__', common
        .clean(report.closedBy));

    cell = cell.replace('__closedDateLabel_inner__', common
        .formatDateToDisplay(report.closing, false, language));

    children += cell + '</div>';

  }

  return document.replace('__reportDiv_children__', children);

};

// Section 1: Range bans {
exports.getRangeBanCells = function(rangeBans, boardData, language) {

  var children = '';

  var template = templateHandler(language).rangeBanCell;

  for (var i = 0; i < rangeBans.length; i++) {
    var rangeBan = rangeBans[i];

    var cell = common.getFormCellBoilerPlate(template.template, '/liftBan.js',
        'rangeBanCell');

    var rangeToUse;

    if (boardData) {
      rangeToUse = miscOps.hashIpForDisplay(rangeBan.range, boardData.ipSalt);
    } else {
      rangeToUse = rangeBan.range.join('.');
    }

    cell = cell.replace('__rangeLabel_inner__', rangeToUse);
    cell = cell.replace('__idIdentifier_value__', rangeBan._id);

    children += cell;
  }

  return children;

};

exports.rangeBans = function(rangeBans, boardData, language) {

  var template = templateHandler(language).rangeBansPage;

  var document = template.template.replace('__title__',
      lang(language).titRangeBans);

  if (boardData) {

    document = document.replace('__boardIdentifier_location__',
        template.removable.boardIdentifier);
    document = document.replace('__boardIdentifier_value__', common
        .clean(boardData.boardUri));

  } else {
    document = document.replace('__boardIdentifier_location__', '');
  }

  return document.replace('__rangeBansDiv_children__', exports
      .getRangeBanCells(rangeBans, boardData, language));

};
// } Section 1: Range bans

// Section 2: Hash bans {
exports.getHashBanCells = function(hashBans, language) {

  var children = '';

  var template = templateHandler(language).hashBanCell.template;

  for (var i = 0; i < hashBans.length; i++) {

    var hashBan = hashBans[i];

    var banCell = common.getFormCellBoilerPlate(template, '/liftHashBan.js',
        'hashBanCell');

    banCell = banCell.replace('__hashLabel_inner__', common.clean(hashBan.md5));
    banCell = banCell.replace('__idIdentifier_value__', hashBan._id);

    children += banCell;
  }

  return children;

};

exports.hashBans = function(hashBans, boardUri, language) {

  var template = templateHandler(language).hashBansPage;

  var document = template.template.replace('__title__',
      lang(language).titHashBans);

  if (boardUri) {
    document = document.replace('__boardIdentifier_location__',
        template.removable.boardIdentifier);
    document = document.replace('__boardIdentifier_value__', common
        .clean(boardUri));

  } else {
    document = document.replace('__boardIdentifier_location__', '');
  }

  return document.replace('__hashBansDiv_children__', exports.getHashBanCells(
      hashBans, language));

};
// } Section 2: Hash bans

// Section 3: Board moderation {
exports.setSpecialCheckboxesAndIdentifiers = function(document, boardData) {

  var specialSettings = boardData.specialSettings || [];

  for ( var key in exports.specialSettingsRelation) {

    if (!exports.specialSettingsRelation.hasOwnProperty(key)) {
      continue;
    }

    var field = '__' + exports.specialSettingsRelation[key] + '_checked__';

    if (specialSettings.indexOf(key) > -1) {
      document = document.replace(field, 'checked');
    } else {
      document = document.replace('checked="' + field + '"', '');
    }
  }

  for (var i = 0; i < exports.boardModerationIdentifiers.length; i++) {

    var identifier = exports.boardModerationIdentifiers[i];

    document = document.replace('__' + identifier + '_value__',
        boardData.boardUri);

  }

  return document;

};

exports.boardModeration = function(boardData, ownerData, language) {

  boardData.boardUri = common.clean(boardData.boardUri);

  var document = templateHandler(language).boardModerationPage.template
      .replace('__title__', lang(language).titBoardModeration.replace(
          '{$board}', boardData.boardUri));

  var children = '';

  var volunteers = boardData.volunteers || [];

  for (var i = 0; i < volunteers.length; i++) {

    var volunteer = common.clean(volunteers[i]);

    children += '<a href="/accountManagement.js?account=' + volunteer + '">';
    children += volunteer + '</a>';
  }

  document = document.replace('__divVolunteers_children__', children);

  document = exports.setSpecialCheckboxesAndIdentifiers(document, boardData);

  var owner = common.clean(ownerData.login);

  document = document.replace('__linkOwner_inner__', owner).replace(
      '__linkOwner_href__', '/accountManagement.js?account=' + owner);

  document = document.replace('__labelLastSeen_inner__',
      ownerData.lastSeen ? common.formatDateToDisplay(ownerData.lastSeen,
          false, language) : '');

  var title = '/' + boardData.boardUri + '/ - ' + boardData.boardName;

  return document.replace('__labelTitle_inner__', title);

};
// } Section 3: Board moderation

// Section 4: Latest postings {
exports.getPosts = function(postings, language) {

  var postsContent = '';

  for (var i = 0; i < postings.length; i++) {

    var postContent = common.getPostCellBase(postings[i]);

    postContent += common.getPostInnerElements(postings[i], true, language);

    postsContent += postContent + '</div>';
  }

  return postsContent;

};

exports.latestPostings = function(postings, parameters, language) {

  var document = templateHandler(language).latestPostingsPage.template.replace(
      '__title__', lang(language).titLatestPostings);

  var previousDay = new Date(parameters.date);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  previousDay = encodeURIComponent(previousDay.toUTCString());

  var nextDay = new Date(parameters.date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  nextDay = encodeURIComponent(nextDay.toUTCString());

  var boiler = '/latestPostings.js?boards=' + parameters.boards + '&date=';

  document = document.replace('__linkPrevious_href__', boiler + previousDay);
  document = document.replace('__linkNext_href__', boiler + nextDay);

  document = document.replace('__fieldBoards_value__',
      parameters.boards.join(', ')).replace('__fieldDate_value__',
      parameters.date.toUTCString());

  return document.replace('__divPostings_children__', exports.getPosts(
      postings, language));

};
// } Section 4: Latest postings
