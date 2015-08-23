'use strict';

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
var templateHandler = require('../../templateHandler');
var lang = require('../../langOps').languagePack();
var common = require('..').common;
var boot = require('../../../boot');
var settings = boot.getGeneralSettings();
var debug = boot.debug();
var verbose = settings.verbose;
var miscOps = require('../../miscOps');

var boardCreationRestricted = settings.restrictBoardCreation;

var optionalStringLogParameters = [ 'user', 'boardUri', 'after', 'before' ];

var accountSettingsRelation = {
  alwaysSignRole : 'checkboxAlwaysSign'
};

var availableLogTypes = {
  '' : lang.guiAllTypes,
  archiveDeletion : lang.guiTypeArchiveDeletion,
  ban : lang.guiTypeBan,
  rangeBan : lang.guiTypeRange,
  banLift : lang.guiTypeBanLift,
  deletion : lang.guiTypeDeletion,
  reportClosure : lang.guiTypeReportClosure,
  globalRoleChange : lang.guiTypeGlobalRoleChange,
  boardDeletion : lang.guiTypeBoardDeletion,
  boardTransfer : lang.guiTypeBoardTransfer,
  hashBan : lang.guiTypeHashBan,
  hashBanLift : lang.guiTypeHashBanLift
};

exports.ban = function(ban, board) {

  try {

    var document = jsdom(ban.range ? templateHandler.rangeBanPage
        : templateHandler.banPage);

    document.title = lang.titBan;

    document.getElementById('boardLabel').innerHTML = board;

    if (ban.range) {
      document.getElementById('rangeLabel').innerHTML = ban.range.join('.');
    } else {
      document.getElementById('reasonLabel').innerHTML = ban.reason;

      document.getElementById('idLabel').innerHTML = ban._id;

      ban.expiration = common.formatDateToDisplay(ban.expiration);
      document.getElementById('expirationLabel').innerHTML = ban.expiration;
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

exports.error = function(code, message) {

  try {

    var document = jsdom(templateHandler.errorPage);

    document.title = lang.titError;

    document.getElementById('codeLabel').innerHTML = code;

    document.getElementById('errorLabel').innerHTML = message;

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

exports.resetEmail = function(password) {

  try {

    var document = jsdom(templateHandler.resetEmail);

    var link = document.getElementById('labelNewPass');
    link.innerHTML = password;

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

exports.recoveryEmail = function(recoveryLink) {

  try {

    var document = jsdom(templateHandler.recoveryEmail);

    var link = document.getElementById('linkRecovery');
    link.href = recoveryLink;

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

// Section 1: Account {
function fillOwnedBoardsDiv(document, boardList) {
  if (!boardList || !boardList.length) {
    return;
  }

  var boardDiv = document.getElementById('boardsDiv');

  for (var i = 0; i < boardList.length; i++) {
    var link = document.createElement('a');

    if (i) {
      boardDiv.appendChild(document.createElement('br'));
    }

    link.innerHTML = '/' + boardList[i] + '/';
    link.href = link.innerHTML;

    boardDiv.appendChild(link);

  }

}

function setBoardCreationForm(userData, document) {

  var allowed = userData.globalRole < 2;

  if (boardCreationRestricted && !allowed) {
    common.removeElement(document.getElementById('boardCreationDiv'));
  }
}

function setAccountSettingsCheckbox(settings, document) {

  if (!settings || !settings.length) {
    return;
  }

  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];

    var checkbox = document.getElementById(accountSettingsRelation[setting]);

    checkbox.setAttribute('checked', true);
  }

}

exports.account = function(userData) {

  try {
    var document = jsdom(templateHandler.accountPage);

    document.title = lang.titAccount.replace('{$login}', userData.login);

    var loginLabel = document.getElementById('labelLogin');

    loginLabel.innerHTML = userData.login;

    var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

    setBoardCreationForm(userData, document);

    if (!globalStaff) {
      common.removeElement(document.getElementById('globalManagementLink'));
    }

    setAccountSettingsCheckbox(userData.settings, document);

    if (userData.email && userData.email.length) {
      document.getElementById('emailField').setAttribute('value',
          userData.email);
    }

    fillOwnedBoardsDiv(document, userData.ownedBoards);

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
// } Section 1: Account

// Section 2: Logs {
function fillComboBox(document, parameters) {

  var combobox = document.getElementById('comboboxType');

  for ( var type in availableLogTypes) {

    var option = document.createElement('option');

    option.innerHTML = availableLogTypes[type];
    option.value = type;

    if (parameters.type === type) {
      option.setAttribute('selected', true);
    }

    combobox.appendChild(option);

  }

}

function fillSearchForm(parameters, document) {

  if (parameters.user) {
    document.getElementById('fieldUser').setAttribute('value', parameters.user);
  }

  if (parameters.excludeGlobals) {
    document.getElementById('checkboxExcludeGlobals').setAttribute('checked',
        true);
  }

  if (parameters.after) {
    document.getElementById('fieldAfter').setAttribute('value',
        parameters.after);
  }

  if (parameters.before) {
    document.getElementById('fieldBefore').setAttribute('value',
        parameters.before);
  }

  if (parameters.boardUri) {
    document.getElementById('fieldBoard').setAttribute('value',
        parameters.boardUri);
  }
}

function setLogEntry(logCell, log) {

  if (!log.global) {
    common.removeElement(logCell.getElementsByClassName('indicatorGlobal')[0]);
  }

  var labelType = logCell.getElementsByClassName('labelType')[0];
  labelType.innerHTML = availableLogTypes[log.type];

  var labelTime = logCell.getElementsByClassName('labelTime')[0];
  labelTime.innerHTML = common.formatDateToDisplay(log.time);

  var labelBoard = logCell.getElementsByClassName('labelBoard')[0];
  labelBoard.innerHTML = log.boardUri || '';

  var labelUser = logCell.getElementsByClassName('labelUser')[0];
  labelUser.innerHTML = log.user;

  var labelDescription = logCell.getElementsByClassName('labelDescription')[0];
  labelDescription.innerHTML = log.description;

}

function setLogPages(document, parameters, pageCount) {

  var pagesDiv = document.getElementById('divPages');

  for (var i = 1; i <= pageCount; i++) {

    var pageLink = document.createElement('a');

    pageLink.innerHTML = i;

    var url = '/logs.js?page=' + i;

    if (parameters.excludeGlobals) {
      url += '&excludeGlobals=on';
    }

    if (parameters.type && parameters.type.length) {
      url += '&type=' + parameters.type;
    }

    for (var j = 0; j < optionalStringLogParameters.length; j++) {

      var parameter = optionalStringLogParameters[j];

      if (parameters[parameter]) {
        url += '&' + parameter + '=' + parameters[parameter];
      }

    }

    pageLink.href = url;

    pagesDiv.appendChild(pageLink);

  }

}

exports.logs = function(logs, pageCount, parameters) {
  try {

    var document = jsdom(templateHandler.logsPage);

    document.title = lang.titLogs;

    fillSearchForm(parameters, document);

    fillComboBox(document, parameters);

    var divLogs = document.getElementById('divLogs');

    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];

      var logCell = document.createElement('div');
      logCell.setAttribute('class', 'logCell');
      logCell.innerHTML = templateHandler.logCell;

      setLogEntry(logCell, log);

      divLogs.appendChild(logCell);
    }

    setLogPages(document, parameters, pageCount);

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
// } Section 2: Logs

exports.message = function(message, link) {

  try {

    var document = jsdom(templateHandler.messagePage);

    document.title = message;

    var messageLabel = document.getElementById('labelMessage');

    messageLabel.innerHTML = message;

    var redirectLink = document.getElementById('linkRedirect');

    redirectLink.href = link;

    var meta = document.createElement('META');

    meta.httpEquiv = 'refresh';
    meta.content = '3; url=' + link;

    document.getElementsByTagName('head')[0].appendChild(meta);

    return serializer(document);
  } catch (error) {
    if (verbose) {
      console.log('error ' + error);
    }

    if (debug) {
      throw error;
    }

    return error.toString;
  }

};

// Section 3: Board listing {
function setBoardCell(board, boardCell) {

  var linkContent = '/' + board.boardUri + '/ - ' + board.boardName;
  var boardLink = boardCell.getElementsByClassName('linkBoard')[0];
  boardLink.href = '/' + board.boardUri + '/';
  boardLink.innerHTML = linkContent;

  var labelPPH = boardCell.getElementsByClassName('labelPostsPerHour')[0];
  labelPPH.innerHTML = board.postsPerHour || 0;

  var labelCount = boardCell.getElementsByClassName('labelPostCount')[0];
  labelCount.innerHTML = board.lastPostId || 0;

  var labelDescription = boardCell.getElementsByClassName('divDescription')[0];
  labelDescription.innerHTML = board.boardDescription;

  var labelTags = boardCell.getElementsByClassName('labelTags')[0];

  if (board.tags) {
    labelTags.innerHTML = board.tags.join(', ');
  } else {
    common.removeElement(labelTags);
  }
}

function setPages(document, pageCount) {
  var pagesDiv = document.getElementById('divPages');

  for (var j = 1; j <= pageCount; j++) {

    var link = document.createElement('a');
    link.innerHTML = j;
    link.href = '/boards.js?page=' + j;

    pagesDiv.appendChild(link);
  }
}

exports.boards = function(boards, pageCount) {
  try {
    var document = jsdom(templateHandler.boardsPage);

    document.title = lang.titBoards;

    var divBoards = document.getElementById('divBoards');

    for (var i = 0; i < boards.length; i++) {
      var board = boards[i];

      var boardCell = document.createElement('div');
      boardCell.innerHTML = templateHandler.boardsCell;
      boardCell.setAttribute('class', 'boardsCell');

      setBoardCell(board, boardCell);

      divBoards.appendChild(boardCell);
    }

    setPages(document, pageCount);

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

// } Section 3: Board listing

exports.edit = function(parameters, message) {
  try {

    var document = jsdom(templateHandler.editPage);

    document.title = lang.titEdit;

    document.getElementById('fieldMessage').defaultValue = message;

    document.getElementById('boardIdentifier').setAttribute('value',
        parameters.boardUri);

    if (parameters.threadId) {
      document.getElementById('threadIdentifier').setAttribute('value',
          parameters.threadId);

      common.removeElement(document.getElementById('postIdentifier'));

    } else {
      document.getElementById('postIdentifier').setAttribute('value',
          parameters.postId);
      common.removeElement(document.getElementById('threadIdentifier'));
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

exports.noCookieCaptcha = function(parameters, captchaId) {

  try {

    var document = jsdom(templateHandler.noCookieCaptchaPage);

    document.title = lang.titNoCookieCaptcha;

    if (!parameters.solvedCaptcha) {
      common.removeElement(document.getElementById('divSolvedCaptcha'));
    } else {
      var labelSolved = document.getElementById('labelCaptchaId');
      labelSolved.innerHTML = parameters.solvedCaptcha;
    }

    var captchaPath = '/captcha.js?captchaId=' + captchaId;
    document.getElementById('imageCaptcha').src = captchaPath;

    document.getElementById('inputCaptchaId').setAttribute('value', captchaId);

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

exports.mainArchive = function(boards) {

  try {

    var document = jsdom(templateHandler.mainArchivePage);

    document.title = lang.titMainArchive;

    var boardsDiv = document.getElementById('boardsDiv');

    for (var i = 0; i < boards.length; i++) {

      var cell = document.createElement('div');

      cell.innerHTML = templateHandler.mainArchiveCell;

      var link = cell.getElementsByClassName('linkBoard')[0];

      var board = boards[i];

      link.href = '/' + board + '/';
      link.innerHTML = board;

      boardsDiv.appendChild(cell);
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

exports.boardArchive = function(boardUri, threads) {

  try {

    var document = jsdom(templateHandler.boardArchivePage);

    document.title = lang.titBoardArchive.replace('{$board}', boardUri);

    var threadsDiv = document.getElementById('threadsDiv');

    for (var i = 0; i < threads.length; i++) {

      var cell = document.createElement('div');

      cell.innerHTML = templateHandler.boardArchiveCell;

      var link = cell.getElementsByClassName('linkThread')[0];

      var thread = threads[i];

      link.href = '/' + boardUri + '/res/' + thread + '.html';
      link.innerHTML = thread;

      threadsDiv.appendChild(cell);
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

// This page COULD be static, since it doesn't need any manipulation.
// However, given how often it will be accessed and how it might require
// manipulation in the future, I will leave it as a dynamic page.
exports.archiveDeletion = function() {
  try {
    var document = jsdom(templateHandler.archiveDeletionPage);

    document.title = lang.titArchiveDeletion;

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
