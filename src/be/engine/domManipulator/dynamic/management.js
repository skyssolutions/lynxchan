'use strict';

// handles management pages in general

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
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
  maxThreadFields : 'maxThreadCount',
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

// Section 1: Board control {
exports.setBoardControlCheckBoxes = function(document, boardData) {

  var settings = boardData.settings;

  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];

    var checkBox = document
        .getElementById(exports.boardSettingsRelation[setting]);

    if (checkBox) {
      checkBox.setAttribute('checked', true);
    }

  }

};

exports.setBoardComboBoxes = function(document, boardData, language) {

  for (var i = 0; i < exports.boardRangeSettingsRelation.length; i++) {

    var setting = exports.boardRangeSettingsRelation[i];

    var element = document.getElementById(setting.element);

    var labels = lang(language)[setting.labels];

    for (var j = 0; j <= setting.limit; j++) {

      var option = document.createElement('option');
      option.innerHTML = labels[j];
      option.setAttribute('value', j);

      if (j === boardData[setting.setting]) {
        option.setAttribute('selected', true);
      }

      element.appendChild(option);

    }

  }

};

exports.setBoardFields = function(document, boardData) {

  for ( var key in exports.boardFieldsRelation) {

    document.getElementById(key).setAttribute('value',
        boardData[exports.boardFieldsRelation[key]] || '');
  }

  document.getElementById('validMimesField').setAttribute('value',
      (boardData.acceptedMimes || []).join(', '));

  document.getElementById('tagsField').setAttribute('value',
      (boardData.tags || []).join(', '));

  var messageContent = boardData.boardMessage || '';

  document.getElementById('boardMessageField').defaultValue = messageContent;

};

exports.setVolunteersDiv = function(document, boardData, language) {
  var volunteersDiv = document.getElementById('volunteersDiv');

  var volunteers = boardData.volunteers || [];

  for (var i = 0; i < volunteers.length; i++) {

    var cell = document.createElement('form');
    cell.innerHTML = templateHandler(language).volunteerCell;

    common.setFormCellBoilerPlate(cell, '/setVolunteer.js', 'volunteerCell');

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        volunteers[i]);

    cell.getElementsByClassName('userLabel')[0].innerHTML = volunteers[i];

    cell.getElementsByClassName('boardIdentifier')[0].setAttribute('value',
        boardData.boardUri);

    volunteersDiv.appendChild(cell);
  }
};

exports.setBoardOwnerControls = function(document, boardData, language) {

  for (var i = 0; i < exports.boardControlIdentifiers.length; i++) {
    document.getElementById(exports.boardControlIdentifiers[i]).setAttribute(
        'value', boardData.boardUri);
  }

  if (customJs) {
    document.getElementById('customJsIdentifier').setAttribute('value',
        boardData.boardUri);
  } else {
    common.removeElement(document.getElementById('customJsForm'));
  }

  if (!boardData.usesCustomSpoiler) {
    common.removeElement(document.getElementById('customSpoilerIndicator'));
  }

  exports.setVolunteersDiv(document, boardData, language);

};

exports.setBoardManagementLinks = function(document, boardData) {

  for (var i = 0; i < exports.boardManagementLinks.length; i++) {
    var link = exports.boardManagementLinks[i];

    var url = '/' + link.page + '.js?boardUri=' + boardData.boardUri;
    document.getElementById(link.element).href = url;

  }

};

exports.setContent = function(document, boardData, userData, bans, reports,
    language) {

  document.getElementById('boardSettingsIdentifier').setAttribute('value',
      boardData.boardUri);

  exports.setBoardManagementLinks(document, boardData);

  exports.setBoardControlCheckBoxes(document, boardData);

  exports.setBoardComboBoxes(document, boardData, language);

  exports.setBoardFields(document, boardData);

  var globallyAllowed = globalBoardModeration && userData.globalRole <= 1;

  if (userData.login === boardData.owner || globallyAllowed) {
    exports.setBoardOwnerControls(document, boardData, language);
  } else {
    common.removeElement(document.getElementById('ownerControlDiv'));
  }

  common.setBanList(document, document.getElementById('appealedBansPanel'),
      bans, language);

  common.setReportList(document, reports, language);

};

exports.boardManagement = function(userData, boardData, reports, bans,
    userLanguage) {

  try {

    var document = jsdom(templateHandler(userLanguage).bManagement);

    document.title = lang(userLanguage).titBoardManagement.replace('{$board}',
        boardData.boardUri);

    document.getElementById('linkSelf').href = '/' + boardData.boardUri + '/';

    var boardLabel = document.getElementById('boardLabel');

    var label = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    boardLabel.innerHTML = label;

    exports.setContent(document, boardData, userData, bans, reports,
        userLanguage);

    return serializer(document);

  } catch (error) {

    return error.toString();
  }

};
// } Section 1: Board control

// Section 2: Global Management {
exports.setRoleComboBox = function(document, node, possibleRoles, user) {
  for (var k = 0; k < possibleRoles.length; k++) {

    var role = possibleRoles[k];

    var option = document.createElement('option');
    option.value = role.value;
    option.innerHTML = role.label;

    if (role.value === user.globalRole) {
      option.setAttribute('selected', 'selected');
    }

    node.add(option);

  }

};

exports.fillStaffDiv = function(document, possibleRoles, staff, language) {

  var divStaff = document.getElementById('divStaff');

  for (var i = 0; i < staff.length; i++) {

    var user = staff[i];

    var cell = document.createElement('form');
    cell.innerHTML = templateHandler(language).staffCell;

    common.setFormCellBoilerPlate(cell, '/setGlobalRole.js', 'staffCell');

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        user.login);

    cell.getElementsByClassName('userLabel')[0].innerHTML = user.login + ': ';

    exports.setRoleComboBox(document,
        cell.getElementsByClassName('roleCombo')[0], possibleRoles, user);

    divStaff.appendChild(cell);

  }
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

exports.setNewStaffComboBox = function(document, userRole, language) {

  var comboBox = document.getElementById('newStaffCombo');

  for (var i = userRole + 1; i <= miscOps.getMaxStaffRole(); i++) {

    var option = document.createElement('option');
    option.value = i;
    option.innerHTML = miscOps.getGlobalRoleLabel(i, language);

    comboBox.add(option);
  }

};

exports.setGlobalManagementLinks = function(userRole, document) {

  var displayBans = userRole < miscOps.getMaxStaffRole();

  if (!displayBans) {
    common.removeElement(document.getElementById('hashBansLink'));
    common.removeElement(document.getElementById('bansLink'));
  }

  var displayRangeBans = userRole <= minClearIpRole;

  if (!displayRangeBans) {
    common.removeElement(document.getElementById('rangeBansLink'));
  }

  if (userRole !== 0) {
    common.removeElement(document.getElementById('globalSettingsLink'));
    common.removeElement(document.getElementById('languagesLink'));
  }

  var admin = userRole < 2;

  if (!admin) {
    common.removeElement(document.getElementById('globalBannersLink'));
    common.removeElement(document.getElementById('accountsLink'));
  }
};

exports.processHideableElements = function(document, userRole, staff, lang) {

  if (userRole < 2) {
    exports.setNewStaffComboBox(document, userRole, lang);
    exports.fillStaffDiv(document, exports.getPossibleRoles(userRole, lang),
        staff, lang);
  } else {
    common.removeElement(document.getElementById('addStaffForm'));
    common.removeElement(document.getElementById('divStaff'));
  }

};

exports.setGlobalManagementList = function(document, reports, appealedBans,
    language) {

  common.setReportList(document, reports, language);

  var banDiv = document.getElementById('appealedBansPanel');

  if (appealedBans) {
    common.setBanList(document, banDiv, appealedBans, language);
  } else {
    common.removeElement(banDiv);
  }

};

exports.setUserLabel = function(document, userLogin, userRole, language) {

  var userLabel = document.getElementById('userLabel');

  var userLabelContent = userLogin + ': ';
  userLabelContent += miscOps.getGlobalRoleLabel(userRole, language);

  userLabel.innerHTML = userLabelContent;

};

exports.globalManagement = function(userRole, userLogin, staff, reports,
    appealedBans, language) {

  try {
    var document = jsdom(templateHandler(language).gManagement);

    document.title = lang(language).titGlobalManagement;

    exports.setGlobalManagementList(document, reports, appealedBans, language);

    exports.setGlobalManagementLinks(userRole, document);

    exports.processHideableElements(document, userRole, staff, language);

    exports.setUserLabel(document, userLogin, userRole, language);

    return serializer(document);
  } catch (error) {

    return error.toString();
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
    common
        .removeElement(cell.getElementsByClassName('labelCaseInsensitive')[0]);
  }

  return cell;
};

exports.filterManagement = function(boardUri, filters, language) {

  try {

    var document = jsdom(templateHandler(language).filterManagement);

    document.title = lang(language).titFilters.replace('{$board}', boardUri);

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    var filtersDiv = document.getElementById('divFilters');

    for (var i = 0; i < filters.length; i++) {
      filtersDiv.appendChild(exports.setFilterCell(document, boardUri,
          filters[i], language));
    }

    return serializer(document);

  } catch (error) {

    return error.toString();
  }

};
// } Section 3: Filter management

// Section 4: Rule management {
exports.setRuleManagementCells = function(document, boardUri, rules, language) {
  var rulesDiv = document.getElementById('divRules');

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];

    var cell = document.createElement('form');
    common.setFormCellBoilerPlate(cell, '/deleteRule.js', 'ruleManagementCell');
    cell.innerHTML = templateHandler(language).ruleManagementCell;
    cell.getElementsByClassName('textLabel')[0].innerHTML = rule;

    cell.getElementsByClassName('boardIdentifier')[0].setAttribute('value',
        boardUri);
    cell.getElementsByClassName('indexIdentifier')[0].setAttribute('value', i);

    rulesDiv.appendChild(cell);
  }
};

exports.ruleManagement = function(boardUri, rules, language) {

  try {

    var document = jsdom(templateHandler(language).ruleManagementPage);

    document.title = lang(language).titRuleManagement;

    var boardIdentifier = document.getElementById('boardIdentifier');

    boardIdentifier.setAttribute('value', boardUri);

    exports.setRuleManagementCells(document, boardUri, rules, language);

    return serializer(document);

  } catch (error) {

    return error.toString();
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

    var document = jsdom(templateHandler(language).flagsPage);

    document.title = lang(language).titFlagManagement;

    document.getElementById('maxSizeLabel').innerHTML = displayMaxFlagSize;

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    exports.addFlagCells(document, flags, boardUri, language);

    return serializer(document);
  } catch (error) {

    return error.toString();
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

    var document = jsdom(templateHandler(language).globalSettingsPage);

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

    return serializer(document);

  } catch (error) {

    return error.toString();
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

    var document = jsdom(templateHandler(language).bannerManagementPage);

    if (boardUri) {
      document.title = lang(language).titBanners.replace('{$board}', boardUri);
      document.getElementById('boardIdentifier')
          .setAttribute('value', boardUri);

    } else {
      document.title = lang(language).titGlobalBanners;
      common.removeElement(document.getElementById('boardIdentifier'));
    }

    document.getElementById('maxSizeLabel').innerHTML = displayMaxBannerSize;

    exports.addBannerCells(document, banners, language);

    return serializer(document);

  } catch (error) {

    return error.toString();

  }

};
// } Section 7: Banners

// Section 8: Media management {
exports.setMediaManagementPages = function(pages, document, parameters) {

  var pagesDiv = document.getElementById('pagesDiv');

  var boilerPlate = '';

  if (parameters.orphaned) {
    boilerPlate += '&orphaned=1';
  }

  for (var i = 1; i <= pages; i++) {

    var link = document.createElement('a');
    link.innerHTML = i;
    link.href = '/mediaManagement.js?page=' + i + boilerPlate;

    pagesDiv.appendChild(link);

  }

};

exports.getFileLink = function(file) {

  var filePath = '/.media/' + file.identifier;

  if (file.extension) {
    filePath += '.' + file.extension;
  }

  return filePath;

};

exports.setMediaManagementCells = function(document, media, language) {

  var filesDiv = document.getElementById('filesDiv');

  for (var i = 0; i < media.length; i++) {

    var file = media[i];

    var cell = document.createElement('div');
    cell.innerHTML = templateHandler(language).mediaCell;
    cell.setAttribute('class', 'mediaCell');

    var link = cell.getElementsByClassName('fileLink')[0];
    link.href = exports.getFileLink(file);
    link.innerHTML = file.identifier;

    cell.getElementsByClassName('identifierCheckbox')[0].setAttribute('name',
        file.identifier);

    var thumbImg = cell.getElementsByClassName('thumbImg')[0];
    thumbImg.setAttribute('src', '/.media/t_' + file.identifier);

    var referencesLabel = cell.getElementsByClassName('referencesLabel')[0];
    referencesLabel.innerHTML = file.references;

    filesDiv.appendChild(cell);

  }

};

exports.mediaManagement = function(media, pages, parameters, language) {

  try {

    var document = jsdom(templateHandler(language).mediaManagementPage);

    document.title = lang(language).titMediaManagement;

    exports.setMediaManagementPages(pages, document, parameters);

    exports.setMediaManagementCells(document, media, language);

    return serializer(document);

  } catch (error) {

    return error.toString();

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

    var document = jsdom(templateHandler(language).languagesManagementPage);

    document.title = lang(language).titLanguages;

    for (var i = 0; i < languages.length; i++) {
      exports.addLanguageCell(document, languages[i], language);
    }

    return serializer(document);

  } catch (error) {
    return error.toString();
  }

};
// } Section 9: Language management

exports.accounts = function(accounts, language) {

  try {

    var document = jsdom(templateHandler(language).accountsPage);

    document.title = lang(language).titAccounts;

    var accountsDiv = document.getElementById('divAccounts');

    for (var i = 0; i < accounts.length; i++) {

      var account = accounts[i];

      var newCell = document.createElement('div');
      newCell.innerHTML = templateHandler(language).accountCell;

      var accountLink = newCell.getElementsByClassName('accountLink')[0];
      accountLink.href = '/accountManagement.js?account=' + account;
      accountLink.innerHTML = account;

      accountsDiv.appendChild(newCell);
    }

    return serializer(document);

  } catch (error) {
    return error.toString();
  }

};
