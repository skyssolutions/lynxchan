'use strict';

// handles miscellaneous pages

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
var logger = require('../../../logger');
var debug = require('../../../kernel').debug();
var verbose;
var overboard;
var templateHandler;
var lang;
var common;
var miscOps;
var boardCreationRequirement;

exports.optionalStringLogParameters = [ 'user', 'boardUri', 'after', 'before' ];

exports.accountSettingsRelation = {
  alwaysSignRole : 'checkboxAlwaysSign'
};

exports.loadSettings = function() {

  var settings = require('../../../settingsHandler').getGeneralSettings();

  verbose = settings.verbose;
  overboard = settings.overboard;
  boardCreationRequirement = settings.boardCreationRequirement;

};

exports.loadDependencies = function() {

  templateHandler = require('../../templateHandler');
  lang = require('../../langOps').languagePack();

  common = require('..').common;
  miscOps = require('../../miscOps');

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
exports.fillBoardsDiv = function(document, boardDiv, boardList) {

  if (!boardList || !boardList.length) {
    return;
  }

  for (var i = 0; i < boardList.length; i++) {
    var link = document.createElement('a');

    if (i) {
      boardDiv.appendChild(document.createElement('br'));
    }

    link.innerHTML = '/' + boardList[i] + '/';
    link.href = '/boardManagement.js?boardUri=' + boardList[i];

    boardDiv.appendChild(link);

  }

};

exports.setBoardCreationForm = function(userData, document) {

  var allowed = userData.globalRole <= boardCreationRequirement;

  if (boardCreationRequirement <= miscOps.getMaxStaffRole() && !allowed) {
    common.removeElement(document.getElementById('boardCreationDiv'));
  }
};

exports.setAccountSettingsCheckbox = function(settings, document) {

  if (!settings || !settings.length) {
    return;
  }

  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];

    var checkbox = document
        .getElementById(exports.accountSettingsRelation[setting]);

    checkbox.setAttribute('checked', true);
  }

};

exports.setTitleLoginAndStaff = function(document, userData) {

  document.title = lang.titAccount.replace('{$login}', userData.login);

  var loginLabel = document.getElementById('labelLogin');

  loginLabel.innerHTML = userData.login;

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  exports.setBoardCreationForm(userData, document);

  if (!globalStaff) {
    common.removeElement(document.getElementById('globalManagementLink'));
  }

};

exports.account = function(userData) {

  try {
    var document = jsdom(templateHandler.accountPage);

    exports.setTitleLoginAndStaff(document, userData);

    exports.setAccountSettingsCheckbox(userData.settings, document);

    if (userData.email && userData.email.length) {
      document.getElementById('emailField').setAttribute('value',
          userData.email);
    }

    exports.fillBoardsDiv(document, document.getElementById('ownedDiv'),
        userData.ownedBoards);

    exports.fillBoardsDiv(document, document.getElementById('volunteeredDiv'),
        userData.volunteeredBoards);

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
exports.setLogIndexCell = function(dateCell, date) {

  dateCell.setAttribute('class', 'logIndexCell');
  dateCell.innerHTML = templateHandler.logIndexCell;

  var link = dateCell.getElementsByClassName('dateLink')[0];
  link.innerHTML = common.formatDateToDisplay(date, true);

  link.href = '/.global/logs/' + logger.formatedDate(date) + '.html';

};

exports.logs = function(dates) {

  try {

    var document = jsdom(templateHandler.logIndexPage);

    document.title = lang.titLogs;

    var divDates = document.getElementById('divDates');

    for (var i = 0; i < dates.length; i++) {

      var dateCell = document.createElement('div');

      exports.setLogIndexCell(dateCell, dates[i]);

      divDates.appendChild(dateCell);
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
// } Section 2: Logs

// Section 3: Board listing {
exports.setSimpleBoardCellLabels = function(board, boardCell) {

  var labelPPH = boardCell.getElementsByClassName('labelPostsPerHour')[0];
  labelPPH.innerHTML = board.postsPerHour || 0;

  var labelUniqueIps = boardCell.getElementsByClassName('labelUniqueIps')[0];
  labelUniqueIps.innerHTML = board.uniqueIps || 0;

  var labelCount = boardCell.getElementsByClassName('labelPostCount')[0];
  labelCount.innerHTML = board.lastPostId || 0;

  var labelDescription = boardCell.getElementsByClassName('divDescription')[0];
  labelDescription.innerHTML = board.boardDescription;

};

exports.setBoardCell = function(board, boardCell) {

  var linkContent = '/' + board.boardUri + '/ - ' + board.boardName;
  var boardLink = boardCell.getElementsByClassName('linkBoard')[0];
  boardLink.href = '/' + board.boardUri + '/';
  boardLink.innerHTML = linkContent;

  exports.setSimpleBoardCellLabels(board, boardCell);

  var labelTags = boardCell.getElementsByClassName('labelTags')[0];

  if (board.tags) {
    labelTags.innerHTML = board.tags.join(', ');
  } else {
    common.removeElement(labelTags);
  }
};

exports.setPages = function(parameters, document, pageCount) {
  var pagesDiv = document.getElementById('divPages');

  for (var j = 1; j <= pageCount; j++) {

    var link = document.createElement('a');
    link.innerHTML = j;

    var href = '/boards.js?page=' + j;

    if (parameters.boardUri) {
      href += '&boardUri=' + parameters.boardUri;
    }

    if (parameters.tags) {
      href += '&tags=' + parameters.tags;
    }

    link.href = href;

    pagesDiv.appendChild(link);
  }
};

exports.setBoards = function(boards, document) {

  var divBoards = document.getElementById('divBoards');

  for (var i = 0; i < boards.length; i++) {
    var board = boards[i];

    var boardCell = document.createElement('div');
    boardCell.innerHTML = templateHandler.boardsCell;
    boardCell.setAttribute('class', 'boardsCell');

    exports.setBoardCell(board, boardCell);

    divBoards.appendChild(boardCell);
  }

};

exports.boards = function(parameters, boards, pageCount) {
  try {
    var document = jsdom(templateHandler.boardsPage);

    document.title = lang.titBoards;

    var linkOverboard = document.getElementById('linkOverboard');

    if (overboard) {
      linkOverboard.href = '/' + overboard + '/';
    } else {
      common.removeElement(linkOverboard);
    }

    exports.setBoards(boards, document);

    exports.setPages(parameters, document, pageCount);

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

// Section 4: Ban {
exports.setBanPage = function(document, ban, board) {

  document.getElementById('boardLabel').innerHTML = board;

  if (ban.range) {
    document.getElementById('rangeLabel').innerHTML = ban.range.join('.');
  } else {

    document.getElementById('reasonLabel').innerHTML = ban.reason;

    document.getElementById('idLabel').innerHTML = ban._id;

    ban.expiration = common.formatDateToDisplay(ban.expiration);
    document.getElementById('expirationLabel').innerHTML = ban.expiration;

    if (ban.appeal) {
      common.removeElement(document.getElementById('formAppeal'));
    } else {

      var identifier = document.getElementById('idIdentifier');
      identifier.setAttribute('value', ban._id);

    }

  }

};

exports.ban = function(ban, board) {

  try {

    var templateToUse;

    if (ban.range) {
      templateToUse = templateHandler.rangeBanPage;
    } else {
      templateToUse = templateHandler.banPage;
    }

    var document = jsdom(templateToUse);

    document.title = lang.titBan;

    exports.setBanPage(document, ban, board);

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
// } Section 4: Ban

// Section 5: Hash ban page {
exports.setHashBanCells = function(document, hashBans) {

  var panel = document.getElementById('hashBansPanel');

  for (var i = 0; i < hashBans.length; i++) {

    var hashBan = hashBans[i];

    var cell = document.createElement('div');
    cell.innerHTML = templateHandler.hashBanCellDisplay;
    cell.setAttribute('class', 'hashBanCellDisplay');

    cell.getElementsByClassName('labelFile')[0].innerHTML = hashBan.file;

    var boardLabel = cell.getElementsByClassName('labelBoard')[0];

    boardLabel.innerHTML = hashBan.boardUri || lang.miscAllBoards;

    panel.appendChild(cell);

  }

};

exports.hashBan = function(hashBans) {

  try {

    var document = jsdom(templateHandler.hashBanPage);

    document.title = lang.titHashBan;

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
// } Section 5: Hash ban page

// Section 6: Message page {
exports.setMessageRedirect = function(document, link) {

  var redirectLink = document.getElementById('linkRedirect');

  redirectLink.href = link;

  var meta = document.createElement('META');

  meta.httpEquiv = 'refresh';
  meta.content = '3; url=' + link;

  document.getElementsByTagName('head')[0].appendChild(meta);

};

exports.message = function(message, link) {

  try {

    var document = jsdom(templateHandler.messagePage);

    document.title = message;

    var messageLabel = document.getElementById('labelMessage');

    messageLabel.innerHTML = message;

    exports.setMessageRedirect(document, link);

    return serializer(document);
  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString;
  }

};
// } Section 6: Message page

// Section 7: Edit page {
exports.setEditIdentifiers = function(parameters, document) {

  if (parameters.threadId) {
    document.getElementById('threadIdentifier').setAttribute('value',
        parameters.threadId);

    common.removeElement(document.getElementById('postIdentifier'));

  } else {
    document.getElementById('postIdentifier').setAttribute('value',
        parameters.postId);
    common.removeElement(document.getElementById('threadIdentifier'));
  }

};

exports.edit = function(parameters, message) {
  try {

    var document = jsdom(templateHandler.editPage);

    document.title = lang.titEdit;

    document.getElementById('fieldMessage').defaultValue = message;

    document.getElementById('boardIdentifier').setAttribute('value',
        parameters.boardUri);

    exports.setEditIdentifiers(parameters, document);

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
// } Section 7: Edit page

// Section 8: No cookie captcha {
exports.setCaptchaIdAndImage = function(document, captchaId) {

  var captchaPath = '/captcha.js?captchaId=' + captchaId;
  document.getElementById('imageCaptcha').src = captchaPath;

  document.getElementById('inputCaptchaId').setAttribute('value', captchaId);

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

    exports.setCaptchaIdAndImage(document, captchaId);

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
// } Section 8: No cookie captcha

// Section 9: Archive index {
exports.setArchiveIndexCell = function(cell, board) {

  cell.innerHTML = templateHandler.mainArchiveCell;
  cell.setAttribute('class', 'mainArchiveCell');

  var link = cell.getElementsByClassName('linkBoard')[0];

  link.href = '/' + board + '/';
  link.innerHTML = board;

};

exports.mainArchive = function(boards) {

  try {

    var document = jsdom(templateHandler.mainArchivePage);

    document.title = lang.titMainArchive;

    var boardsDiv = document.getElementById('boardsDiv');

    for (var i = 0; i < boards.length; i++) {

      var cell = document.createElement('div');

      exports.setArchiveIndexCell(cell, boards[i]);

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
// } Section 9: Archive index

// Section 10: Board archive {
exports.setBoardArchiveCell = function(cell, thread, boardUri) {

  cell.innerHTML = templateHandler.boardArchiveCell;
  cell.setAttribute('class', 'boardArchiveCell');

  var link = cell.getElementsByClassName('linkThread')[0];

  link.href = '/' + boardUri + '/res/' + thread + '.html';
  link.innerHTML = thread;

};

exports.boardArchive = function(boardUri, threads) {

  try {

    var document = jsdom(templateHandler.boardArchivePage);

    document.title = lang.titBoardArchive.replace('{$board}', boardUri);

    var threadsDiv = document.getElementById('threadsDiv');

    for (var i = 0; i < threads.length; i++) {

      var cell = document.createElement('div');

      exports.setBoardArchiveCell(cell, threads[i], boardUri);

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
// } Section 10: Board archive

exports.blockBypass = function(valid) {

  try {

    var document = jsdom(templateHandler.bypassPage);

    document.title = lang.titBlockbypass;

    if (!valid) {
      common.removeElement(document.getElementById('indicatorValidBypass'));
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