'use strict';

// handles management pages in general

var JSDOM = require('jsdom').JSDOM;
var debug = require('../../../kernel').debug();
var settings;
var minClearIpRole;
var globalBoardModeration;
var customJs;
var common;
var templateHandler;
var lang;
var miscOps;

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
  maxThreadField : 'maxThreadCount',
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

  var template = templateHandler(language, true).volunteerCell.template;

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

  var removable = templateHandler(language, true).bManagement.removable;

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

  var template = templateHandler(language, true).bManagement;

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

  document = exports.setBoardManagementLinks(document, boardData);

  document = document.replace('__appealedBansPanel_children__', common
      .getBanList(bans, false, language));

  return document.replace('__reportDiv_children__', common.getReportList(
      reports, language));

};

exports.boardManagement = function(userData, bData, reports, bans, language) {

  try {

    var document = exports.getBoardManagementContent(bData, userData, bans,
        reports, language);

    var boardUri = common.clean(bData.boardUri);
    var selfLink = '/' + boardUri + '/';
    document = document.replace('__linkSelf_href__', selfLink);

    var labelInner = '/' + boardUri + '/ - ' + common.clean(bData.boardName);
    document = document.replace('__boardLabel_inner__', labelInner);

    return document.replace('__title__', lang(language).titBoardManagement
        .replace('{$board}', common.clean(bData.boardUri)));

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

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

  var template = templateHandler(language, true).staffCell.template;

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

  try {

    var template = templateHandler(language, true).gManagement;

    var document = template.template.replace('__title__',
        lang(language).titGlobalManagement);

    document = exports.setGlobalManagementLists(document, reports,
        appealedBans, language, template.removable);

    document = exports.setGlobalManagementLinks(userRole, document,
        template.removable);

    document = exports.processHideableElements(document, userRole, staff,
        language, template.removable);

    var userLabelContent = common.clean(userLogin) + ': ';
    userLabelContent += miscOps.getGlobalRoleLabel(userRole, language);

    return document.replace('__userLabel_inner__', userLabelContent);

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }
};
// } Section 2: Global Management

// Section 3: Filter management {
exports.setFilterCell = function(document, boardUri, filter, language) {

  var cell = document.createElement('form');

  cell.innerHTML = templateHandler(language).filterCell;

  common.setFormCellBoilerPlate(cell, '/deleteFilter.js', 'filterCell');

  var labelOriginal = cell.getElementsByClassName('labelOriginal')[0];
  labelOriginal.innerHTML = filter.originalTerm;

  var labelReplacement = cell.getElementsByClassName('labelReplacement')[0];
  labelReplacement.innerHTML = filter.replacementTerm;

  var filterIdentifier = cell.getElementsByClassName('filterIdentifier')[0];
  filterIdentifier.setAttribute('value', filter.originalTerm);

  var boardIdentifier = cell.getElementsByClassName('boardIdentifier')[0];
  boardIdentifier.setAttribute('value', boardUri);

  if (!filter.caseInsensitive) {
    cell.getElementsByClassName('labelCaseInsensitive')[0].remove();
  }

  return cell;
};

exports.filterManagement = function(boardUri, filters, language) {

  try {

    var dom = new JSDOM(templateHandler(language).filterManagement);
    var document = dom.window.document;

    document.title = lang(language).titFilters.replace('{$board}', boardUri);

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    var filtersDiv = document.getElementById('divFilters');

    for (var i = 0; i < filters.length; i++) {
      filtersDiv.appendChild(exports.setFilterCell(document, boardUri,
          filters[i], language));
    }

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 3: Filter management

// Section 4: Rule management {
exports.getRuleManagementCells = function(boardUri, rules, language) {

  var children = '';

  var template = templateHandler(language, true).ruleManagementCell.template;

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

  try {

    boardUri = common.clean(boardUri);

    var document = templateHandler(language, true).ruleManagementPage.template
        .replace('__title__', lang(language).titRuleManagement);

    document = document.replace('__boardIdentifier_value__', boardUri);

    return document.replace('__divRules_children__', exports
        .getRuleManagementCells(boardUri, rules, language));

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 4: Rule management

// Section 5: Flag management {
exports.addFlagCells = function(document, flags, boardUri, language) {

  var flagsDiv = document.getElementById('flagsDiv');

  for (var i = 0; i < flags.length; i++) {
    var flag = flags[i];

    var cell = document.createElement('form');

    common.setFormCellBoilerPlate(cell, '/deleteFlag.js', 'flagCell');

    cell.innerHTML = templateHandler(language).flagCell;

    var flagUrl = '/' + boardUri + '/flags/' + flag._id;

    cell.getElementsByClassName('flagImg')[0].src = flagUrl;

    cell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        flag._id);

    cell.getElementsByClassName('nameLabel')[0].innerHTML = flag.name;

    flagsDiv.appendChild(cell);
  }

};

exports.flagManagement = function(boardUri, flags, language) {
  try {

    var dom = new JSDOM(templateHandler(language).flagsPage);
    var document = dom.window.document;

    document.title = lang(language).titFlagManagement;

    document.getElementById('maxSizeLabel').innerHTML = displayMaxFlagSize;

    var lengthLabel = document.getElementById('maxNameLengthLabel');
    lengthLabel.innerHTML = displayMaxFlagNameLength;

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    exports.addFlagCells(document, flags, boardUri, language);

    return dom.serialize();
  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 5: Flag management

// Section 6: Global settings {
exports.setComboSetting = function(document, element, setting) {

  var limit = setting.limit && setting.limit < setting.options.length;

  limit = limit ? setting.limit + 1 : setting.options.length;

  for (var i = 0; i < limit; i++) {

    var option = document.createElement('option');
    option.value = i;
    option.innerHTML = setting.options[i];

    if (i === settings[setting.setting]) {
      option.setAttribute('selected', 'selected');
    }

    element.appendChild(option);
  }
};

exports.globalSettings = function(language) {

  try {

    var dom = new JSDOM(templateHandler(language).globalSettingsPage);
    var document = dom.window.document;

    var siteSettingsRelation = miscOps.getParametersArray(language);

    for (var i = 0; i < siteSettingsRelation.length; i++) {

      var setting = siteSettingsRelation[i];

      var element = document.getElementById(setting.element);

      switch (setting.type) {
      case 'string':
      case 'number':
        element.setAttribute('value', settings[setting.setting] || '');
        break;
      case 'boolean':
        if (settings[setting.setting]) {
          element.setAttribute('checked', true);
        }
        break;

      case 'array':
        element.setAttribute('value', (settings[setting.setting] || '')
            .toString());
        break;
      case 'range':
        exports.setComboSetting(document, element, setting);
        break;
      }

    }

    document.title = lang(language).titGlobalSettings;

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }
};
// } Section 6: Global settings

// Section 7: Banners {
exports.addBannerCells = function(document, banners, language) {

  var bannerDiv = document.getElementById('bannersDiv');

  for (var i = 0; i < banners.length; i++) {
    var banner = banners[i];

    var cell = document.createElement('form');
    cell.innerHTML = templateHandler(language).bannerCell;

    common.setFormCellBoilerPlate(cell, '/deleteBanner.js', 'bannerCell');

    cell.getElementsByClassName('bannerImage')[0].src = banner.filename;

    cell.getElementsByClassName('bannerIdentifier')[0].setAttribute('value',
        banner._id);

    bannerDiv.appendChild(cell);
  }

};

exports.bannerManagement = function(boardUri, banners, language) {

  try {

    var dom = new JSDOM(templateHandler(language).bannerManagementPage);
    var document = dom.window.document;

    if (boardUri) {
      document.title = lang(language).titBanners.replace('{$board}', boardUri);
      document.getElementById('boardIdentifier')
          .setAttribute('value', boardUri);

    } else {
      document.title = lang(language).titGlobalBanners;
      document.getElementById('boardIdentifier').remove();
    }

    document.getElementById('maxSizeLabel').innerHTML = displayMaxBannerSize;

    exports.addBannerCells(document, banners, language);

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');

  }

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

  var template = templateHandler(language, true).mediaCell;

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

  try {

    var document = templateHandler(language, true).mediaManagementPage.template
        .replace('__title__', lang(language).titMediaManagement);

    document = document.replace('__pagesDiv_children__', exports
        .getMediaManagementPages(pages, parameters));

    return document.replace('__filesDiv_children__', exports
        .getMediaManagementCells(media, language));

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');

  }

};
// } Section 8: Media management

// Section 9: Language management {
exports.addLanguageCell = function(document, language, userLanguage) {

  var cell = document.createElement('form');

  common.setFormCellBoilerPlate(cell, '/deleteLanguage.js', 'languageCell');

  cell.innerHTML = templateHandler(userLanguage).languageCell;

  cell.getElementsByClassName('languageIdentifier')[0].setAttribute('value',
      language._id);
  cell.getElementsByClassName('frontEndLabel')[0].innerHTML = language.frontEnd;

  var languagePackLabel = cell.getElementsByClassName('languagePackLabel')[0];
  languagePackLabel.innerHTML = language.languagePack;

  var headerValuesLabel = cell.getElementsByClassName('headerValuesLabel')[0];
  headerValuesLabel.innerHTML = language.headerValues.join(', ');

  document.getElementById('languagesDiv').appendChild(cell);

};

exports.languages = function(languages, language) {

  try {

    var dom = new JSDOM(templateHandler(language).languagesManagementPage);
    var document = dom.window.document;

    document.title = lang(language).titLanguages;

    for (var i = 0; i < languages.length; i++) {
      exports.addLanguageCell(document, languages[i], language);
    }

    return dom.serialize();

  } catch (error) {
    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 9: Language management

exports.accounts = function(accounts, language) {

  try {

    var document = templateHandler(language, true).accountsPage.template
        .replace('__title__', lang(language).titAccounts);

    var children = '';

    var cellTemplate = templateHandler(language, true).accountCell.template;

    for (var i = 0; i < accounts.length; i++) {

      var account = common.clean(accounts[i]);

      var newCell = '<div class="accountCell">' + cellTemplate + '</div>';

      newCell = newCell.replace('__accountLink_inner__', account);
      newCell = newCell.replace('__accountLink_href__',
          '/accountManagement.js?account=' + account);

      children += newCell;
    }

    return document.replace('__divAccounts_children__', children);

  } catch (error) {
    return error.stack.replace(/\n/g, '<br>');
  }

};

// Section 10: Account management {
exports.setOwnedAndVolunteeredBoards = function(accountData, document) {

  var children = '';

  for (var i = 0; i < accountData.ownedBoards.length; i++) {
    children += '<div>' + common.clean(accountData.ownedBoards[i]);
    children += '</div>';
  }

  document = document.replace('__ownedBoardsDiv_children__', children);

  children = '';

  for (i = 0; i < accountData.volunteeredBoards.length; i++) {
    children += '<div>' + common.clean(accountData.volunteeredBoards[i]);
    children += '</div>';
  }

  return document.replace('__volunteeredBoardsDiv_children__', children);

};

exports.accountManagement = function(accountData, account, userRole, language) {

  try {

    account = common.clean(account);

    var template = templateHandler(language, true).accountManagementPage;
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

    document = document.replace('__lastSeenLabel_inner__',
        accountData.lastSeen ? accountData.lastSeen.toUTCString() : '');

    document = exports.setOwnedAndVolunteeredBoards(accountData, document);

    return document.replace('__globalRoleLabel_inner__', miscOps
        .getGlobalRoleLabel(accountData.globalRole, language));

  } catch (error) {
    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 10: Account management

exports.socketData = function(statusData, language) {

  try {

    var document = templateHandler(language, true).socketManagementPage.template
        .replace('__title__', lang(language).titSocketManagement);

    return document.replace('__statusLabel_inner__', statusData.status);

  } catch (error) {
    return error.stack.replace(/\n/g, '<br>');
  }

};

// Section 11: Media details {
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

  try {

    var document = templateHandler(language, true).mediaDetailsPage.template
        .replace('__title__', lang(language).titMediaDetails);

    document = document.replace('__labelSize_inner__', common.formatFileSize(
        details.size, language));

    document = document.replace('__labelIdentifier_inner__', identifier);

    document = document.replace('__labelUploadDate_inner__', common
        .formatDateToDisplay(details.uploadDate, false, language));

    return document.replace('__panelReferences_children__', exports
        .getReferencesDiv(details));

  } catch (error) {
    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 11: Media details
