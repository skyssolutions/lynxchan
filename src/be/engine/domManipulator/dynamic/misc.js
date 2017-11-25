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
exports.setSimpleBoardCellLabels = function(board, cell) {

  cell = cell.replace('__labelPostsPerHour_inner__', board.postsPerHour || 0);

  cell = cell.replace('__labelUniqueIps_inner__', board.uniqueIps || 0);

  cell = cell.replace('__labelPostCount_inner__', board.lastPostId || 0);

  cell = cell.replace('__divDescription__', common
      .clean(board.boardDescription));

  return cell;

};

exports.setBoardCellIndicators = function(cell, removable, board) {

  var specialSettings = board.specialSettings || [];

  if (specialSettings.indexOf('sfw') < 0) {
    cell = cell.replace('__indicatorSfw_location__', '');
  } else {
    cell = cell.replace('__indicatorSfw_location__', removable.indicatorSfw);
  }

  if (!board.inactive) {
    cell = cell.replace('__indicatorInactive_location__', '');
  } else {
    cell = cell.replace('__indicatorInactive_location__',
        removable.indicatorInactive);
  }

  return cell;

};

exports.getBoardCell = function(board, language) {

  var cellTemplate = templateHandler(language, true).boardsCell;

  var boardUri = common.clean(board.boardUri);

  var cell = '<div class="boardsCell">' + cellTemplate.template;
  cell += '</div>';

  var linkContent = '/' + boardUri + '/ - ' + common.clean(board.boardName);

  cell = cell.replace('__linkBoard_href__', '/' + boardUri + '/');
  cell = cell.replace('__linkBoard_inner__', linkContent);

  cell = exports.setSimpleBoardCellLabels(board, cell);

  if (board.tags) {

    cell = cell.replace('__labelTags_location__',
        cellTemplate.removable.labelTags);

    cell = cell.replace('__labelTags_inner__', common.clean(board.tags
        .join(', ')));

  } else {
    cell = cell.replace('__labelTags_location__', '');
  }

  return exports.setBoardCellIndicators(cell, cellTemplate.removable, board);

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

  return common.clean(href);

};

exports.getPages = function(parameters, pageCount) {

  var boilerPlate = exports.getBoardPageLinkBoilerPlate(parameters);

  var children = '';

  for (var j = 1; j <= pageCount; j++) {

    var link = '<a href="/boards.js?page=' + j + boilerPlate + '">';
    link += j + '</a>';

    children += link;
  }

  return children;

};

exports.setBoards = function(boards, document, language) {

  var children = '';

  var cellTemplate = templateHandler(language, true).boardsCell;

  for (var i = 0; i < boards.length; i++) {
    var board = boards[i];

    children += exports.getBoardCell(board, language);

  }

  return document.replace('__divBoards_children__', children);

};

exports.setOverboardLinks = function(template) {

  var document = template.template;

  if (overboard) {
    document = document.replace('__linkOverboard_location__',
        template.removable.linkOverboard);

    document = document
        .replace('__linkOverboard_href__', '/' + overboard + '/');

  } else {
    document = document.replace('__linkOverboard_location__', '');
  }

  if (sfwOverboard) {

    document = document.replace('__linkSfwOver_location__',
        template.removable.linkSfwOver);

    var href = '/' + sfwOverboard + '/';
    document = document.replace('__linkSfwOver_href__', href);

  } else {
    document = document.replace('__linkSfwOver_location__', '');
  }

  return document;

};

exports.boards = function(parameters, boards, pageCount, language) {
  try {

    var template = templateHandler(language, true).boardsPage;

    var document = exports.setOverboardLinks(template).replace('__title__',
        lang(language).titBoards);

    document = exports.setBoards(boards, document, language);

    return document.replace('__divPages_children__', exports.getPages(
        parameters, pageCount));

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 2: Board listing

// Section 3: Ban {
exports.getBanPage = function(ban, language) {

  var template;

  if (ban.range) {
    template = templateHandler(language, true).rangeBanPage;
  } else {
    template = templateHandler(language, true).banPage;
  }

  var document = template.template;

  if (ban.range) {
    document = document.replace('__rangeLabel_inner__', ban.range.join('.'));
  } else {

    document = document.replace('__reasonLabel_inner__', common
        .clean(ban.reason));

    document = document.replace('__idLabel_inner__', ban._id);

    document = document.replace('__expirationLabel_inner__', common
        .formatDateToDisplay(ban.expiration, null, language));

    if (ban.appeal) {
      document = document.replace('__formAppeal_location__', '');
    } else {

      document = document.replace('__formAppeal_location__',
          template.removable.formAppeal);
      document = document.replace('__idIdentifier_value__', ban._id);

    }

  }

  return document;

};

exports.ban = function(ban, board, language) {

  try {

    var document = exports.getBanPage(ban, language).replace('__title__',
        lang(language).titBan);

    document = document.replace('__boardLabel_inner__', common.clean(board));

    return document;

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

exports.noCookieCaptcha = function(parameters, captchaId, language) {

  try {

    var template = templateHandler(language, true).noCookieCaptchaPage;
    var document = template.template.replace('__title__',
        lang(language).titNoCookieCaptcha);

    if (!parameters.solvedCaptcha) {
      document = document.replace('__divSolvedCaptcha_location__', '');
    } else {
      document = document.replace('__divSolvedCaptcha_location__',
          template.removable.divSolvedCaptcha);

      document = document.replace('__labelCaptchaId_inner__',
          parameters.solvedCaptcha);

    }

    document = document.replace('__imageCaptcha_src__',
        '/captcha.js?captchaId=' + captchaId);

    return document.replace('__inputCaptchaId_value__', captchaId);

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};

exports.blockBypass = function(valid, language) {

  try {

    var template = templateHandler(language, true).bypassPage;

    var document = template.template.replace('__title__',
        lang(language).titBlockbypass);

    if (!valid) {
      document = document.replace('__indicatorValidBypass_location__', '');
    } else {
      document = document.replace('__indicatorValidBypass_location__',
          template.removable.indicatorValidBypass);
    }

    if (!blockBypass) {
      document = document.replace('__renewForm_location__', '');
    } else {
      document = document.replace('__renewForm_location__',
          template.removable.renewForm);
    }

    return document;

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