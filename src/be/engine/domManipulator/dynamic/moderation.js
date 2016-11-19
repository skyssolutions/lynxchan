'use strict';

// handles moderation pages. The difference between moderation and management is
// that moderation is focused on restricting users

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
var debug = require('../../../kernel').debug();
var verbose;
var templateHandler;
var lang;
var miscOps;
var common;

var boardModerationIdentifiers = [ 'boardTransferIdentifier',
    'boardDeletionIdentifier', 'specialSettingsIdentifier' ];

var specialSettingsRelation = {
  sfw : 'checkboxSfw'
};

exports.loadSettings = function() {

  var settings = require('../../../settingsHandler').getGeneralSettings();
  verbose = settings.verbose;

};

exports.loadDependencies = function() {

  miscOps = require('../../miscOps');
  templateHandler = require('../../templateHandler').getTemplates;
  lang = require('../../langOps').languagePack();
  common = require('..').common;

};

// Section 1: Bans {
exports.bans = function(bans) {

  try {

    var document = jsdom(templateHandler().bansPage);

    document.title = lang.titBansManagement;

    common.setBanList(document, document.getElementById('bansDiv'), bans);

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();

  }

};
// } Section 1: Bans

// Section 2: Closed reports {
exports.setClosedReportCell = function(cell, report) {

  cell.innerHTML = templateHandler().closedReportCell;
  cell.setAttribute('class', 'closedReportCell');

  if (report.reason) {
    var reason = cell.getElementsByClassName('reasonLabel')[0];
    reason.innerHTML = report.reason;
  }

  var reportLink = cell.getElementsByClassName('link')[0];
  reportLink.setAttribute('href', common.getReportLink(report));

  var closedBy = cell.getElementsByClassName('closedByLabel')[0];
  closedBy.innerHTML = report.closedBy;

  var closedDate = cell.getElementsByClassName('closedDateLabel')[0];
  closedDate.innerHTML = report.closing;
};

exports.closedReports = function(reports, callback) {

  try {
    var document = jsdom(templateHandler().closedReportsPage);

    document.title = lang.titClosedReports;

    var reportsDiv = document.getElementById('reportDiv');

    for (var i = 0; i < reports.length; i++) {

      var cell = document.createElement('div');

      exports.setClosedReportCell(cell, reports[i]);

      reportsDiv.appendChild(cell);

    }

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }
};
// } Section 2: Closed reports

// Section 3: Range bans {
exports.setRangeBanCells = function(document, rangeBans, boardData) {

  var bansDiv = document.getElementById('rangeBansDiv');

  for (var i = 0; i < rangeBans.length; i++) {
    var rangeBan = rangeBans[i];

    var banCell = document.createElement('form');
    banCell.innerHTML = templateHandler().rangeBanCell;
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

exports.rangeBans = function(rangeBans, boardData) {

  try {

    var document = jsdom(templateHandler().rangeBansPage);

    document.title = lang.titRangeBans;

    var boardIdentifier = document.getElementById('boardIdentifier');

    if (boardData) {
      boardIdentifier.setAttribute('value', boardData.boardUri);
    } else {
      common.removeElement(boardIdentifier);
    }

    exports.setRangeBanCells(document, rangeBans, boardData);

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }

};
// } Section 3: Range bans

// Section 4: Hash bans {
exports.setHashBanCells = function(document, hashBans) {

  var bansDiv = document.getElementById('hashBansDiv');

  for (var i = 0; i < hashBans.length; i++) {
    var hashBan = hashBans[i];

    var banCell = document.createElement('form');
    banCell.innerHTML = templateHandler().hashBanCell;
    common.setFormCellBoilerPlate(banCell, '/liftHashBan.js', 'hashBanCell');

    banCell.getElementsByClassName('hashLabel')[0].innerHTML = hashBan.md5;
    banCell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        hashBan._id);

    bansDiv.appendChild(banCell);
  }

};

exports.hashBans = function(hashBans, boardUri) {

  try {

    var document = jsdom(templateHandler().hashBansPage);

    document.title = lang.titHashBans;

    var boardIdentifier = document.getElementById('boardIdentifier');

    if (boardUri) {
      boardIdentifier.setAttribute('value', boardUri);
    } else {
      common.removeElement(boardIdentifier);
    }

    exports.setHashBanCells(document, hashBans);

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }
};

// } Section 4: Hash bans

// Section 5: Board moderation {
exports.setSpecialCheckboxesAndIdentifiers = function(document, boardData) {

  var specialSettings = boardData.specialSettings || [];

  for ( var key in specialSettingsRelation) {

    if (!specialSettingsRelation.hasOwnProperty(key)) {
      continue;
    }

    if (specialSettings.indexOf(key) > -1) {
      document.getElementById(specialSettingsRelation[key]).setAttribute(
          'checked', true);
    }
  }

  for (var i = 0; i < boardModerationIdentifiers.length; i++) {
    document.getElementById(boardModerationIdentifiers[i]).setAttribute(
        'value', boardData.boardUri);
  }

};

exports.boardModeration = function(boardData, ownerData) {

  try {

    var document = jsdom(templateHandler().boardModerationPage);

    document.title = lang.titBoardModeration.replace('{$board}',
        boardData.boardUri);

    exports.setSpecialCheckboxesAndIdentifiers(document, boardData);

    document.getElementById('labelOwner').innerHTML = ownerData.login;

    document.getElementById('labelLastSeen').innerHTML = ownerData.lastSeen;

    var title = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    document.getElementById('labelTitle').innerHTML = title;

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }

};
// } Section 5: Board moderation
