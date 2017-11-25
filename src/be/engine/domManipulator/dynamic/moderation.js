'use strict';

// handles moderation pages. The difference between moderation and management is
// that moderation is focused on restricting users

var JSDOM = require('jsdom').JSDOM;
var debug = require('../../../kernel').debug();
var templateHandler;
var lang;
var miscOps;
var common;

var boardModerationIdentifiers = [ 'boardTransferIdentifier',
    'boardDeletionIdentifier', 'specialSettingsIdentifier' ];

var specialSettingsRelation = {
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

  try {

    var document = templateHandler(language, true).bansPage.template.replace(
        '__title__', lang(language).titBansManagement);

    return document.replace('__bansDiv_children__', common.getBanList(bans,
        globalPage, language));

  } catch (error) {
    return error.stack.replace(/\n/g, '<br>');
  }

};

exports.closedReports = function(reports, language) {

  try {
    var document = templateHandler(language, true).closedReportsPage.template
        .replace('__title__', lang(language).titClosedReports);

    var children = '';

    var cellTemplate = templateHandler(language, true).closedReportCell;

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

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }
};

// Section 1: Range bans {
exports.getRangeBanCells = function(rangeBans, boardData, language) {

  var children = '';

  var template = templateHandler(language, true).rangeBanCell;

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

  try {

    var template = templateHandler(language, true).rangeBansPage;

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

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 1: Range bans

// Section 2: Hash bans {
exports.getHashBanCells = function(hashBans, language) {

  var children = '';

  var template = templateHandler(language, true).hashBanCell.template;

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

  try {

    var template = templateHandler(language, true).hashBansPage;

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

    return document.replace('__hashBansDiv_children__', exports
        .getHashBanCells(hashBans, language));

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }
};
// } Section 2: Hash bans

// Section 3: Board moderation {
exports.setSpecialCheckboxesAndIdentifiers = function(document, boardData) {

  var specialSettings = boardData.specialSettings || [];

  for ( var key in specialSettingsRelation) {

    if (!specialSettingsRelation.hasOwnProperty(key)) {
      continue;
    }

    var field = '__' + specialSettingsRelation[key] + '_checked__';

    if (specialSettings.indexOf(key) > -1) {
      document = document.replace(field, 'checked');
    } else {
      document = document.replace('checked="' + field + '"', '');
    }
  }

  for (var i = 0; i < boardModerationIdentifiers.length; i++) {

    var identifier = boardModerationIdentifiers[i];

    document = document.replace('__' + identifier + '_value__',
        boardData.boardUri);

  }

  return document;

};

exports.boardModeration = function(boardData, ownerData, language) {

  try {

    boardData.boardUri = common.clean(boardData.boardUri);

    var document = templateHandler(language, true).boardModerationPage.template
        .replace('__title__', lang(language).titBoardModeration.replace(
            '{$board}', boardData.boardUri));

    var children = '';

    var volunteers = boardData.volunteers || [];

    for (var i = 0; i < volunteers.length; i++) {
      children += '<div>' + common.clean(volunteers[i]) + '</div>';
    }

    document = document.replace('__divVolunteers_children__', children);

    document = exports.setSpecialCheckboxesAndIdentifiers(document, boardData);

    document = document.replace('__labelOwner_inner__', common
        .clean(ownerData.login));

    document = document.replace('__labelLastSeen_inner__',
        ownerData.lastSeen ? common.formatDateToDisplay(ownerData.lastSeen,
            false, language) : '');

    var title = '/' + boardData.boardUri + '/ - ' + boardData.boardName;

    return document.replace('__labelTitle_inner__', title);

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 3: Board moderation
