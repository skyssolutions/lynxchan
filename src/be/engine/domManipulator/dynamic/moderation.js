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
exports.setRangeBanCells = function(document, rangeBans, boardData, language) {

  var bansDiv = document.getElementById('rangeBansDiv');

  for (var i = 0; i < rangeBans.length; i++) {
    var rangeBan = rangeBans[i];

    var banCell = document.createElement('form');
    banCell.innerHTML = templateHandler(language).rangeBanCell;
    common.setFormCellBoilerPlate(banCell, '/liftBan.js', 'rangeBanCell');

    var rangeToUse;

    if (boardData) {
      rangeToUse = miscOps.hashIpForDisplay(rangeBan.range, boardData.ipSalt);
    } else {
      rangeToUse = rangeBan.range.join('.');
    }

    banCell.getElementsByClassName('rangeLabel')[0].innerHTML = rangeToUse;
    banCell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        rangeBan._id);

    bansDiv.appendChild(banCell);

  }

};

exports.rangeBans = function(rangeBans, boardData, language) {

  try {

    var dom = new JSDOM(templateHandler(language).rangeBansPage);
    var document = dom.window.document;

    document.title = lang(language).titRangeBans;

    var boardIdentifier = document.getElementById('boardIdentifier');

    if (boardData) {
      boardIdentifier.setAttribute('value', boardData.boardUri);
    } else {
      boardIdentifier.remove();
    }

    exports.setRangeBanCells(document, rangeBans, boardData, language);

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 1: Range bans

// Section 2: Hash bans {
exports.setHashBanCells = function(document, hashBans, language) {

  var bansDiv = document.getElementById('hashBansDiv');

  for (var i = 0; i < hashBans.length; i++) {
    var hashBan = hashBans[i];

    var banCell = document.createElement('form');
    banCell.innerHTML = templateHandler(language).hashBanCell;
    common.setFormCellBoilerPlate(banCell, '/liftHashBan.js', 'hashBanCell');

    banCell.getElementsByClassName('hashLabel')[0].innerHTML = hashBan.md5;
    banCell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        hashBan._id);

    bansDiv.appendChild(banCell);
  }

};

exports.hashBans = function(hashBans, boardUri, language) {

  try {

    var dom = new JSDOM(templateHandler(language).hashBansPage);
    var document = dom.window.document;

    document.title = lang(language).titHashBans;

    var boardIdentifier = document.getElementById('boardIdentifier');

    if (boardUri) {
      boardIdentifier.setAttribute('value', boardUri);
    } else {
      boardIdentifier.remove();
    }

    exports.setHashBanCells(document, hashBans, language);

    return dom.serialize();

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
