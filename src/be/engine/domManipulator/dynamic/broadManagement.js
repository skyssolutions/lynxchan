'use strict';

var lang;
var common;
var templateHandler;
var customJs;
var volunteerSettings;
var settings;
var miscOps;
var minClearIpRole;
var boardMessageLength;
var globalBoardModeration;

exports.loadSettings = function() {

  settings = require('../../../settingsHandler').getGeneralSettings();
  customJs = settings.allowBoardCustomJs;
  volunteerSettings = settings.allowVolunteerSettings;
  minClearIpRole = settings.clearIpMinRole;
  boardMessageLength = settings.boardMessageLength;
  globalBoardModeration = settings.allowGlobalBoardModeration;

};

exports.loadDependencies = function() {

  lang = require('../../langOps').languagePack;
  common = require('..').common;
  miscOps = require('../../miscOps');
  templateHandler = require('../../templateHandler').getTemplates;

};

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
  autoFullCaptchaThresholdField : 'autoFullCaptchaThreshold',
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
  page : 'openReports',
  element : 'openReportsLink'
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
  page : 'asnBans',
  element : 'asnBansLink'
}, {
  page : 'rules',
  element : 'ruleManagementLink'
}, {
  page : 'hashBans',
  element : 'hashBansLink'
}, {
  page : 'flags',
  element : 'flagManagementLink'
}, {
  page : 'appealedBans',
  element : 'appealedBansLink'
} ];

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

exports.setLanguageCombobox = function(document, boardData, langs, language) {

  var languagesChildren = '<option value="">';
  languagesChildren += lang(language).guiNoPreferredLanguage;
  languagesChildren += '</option>';

  for (var i = 0; i < langs.length; i++) {

    var currentLang = langs[i];

    var option = '<option value="' + currentLang.id + '"';

    if (boardData.preferredLanguage === currentLang.id) {
      option += ' selected="selected"';
    }

    languagesChildren += option + '>' + currentLang.label + '</option>';

  }

  return document.replace('__languageCombobox_children__', languagesChildren);

};

exports.setBoardComboBoxes = function(document, boardData, langs, language) {

  document = exports.setLanguageCombobox(document, boardData, langs, language);

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

exports.setBoardFields = function(document, boardData, languages, language) {

  document = exports.setBoardComboBoxes(document, boardData, languages,
      language);
  document = exports.setBoardControlCheckBoxes(document, boardData);

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

  var specialSettings = boardData.specialSettings || [];

  var allowJs = specialSettings.indexOf('allowJs') > -1;

  if (customJs || allowJs) {
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

exports.checkOwnership = function(userData, boardData, languages, template,
    language) {

  var globallyAllowed = globalBoardModeration && userData.globalRole <= 1;

  var allowed = userData.login === boardData.owner || globallyAllowed;

  var document = template.template;

  if (allowed) {
    document = document.replace('__ownerControlDiv_location__',
        template.removable.ownerControlDiv);

    document = document.replace('__bannerManagementLink_location__',
        template.removable.bannerManagementLink);

    document = exports.setBoardOwnerControls(document, boardData, language);

  } else {
    document = document.replace('__ownerControlDiv_location__', '');
  }

  if (allowed || volunteerSettings) {

    document = document.replace('__settingsForm_location__',
        template.removable.settingsForm).replace(
        '__boardSettingsIdentifier_value__', common.clean(boardData.boardUri));

    document = exports.setBoardFields(document, boardData, languages, language);

  } else {
    document = document.replace('__settingsForm_location__', '');
  }

  return document;

};

exports.getBoardManagementContent = function(boardData, languages, userData,
    language) {

  var template = templateHandler(language).bManagement;

  var document = exports.checkOwnership(userData, boardData, languages,
      template, language);

  if (boardData.lockedUntil) {
    document = document.replace('__resetBoardLockForm_location__',
        template.removable.resetBoardLockForm).replace(
        '__resetLockIdentifier_value__', boardData.boardUri);
  } else {
    document = document.replace('__resetBoardLockForm_location__', '');
  }

  document = document.replace('__messageLengthLabel_inner__',
      boardMessageLength);

  return exports.setBoardManagementLinks(document, boardData);

};

exports.boardManagement = function(userData, bData, languages,
    appealedBanCount, reportCount, language) {

  var document = exports.getBoardManagementContent(bData, languages, userData,
      language).replace('__openReportsLabel_inner__', reportCount).replace(
      '__appealedBansLabel_inner__', appealedBanCount);

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
    document = document.replace('__asnBansLink_location__',
        removable.asnBansLink);
    document = document.replace('__hashBansLink_location__',
        removable.hashBansLink);
  } else {
    document = document.replace('__asnBansLink_location__', '');
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
        removable.accountsLink).replace('__globalBannersLink_location__',
        removable.globalBannersLink).replace('__globalFiltersLink_location__',
        removable.globalFiltersLink);

  } else {
    document = document.replace('__accountsLink_location__', '').replace(
        '__globalBannersLink_location__', '').replace(
        '__globalFiltersLink_location__', '');

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

exports.globalManagement = function(userRole, userLogin, staff,
    appealedBanCount, reportCount, language) {

  var template = templateHandler(language).gManagement;

  var document = template.template.replace('__title__',
      lang(language).titGlobalManagement).replace('__openReportsLabel_inner__',
      reportCount).replace('__appealedBansLabel_inner__', appealedBanCount);

  document = exports.setGlobalManagementLinks(userRole, document,
      template.removable);

  return exports.processHideableElements(document, userRole, staff, language,
      template.removable);

};
