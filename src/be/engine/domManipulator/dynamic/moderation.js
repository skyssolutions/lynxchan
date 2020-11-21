'use strict';

// handles moderation pages. The difference between moderation and management is
// that moderation is focused on restricting users

var settingsHandler = require('../../../settingsHandler');
var templateHandler;
var lang;
var miscOps;
var reportCategories;
var common;
var clearIpMinRole;

exports.boardModerationIdentifiers = [ 'boardTransferIdentifier',
    'boardDeletionIdentifier', 'specialSettingsIdentifier' ];

exports.specialSettingsRelation = {
  sfw : 'checkboxSfw',
  locked : 'checkboxLocked',
  allowJs : 'checkboxAllowJs'
};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();
  reportCategories = settings.reportCategories;
  clearIpMinRole = settings.clearIpMinRole;
};

exports.loadDependencies = function() {

  miscOps = require('../../miscOps');
  templateHandler = require('../../templateHandler').getTemplates;
  lang = require('../../langOps').languagePack;
  common = require('..').common;

};

exports.bans = function(bans, globalPage, userRole, language, appealed) {

  var document = templateHandler(language).bansPage.template.replace(
      '__title__', lang(language)[appealed ? 'titAppealedBansManagement'
          : 'titBansManagement']);

  return document.replace('__bansDiv_children__', common.getBanList(bans,
      globalPage, userRole, language));

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

exports.rangeBans = function(rangeBans, globalPage, boardData, userRole,
    language) {

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

  return document.replace('__rangeBansDiv_children__', common.getBanList(
      rangeBans, globalPage, userRole, language));

};

// Section 1: Hash bans {
exports.getHashBanCells = function(hashBans, language) {

  var children = '';

  var template = templateHandler(language).hashBanCell.template;

  for (var i = 0; i < hashBans.length; i++) {

    var hashBan = hashBans[i];

    var banCell = common.getFormCellBoilerPlate(template, '/liftHashBan.js',
        'hashBanCell');

    banCell = banCell.replace('__hashLabel_inner__',
        common.clean(hashBan.sha256)).replace('__reasonLabel_inner__',
        common.clean(hashBan.reason || '')).replace('__userLabel_inner__',
        common.clean(hashBan.user || '')).replace(
        '__dateLabel_inner__',
        hashBan.date ? common
            .formatDateToDisplay(hashBan.date, false, language) : '').replace(
        '__idIdentifier_value__', hashBan._id);

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
// } Section 1: Hash bans

// Section 2: Board moderation {
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
// } Section 2: Board moderation

// Section 3: Latest postings {
exports.getPosts = function(postings, boardData, userRole, language) {

  var postsContent = '';

  var operations = [];

  for (var i = 0; i < postings.length; i++) {

    var postContent = common.getPostCellBase(postings[i]);

    var posting = postings[i];

    posting.postId = posting.postId || posting.threadId;

    postContent += common.getPostInnerElements(posting, true, language,
        operations, null, boardData, userRole);

    postsContent += postContent + '</div>';
  }

  common.handleOps(operations);

  return postsContent;

};

exports.setInputPostingInfo = function(parameters, document, removable) {

  var toRemove = parameters.threadId ? 'PostId' : 'ThreadId';
  var toShow = parameters.threadId ? 'ThreadId' : 'PostId';

  return document
      .replace('__inputBoardUri_location__', removable.inputBoardUri).replace(
          '__input' + toRemove + '_location__', '').replace(
          '__input' + toShow + '_location__', removable['input' + toShow])
      .replace('__inputBoardUri_value__', parameters.boardUri).replace(
          '__input' + toShow + '_value__',
          parameters.threadId || parameters.postId);

};

exports.setIpSearchFeatures = function(document, removable, parameters,
    userData) {

  for ( var key in parameters) {

    if (typeof (parameters[key]) !== 'string') {
      continue;
    }

    parameters[key] = common.clean(miscOps
        .cleanHTML(parameters[key].toString()));
  }

  parameters.boards = parameters.boards.map(function(item) {
    return common.clean(miscOps.cleanHTML(item));
  });

  if (userData.globalRole <= clearIpMinRole) {
    document = document.replace('__panelIp_location__', removable.panelIp)
        .replace('__fieldIp_value__', parameters.ip || '');
  } else {
    document = document.replace('__panelIp_location__', '');
  }

  if (!parameters.banId) {
    document = document.replace('__inputBanId_location__', '');
  } else {
    document = document
        .replace('__inputBanId_location__', removable.inputBanId).replace(
            '__inputBanId_value__', parameters.banId);
  }

  if (!parameters.boardUri || (!parameters.threadId && !parameters.postId)) {

    return document.replace('__inputBoardUri_location__', '').replace(
        '__inputThreadId_location__', '').replace('__inputPostId_location__',
        '');

  } else {

    return exports.setInputPostingInfo(parameters, document, removable);

  }

};

exports.getBoilerLink = function(parameters) {

  var boiler = '/latestPostings.js?boards=' + parameters.boards;

  if (parameters.ip) {
    boiler += '&ip=' + parameters.ip;
  }

  if (parameters.banId) {
    boiler += '&banId=' + parameters.banId;
  }

  if (parameters.boardUri && (parameters.threadId || parameters.postId)) {
    boiler += '&boardUri=' + parameters.boardUri + '&';
    boiler += (parameters.threadId ? 'threadId' : 'postId') + '=';
    boiler += parameters.threadId || parameters.postId;
  }

  return boiler + '&date=';

};

exports.getDates = function(currentDate, postings, pivotPosting, parameters,
    document) {

  var previousDay;

  if (pivotPosting) {
    previousDay = pivotPosting.creation.getTime();
  } else {
    previousDay = currentDate.getTime - 1;
  }

  var nextDay;

  if (postings.length) {
    nextDay = postings[0].creation.getTime();
  } else {
    nextDay = currentDate.getTime();
  }

  var boiler = exports.getBoilerLink(parameters);

  document = document.replace('__linkPrevious_href__', boiler + previousDay);
  return document.replace('__linkNext_href__', boiler + nextDay);

};

exports.latestPostings = function(postings, parameters, userData, pivotPosting,
    boardData, language) {

  var dom = templateHandler(language).latestPostingsPage;

  var document = dom.template.replace('__title__',
      lang(language).titLatestPostings);

  document = exports.setIpSearchFeatures(document, dom.removable, parameters,
      userData);

  var currentDate;

  if (postings.length) {
    currentDate = postings[postings.length - 1].creation;
  } else {
    currentDate = new Date();
  }

  document = exports.getDates(currentDate, postings, pivotPosting, parameters,
      document).replace('__fieldBoards_value__', parameters.boards.join(', '))
      .replace('__fieldDate_value__', currentDate.toUTCString());

  return document.replace('__divPostings_children__', exports.getPosts(
      postings, boardData, userData.globalRole, language));

};
// } Section 3: Latest postings

exports.asnBans = function(asnBans, globalPage, boardData, language) {

  var template = templateHandler(language).asnBansPage;

  var document = template.template.replace('__title__',
      lang(language).titAsnBans);

  if (boardData) {

    document = document.replace('__boardIdentifier_location__',
        template.removable.boardIdentifier);
    document = document.replace('__boardIdentifier_value__', common
        .clean(boardData.boardUri));

  } else {
    document = document.replace('__boardIdentifier_location__', '');
  }

  return document.replace('__asnBansDiv_children__', common.getBanList(asnBans,
      globalPage, null, language));

};

// Section 4: Open reports
exports.getReportCell = function(report, boardData, language, ops, userRole) {

  var template = templateHandler(language).reportCell;

  var cell = '<div class="reportCell">';
  cell += template.template + '</div>';

  var reason = common.clean(report.reason || '');
  cell = cell.replace('__reasonLabel_inner__', reason);
  cell = cell.replace('__closureCheckbox_name__', 'report-' + report._id);

  cell = cell.replace('__link_href__', common.getReportLink(report));

  cell = cell.replace('__boardLabel_inner__', report.boardUri);

  if (report.category) {
    cell = cell.replace('__categoryDiv_location__',
        template.removable.categoryDiv).replace('__categoryLabel_inner__',
        report.category);

  } else {
    cell = cell.replace('__categoryDiv_location__', '');
  }

  if (report.associatedPost) {
    return cell.replace('__postingDiv_inner__', common.getPostInnerElements(
        report.associatedPost, true, language, ops, null, boardData, userRole));

  } else {
    return cell.replace('__postingDiv_inner__', '');
  }

};

exports.getReportList = function(reports, boardData, language, userRole) {

  var children = '';

  var operations = [];

  for (var i = 0; i < reports.length; i++) {
    children += exports.getReportCell(reports[i], boardData, language,
        operations, userRole);
  }

  common.handleOps(operations);

  return children;

};

exports.getCategories = function(parameters, language) {

  var children = '';

  var template = templateHandler(language).reportCategoryFilterCell;

  var filters = parameters.categoryFilter || [];

  for (var i = 0; i < reportCategories.length; i++) {

    var category = reportCategories[i];

    var cell = template.template.replace('__categoryLabel_inner__', category)
        .replace('__categoryCheckbox_value__', category);

    if (filters.indexOf(category) >= 0) {
      cell = cell.replace('__categoryCheckbox_checked__', 'true');
    } else {
      cell = cell.replace('checked="__categoryCheckbox_checked__"', '');
    }

    children += cell;

  }

  return children;

};

exports.openReports = function(reports, parameters, boardData, userData,
    language) {

  var template = templateHandler(language).openReportsPage;

  var document = template.template.replace('__title__',
      lang(language).titOpenReports);

  if (reportCategories) {
    document = document.replace('__filterForm_location__',
        template.removable.filterForm);

    if (parameters.boardUri) {
      document = document.replace('__filterBoardIdentifier_location__',
          template.removable.filterBoardIdentifier).replace(
          '__filterBoardIdentifier_value__', parameters.boardUri);

    } else {
      document = document.replace('__filterBoardIdentifier_location__', '');
    }

    document = document.replace('__filterCategoriesDiv_children__', exports
        .getCategories(parameters, language));

  } else {
    document = document.replace('__filterForm_location__', '');
  }

  return document.replace('__reportDiv_children__', exports.getReportList(
      reports, boardData, language, userData.globalRole));

};
// } Section 4: Open reports
