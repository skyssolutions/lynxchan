'use strict';

// handles management pages in general

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
var debug = require('../../../kernel').debug();
var settings;
var verbose;
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
  disableCaptcha : 'disableCaptchaCheckbox',
  forceAnonymity : 'forceAnonymityCheckbox',
  allowCode : 'allowCodeCheckbox',
  archive : 'enableArchiveCheckbox',
  early404 : 'early404Checkbox',
  unindex : 'unindexCheckbox',
  blockDeletion : 'blockDeletionCheckbox',
  requireThreadFile : 'requireFileCheckbox',
  uniquePosts : 'uniquePostsCheckbox',
  uniqueFiles : 'uniqueFilesCheckbox',
  locationFlags : 'locationCheckBox'
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
  autoSageLimitField : 'autoSageLimit'
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
  verbose = settings.verbose;
  globalBoardModeration = settings.allowGlobalBoardModeration;
  customJs = settings.allowBoardCustomJs;
  displayMaxBannerSize = common.formatFileSize(settings.maxBannerSizeB);
  displayMaxFlagSize = common.formatFileSize(settings.maxFlagSizeB);

};

exports.loadDependencies = function() {

  common = require('..').common;
  templateHandler = require('../../templateHandler');
  lang = require('../../langOps').languagePack();
  miscOps = require('../../miscOps');

};

// Section 1: Board control {
exports.setBoardControlCheckBoxes = function(document, boardData) {

  var settings = boardData.settings;

  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];
    document.getElementById(exports.boardSettingsRelation[setting])
        .setAttribute('checked', true);
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

exports.setVolunteersDiv = function(document, boardData) {
  var volunteersDiv = document.getElementById('volunteersDiv');

  var volunteers = boardData.volunteers || [];

  for (var i = 0; i < volunteers.length; i++) {

    var cell = document.createElement('form');
    cell.innerHTML = templateHandler.volunteerCell;

    common.setFormCellBoilerPlate(cell, '/setVolunteer.js', 'volunteerCell');

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        volunteers[i]);

    cell.getElementsByClassName('userLabel')[0].innerHTML = volunteers[i];

    cell.getElementsByClassName('boardIdentifier')[0].setAttribute('value',
        boardData.boardUri);

    volunteersDiv.appendChild(cell);
  }
};

exports.setBoardOwnerControls = function(document, boardData) {

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

  exports.setVolunteersDiv(document, boardData);

};

exports.setBoardManagementLinks = function(document, boardData) {

  for (var i = 0; i < exports.boardManagementLinks.length; i++) {
    var link = exports.boardManagementLinks[i];

    var url = '/' + link.page + '.js?boardUri=' + boardData.boardUri;
    document.getElementById(link.element).href = url;

  }

};

exports.setContent = function(document, boardData, userData, bans, reports) {

  document.getElementById('boardSettingsIdentifier').setAttribute('value',
      boardData.boardUri);

  exports.setBoardManagementLinks(document, boardData);

  exports.setBoardControlCheckBoxes(document, boardData);

  exports.setBoardFields(document, boardData);

  var globallyAllowed = globalBoardModeration && userData.globalRole <= 1;

  if (userData.login === boardData.owner || globallyAllowed) {
    exports.setBoardOwnerControls(document, boardData);
  } else {
    common.removeElement(document.getElementById('ownerControlDiv'));
  }

  common.setBanList(document, document.getElementById('appealedBansPanel'),
      bans);

  common.setReportList(document, reports);

};

exports.boardManagement = function(userData, boardData, reports, bans) {

  try {

    var document = jsdom(templateHandler.bManagement);

    document.title = lang.titBoardManagement.replace('{$board}',
        boardData.boardUri);

    document.getElementById('linkSelf').href = '/' + boardData.boardUri + '/';

    var boardLabel = document.getElementById('boardLabel');

    var label = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    boardLabel.innerHTML = label;

    exports.setContent(document, boardData, userData, bans, reports);

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

exports.fillStaffDiv = function(document, possibleRoles, staff) {

  var divStaff = document.getElementById('divStaff');

  for (var i = 0; i < staff.length; i++) {

    var user = staff[i];

    var cell = document.createElement('form');
    cell.innerHTML = templateHandler.staffCell;

    common.setFormCellBoilerPlate(cell, '/setGlobalRole.js', 'staffCell');

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        user.login);

    cell.getElementsByClassName('userLabel')[0].innerHTML = user.login + ': ';

    exports.setRoleComboBox(document,
        cell.getElementsByClassName('roleCombo')[0], possibleRoles, user);

    divStaff.appendChild(cell);

  }
};

exports.getPossibleRoles = function(role) {

  var roles = [];

  for (var i = role + 1; i <= miscOps.getMaxStaffRole() + 1; i++) {
    var toPush = {
      value : i,
      label : miscOps.getGlobalRoleLabel(i)
    };

    roles.push(toPush);

  }

  return roles;
};

exports.setNewStaffComboBox = function(document, userRole) {

  var comboBox = document.getElementById('newStaffCombo');

  for (var i = userRole + 1; i <= miscOps.getMaxStaffRole(); i++) {

    var option = document.createElement('option');
    option.value = i;
    option.innerHTML = miscOps.getGlobalRoleLabel(i);

    comboBox.add(option);
  }

};

exports.setGlobalManagementLinks = function(userRole, document) {

  var displayBans = userRole < miscOps.getMaxStaffRole();

  if (!displayBans) {
    common.removeElement(document.getElementById('hashBansLink'));
    common.removeElement(document.getElementById('rangeBansLink'));
    common.removeElement(document.getElementById('bansLink'));
  }

  if (userRole !== 0) {
    common.removeElement(document.getElementById('globalSettingsLink'));
  }

  var admin = userRole < 2;

  if (!admin) {
    common.removeElement(document.getElementById('archiveDeletionLink'));
    common.removeElement(document.getElementById('globalBannersLink'));
  }
};

exports.processHideableElements = function(document, userRole, staff) {

  if (userRole < 2) {
    exports.setNewStaffComboBox(document, userRole);
  } else {
    common.removeElement(document.getElementById('addStaffForm'));
  }

  if (userRole < 2) {
    exports.fillStaffDiv(document, exports.getPossibleRoles(userRole), staff);
  } else {
    common.removeElement(document.getElementById('divStaff'));
  }

};

exports.setGlobalManagementList = function(document, reports, appealedBans) {

  common.setReportList(document, reports);

  var banDiv = document.getElementById('appealedBansPanel');

  if (appealedBans) {
    common.setBanList(document, banDiv, appealedBans);
  } else {
    common.removeElement(banDiv);
  }

};

exports.setUserLabel = function(document, userLogin, userRole) {

  var userLabel = document.getElementById('userLabel');

  var userLabelContent = userLogin + ': ';
  userLabelContent += miscOps.getGlobalRoleLabel(userRole);

  userLabel.innerHTML = userLabelContent;

};

exports.globalManagement = function(userRole, userLogin, staff, reports,
    appealedBans) {

  try {
    var document = jsdom(templateHandler.gManagement);

    document.title = lang.titGlobalManagement;

    exports.setGlobalManagementList(document, reports, appealedBans);

    exports.setGlobalManagementLinks(userRole, document);

    exports.processHideableElements(document, userRole, staff);

    exports.setUserLabel(document, userLogin, userRole);

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
// } Section 2: Global Management

// Section 3: Filter management {

exports.setFilterCell = function(document, boardUri, filter) {

  var cell = document.createElement('form');

  cell.innerHTML = templateHandler.filterCell;

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

exports.filterManagement = function(boardUri, filters) {

  try {

    var document = jsdom(templateHandler.filterManagement);

    document.title = lang.titFilters.replace('{$board}', boardUri);

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    var filtersDiv = document.getElementById('divFilters');

    for (var i = 0; i < filters.length; i++) {
      filtersDiv.appendChild(exports.setFilterCell(document, boardUri,
          filters[i]));
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
// } Section 3: Filter management

// Section 4: Rule management {
exports.setRuleManagementCells = function(document, boardUri, rules) {
  var rulesDiv = document.getElementById('divRules');

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];

    var cell = document.createElement('form');
    common.setFormCellBoilerPlate(cell, '/deleteRule.js', 'ruleManagementCell');
    cell.innerHTML = templateHandler.ruleManagementCell;
    cell.getElementsByClassName('textLabel')[0].innerHTML = rule;

    cell.getElementsByClassName('boardIdentifier')[0].setAttribute('value',
        boardUri);
    cell.getElementsByClassName('indexIdentifier')[0].setAttribute('value', i);

    rulesDiv.appendChild(cell);
  }
};

exports.ruleManagement = function(boardUri, rules) {

  try {

    var document = jsdom(templateHandler.ruleManagementPage);

    document.title = lang.titRuleManagement;

    var boardIdentifier = document.getElementById('boardIdentifier');

    boardIdentifier.setAttribute('value', boardUri);

    exports.setRuleManagementCells(document, boardUri, rules);

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
// } Section 4: Rule management

// Section 5: Flag management {
exports.addFlagCells = function(document, flags, boardUri) {

  var flagsDiv = document.getElementById('flagsDiv');

  for (var i = 0; i < flags.length; i++) {
    var flag = flags[i];

    var cell = document.createElement('form');

    common.setFormCellBoilerPlate(cell, '/deleteFlag.js', 'flagCell');

    cell.innerHTML = templateHandler.flagCell;

    var flagUrl = '/' + boardUri + '/flags/' + flag._id;

    cell.getElementsByClassName('flagImg')[0].src = flagUrl;

    cell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        flag._id);

    cell.getElementsByClassName('nameLabel')[0].innerHTML = flag.name;

    flagsDiv.appendChild(cell);
  }

};

exports.flagManagement = function(boardUri, flags, callback) {
  try {

    var document = jsdom(templateHandler.flagsPage);

    document.title = lang.titFlagManagement;

    document.getElementById('maxSizeLabel').innerHTML = displayMaxFlagSize;

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    exports.addFlagCells(document, flags, boardUri);

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

exports.globalSettings = function() {

  try {

    var document = jsdom(templateHandler.globalSettingsPage);

    var siteSettingsRelation = miscOps.getParametersArray();

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

    document.title = lang.titGlobalSettings;

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
// } Section 6: Global settings

// Section 7: Banners {
exports.addBannerCells = function(document, banners) {

  var bannerDiv = document.getElementById('bannersDiv');

  for (var i = 0; i < banners.length; i++) {
    var banner = banners[i];

    var cell = document.createElement('form');
    cell.innerHTML = templateHandler.bannerCell;

    common.setFormCellBoilerPlate(cell, '/deleteBanner.js', 'bannerCell');

    cell.getElementsByClassName('bannerImage')[0].src = banner.filename;

    cell.getElementsByClassName('bannerIdentifier')[0].setAttribute('value',
        banner._id);

    bannerDiv.appendChild(cell);
  }

};

exports.bannerManagement = function(boardUri, banners) {

  try {

    var document = jsdom(templateHandler.bannerManagementPage);

    if (boardUri) {
      document.title = lang.titBanners.replace('{$board}', boardUri);
      document.getElementById('boardIdentifier')
          .setAttribute('value', boardUri);

    } else {
      document.title = lang.titGlobalBanners;
      common.removeElement(document.getElementById('boardIdentifier'));
    }

    document.getElementById('maxSizeLabel').innerHTML = displayMaxBannerSize;

    exports.addBannerCells(document, banners);

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
// } Section 7: Banners
