'use strict';

// handles management pages in general

var settings;
var common;
var templateHandler;
var lang;
var filterLength;
var miscOps;
var maxBannerLimit;
var displayMaxBannerSize;
var displayMaxFlagSize;
var displayMaxFlagNameLength;

exports.loadSettings = function() {

  settings = require('../../../settingsHandler').getGeneralSettings();
  filterLength = settings.maxFilterLength;
  maxBannerLimit = settings.maxBoardBanners;
  displayMaxBannerSize = common.formatFileSize(settings.maxBannerSizeB);
  displayMaxFlagSize = common.formatFileSize(settings.maxFlagSizeB);
  displayMaxFlagNameLength = settings.flagNameLength;

};

exports.loadDependencies = function() {

  common = require('..').common;
  templateHandler = require('../../templateHandler').getTemplates;
  lang = require('../../langOps').languagePack;
  miscOps = require('../../miscOps');

};

// Section 1: Filter management {
exports.getFilterDiv = function(boardUri, filters, language) {

  var children = '';

  var template = templateHandler(language).filterCell;

  for (var i = 0; i < filters.length; i++) {

    var filter = filters[i];

    var originalTerm = common.clean(filter.originalTerm);

    var cell = common.getFormCellBoilerPlate(template.template,
        '/deleteFilter.js', 'filterCell').replace('__labelOriginal_inner__',
        originalTerm);

    if (boardUri) {

      cell = cell.replace('__boardIdentifier_location__',
          template.removable.boardIdentifier).replace(
          '__boardIdentifier_value__', boardUri);
    } else {

      cell = cell.replace('__boardIdentifier_location__', '');
    }

    if (!filter.caseInsensitive) {
      cell = cell.replace('__labelCaseInsensitive_location__', '');
    } else {
      cell = cell.replace('__labelCaseInsensitive_location__',
          template.removable.labelCaseInsensitive);
    }

    children += cell.replace('__labelReplacement_inner__',
        common.clean(filter.replacementTerm)).replace(
        '__filterIdentifier_value__', originalTerm);
  }

  return children;
};

exports.filterManagement = function(boardUri, filters, language) {

  boardUri = common.clean(boardUri);

  var titleToUse = boardUri ? lang(language).titBoardFilters.replace(
      '{$board}', boardUri) : lang(language).titGlobalFilters;

  var template = templateHandler(language).filterManagement;

  var document = template.template.replace('__title__', titleToUse).replace(
      '__maxLengthLabel_inner__', filterLength);

  if (boardUri) {

    document = document.replace('__boardIdentifier_location__',
        template.removable.boardIdentifier).replace(
        '__boardIdentifier_value__', boardUri);
  } else {
    document = document.replace('__boardIdentifier_location__', '');
  }

  return document.replace('__divFilters_children__', exports.getFilterDiv(
      boardUri, filters, language));

};
// } Section 1: Filter management

// Section 2: Rule management {
exports.getRuleManagementCells = function(boardUri, rules, language) {

  var children = '';

  var template = templateHandler(language).ruleManagementCell.template;

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];

    var cell = common.getFormCellBoilerPlate(template, '/ruleAction.js',
        'ruleManagementCell');

    cell = cell.replace('__textField_value__', common.clean(rule));

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
// } Section 2: Rule management

// Section 3: Flag management {
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
// } Section 3: Flag management

// Section 4: Global settings {
exports.getComboSetting = function(setting) {

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
          .getComboSetting(setting));

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
// } Section 4: Global settings

// Section 5: Banners {
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
        template.removable.boardIdentifier).replace(
        '__boardIdentifier_value__', boardUri);

    document = document.replace('__maxBannerDiv_location__',
        template.removable.maxBannerDiv).replace('__maxBannerLabel_inner__',
        maxBannerLimit);

  } else {
    document = document.replace('__title__', lang(language).titGlobalBanners);
    document = document.replace('__boardIdentifier_location__', '').replace(
        '__maxBannerDiv_location__', '');
  }

  return document.replace('__bannersDiv_children__', exports.getBannerCells(
      banners, language));

};
// } Section 5: Banners

// Section 6: Media management {
exports.getMediaManagementLinkBoilerPlate = function(parameters) {

  var boilerPlate = '';

  if (parameters.orphaned) {
    boilerPlate += '&orphaned=1';
  }

  if (parameters.banId) {
    boilerPlate += '&banId=' + parameters.banId;
  }

  if (parameters.filter) {
    boilerPlate += '&filter=' + parameters.filter;
  }

  if (parameters.boardUri && (parameters.threadId || parameters.postId)) {

    boilerPlate += '&boardUri=' + parameters.boardUri + '&';

    if (parameters.threadId) {
      boilerPlate += 'threadId=' + parameters.threadId;
    } else {
      boilerPlate += 'postId=' + parameters.postId;
    }

  }

  return boilerPlate;

};

exports.getMediaManagementPages = function(pages, parameters) {

  var children = '';

  var boilerPlate = exports.getMediaManagementLinkBoilerPlate(parameters);

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

  var detailsHref = '/mediaDetails.js?identifier=' + file.sha256;
  cell = cell.replace('__detailsLink_href__', detailsHref);

  var filePath = '/.media/' + file.sha256;

  if (file.extension) {
    filePath += '.' + file.extension;
  }

  cell = cell.replace('__fileLink_href__', filePath);
  cell = cell.replace('__fileLink_inner__', file.sha256);

  return cell + '</div>';

};

exports.getMediaManagementCells = function(media, language) {

  var children = '';

  var template = templateHandler(language).mediaCell;

  for (var i = 0; i < media.length; i++) {

    var file = media[i];

    var cell = exports.getMediaLinks(template, file);

    cell = cell.replace('__identifierCheckbox_name__', file.sha256);
    cell = cell.replace('__thumbImg_src__', '/.media/t_' + file.sha256);
    cell = cell.replace('__referencesLabel_inner__', file.references);

    children += cell;

  }

  return children;

};

exports.setMediaManagementIdentifiers = function(parameters, doc, template) {

  if (parameters.banId) {
    doc = doc.replace('__banIdentifier_location__',
        template.removable.banIdentifier).replace('__banIdentifier_value__',
        parameters.banId);
  } else {
    doc = doc.replace('__banIdentifier_location__', '');
  }

  if (parameters.boardUri && (parameters.threadId || parameters.postId)) {

    doc = doc.replace('__boardUriIdentifier_location__',
        template.removable.boardUriIdentifier).replace(
        '__boardUriIdentifier_value__', parameters.boardUri);

    if (parameters.threadId) {

      return doc.replace('__threadIdIdentifier_location__',
          template.removable.threadIdIdentifier).replace(
          '__postIdIdentifier_location__', '').replace(
          '__threadIdIdentifier_value__', parameters.threadId);

    } else {

      return doc.replace('__postIdIdentifier_location__',
          template.removable.postIdIdentifier).replace(
          '__threadIdIdentifier_location__', '').replace(
          '__postIdIdentifier_value__', parameters.postId);

    }

  } else {
    return doc.replace('__boardUriIdentifier_location__', '').replace(
        '__threadIdIdentifier_location__', '').replace(
        '__postIdIdentifier_location__', '');
  }

};

exports.mediaManagement = function(role, media, pages, parameters, language) {

  var template = templateHandler(language).mediaManagementPage;

  var document = template.template.replace('__title__',
      lang(language).titMediaManagement);

  document = document.replace('__pagesDiv_children__', exports
      .getMediaManagementPages(pages, parameters));

  if (role === miscOps.getMaxStaffRole()) {
    document = document.replace('__banPanel_location__', '');
  } else {
    document = document.replace('__banPanel_location__',
        template.removable.banPanel);
  }

  return exports.setMediaManagementIdentifiers(parameters, document, template)
      .replace('__filesDiv_children__',
          exports.getMediaManagementCells(media, language));

};
// } Section 6: Media management

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

// Section 7: Account management {
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
// } Section 7: Account management

exports.socketData = function(statusData, language) {

  var document = templateHandler(language).socketManagementPage.template
      .replace('__title__', lang(language).titSocketManagement);

  return document.replace('__statusLabel_inner__', statusData.status);

};

// Section 8: Media details {
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
// } Section 8: Media details

// Section 9: Offense records {
exports.getOffenseList = function(document, offenses, language) {

  var list = '';

  var template = templateHandler(language).offenseCell;

  for (var i = 0; i < offenses.length; i++) {

    var offense = offenses[i];

    var cell = template.template.replace('__reasonLabel_inner__',
        offense.reason || '').replace('__modLabel_inner__', offense.mod)
        .replace(
            '__expirationLabel_inner__',
            offense.expiration ? common.formatDateToDisplay(offense.expiration,
                false, language) : '').replace('__dateLabel_inner__',
            common.formatDateToDisplay(offense.date, false, language)).replace(
            '__globalLabel_location__',
            offense.global ? template.removable.globalLabel : '');

    list += '<div>' + cell + '</div>';
  }

  return document.replace('__offensesDiv_children__', list);

};

exports.offenseRecord = function(offenses, parameters, language) {

  var template = templateHandler(language).offenseRecordPage;

  var document = template.template.replace('__title__',
      lang(language).titOffenseRecord);

  document = document.replace('__ipField_value__', parameters.ip || '');

  if (parameters.boardUri && (parameters.threadId || parameters.postId)) {

    document = document.replace('__boardIdentifier_location__',
        template.removable.boardIdentifier).replace(
        '__boardIdentifier_value__', parameters.boardUri);

    if (parameters.threadId) {
      document = document.replace('__threadIdentifier_location__',
          template.removable.threadIdentifier).replace(
          '__postIdentifier_location__', '').replace(
          '__threadIdentifier_value__', parameters.threadId);
    } else {
      document = document.replace('__postIdentifier_location__',
          template.removable.postIdentifier).replace(
          '__threadIdentifier_location__', '').replace(
          '__postIdentifier_value__', parameters.postId);
    }

  } else {

    document = document.replace('__boardIdentifier_location__', '').replace(
        '__threadIdentifier_location__', '').replace(
        '__postIdentifier_location__', '');

  }

  return exports.getOffenseList(document, offenses, language);

};
// } Section 9: Offense records
