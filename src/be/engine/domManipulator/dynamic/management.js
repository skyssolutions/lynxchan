'use strict';

// handles management pages in general

var settings;
var minClearIpRole;
var globalBoardModeration;
var customJs;
var common;
var templateHandler;
var lang;
var miscOps;
var boardMessageLength;

var displayMaxBannerSize;
var displayMaxFlagSize;
var displayMaxFlagNameLength;

exports.boardSettingsRelation = {
  disableIds : 'disableIdsCheckbox',
  forceAnonymity : 'forceAnonymityCheckbox',
  allowCode : 'allowCodeCheckbox',
  early404 : 'early404Checkbox',
  unindex : 'unindexCheckbox',
  blockDeletion : 'blockDeletionCheckbox',
  requireThreadFile : 'requireFileCheckbox',
  uniquePosts : 'uniquePostsCheckbox',
  uniqueFiles : 'uniqueFilesCheckbox',
  textBoard : 'textBoardCheckbox'
};

exports.boardFieldsRelation = {
  boardNameField : 'boardName',
  boardDescriptionField : 'boardDescription',
  autoCaptchaThresholdField : 'autoCaptchaThreshold',
  hourlyThreadLimitField : 'hourlyThreadLimit',
  anonymousNameField : 'anonymousName',
  maxFilesField : 'maxFiles',
  maxFileSizeField : 'maxFileSizeMB',
  maxThreadsField : 'maxThreadCount',
  autoSageLimitField : 'autoSageLimit',
  maxBumpAgeField : 'maxBumpAgeDays'
};

exports.boardControlIdentifiers = [ 'addVolunteerBoardIdentifier',
    'deletionIdentifier', 'transferBoardIdentifier', 'customCssIdentifier',
    'customSpoilerIdentifier' ];

exports.boardManagementLinks = [ {
  page : 'closedReports',
  element : 'closedReportsLink'
}, {
  page : 'bans',
  element : 'bansLink'
}, {
  page : 'bannerManagement',
  element : 'bannerManagementLink'
}, {
  page : 'filterManagement',
  element : 'filterManagementLink'
}, {
  page : 'rangeBans',
  element : 'rangeBansLink'
}, {
  page : 'rules',
  element : 'ruleManagementLink'
}, {
  page : 'hashBans',
  element : 'hashBansLink'
}, {
  page : 'flags',
  element : 'flagManagementLink'
} ];

exports.loadSettings = function() {

  settings = require('../../../settingsHandler').getGeneralSettings();
  globalBoardModeration = settings.allowGlobalBoardModeration;
  customJs = settings.allowBoardCustomJs;
  boardMessageLength = settings.boardMessageLength;
  displayMaxBannerSize = common.formatFileSize(settings.maxBannerSizeB);
  displayMaxFlagSize = common.formatFileSize(settings.maxFlagSizeB);
  minClearIpRole = settings.clearIpMinRole;
  displayMaxFlagNameLength = settings.flagNameLength;

};

exports.loadDependencies = function() {

  common = require('..').common;
  templateHandler = require('../../templateHandler').getTemplates;
  lang = require('../../langOps').languagePack;
  miscOps = require('../../miscOps');

  exports.boardRangeSettingsRelation = [ {
    limit : 2,
    element : 'captchaModeComboBox',
    setting : 'captchaMode',
    labels : 'guiCaptchaModes'
  }, {
    limit : 2,
    element : 'locationComboBox',
    setting : 'locationFlagMode',
    labels : 'guiBypassModes'
  } ];

};

// Section 1: Board Management {
exports.setBoardControlCheckBoxes = function(document, boardData) {

  for ( var setting in exports.boardSettingsRelation) {

    var element = '__' + exports.boardSettingsRelation[setting] + '_checked__';

    if (boardData.settings.indexOf(setting) > -1) {
      document = document.replace(element, 'true');
    } else {
      document = document.replace('checked="' + element + '"', '');
    }

  }

  return document;

};

exports.setBoardComboBoxes = function(document, boardData, language) {

  for (var i = 0; i < exports.boardRangeSettingsRelation.length; i++) {

    var setting = exports.boardRangeSettingsRelation[i];

    var labels = lang(language)[setting.labels];

    var children = '';
    for (var j = 0; j <= setting.limit; j++) {

      var option = '<option value="' + j;

      if (j === boardData[setting.setting]) {
        option += '" selected="selected';
      }

      children += option + '">' + labels[j] + '</option>';

    }

    document = document.replace('__' + setting.element + '_children__',
        children);

  }

  return document;

};

exports.setBoardFields = function(document, boardData) {

  for ( var key in exports.boardFieldsRelation) {

    var value = boardData[exports.boardFieldsRelation[key]];

    if (typeof value === 'string') {
      value = common.clean(value);
    }

    document = document.replace('__' + key + '_value__', value || '');

  }

  document = document.replace('__validMimesField_value__', common
      .clean((boardData.acceptedMimes || []).join(', ')));

  document = document.replace('__tagsField_value__', common
      .clean((boardData.tags || []).join(', ')));

  document = document.replace('__boardMessageField_defaultValue__', common
      .clean(boardData.boardMessage || ''));

  return document;

};

exports.getVolunteersDiv = function(boardData, language) {

  var volunteers = boardData.volunteers || [];

  var children = '';

  var boardUri = common.clean(boardData.boardUri);

  var template = templateHandler(language).volunteerCell.template;

  for (var i = 0; i < volunteers.length; i++) {

    var volunteer = common.clean(volunteers[i]);

    var cell = common.getFormCellBoilerPlate(template, '/setVolunteer.js',
        'volunteerCell');

    cell = cell.replace('__userIdentifier_value__', volunteer);
    cell = cell.replace('__userLabel_inner__', volunteer);
    cell = cell.replace('__boardIdentifier_value__', boardUri);

    children += cell;
  }

  return children;

};

exports.setBoardOwnerControls = function(document, boardData, language) {

  var boardUri = common.clean(boardData.boardUri);

  for (var i = 0; i < exports.boardControlIdentifiers.length; i++) {
    var field = '__' + exports.boardControlIdentifiers[i] + '_value__';
    document = document.replace(field, boardUri);
  }

  var removable = templateHandler(language).bManagement.removable;

  if (customJs) {
    document = document.replace('__customJsForm_location__',
        removable.customJsForm);
    document = document.replace('__customJsIdentifier_value__', boardUri);
  } else {
    document = document.replace('__customJsForm_location__', '');
  }

  document = document.replace('__customSpoilerIndicator_location__',
      boardData.usesCustomSpoiler ? removable.customSpoilerIndicator : '');

  return document.replace('__volunteersDiv_children__', exports
      .getVolunteersDiv(boardData, language));

};

exports.setBoardManagementLinks = function(document, boardData) {

  for (var i = 0; i < exports.boardManagementLinks.length; i++) {
    var link = exports.boardManagementLinks[i];

    var url = '/' + link.page + '.js?boardUri=';
    url += common.clean(boardData.boardUri);

    document = document.replace('__' + link.element + '_href__', url);

  }

  return document;

};

exports.getBoardManagementContent = function(boardData, userData, bans,
    reports, language) {

  var template = templateHandler(language).bManagement;

  var document = template.template.replace('__boardSettingsIdentifier_value__',
      common.clean(boardData.boardUri));

  document = exports.setBoardComboBoxes(document, boardData, language);
  document = exports.setBoardControlCheckBoxes(document, boardData);
  document = exports.setBoardFields(document, boardData);

  var globallyAllowed = globalBoardModeration && userData.globalRole <= 1;

  if (userData.login === boardData.owner || globallyAllowed) {
    document = document.replace('__ownerControlDiv_location__',
        template.removable.ownerControlDiv);

    document = document.replace('__bannerManagementLink_location__',
        template.removable.bannerManagementLink);

    document = exports.setBoardOwnerControls(document, boardData, language);
  } else {
    document = document.replace('__ownerControlDiv_location__', '');
  }

  document = document.replace('__messageLengthLabel_inner__',
      boardMessageLength);

  document = exports.setBoardManagementLinks(document, boardData);

  document = document.replace('__appealedBansPanel_children__', common
      .getBanList(bans, false, language));

  return document.replace('__reportDiv_children__', common.getReportList(
      reports, language));

};

exports.boardManagement = function(userData, bData, reports, bans, language) {

  var document = exports.getBoardManagementContent(bData, userData, bans,
      reports, language);

  var boardUri = common.clean(bData.boardUri);
  var selfLink = '/' + boardUri + '/';
  document = document.replace('__linkSelf_href__', selfLink);

  var labelInner = '/' + boardUri + '/ - ' + common.clean(bData.boardName);
  document = document.replace('__boardLabel_inner__', labelInner);

  return document.replace('__title__', lang(language).titBoardManagement
      .replace('{$board}', common.clean(bData.boardUri)));

};
// } Section 1: Board Management

// Section 2: Global Management {
exports.getRoleComboBox = function(possibleRoles, user) {

  var children = '';

  for (var k = 0; k < possibleRoles.length; k++) {

    var role = possibleRoles[k];

    var option = '<option value="' + role.value;

    if (role.value === user.globalRole) {
      option += '" selected="selected';
    }

    children += option + '">' + role.label + '</option>';

  }

  return children;

};

exports.getStaffDiv = function(possibleRoles, staff, language) {

  var children = '';

  var template = templateHandler(language).staffCell.template;

  for (var i = 0; i < staff.length; i++) {

    var user = staff[i];

    var cell = common.getFormCellBoilerPlate(template, '/setGlobalRole.js',
        'staffCell');

    var login = common.clean(user.login);

    cell = cell.replace('__userLabel_inner__', login);
    cell = cell.replace('__userIdentifier_value__', login);
    children += cell.replace('__roleCombo_children__', exports.getRoleComboBox(
        possibleRoles, user));

  }

  return children;
};

exports.getPossibleRoles = function(role, language) {

  var roles = [];

  for (var i = role + 1; i <= miscOps.getMaxStaffRole() + 1; i++) {
    var toPush = {
      value : i,
      label : miscOps.getGlobalRoleLabel(i, language)
    };

    roles.push(toPush);

  }

  return roles;
};

exports.getNewStaffComboBox = function(userRole, language) {

  var children = '';

  for (var i = userRole + 1; i <= miscOps.getMaxStaffRole(); i++) {

    var option = '<option value="' + i + '">';
    option += miscOps.getGlobalRoleLabel(i, language) + '</option>';
    children += option;

  }

  return children;

};

exports.setGlobalBansLinks = function(document, userRole, removable) {

  if (userRole < miscOps.getMaxStaffRole()) {
    document = document.replace('__bansLink_location__', removable.bansLink);
    document = document.replace('__hashBansLink_location__',
        removable.hashBansLink);
  } else {
    document = document.replace('__bansLink_location__', '');
    document = document.replace('__hashBansLink_location__', '');
  }

  if (userRole <= minClearIpRole) {
    document = document.replace('__rangeBansLink_location__',
        removable.rangeBansLink);
  } else {
    document = document.replace('__rangeBansLink_location__', '');
  }

  return document;

};

exports.setGlobalManagementLinks = function(userRole, document, removable) {

  document = exports.setGlobalBansLinks(document, userRole, removable);

  if (userRole !== 0) {
    document = document.replace('__globalSettingsLink_location__', '');
    document = document.replace('__languagesLink_location__', '');
    document = document.replace('__socketLink_location__', '');
  } else {
    document = document.replace('__globalSettingsLink_location__',
        removable.globalSettingsLink);
    document = document.replace('__languagesLink_location__',
        removable.languagesLink);
    document = document
        .replace('__socketLink_location__', removable.socketLink);
  }

  if (userRole < 2) {
    document = document.replace('__accountsLink_location__',
        removable.accountsLink);
    document = document.replace('__globalBannersLink_location__',
        removable.globalBannersLink);
  } else {
    document = document.replace('__accountsLink_location__', '');
    document = document.replace('__globalBannersLink_location__', '');
  }

  return document;

};

exports.processHideableElements = function(document, userRole, staff, language,
    removable) {

  if (userRole < 2) {

    document = document.replace('__addStaffForm_location__',
        removable.addStaffForm);
    document = document.replace('__massBanPanel_location__',
        removable.massBanPanel);
    document = document.replace('__divStaff_location__', removable.divStaff);

    document = document.replace('__newStaffCombo_children__', exports
        .getNewStaffComboBox(userRole, language));
    document = document.replace('__divStaff_children__', exports.getStaffDiv(
        exports.getPossibleRoles(userRole, language), staff, language));

  } else {
    document = document.replace('__addStaffForm_location__', '');
    document = document.replace('__massBanPanel_location__', '');
    document = document.replace('__divStaff_location__', '');
  }

  return document;

};

exports.setGlobalManagementLists = function(document, reports, appealedBans,
    language, removable) {

  document = document.replace('__reportDiv_children__', common.getReportList(
      reports, language));

  if (appealedBans) {
    document = document.replace('__appealedBansPanel_location__',
        removable.appealedBansPanel);

    document = document.replace('__appealedBansPanel_children__', common
        .getBanList(appealedBans, true, language));
  } else {
    document = document.replace('__appealedBansPanel_location__', '');
  }

  return document;

};

exports.globalManagement = function(userRole, userLogin, staff, reports,
    appealedBans, language) {

  var template = templateHandler(language).gManagement;

  var document = template.template.replace('__title__',
      lang(language).titGlobalManagement);

  document = exports.setGlobalManagementLists(document, reports, appealedBans,
      language, template.removable);

  document = exports.setGlobalManagementLinks(userRole, document,
      template.removable);

  return exports.processHideableElements(document, userRole, staff, language,
      template.removable);

};
// } Section 2: Global Management

// Section 3: Filter management {
exports.getFilterDiv = function(boardUri, filters, language) {

  var children = '';

  var template = templateHandler(language).filterCell;

  for (var i = 0; i < filters.length; i++) {

    var filter = filters[i];

    var originalTerm = common.clean(filter.originalTerm);

    var cell = common.getFormCellBoilerPlate(template.template,
        '/deleteFilter.js', 'filterCell');

    cell = cell.replace('__labelOriginal_inner__', originalTerm);

    cell = cell.replace('__labelReplacement_inner__', common
        .clean(filter.replacementTerm));

    cell = cell.replace('__boardIdentifier_value__', boardUri);

    cell = cell.replace('__filterIdentifier_value__', originalTerm);

    if (!filter.caseInsensitive) {
      cell = cell.replace('__labelCaseInsensitive_location__', '');
    } else {
      cell = cell.replace('__labelCaseInsensitive_location__',
          template.removable.labelCaseInsensitive);
    }

    children += cell;
  }

  return children;
};

exports.filterManagement = function(boardUri, filters, language) {

  boardUri = common.clean(boardUri);

  var document = templateHandler(language).filterManagement.template.replace(
      '__title__', lang(language).titFilters.replace('{$board}', boardUri));

  document = document.replace('__boardIdentifier_value__', boardUri);

  return document.replace('__divFilters_children__', exports.getFilterDiv(
      boardUri, filters, language));

};
// } Section 3: Filter management

// Section 4: Rule management {
exports.getRuleManagementCells = function(boardUri, rules, language) {

  var children = '';

  var template = templateHandler(language).ruleManagementCell.template;

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];

    var cell = common.getFormCellBoilerPlate(template, '/deleteRule.js',
        'ruleManagementCell');

    cell = cell.replace('__textLabel_inner__', common.clean(rule));

    cell = cell.replace('__boardIdentifier_value__', boardUri);

    children += cell.replace('__indexIdentifier_value__', i);
  }

  return children;
};

exports.ruleManagement = function(boardUri, rules, language) {

  boardUri = common.clean(boardUri);

  var document = templateHandler(language).ruleManagementPage.template.replace(
      '__title__', lang(language).titRuleManagement);

  document = document.replace('__boardIdentifier_value__', boardUri);

  return document.replace('__divRules_children__', exports
      .getRuleManagementCells(boardUri, rules, language));

};
// } Section 4: Rule management

// Section 5: Flag management {
exports.getFlagCells = function(flags, boardUri, language) {

  var children = '';

  var cellTemplate = templateHandler(language).flagCell.template;

  for (var i = 0; i < flags.length; i++) {

    var flag = flags[i];

    var cell = common.getFormCellBoilerPlate(cellTemplate, '/deleteFlag.js',
        'flagCell');

    var flagUrl = '/' + boardUri + '/flags/' + flag._id;
    cell = cell.replace('__flagImg_src__', flagUrl);

    cell = cell.replace('__idIdentifier_value__', flag._id);

    children += cell.replace('__nameLabel_inner__', common.clean(flag.name));
  }

  return children;

};

exports.flagManagement = function(boardUri, flags, language) {

  var document = templateHandler(language).flagsPage.template.replace(
      '__title__', lang(language).titFlagManagement);

  boardUri = common.clean(boardUri);

  document = document.replace('__maxSizeLabel_inner__', displayMaxFlagSize);

  document = document.replace('__maxNameLengthLabel_inner__',
      displayMaxFlagNameLength);

  document = document.replace('__boardIdentifier_value__', boardUri);

  return document.replace('__flagsDiv_children__', exports.getFlagCells(flags,
      boardUri, language));

};
// } Section 5: Flag management

// Section 6: Global settings {
exports.getComboSetting = function(element, setting) {

  var limit = setting.limit && setting.limit < setting.options.length;

  limit = limit ? setting.limit + 1 : setting.options.length;

  var children = '';

  for (var i = 0; i < limit; i++) {

    var option = '<option value="' + i;

    if (i === settings[setting.setting]) {
      option += '" selected="selected';
    }

    children += option + '">' + setting.options[i] + '</option>';

  }

  return children;

};

exports.getCheckboxSetting = function(element, setting, document) {

  if (settings[setting.setting]) {
    return document.replace(element + 'checked__', 'true');
  } else {
    return document.replace('checked="' + element + 'checked__"', '');
  }

};

exports.setElements = function(siteSettingsRelation, document) {

  for (var i = 0; i < siteSettingsRelation.length; i++) {

    var setting = siteSettingsRelation[i];

    var element = '__' + setting.element + '_';

    switch (setting.type) {
    case 'string':
    case 'number': {

      document = document.replace(element + 'value__',
          settings[setting.setting] || '');

      break;
    }

    case 'boolean': {
      document = exports.getCheckboxSetting(element, setting, document);
      break;
    }

    case 'array': {
      document = document.replace(element + 'value__',
          (settings[setting.setting] || '').toString());
      break;

    }

    case 'range': {
      document = document.replace(element + 'children__', exports
          .getComboSetting(element, setting));

      break;
    }

    }

  }

  return document;

};

exports.globalSettings = function(language) {

  var document = templateHandler(language).globalSettingsPage.template.replace(
      '__title__', lang(language).titGlobalSettings);

  return exports.setElements(miscOps.getParametersArray(language), document);

};
// } Section 6: Global settings

// Section 7: Banners {
exports.getBannerCells = function(banners, language) {

  var children = '';

  var template = templateHandler(language).bannerCell.template;

  for (var i = 0; i < banners.length; i++) {
    var banner = banners[i];

    var cell = common.getFormCellBoilerPlate(template, '/deleteBanner.js',
        'bannerCell');

    cell = cell.replace('__bannerImage_src__', banner.filename);

    children += cell.replace('__bannerIdentifier_value__', banner._id);

  }

  return children;

};

exports.bannerManagement = function(boardUri, banners, language) {

  var template = templateHandler(language).bannerManagementPage;

  var document = template.template.replace('__maxSizeLabel_inner__',
      displayMaxBannerSize);

  if (boardUri) {

    boardUri = common.clean(boardUri);

    document = document.replace('__title__', lang(language).titBanners.replace(
        '{$board}', boardUri));
    document = document.replace('__boardIdentifier_location__',
        template.removable.boardIdentifier);
    document = document.replace('__boardIdentifier_value__', boardUri);

  } else {
    document = document.replace('__title__', lang(language).titGlobalBanners);
    document = document.replace('__boardIdentifier_location__', '');
  }

  return document.replace('__bannersDiv_children__', exports.getBannerCells(
      banners, language));

};
// } Section 7: Banners

// Section 8: Media management {
exports.getMediaManagementPages = function(pages, parameters) {

  var children = '';

  var boilerPlate = '';

  if (parameters.orphaned) {
    boilerPlate += '&orphaned=1';
  }

  if (parameters.filter) {
    boilerPlate += '&filter=' + parameters.filter;
  }

  for (var i = 1; i <= pages; i++) {

    var link = '<a href="' + '/mediaManagement.js?page=' + i + boilerPlate;
    link += '">' + i + '</a>';

    children += link;

  }

  return children;

};

exports.getMediaLinks = function(template, file) {

  var cell = '<div class="mediaCell">';
  cell += template.template;

  var detailsHref = '/mediaDetails.js?identifier=' + file.identifier;
  cell = cell.replace('__detailsLink_href__', detailsHref);

  var filePath = '/.media/' + file.identifier;

  if (file.extension) {
    filePath += '.' + file.extension;
  }

  cell = cell.replace('__fileLink_href__', filePath);
  cell = cell.replace('__fileLink_inner__', file.identifier);

  return cell + '</div>';

};

exports.getMediaManagementCells = function(media, language) {

  var children = '';

  var template = templateHandler(language).mediaCell;

  for (var i = 0; i < media.length; i++) {

    var file = media[i];

    var cell = exports.getMediaLinks(template, file);

    cell = cell.replace('__identifierCheckbox_name__', file.identifier);
    cell = cell.replace('__thumbImg_src__', '/.media/t_' + file.identifier);
    cell = cell.replace('__referencesLabel_inner__', file.references);

    children += cell;

  }

  return children;

};

exports.mediaManagement = function(media, pages, parameters, language) {

  var document = templateHandler(language).mediaManagementPage.template
      .replace('__title__', lang(language).titMediaManagement);

  document = document.replace('__pagesDiv_children__', exports
      .getMediaManagementPages(pages, parameters));

  return document.replace('__filesDiv_children__', exports
      .getMediaManagementCells(media, language));

};
// } Section 8: Media management

exports.languages = function(languages, language) {

  var template = templateHandler(language).languagesManagementPage;

  var document = template.template.replace('__title__',
      lang(language).titLanguages);

  var children = '';

  var cellTemplate = templateHandler(language).languageCell.template;

  for (var i = 0; i < languages.length; i++) {

    var cell = common.getFormCellBoilerPlate(cellTemplate,
        '/deleteLanguage.js', 'languageCell');

    var currentLang = languages[i];

    cell = cell.replace('__languageIdentifier_value__', currentLang._id);

    cell = cell.replace('__frontEndLabel_inner__', common
        .clean(currentLang.frontEnd));

    cell = cell.replace('__languagePackLabel_inner__', common
        .clean(currentLang.languagePack));

    cell = cell.replace('__headerValuesLabel_inner__', common
        .clean(currentLang.headerValues.join(', ')));

    children += cell;
  }

  return document.replace('__languagesDiv_children__', children);

};

exports.accounts = function(accounts, language) {

  var document = templateHandler(language).accountsPage.template.replace(
      '__title__', lang(language).titAccounts);

  var children = '';

  for (var i = 0; i < accounts.length; i++) {

    var account = common.clean(accounts[i]);

    var newCell = '<a href="/accountManagement.js?account=' + account + '">';

    children += newCell + account + '</a>';
  }

  return document.replace('__divAccounts_children__', children);

};

// Section 9: Account management {
exports.setOwnedAndVolunteeredBoards = function(accountData, document) {

  var children = '';

  for (var i = 0; i < accountData.ownedBoards.length; i++) {

    var boardUri = common.clean(accountData.ownedBoards[i]);

    children += '<a href="/boardModeration.js?boardUri=' + boardUri + '">';
    children += boardUri + '</a>';

  }

  document = document.replace('__ownedBoardsDiv_children__', children);

  children = '';

  for (i = 0; i < accountData.volunteeredBoards.length; i++) {

    boardUri = common.clean(accountData.volunteeredBoards[i]);

    children += '<a href="/boardModeration.js?boardUri=' + boardUri + '">';
    children += boardUri + '</a>';
  }

  return document.replace('__volunteeredBoardsDiv_children__', children);

};

exports.accountManagement = function(accountData, account, userRole, language) {

  account = common.clean(account);

  var template = templateHandler(language).accountManagementPage;
  var document = template.template.replace('__title__',
      lang(language).titAccountManagement.replace('{$account}', account));

  document = document.replace('__emailLabel_inner__', common
      .clean(accountData.email));

  if (accountData.globalRole <= userRole) {
    document = document.replace('__deletionForm_location__', '');
  } else {
    document = document.replace('__deletionForm_location__',
        template.removable.deletionForm);

    document = document.replace('__userIdentifier_value__', account);
  }

  document = document.replace('__loginLabel_inner__', account);

  document = document.replace('__lastSeenLabel_inner__',
      accountData.lastSeen ? accountData.lastSeen.toUTCString() : '');

  document = exports.setOwnedAndVolunteeredBoards(accountData, document);

  return document.replace('__globalRoleLabel_inner__', miscOps
      .getGlobalRoleLabel(accountData.globalRole, language));

};
// } Section 9: Account management

exports.socketData = function(statusData, language) {

  var document = templateHandler(language).socketManagementPage.template
      .replace('__title__', lang(language).titSocketManagement);

  return document.replace('__statusLabel_inner__', statusData.status);

};

// Section 10: Media details {
exports.getReferencesDiv = function(details) {

  var children = '';

  for (var i = 0; i < details.references.length; i++) {

    var reference = details.references[i];

    var boardUri = common.clean(reference.boardUri);

    var url = '/' + boardUri + '/res/' + reference.threadId;
    url += '.html';

    if (reference.postId) {
      url += '#' + reference.postId;
    }

    var idToUse = reference.postId || reference.threadId;
    var link = '<a href="' + url + '">' + boardUri + '/' + idToUse + '</a>';

    children += link;

  }

  return children;

};

exports.mediaDetails = function(identifier, details, language) {

  var document = templateHandler(language).mediaDetailsPage.template.replace(
      '__title__', lang(language).titMediaDetails);

  document = document.replace('__labelSize_inner__', common.formatFileSize(
      details.size, language));

  document = document.replace('__labelIdentifier_inner__', identifier);

  document = document.replace('__labelUploadDate_inner__', common
      .formatDateToDisplay(details.uploadDate, false, language));

  return document.replace('__panelReferences_children__', exports
      .getReferencesDiv(details));

};
// } Section 10: Media details
