'use strict';

// handles miscellaneous pages

var JSDOM = require('jsdom').JSDOM;
var logger = require('../../../logger');
var debug = require('../../../kernel').debug();
var overboard;
var sfwOverboard;
var templateHandler;
var lang;
var common;
var miscOps;
var blockBypass;
var boardCreationRequirement;
var messageLength;

exports.optionalStringLogParameters = [ 'user', 'boardUri', 'after', 'before' ];

exports.accountSettingsRelation = {
  alwaysSignRole : 'checkboxAlwaysSign'
};

exports.loadSettings = function() {

  var settings = require('../../../settingsHandler').getGeneralSettings();

  blockBypass = settings.bypassMode;
  messageLength = settings.messageLength;
  overboard = settings.overboard;
  sfwOverboard = settings.sfwOverboard;
  boardCreationRequirement = settings.boardCreationRequirement;

};

exports.loadDependencies = function() {

  templateHandler = require('../../templateHandler').getTemplates;
  lang = require('../../langOps').languagePack;

  common = require('..').common;
  miscOps = require('../../miscOps');

};

exports.error = function(code, message, language) {

  try {

    var document = templateHandler(language, true).errorPage.template.replace(
        '__title__', lang(language).titError);

    document = document.replace('__codeLabel_inner__', code);

    return document.replace('__errorLabel_inner__', message);

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');

  }

};

exports.resetEmail = function(password, language) {

  try {

    return templateHandler(language, true).resetEmail.template.replace(
        '__labelNewPass_inner__', password);

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }
};

exports.recoveryEmail = function(recoveryLink, language) {

  try {

    return templateHandler(language, true).recoveryEmail.template.replace(
        '__linkRecovery_href__', recoveryLink);

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
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
    document.getElementById('boardCreationDiv').remove();
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

exports.setTitleLoginAndStaff = function(document, userData, language) {

  document.title = lang(language).titAccount
      .replace('{$login}', userData.login);

  var loginLabel = document.getElementById('labelLogin');

  loginLabel.innerHTML = userData.login;

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  exports.setBoardCreationForm(userData, document);

  if (!globalStaff) {
    document.getElementById('globalManagementLink').remove();
  }

};

exports.account = function(userData, language) {

  try {
    var dom = new JSDOM(templateHandler(language).accountPage);
    var document = dom.window.document;

    exports.setTitleLoginAndStaff(document, userData, language);

    exports.setAccountSettingsCheckbox(userData.settings, document);

    if (userData.email && userData.email.length) {
      document.getElementById('emailField').setAttribute('value',
          userData.email);
    }

    exports.fillBoardsDiv(document, document.getElementById('ownedDiv'),
        userData.ownedBoards);

    exports.fillBoardsDiv(document, document.getElementById('volunteeredDiv'),
        userData.volunteeredBoards);

    return dom.serialize();
  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }
};
// } Section 1: Account

exports.logs = function(dates, language) {

  try {

    var document = templateHandler(language, true).logIndexPage.template
        .replace('__title__', lang(language).titLogs);

    var children = '';

    var cellTemplate = templateHandler(language, true).logIndexCell.template;

    for (var i = 0; i < dates.length; i++) {

      var cell = '<div class="logIndexCell">' + cellTemplate;

      var href = '/.global/logs/' + logger.formatedDate(dates[i]) + '.html';
      var displayDate = common.formatDateToDisplay(dates[i], true, language);

      cell = cell.replace('__dateLink_href__', href);

      children += cell.replace('__dateLink_inner__', displayDate) + '</div>';

    }

    return document.replace('__divDates_children__', children);

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};

// Section 2: Board listing {
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

  var specialSettings = board.specialSettings || [];

  if (specialSettings.indexOf('sfw') < 0) {
    boardCell.getElementsByClassName('indicatorSfw')[0].remove();
  }

  if (!board.inactive) {
    var inactiveIndicator = boardCell
        .getElementsByClassName('indicatorInactive')[0];
    inactiveIndicator.remove();
  }

  if (board.tags) {
    labelTags.innerHTML = board.tags.join(', ');
  } else {
    labelTags.remove();
  }
};

exports.getBoardPageLinkBoilerPlate = function(parameters) {

  var href = '';

  if (parameters.boardUri) {
    href += '&boardUri=' + parameters.boardUri;
  }

  if (parameters.sfw) {
    href += '&sfw=1';
  }

  if (parameters.tags) {
    href += '&tags=' + parameters.tags;
  }

  if (parameters.inactive) {
    href += '&inactive=1';
  }

  if (parameters.sorting) {
    href += '&sorting=' + parameters.sorting;
  }

  return href;

};

exports.setPages = function(parameters, document, pageCount) {
  var pagesDiv = document.getElementById('divPages');

  var boilerPlate = exports.getBoardPageLinkBoilerPlate(parameters);

  for (var j = 1; j <= pageCount; j++) {

    var link = document.createElement('a');
    link.innerHTML = j;
    link.href = '/boards.js?page=' + j + boilerPlate;

    pagesDiv.appendChild(link);
  }
};

exports.setBoards = function(boards, document, language) {

  var divBoards = document.getElementById('divBoards');

  for (var i = 0; i < boards.length; i++) {
    var board = boards[i];

    var boardCell = document.createElement('div');
    boardCell.innerHTML = templateHandler(language).boardsCell;
    boardCell.setAttribute('class', 'boardsCell');

    exports.setBoardCell(board, boardCell);

    divBoards.appendChild(boardCell);
  }

};

exports.setOverboardLinks = function(document) {

  var linkOverboard = document.getElementById('linkOverboard');

  if (overboard) {
    linkOverboard.href = '/' + overboard + '/';
  } else {
    linkOverboard.remove();
  }

  var linkSfwOverboard = document.getElementById('linkSfwOver');

  if (sfwOverboard) {
    linkSfwOverboard.href = '/' + sfwOverboard + '/';
  } else {
    linkSfwOverboard.remove();
  }

};

exports.boards = function(parameters, boards, pageCount, language) {
  try {
    var dom = new JSDOM(templateHandler(language).boardsPage);
    var document = dom.window.document;

    document.title = lang(language).titBoards;

    exports.setOverboardLinks(document);

    exports.setBoards(boards, document, language);

    exports.setPages(parameters, document, pageCount);

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 2: Board listing

// Section 3: Ban {
exports.setBanPage = function(document, ban, board, language) {

  document.getElementById('boardLabel').innerHTML = board;

  if (ban.range) {
    document.getElementById('rangeLabel').innerHTML = ban.range.join('.');
  } else {

    document.getElementById('reasonLabel').innerHTML = ban.reason;

    document.getElementById('idLabel').innerHTML = ban._id;

    ban.expiration = common.formatDateToDisplay(ban.expiration, null, language);
    document.getElementById('expirationLabel').innerHTML = ban.expiration;

    if (ban.appeal) {
      document.getElementById('formAppeal').remove();
    } else {

      var identifier = document.getElementById('idIdentifier');
      identifier.setAttribute('value', ban._id);

    }

  }

};

exports.ban = function(ban, board, language) {

  try {

    var templateToUse;

    if (ban.range) {
      templateToUse = templateHandler(language).rangeBanPage;
    } else {
      templateToUse = templateHandler(language).banPage;
    }

    var dom = new JSDOM(templateToUse);
    var document = dom.window.document;

    document.title = lang(language).titBan;

    exports.setBanPage(document, ban, board, language);

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');

  }

};
// } Section 3: Ban

// Section 4: Hash ban page {
exports.setHashBanCells = function(document, hashBans, language) {

  var panel = document.getElementById('hashBansPanel');

  for (var i = 0; i < hashBans.length; i++) {

    var hashBan = hashBans[i];

    var cell = document.createElement('div');
    cell.innerHTML = templateHandler(language).hashBanCellDisplay;
    cell.setAttribute('class', 'hashBanCellDisplay');

    cell.getElementsByClassName('labelFile')[0].innerHTML = hashBan.file;

    var boardLabel = cell.getElementsByClassName('labelBoard')[0];

    boardLabel.innerHTML = hashBan.boardUri || lang(language).miscAllBoards;

    panel.appendChild(cell);

  }

};

exports.hashBan = function(hashBans, language) {

  try {

    var dom = new JSDOM(templateHandler(language).hashBanPage);
    var document = dom.window.document;

    document.title = lang(language).titHashBan;

    exports.setHashBanCells(document, hashBans, language);

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 4: Hash ban page

exports.edit = function(parameters, posting, language) {
  try {

    var template = templateHandler(language, true).editPage;

    var document = template.template.replace('__labelMessageLength_inner__',
        messageLength).replace('__title__', lang(language).titEdit);

    document = document.replace('__fieldMessage_defaultValue__',
        posting.message);

    document = document
        .replace('__fieldSubject_value__', posting.subject || '');

    document = document.replace('__boardIdentifier_value__', common
        .clean(parameters.boardUri));

    if (parameters.threadId) {

      document = document.replace('__postIdentifier_location__', '');
      document = document.replace('__threadIdentifier_location__',
          template.removable.threadIdentifier);
      document = document.replace('__threadIdentifier_value__',
          parameters.threadId);

    } else {

      document = document.replace('__threadIdentifier_location__', '');
      document = document.replace('__postIdentifier_location__',
          template.removable.postIdentifier);
      document = document
          .replace('__postIdentifier_value__', parameters.postId);

    }

    return document;

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }
};

// Section 5: No cookie captcha {
exports.setCaptchaIdAndImage = function(document, captchaId) {

  var captchaPath = '/captcha.js?captchaId=' + captchaId;
  document.getElementById('imageCaptcha').src = captchaPath;

  document.getElementById('inputCaptchaId').setAttribute('value', captchaId);

};

exports.noCookieCaptcha = function(parameters, captchaId, language) {

  try {

    var dom = new JSDOM(templateHandler(language).noCookieCaptchaPage);
    var document = dom.window.document;

    document.title = lang(language).titNoCookieCaptcha;

    if (!parameters.solvedCaptcha) {
      document.getElementById('divSolvedCaptcha').remove();
    } else {
      var labelSolved = document.getElementById('labelCaptchaId');
      labelSolved.innerHTML = parameters.solvedCaptcha;
    }

    exports.setCaptchaIdAndImage(document, captchaId);

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 5: No cookie captcha

exports.blockBypass = function(valid, language) {

  try {

    var dom = new JSDOM(templateHandler(language).bypassPage);
    var document = dom.window.document;

    document.title = lang(language).titBlockbypass;

    if (!valid) {
      document.getElementById('indicatorValidBypass').remove();
    }

    if (!blockBypass) {
      document.getElementById('renewForm').remove();
    }

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }
};

exports.graphs = function(dates, language) {

  try {

    var document = templateHandler(language, true).graphsIndexPage.template
        .replace('__title__', lang(language).titGraphs);

    var children = '';

    var cellTemplate = templateHandler(language, true).graphIndexCell.template;

    for (var i = 0; i < dates.length; i++) {

      var cell = '<div class="graphIndexCell">' + cellTemplate;

      var href = '/.global/graphs/' + logger.formatedDate(dates[i]) + '.png';
      var displayDate = common.formatDateToDisplay(dates[i], true, language);

      cell = cell.replace('__dateLink_href__', href);

      children += cell.replace('__dateLink_inner__', displayDate) + '</div>';

    }

    return document.replace('__divDates_children__', children);

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};

exports.message = function(message, link, language) {

  try {

    var document = templateHandler(language, true).messagePage.template
        .replace('__title__', message);

    document = document.replace('__labelMessage_inner__', message);
    return document.replace('__linkRedirect_href__', link);

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};