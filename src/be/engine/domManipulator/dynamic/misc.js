'use strict';

// handles miscellaneous pages

var logger = require('../../../logger');
var overboard;
var sfwOverboard;
var templateHandler;
var lang;
var common;
var miscOps;
var blockBypass;
var reportCategories;
var boardCreationRequirement;
var messageLength;
var disabledLatestPostings;

exports.optionalStringLogParameters = [ 'user', 'boardUri', 'after', 'before' ];

exports.accountSettingsRelation = {
  noBoardReports : 'checkboxNoBoardReports',
  alwaysSignRole : 'checkboxAlwaysSign',
  reportNotify : 'checkboxReportNotify'
};

exports.loadSettings = function() {

  var settings = require('../../../settingsHandler').getGeneralSettings();

  reportCategories = settings.reportCategories;
  blockBypass = settings.bypassMode;
  messageLength = settings.messageLength;
  overboard = settings.overboard;
  sfwOverboard = settings.sfwOverboard;
  boardCreationRequirement = settings.boardCreationRequirement;
  disabledLatestPostings = settings.disableLatestPostings;

};

exports.loadDependencies = function() {

  templateHandler = require('../../templateHandler').getTemplates;
  lang = require('../../langOps').languagePack;

  common = require('..').common;
  miscOps = require('../../miscOps');

};

exports.error = function(code, message, language) {

  var document = templateHandler(language).errorPage.template.replace(
      '__title__', lang(language).titError);

  document = document.replace('__codeLabel_inner__', code);

  return document.replace('__errorLabel_inner__', message);

};

exports.resetEmail = function(password, language) {

  return templateHandler(language).resetEmail.template.replace(
      '__labelNewPass_inner__', password);

};

exports.reportNotificationEmail = function(link) {

  return templateHandler().reportNotificationEmail.template.replace(
      '__linkThread_href__', link).replace('__linkThread_inner__', link);

};

exports.recoveryEmail = function(recoveryLink, login, language) {

  return templateHandler(language).recoveryEmail.template.replace(
      '__linkRecovery_href__', recoveryLink).replace('__loginLabel_inner__',
      login);

};

exports.confirmationEmail = function(confirmationLink, login, language) {

  return templateHandler(language).confirmationEmail.template.replace(
      '__confirmationLink_href__', confirmationLink).replace(
      '__loginLabel_inner__', login);

};

// Section 1: Account {
exports.getBoardsDiv = function(boardList) {

  var children = '';

  for (var i = 0; boardList && i < boardList.length; i++) {

    var boardUri = common.clean(boardList[i]);

    var href = '/boardManagement.js?boardUri=' + boardUri;
    children += '<a href="' + href + '">/' + boardUri + '/</a>';
  }

  return children;

};

exports.setFilters = function(document, language, removables, userData) {

  document = document.replace('__reportFilterDiv_location__',
      removables.reportFilterDiv);

  var cell = templateHandler(language).reportCategoryFilterCell.template;

  var children = '';

  var filter = userData.reportFilter || [];

  for (var i = 0; i < reportCategories.length; i++) {
    var category = reportCategories[i];

    var newCell = cell.replace('__categoryLabel_inner__', category).replace(
        '__categoryCheckbox_value__', category);

    if (filter.indexOf(category) >= 0) {
      newCell = newCell.replace('__categoryCheckbox_checked__', 'true');
    } else {
      newCell = newCell.replace('checked="__categoryCheckbox_checked__"', '');
    }

    children += newCell;

  }

  return document.replace('__reportFilterDiv_children__', children);

};

exports.setAccountSettingsCheckbox = function(userData, document, removables,
    language) {

  var settings = userData.settings;

  for ( var key in exports.accountSettingsRelation) {

    var field = '__' + exports.accountSettingsRelation[key] + '_checked__';

    if (settings && settings.indexOf(key) > -1) {
      document = document.replace(field, 'true');
    } else {
      document = document.replace('checked="' + field + '"', '');
    }
  }

  if (reportCategories) {
    return exports.setFilters(document, language, removables, userData);
  } else {
    return document.replace('__reportFilterDiv_location__', '');
  }

};

exports.setAccountHideableElements = function(userData, document, removable) {

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  if (!globalStaff) {
    document = document.replace('__globalManagementLink_location__', '');
  } else {
    document = document.replace('__globalManagementLink_location__',
        removable.globalManagementLink);
  }

  var allowed = userData.globalRole <= boardCreationRequirement;

  if (boardCreationRequirement <= miscOps.getMaxStaffRole() && !allowed) {
    document = document.replace('__boardCreationDiv_location__', '');
  } else {
    document = document.replace('__boardCreationDiv_location__',
        removable.boardCreationDiv);
  }

  if (disabledLatestPostings) {
    document = document.replace('__latestPostingsLink_location__', '');
  } else {

    document = document.replace('__latestPostingsLink_location__',
        removable.latestPostingsLink);
  }

  if (userData.confirmed || !userData.email) {
    document = document.replace('__confirmationForm_location__', '');
  } else {
    document = document.replace('__confirmationForm_location__',
        removable.confirmationForm);
  }

  return document;

};

exports.account = function(userData, language) {

  var template = templateHandler(language).accountPage;

  var login = common.clean(userData.login);

  var document = template.template.replace('__title__',
      lang(language).titAccount.replace('{$login}', login));

  document = document.replace('__labelLogin_inner__', login);

  document = exports.setAccountHideableElements(userData, document,
      template.removable);

  document = exports.setAccountSettingsCheckbox(userData, document,
      template.removable, language);

  document = document.replace('__emailField_value__', common
      .clean(userData.email || ''));

  document = document.replace('__ownedDiv_children__', exports
      .getBoardsDiv(userData.ownedBoards));

  document = document.replace('__labelGlobalRole_inner__', miscOps
      .getGlobalRoleLabel(userData.globalRole, language));

  return document.replace('__volunteeredDiv_children__', exports
      .getBoardsDiv(userData.volunteeredBoards));

};
// } Section 1: Account

exports.logs = function(dates, parameters, language) {

  var boardUri = parameters.boardUri;

  var title = lang(language).titLogs.replace('{$board}',
      parameters.boardUri ? ('/' + parameters.boardUri + '/')
          : lang(language).guiGlobalLogsIndex);

  var label;

  if (!parameters.boardUri) {
    label = lang(language).titLogs.replace('{$board}',
        lang(language).guiGlobalLogsIndex);
  } else {
    label = '/' + common.clean(parameters.boardUri) + '/';
  }

  var document = templateHandler(language).logIndexPage.template.replace(
      '__title__', title).replace('__identifierBoard_value__',
      parameters.boardUri || '').replace('__labelBoard_inner__', label);

  var children = '';

  for (var i = 0; i < dates.length; i++) {

    var cell = '<a href="/.global/logs/' + (parameters.boardUri || '.global');
    cell += '/' + logger.formatedDate(dates[i]);

    var displayDate = common.formatDateToDisplay(dates[i], true, language);
    children += cell + '.html">' + displayDate + '</a>';

  }

  return document.replace('__divDates_children__', children);

};

// Section 2: Board listing {
exports.setSimpleBoardCellLabels = function(board, cell, removable) {

  cell = cell.replace('__labelPostsPerHour_inner__', board.postsPerHour || 0);

  cell = cell.replace('__labelUniqueIps_inner__', board.uniqueIps || 0);

  cell = cell.replace('__labelPostCount_inner__', board.lastPostId || 0);

  if (board.boardDescription) {

    cell = cell
        .replace('__divDescription_location__', removable.divDescription)
        .replace('__divDescription_inner__',
            common.clean(board.boardDescription));

  } else {
    cell = cell.replace('__divDescription_location__', '');
  }

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

  var cellTemplate = templateHandler(language).boardsCell;

  var boardUri = common.clean(board.boardUri);

  var cell = '<div class="boardsCell">' + cellTemplate.template;
  cell += '</div>';

  var linkContent = '/' + boardUri + '/ - ' + common.clean(board.boardName);

  cell = cell.replace('__linkBoard_href__', '/' + boardUri + '/');
  cell = cell.replace('__linkBoard_inner__', linkContent);

  cell = exports.setSimpleBoardCellLabels(board, cell, cellTemplate.removable);

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

  if (parameters.unindexed) {
    href += '&unindexed=1';
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

  return common.clean(miscOps.cleanHTML(href));

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

  var cellTemplate = templateHandler(language).boardsCell;

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

  var template = templateHandler(language).boardsPage;

  var document = exports.setOverboardLinks(template).replace('__title__',
      lang(language).titBoards);

  document = exports.setBoards(boards, document, language);

  return document.replace('__divPages_children__', exports.getPages(parameters,
      pageCount));

};
// } Section 2: Board listing

// Section 3: Ban {
exports.assembleBanPage = function(document, template, ban, language) {

  if (ban.reason) {

    document = document.replace('__reasonPanel_location__',
        template.removable.reasonPanel).replace('__reasonLabel_inner__',
        common.clean(ban.reason));

  } else {
    document = document.replace('__reasonPanel_location__', '');
  }

  document = document.replace('__idLabel_inner__', ban._id);

  if (ban.expiration && !ban.warning) {

    document = document.replace('__expirationPanel_location__',
        template.removable.expirationPanel).replace(
        '__expirationLabel_inner__',
        common.formatDateToDisplay(ban.expiration, null, language));

  } else {
    document = document.replace('__expirationPanel_location__', '');
  }

  if (ban.appeal || ban.warning) {
    document = document.replace('__formAppeal_location__', '');
  } else {

    document = document.replace('__formAppeal_location__',
        template.removable.formAppeal);
    document = document.replace('__idIdentifier_value__', ban._id);

  }

  return document;

};

exports.getBanPage = function(ban, language) {

  var template;

  template = templateHandler(language).banPage;

  var document = template.template;

  document = exports.assembleBanPage(document, template, ban, language);

  return document;

};

exports.ban = function(ban, board, language) {

  var document = exports.getBanPage(ban, language).replace('__title__',
      lang(language).titBan);

  var description;

  if (ban.asn) {
    description = lang(language).guiBanDescriptionAsn
        .replace('{$asn}', ban.asn);
  } else if (ban.range) {
    description = lang(language).guiBanDescriptionRange.replace('{$range}',
        ban.range);
  } else {
    description = lang(language)[ban.warning ? 'guiWarningDescription'
        : 'guiBanDescription'];
  }

  return document.replace('__descriptionLabel_inner__', description.replace(
      '{$board}', board));

};
// } Section 3: Ban

// Section 4: Archives {
exports.getArchiveCells = function(threads, language) {

  var content = '';

  var cell = templateHandler(language).archiveCell.template;

  for (var i = 0; i < threads.length; i++) {

    var thread = threads[i];

    var newCell = '<div class="archiveCell">' + cell + '</div>';

    var url = '/' + thread.boardUri + '/res/' + thread.threadId + '.html';
    newCell = newCell.replace('__theadLink_href__', url);

    var id = thread.boardUri + '/' + thread.threadId;
    newCell = newCell.replace('__idLabel_inner__', id);

    newCell = newCell.replace('__dateLabel_inner__', common
        .formatDateToDisplay(thread.creation, true, language));

    if (thread.subject) {
      var title = common.clean(thread.subject);
    } else {
      title = common.clean(thread.message.substring(0, 256));
    }

    content += newCell.replace('__nameLabel_inner__', title);
  }

  return content;

};

exports.archives = function(threads, parameters, pages, language) {

  var document = templateHandler(language).archivePage.template.replace(
      '__title__', lang(language).titArchives);

  document = document.replace('__fieldBoards_value__', parameters.boards || '');

  var url = '/archives.js?';

  if (parameters.boards) {
    url += 'boards=' + parameters.boards + '&';
  }

  url += 'page=';

  var pagesContent = '';

  for (var i = 1; i <= pages; i++) {
    pagesContent += '<a href="' + url + i + '">' + i + '</a>';
  }

  document = document.replace('__divPages_children__', pagesContent);

  return document.replace('__divThreads_children__', exports.getArchiveCells(
      threads, language));

};
// } Section 4: Archives

exports.hashBan = function(hashBans, language) {

  var document = templateHandler(language).hashBanPage.template.replace(
      '__title__', lang(language).titHashBan);

  var children = '';

  var cellTemplate = templateHandler(language).hashBanCellDisplay;
  cellTemplate = cellTemplate.template;

  for (var i = 0; i < hashBans.length; i++) {

    var hashBan = hashBans[i];

    var cell = '<div class="hashBanCellDisplay">' + cellTemplate;

    cell = cell.replace('__labelFile_inner__', common.clean(hashBan.file))
        .replace('__labelReason_inner__', hashBan.reason || '');

    var boardToUse = hashBan.boardUri || lang(language).miscAllBoards;
    cell = cell.replace('__labelBoard_inner__', common.clean(boardToUse));

    children += cell + '</div>';

  }

  return document.replace('__hashBansPanel_children__', children);

};

exports.edit = function(parameters, posting, language) {

  var template = templateHandler(language).editPage;

  var document = template.template.replace('__labelMessageLength_inner__',
      messageLength).replace('__title__', lang(language).titEdit);

  document = document.replace('__fieldMessage_defaultValue__', posting.message);

  document = document.replace('__fieldSubject_value__', posting.subject || '');

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
    document = document.replace('__postIdentifier_value__', parameters.postId);

  }

  return document;

};

exports.noCookieCaptcha = function(parameters, captchaId, language) {

  var template = templateHandler(language).noCookieCaptchaPage;
  var document = template.template.replace('__title__',
      lang(language).titNoCookieCaptcha);

  if (!parameters.solvedCaptcha) {
    document = document.replace('__divSolvedCaptcha_location__', '');
  } else {
    document = document.replace('__divSolvedCaptcha_location__',
        template.removable.divSolvedCaptcha);

    document = document.replace('__labelCaptchaId_inner__', miscOps
        .cleanHTML(parameters.solvedCaptcha));

  }

  var captchaUrl = '/.global/captchas/' + captchaId.substring(0, 24);
  document = document.replace('__imageCaptcha_src__', captchaUrl);

  return document.replace('__inputCaptchaId_value__', captchaId);

};

exports.blockBypass = function(bypass, language) {

  var template = templateHandler(language).bypassPage;

  var document = template.template.replace('__title__',
      lang(language).titBlockbypass);

  if (!bypass) {
    document = document.replace('__indicatorValidBypass_location__', '');
  } else {
    document = document.replace('__indicatorValidBypass_location__',
        template.removable.indicatorValidBypass);

    if (bypass.validationCode && !bypass.validated) {

      var fullString = bypass._id + bypass.session + bypass.validationHash;

      document = document.replace('__indicatorNotValidated_location__',
          template.removable.indicatorNotValidated).replace(
          '__labelBypass_inner__', fullString);
    } else {

      document = document.replace('__indicatorNotValidated_location__', '');
    }
  }

  if (!blockBypass) {
    document = document.replace('__renewForm_location__', '');
  } else {
    document = document.replace('__renewForm_location__',
        template.removable.renewForm);
  }

  return document;

};

exports.graphs = function(dates, language) {

  var document = templateHandler(language).graphsIndexPage.template.replace(
      '__title__', lang(language).titGraphs);

  var children = '';

  for (var i = 0; i < dates.length; i++) {

    var displayDate = common.formatDateToDisplay(dates[i], true, language);

    var cell = '<a href="/.global/graphs/' + logger.formatedDate(dates[i]);

    children += cell + '.png">' + displayDate + '</a>';

  }

  return document.replace('__divDates_children__', children);

};

exports.message = function(message, link, language) {

  var document = templateHandler(language).messagePage.template.replace(
      '__title__', message);

  document = document.replace('__labelMessage_inner__', message);
  return document.replace('__linkRedirect_href__', link);

};