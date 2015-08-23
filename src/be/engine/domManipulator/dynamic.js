'use strict';

var lang = require('../langOps').languagePack();
var templateHandler = require('../templateHandler');
var boot = require('../../boot');
var settings = boot.getGeneralSettings();
var common = require('./common');
var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
var debug = boot.debug();
var miscOps = require('../miscOps');
var verbose = settings.verbose;
var boardCreationRestricted = settings.restrictBoardCreation;

var optionalStringLogParameters = [ 'user', 'boardUri', 'after', 'before' ];

var accountSettingsRelation = {
  alwaysSignRole : 'checkboxAlwaysSign'
};

var boardSettingsRelation = {
  disableIds : 'disableIdsCheckbox',
  disableCaptcha : 'disableCaptchaCheckbox',
  forceAnonymity : 'forceAnonymityCheckbox',
  allowCode : 'allowCodeCheckbox',
  archive : 'enableArchiveCheckbox',
  early404 : 'early404Checkbox',
  unindex : 'unindexCheckbox'
};

var boardFieldsRelation = {
  boardNameField : 'boardName',
  tagsField : 'tags',
  boardDescriptionField : 'boardDescription',
  autoCaptchaThresholdField : 'autoCaptchaThreshold',
  hourlyThreadLimitField : 'hourlyThreadLimit',
  anonymousNameField : 'anonymousName'
};

var boardControlIdentifiers = [ 'addVolunteerBoardIdentifier',
    'deletionIdentifier', 'transferBoardIdentifier', 'boardSettingsIdentifier',
    'customCssIdentifier', 'customSpoilerIdentifier' ];

var boardManagementLinks = [ {
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

var availableLogTypes = {
  '' : lang.guiAllTypes,
  archiveDeletion : lang.guiTypeArchiveDeletion,
  ban : lang.guiTypeBan,
  rangeBan : lang.guiTypeRange,
  banLift : lang.guiTypeBanLift,
  deletion : lang.guiTypeDeletion,
  reportClosure : lang.guiTypeReportClosure,
  globalRoleChange : lang.guiTypeGlobalRoleChange,
  boardDeletion : lang.guiTypeBoardDeletion,
  boardTransfer : lang.guiTypeBoardTransfer,
  hashBan : lang.guiTypeHashBan,
  hashBanLift : lang.guiTypeHashBanLift
};

var displayMaxBannerSize = common.formatFileSize(settings.maxBannerSizeB);
var displayMaxFlagSize = common.formatFileSize(settings.maxFlagSizeB);

var siteSettingsRelation = {

  fieldAddress : {
    setting : 'address',
    type : 'string'
  },
  fieldPort : {
    setting : 'port',
    type : 'string'
  },
  fieldFePath : {
    setting : 'fePath',
    type : 'string'
  },
  fieldPageSize : {
    setting : 'pageSize',
    type : 'string'
  },
  fieldLatestPostsCount : {
    setting : 'latestPostCount',
    type : 'string'
  },
  fieldAutoSageLimit : {
    setting : 'autoSageLimit',
    type : 'string'
  },
  fieldThreadLimit : {
    setting : 'maxThreadCount',
    type : 'string'
  },
  fieldSiteTitle : {
    setting : 'siteTitle',
    type : 'string'
  },
  fieldTempDir : {
    setting : 'tempDirectory',
    type : 'string'
  },
  fieldSenderEmail : {
    setting : 'emailSender',
    type : 'string'
  },
  fieldCaptchaExpiration : {
    setting : 'captchaExpiration',
    type : 'string'
  },
  fieldMaxRequestSize : {
    setting : 'maxRequestSizeMB',
    type : 'string'
  },
  fieldMaxFileSize : {
    setting : 'maxFileSizeMB',
    type : 'string'
  },
  fieldMaxFiles : {
    setting : 'maxFiles',
    type : 'string'
  },
  fieldBanMessage : {
    setting : 'defaultBanMessage',
    type : 'string'
  },
  fieldLogPageSize : {
    setting : 'logPageSize',
    type : 'string'
  },
  fieldAnonymousName : {
    setting : 'defaultAnonymousName',
    type : 'string'
  },
  fieldTopBoardsCount : {
    setting : 'topBoardsCount',
    type : 'string'
  },
  fieldBoardsPerPage : {
    setting : 'boardsPerPage',
    type : 'string'
  },
  fieldTorSource : {
    setting : 'torSource',
    type : 'string'
  },
  fieldLanguagePack : {
    setting : 'languagePackPath',
    type : 'string'
  },
  fieldMaxRules : {
    setting : 'maxBoardRules',
    type : 'string'
  },
  fieldThumbSize : {
    setting : 'thumbSize',
    type : 'string'
  },
  fieldMaxTags : {
    setting : 'maxBoardTags',
    type : 'string'
  },
  fieldMaxFilters : {
    setting : 'maxFilters',
    type : 'string'
  },
  fieldMaxVolunteers : {
    setting : 'maxBoardVolunteers',
    type : 'string'
  },
  fieldMaxBannerSize : {
    setting : 'maxBannerSizeKB',
    type : 'string'
  },
  fieldMaxFlagSize : {
    setting : 'maxFlagSizeKB',
    type : 'string'
  },
  fieldFloodInterval : {
    setting : 'floodTimerSec',
    type : 'string'
  },
  checkboxVerbose : {
    setting : 'verbose',
    type : 'boolean'
  },
  checkboxDisable304 : {
    setting : 'disable304',
    type : 'boolean'
  },
  checkboxSsl : {
    setting : 'ssl',
    type : 'boolean'
  },
  checkboxBlockTor : {
    setting : 'blockTor',
    type : 'boolean'
  },
  checkboxMediaThumb : {
    setting : 'mediaThumb',
    type : 'boolean'
  },
  checkboxMaintenance : {
    setting : 'maintenance',
    type : 'boolean'
  },
  checkboxMultipleReports : {
    setting : 'multipleReports',
    type : 'boolean'
  },
  checkboxBlockProxy : {
    setting : 'blockProxy',
    type : 'boolean'
  },
  checkboxDisableFloodCheck : {
    setting : 'disableFloodCheck',
    type : 'boolean'
  },
  checkboxServeArchive : {
    setting : 'serveArchive',
    type : 'boolean'
  },
  checkboxDisableAccountCreation : {
    setting : 'disableAccountCreation',
    type : 'boolean'
  },
  checkboxRestrictBoardCreation : {
    setting : 'restrictBoardCreation',
    type : 'boolean'
  },
  fieldCaptchaFonts : {
    setting : 'captchaFonts',
    type : 'array'
  },
  fieldAcceptedMimes : {
    setting : 'acceptedMimes',
    type : 'array'
  },
  comboArchive : {
    setting : 'archiveLevel',
    type : 'combo',
    options : lang.guiArchiveLevels
  }
};

exports.bannerManagement = function(boardUri, banners) {

  try {

    var document = jsdom(templateHandler.bannerManagementPage);

    document.title = lang.titBanners.replace('{$board}', boardUri);

    document.getElementById('maxSizeLabel').innerHTML = displayMaxBannerSize;

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

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

exports.ban = function(ban, board) {

  try {

    var document = jsdom(ban.range ? templateHandler.rangeBanPage
        : templateHandler.banPage);

    document.title = lang.titBan;

    document.getElementById('boardLabel').innerHTML = board;

    if (ban.range) {
      document.getElementById('rangeLabel').innerHTML = ban.range.join('.');
    } else {
      document.getElementById('reasonLabel').innerHTML = ban.reason;

      document.getElementById('idLabel').innerHTML = ban._id;

      ban.expiration = common.formatDateToDisplay(ban.expiration);
      document.getElementById('expirationLabel').innerHTML = ban.expiration;
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

exports.error = function(code, message) {

  try {

    var document = jsdom(templateHandler.errorPage);

    document.title = lang.titError;

    document.getElementById('codeLabel').innerHTML = code;

    document.getElementById('errorLabel').innerHTML = message;

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

// Section 1: Bans {
function setBanCell(ban, cell) {

  cell.getElementsByClassName('idLabel')[0].innerHTML = ban._id;

  cell.getElementsByClassName('reasonLabel')[0].innerHTML = ban.reason;

  var expirationLabel = cell.getElementsByClassName('expirationLabel')[0];
  expirationLabel.innerHTML = common.formatDateToDisplay(ban.expiration);

  var appliedByLabel = cell.getElementsByClassName('appliedByLabel')[0];
  appliedByLabel.innerHTML = ban.appliedBy;

  var boardLabel = cell.getElementsByClassName('boardLabel')[0];
  boardLabel.innerHTML = ban.boardUri ? ban.boardUri : lang.miscAllBoards;

  cell.getElementsByClassName('idIdentifier')[0].setAttribute('value', ban._id);

}

exports.bans = function(bans) {

  try {

    var document = jsdom(templateHandler.bansPage);

    document.title = lang.titBansManagement;

    var bansDiv = document.getElementById('bansDiv');

    for (var i = 0; i < bans.length; i++) {

      var ban = bans[i];
      var cell = document.createElement('form');
      cell.innerHTML = templateHandler.banCell;

      common.setFormCellBoilerPlate(cell, '/liftBan.js', 'banCell');

      setBanCell(ban, cell);
      bansDiv.appendChild(cell);
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
// } Section 1: Bans

// Section 2: Closed reports {
function setClosedReportCell(cell, report) {

  if (report.reason) {
    var reason = cell.getElementsByClassName('reasonLabel')[0];
    reason.innerHTML = report.reason;
  }

  var reportLink = cell.getElementsByClassName('link')[0];
  reportLink.setAttribute('href', common.getReportLink(report));

  var closedBy = cell.getElementsByClassName('closedByLabel')[0];
  closedBy.innerHTML = report.closedBy;

  var closedDate = cell.getElementsByClassName('closedDateLabel')[0];
  closedDate.innerHTML = report.closing;
}

exports.closedReports = function(reports, callback) {

  try {
    var document = jsdom(templateHandler.closedReportsPage);

    document.title = lang.titClosedReports;

    var reportsDiv = document.getElementById('reportDiv');

    for (var i = 0; i < reports.length; i++) {

      var report = reports[i];
      var cell = document.createElement('div');

      cell.innerHTML = templateHandler.closedReportCell;
      cell.setAttribute('class', 'closedReportCell');

      setClosedReportCell(cell, report);

      reportsDiv.appendChild(cell);

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
// } Section 2: Closed reports

// Section 3: Board control {
function setBoardControlCheckBoxes(document, boardData) {

  var settings = boardData.settings;

  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];
    document.getElementById(boardSettingsRelation[setting]).setAttribute(
        'checked', true);
  }

}

function setBoardFields(document, boardData) {

  for ( var key in boardFieldsRelation) {

    document.getElementById(key).setAttribute('value',
        boardData[boardFieldsRelation[key]] || '');
  }

  var messageContent = boardData.boardMessage || '';

  document.getElementById('boardMessageField').defaultValue = messageContent;

}

function setVolunteersDiv(document, boardData) {
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
}

function setBoardOwnerControls(document, boardData) {

  for (var i = 0; i < boardControlIdentifiers.length; i++) {
    document.getElementById(boardControlIdentifiers[i]).setAttribute('value',
        boardData.boardUri);
  }

  if (!boardData.usesCustomSpoiler) {
    common.removeElement(document.getElementById('customSpoilerIndicator'));
  }

  setBoardControlCheckBoxes(document, boardData);

  setVolunteersDiv(document, boardData);

}

function setBoardManagementLinks(document, boardData) {

  for (var i = 0; i < boardManagementLinks.length; i++) {
    var link = boardManagementLinks[i];

    var url = '/' + link.page + '.js?boardUri=' + boardData.boardUri;
    document.getElementById(link.element).href = url;

  }

}

exports.boardManagement = function(login, boardData, reports) {

  try {

    var document = jsdom(templateHandler.bManagement);

    document.title = lang.titBoardManagement.replace('{$board}',
        boardData.boardUri);

    setBoardManagementLinks(document, boardData);

    setBoardFields(document, boardData);

    var boardLabel = document.getElementById('boardLabel');

    var label = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    boardLabel.innerHTML = label;

    common.setReportList(document, reports);

    if (login === boardData.owner) {
      setBoardOwnerControls(document, boardData);
    } else {
      common.removeElement(document.getElementById('ownerControlDiv'));
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
// } Section 3: Board control

// Section 4: Global Management {
function setRoleComboBox(document, node, possibleRoles, user) {
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

}

function fillStaffDiv(document, possibleRoles, staff) {
  var divStaff = document.getElementById('divStaff');

  for (var i = 0; i < staff.length; i++) {

    var user = staff[i];

    var cell = document.createElement('form');
    cell.innerHTML = templateHandler.staffCell;

    common.setFormCellBoilerPlate(cell, '/setGlobalRole.js', 'staffCell');

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        user.login);

    cell.getElementsByClassName('userLabel')[0].innerHTML = user.login + ': ';

    setRoleComboBox(document, cell.getElementsByClassName('roleCombo')[0],
        possibleRoles, user);

    divStaff.appendChild(cell);

  }
}

function getPossibleRoles(role) {

  var roles = [];

  for (var i = role + 1; i <= miscOps.getMaxStaffRole() + 1; i++) {
    var toPush = {
      value : i,
      label : miscOps.getGlobalRoleLabel(i)
    };

    roles.push(toPush);

  }

  return roles;
}

function setNewStaffComboBox(document, userRole) {

  var comboBox = document.getElementById('newStaffCombo');

  for (var i = userRole + 1; i <= miscOps.getMaxStaffRole(); i++) {

    var option = document.createElement('option');
    option.value = i;
    option.innerHTML = miscOps.getGlobalRoleLabel(i);

    comboBox.add(option);
  }

}

function setGlobalManagementLinks(userRole, document) {

  var displayBans = userRole < miscOps.getMaxStaffRole();

  if (!displayBans) {
    common.removeElement(document.getElementById('hashBansLink'));
    common.removeElement(document.getElementById('rangeBansLink'));
    common.removeElement(document.getElementById('bansLink'));
  }

  if (userRole !== 0) {
    common.removeElement(document.getElementById('globalSettingsLink'));
  }

  var deleteArchive = userRole < 2;

  if (!deleteArchive) {
    common.removeElement(document.getElementById('archiveDeletionLink'));
  }
}

exports.globalManagement = function(userRole, userLogin, staff, reports) {

  try {
    var document = jsdom(templateHandler.gManagement);

    document.title = lang.titGlobalManagement;

    common.setReportList(document, reports);

    setGlobalManagementLinks(userRole, document);

    if (userRole < 2) {
      setNewStaffComboBox(document, userRole);
    } else {
      common.removeElement(document.getElementById('addStaffForm'));
    }

    var userLabel = document.getElementById('userLabel');

    var userLabelContent = userLogin + ': ';
    userLabelContent += miscOps.getGlobalRoleLabel(userRole);

    userLabel.innerHTML = userLabelContent;

    fillStaffDiv(document, getPossibleRoles(userRole), staff);

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
// } Section 4: Global Management

exports.resetEmail = function(password) {

  try {

    var document = jsdom(templateHandler.resetEmail);

    var link = document.getElementById('labelNewPass');
    link.innerHTML = password;

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

exports.recoveryEmail = function(recoveryLink) {

  try {

    var document = jsdom(templateHandler.recoveryEmail);

    var link = document.getElementById('linkRecovery');
    link.href = recoveryLink;

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

// Section 5: Account {
function fillOwnedBoardsDiv(document, boardList) {
  if (!boardList || !boardList.length) {
    return;
  }

  var boardDiv = document.getElementById('boardsDiv');

  for (var i = 0; i < boardList.length; i++) {
    var link = document.createElement('a');

    if (i) {
      boardDiv.appendChild(document.createElement('br'));
    }

    link.innerHTML = '/' + boardList[i] + '/';
    link.href = link.innerHTML;

    boardDiv.appendChild(link);

  }

}

function setBoardCreationForm(userData, document) {

  var allowed = userData.globalRole < 2;

  if (boardCreationRestricted && !allowed) {
    common.removeElement(document.getElementById('boardCreationDiv'));
  }
}

function setAccountSettingsCheckbox(settings, document) {

  if (!settings || !settings.length) {
    return;
  }

  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];

    var checkbox = document.getElementById(accountSettingsRelation[setting]);

    checkbox.setAttribute('checked', true);
  }

}

exports.account = function(userData) {

  try {
    var document = jsdom(templateHandler.accountPage);

    document.title = lang.titAccount.replace('{$login}', userData.login);

    var loginLabel = document.getElementById('labelLogin');

    loginLabel.innerHTML = userData.login;

    var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

    setBoardCreationForm(userData, document);

    if (!globalStaff) {
      common.removeElement(document.getElementById('globalManagementLink'));
    }

    setAccountSettingsCheckbox(userData.settings, document);

    if (userData.email && userData.email.length) {
      document.getElementById('emailField').setAttribute('value',
          userData.email);
    }

    fillOwnedBoardsDiv(document, userData.ownedBoards);

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
// } Section 5: Account

// Section 6: Logs {
function fillComboBox(document, parameters) {

  var combobox = document.getElementById('comboboxType');

  for ( var type in availableLogTypes) {

    var option = document.createElement('option');

    option.innerHTML = availableLogTypes[type];
    option.value = type;

    if (parameters.type === type) {
      option.setAttribute('selected', true);
    }

    combobox.appendChild(option);

  }

}

function fillSearchForm(parameters, document) {

  if (parameters.user) {
    document.getElementById('fieldUser').setAttribute('value', parameters.user);
  }

  if (parameters.excludeGlobals) {
    document.getElementById('checkboxExcludeGlobals').setAttribute('checked',
        true);
  }

  if (parameters.after) {
    document.getElementById('fieldAfter').setAttribute('value',
        parameters.after);
  }

  if (parameters.before) {
    document.getElementById('fieldBefore').setAttribute('value',
        parameters.before);
  }

  if (parameters.boardUri) {
    document.getElementById('fieldBoard').setAttribute('value',
        parameters.boardUri);
  }
}

function setLogEntry(logCell, log) {

  if (!log.global) {
    common.removeElement(logCell.getElementsByClassName('indicatorGlobal')[0]);
  }

  var labelType = logCell.getElementsByClassName('labelType')[0];
  labelType.innerHTML = availableLogTypes[log.type];

  var labelTime = logCell.getElementsByClassName('labelTime')[0];
  labelTime.innerHTML = common.formatDateToDisplay(log.time);

  var labelBoard = logCell.getElementsByClassName('labelBoard')[0];
  labelBoard.innerHTML = log.boardUri || '';

  var labelUser = logCell.getElementsByClassName('labelUser')[0];
  labelUser.innerHTML = log.user;

  var labelDescription = logCell.getElementsByClassName('labelDescription')[0];
  labelDescription.innerHTML = log.description;

}

function setLogPages(document, parameters, pageCount) {

  var pagesDiv = document.getElementById('divPages');

  for (var i = 1; i <= pageCount; i++) {

    var pageLink = document.createElement('a');

    pageLink.innerHTML = i;

    var url = '/logs.js?page=' + i;

    if (parameters.excludeGlobals) {
      url += '&excludeGlobals=on';
    }

    if (parameters.type && parameters.type.length) {
      url += '&type=' + parameters.type;
    }

    for (var j = 0; j < optionalStringLogParameters.length; j++) {

      var parameter = optionalStringLogParameters[j];

      if (parameters[parameter]) {
        url += '&' + parameter + '=' + parameters[parameter];
      }

    }

    pageLink.href = url;

    pagesDiv.appendChild(pageLink);

  }

}

exports.logs = function(logs, pageCount, parameters) {
  try {

    var document = jsdom(templateHandler.logsPage);

    document.title = lang.titLogs;

    fillSearchForm(parameters, document);

    fillComboBox(document, parameters);

    var divLogs = document.getElementById('divLogs');

    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];

      var logCell = document.createElement('div');
      logCell.setAttribute('class', 'logCell');
      logCell.innerHTML = templateHandler.logCell;

      setLogEntry(logCell, log);

      divLogs.appendChild(logCell);
    }

    setLogPages(document, parameters, pageCount);

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
// } Section 6: Logs

exports.message = function(message, link) {

  try {

    var document = jsdom(templateHandler.messagePage);

    document.title = message;

    var messageLabel = document.getElementById('labelMessage');

    messageLabel.innerHTML = message;

    var redirectLink = document.getElementById('linkRedirect');

    redirectLink.href = link;

    var meta = document.createElement('META');

    meta.httpEquiv = 'refresh';
    meta.content = '3; url=' + link;

    document.getElementsByTagName('head')[0].appendChild(meta);

    return serializer(document);
  } catch (error) {
    if (verbose) {
      console.log('error ' + error);
    }

    if (debug) {
      throw error;
    }

    return error.toString;
  }

};

// Section 7: Filter management {

function setFilterCell(cell, boardUri, filter) {

  var labelOriginal = cell.getElementsByClassName('labelOriginal')[0];
  labelOriginal.innerHTML = filter.originalTerm;

  var labelReplacement = cell.getElementsByClassName('labelReplacement')[0];
  labelReplacement.innerHTML = filter.replacementTerm;

  var filterIdentifier = cell.getElementsByClassName('filterIdentifier')[0];
  filterIdentifier.setAttribute('value', filter.originalTerm);

  var boardIdentifier = cell.getElementsByClassName('boardIdentifier')[0];
  boardIdentifier.setAttribute('value', boardUri);
}

exports.filterManagement = function(boardUri, filters) {

  try {

    var document = jsdom(templateHandler.filterManagement);

    document.title = lang.titFilters.replace('{$board}', boardUri);

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    var filtersDiv = document.getElementById('divFilters');

    for (var i = 0; i < filters.length; i++) {

      var filter = filters[i];

      var filterCell = document.createElement('form');
      filterCell.innerHTML = templateHandler.filterCell;

      common.setFormCellBoilerPlate(filterCell, '/deleteFilter.js',
          'filterCell');

      setFilterCell(filterCell, boardUri, filter);

      filtersDiv.appendChild(filterCell);
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
// } Section 7: Filter management

exports.boardModeration = function(boardData, ownerData) {

  try {

    var document = jsdom(templateHandler.boardModerationPage);

    document.title = lang.titBoardModeration.replace('{$board}',
        boardData.boardUri);

    document.getElementById('boardTransferIdentifier').setAttribute('value',
        boardData.boardUri);

    document.getElementById('boardDeletionIdentifier').setAttribute('value',
        boardData.boardUri);

    document.getElementById('labelOwner').innerHTML = ownerData.login;

    var title = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    document.getElementById('labelTitle').innerHTML = title;

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

// Section 8: Board listing {
function setBoardCell(board, boardCell) {

  var linkContent = '/' + board.boardUri + '/ - ' + board.boardName;
  var boardLink = boardCell.getElementsByClassName('linkBoard')[0];
  boardLink.href = '/' + board.boardUri + '/';
  boardLink.innerHTML = linkContent;

  var labelPPH = boardCell.getElementsByClassName('labelPostsPerHour')[0];
  labelPPH.innerHTML = board.postsPerHour || 0;

  var labelCount = boardCell.getElementsByClassName('labelPostCount')[0];
  labelCount.innerHTML = board.lastPostId || 0;

  var labelDescription = boardCell.getElementsByClassName('divDescription')[0];
  labelDescription.innerHTML = board.boardDescription;

  var labelTags = boardCell.getElementsByClassName('labelTags')[0];

  if (board.tags) {
    labelTags.innerHTML = board.tags.join(', ');
  } else {
    common.removeElement(labelTags);
  }
}

function setPages(document, pageCount) {
  var pagesDiv = document.getElementById('divPages');

  for (var j = 1; j <= pageCount; j++) {

    var link = document.createElement('a');
    link.innerHTML = j;
    link.href = '/boards.js?page=' + j;

    pagesDiv.appendChild(link);
  }
}

exports.boards = function(boards, pageCount) {
  try {
    var document = jsdom(templateHandler.boardsPage);

    document.title = lang.titBoards;

    var divBoards = document.getElementById('divBoards');

    for (var i = 0; i < boards.length; i++) {
      var board = boards[i];

      var boardCell = document.createElement('div');
      boardCell.innerHTML = templateHandler.boardsCell;
      boardCell.setAttribute('class', 'boardsCell');

      setBoardCell(board, boardCell);

      divBoards.appendChild(boardCell);
    }

    setPages(document, pageCount);

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

// } Section 8: Board listing

exports.noCookieCaptcha = function(parameters, captchaId) {

  try {

    var document = jsdom(templateHandler.noCookieCaptchaPage);

    document.title = lang.titNoCookieCaptcha;

    if (!parameters.solvedCaptcha) {
      common.removeElement(document.getElementById('divSolvedCaptcha'));
    } else {
      var labelSolved = document.getElementById('labelCaptchaId');
      labelSolved.innerHTML = parameters.solvedCaptcha;
    }

    var captchaPath = '/captcha.js?captchaId=' + captchaId;
    document.getElementById('imageCaptcha').src = captchaPath;

    document.getElementById('inputCaptchaId').setAttribute('value', captchaId);

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

// Section 9: Range bans {
function setRangeBanCells(document, rangeBans) {

  var bansDiv = document.getElementById('rangeBansDiv');

  for (var i = 0; i < rangeBans.length; i++) {
    var rangeBan = rangeBans[i];

    var banCell = document.createElement('form');
    banCell.innerHTML = templateHandler.rangeBanCell;
    common.setFormCellBoilerPlate(banCell, '/liftBan.js', 'rangeBanCell');

    banCell.getElementsByClassName('rangeLabel')[0].innerHTML = rangeBan.range
        .join('.');
    banCell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        rangeBan._id);

    bansDiv.appendChild(banCell);

  }

}

exports.rangeBans = function(rangeBans, boardUri) {

  try {

    var document = jsdom(templateHandler.rangeBansPage);

    document.title = lang.titRangeBans;

    var boardIdentifier = document.getElementById('boardIdentifier');

    if (boardUri) {
      boardIdentifier.setAttribute('value', boardUri);
    } else {
      common.removeElement(boardIdentifier);
    }

    setRangeBanCells(document, rangeBans);

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
// } Section 9: Range bans

// Section 10: Hash bans {
function setHashBanCells(document, hashBans) {

  var bansDiv = document.getElementById('hashBansDiv');

  for (var i = 0; i < hashBans.length; i++) {
    var hashBan = hashBans[i];

    var banCell = document.createElement('form');
    banCell.innerHTML = templateHandler.hashBanCell;
    common.setFormCellBoilerPlate(banCell, '/liftHashBan.js', 'hashBanCell');

    banCell.getElementsByClassName('hashLabel')[0].innerHTML = hashBan.md5;
    banCell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        hashBan._id);

    bansDiv.appendChild(banCell);
  }

}

exports.hashBans = function(hashBans, boardUri) {

  try {

    var document = jsdom(templateHandler.hashBansPage);

    document.title = lang.titHashBans;

    var boardIdentifier = document.getElementById('boardIdentifier');

    if (boardUri) {
      boardIdentifier.setAttribute('value', boardUri);
    } else {
      common.removeElement(boardIdentifier);
    }

    setHashBanCells(document, hashBans);

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

// } Section 10: Hash bans

// Section 11: Rule management {
function setRuleManagementCells(document, boardUri, rules) {
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
}

exports.ruleManagement = function(boardUri, rules) {

  try {

    var document = jsdom(templateHandler.ruleManagementPage);

    document.title = lang.titRuleManagement;

    var boardIdentifier = document.getElementById('boardIdentifier');

    boardIdentifier.setAttribute('value', boardUri);

    setRuleManagementCells(document, boardUri, rules);

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
// } Section 11: Rule management

exports.edit = function(parameters, message) {
  try {

    var document = jsdom(templateHandler.editPage);

    document.title = lang.titEdit;

    document.getElementById('fieldMessage').defaultValue = message;

    document.getElementById('boardIdentifier').setAttribute('value',
        parameters.boardUri);

    if (parameters.threadId) {
      document.getElementById('threadIdentifier').setAttribute('value',
          parameters.threadId);

      common.removeElement(document.getElementById('postIdentifier'));

    } else {
      document.getElementById('postIdentifier').setAttribute('value',
          parameters.postId);
      common.removeElement(document.getElementById('threadIdentifier'));
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

// Section 12: Flag management {
function addFlagCells(document, flags, boardUri) {

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

}

exports.flagManagement = function(boardUri, flags, callback) {
  try {

    var document = jsdom(templateHandler.flagsPage);

    document.title = lang.titFlagManagement;

    document.getElementById('maxSizeLabel').innerHTML = displayMaxFlagSize;

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    addFlagCells(document, flags, boardUri);

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

// } Section 12: Flag management

exports.mainArchive = function(boards) {

  try {

    var document = jsdom(templateHandler.mainArchivePage);

    document.title = lang.titMainArchive;

    var boardsDiv = document.getElementById('boardsDiv');

    for (var i = 0; i < boards.length; i++) {

      var cell = document.createElement('div');

      cell.innerHTML = templateHandler.mainArchiveCell;

      var link = cell.getElementsByClassName('linkBoard')[0];

      var board = boards[i];

      link.href = '/' + board + '/';
      link.innerHTML = board;

      boardsDiv.appendChild(cell);
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

exports.boardArchive = function(boardUri, threads) {

  try {

    var document = jsdom(templateHandler.boardArchivePage);

    document.title = lang.titBoardArchive.replace('{$board}', boardUri);

    var threadsDiv = document.getElementById('threadsDiv');

    for (var i = 0; i < threads.length; i++) {

      var cell = document.createElement('div');

      cell.innerHTML = templateHandler.boardArchiveCell;

      var link = cell.getElementsByClassName('linkThread')[0];

      var thread = threads[i];

      link.href = '/' + boardUri + '/res/' + thread + '.html';
      link.innerHTML = thread;

      threadsDiv.appendChild(cell);
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

// Section 13: Global settings {
function setComboSetting(document, element, setting) {

  for (var i = 0; i < setting.options.length; i++) {

    var option = document.createElement('option');
    option.value = i;
    option.innerHTML = setting.options[i];

    if (i === settings[setting.setting]) {
      option.setAttribute('selected', 'selected');
    }

    element.appendChild(option);
  }
}

exports.globalSettings = function(settings) {

  try {

    var document = jsdom(templateHandler.globalSettingsPage);

    for ( var key in siteSettingsRelation) {

      var setting = siteSettingsRelation[key];

      var element = document.getElementById(key);

      switch (setting.type) {
      case 'string':
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
      case 'combo':
        setComboSetting(document, element, setting);
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
// } Section 13: Global settings

// This page COULD be static, since it doesn't need any manipulation.
// However, given how often it will be accessed and how it might require
// manipulation in the future, I will leave it as a dynamic page.
exports.archiveDeletion = function() {
  try {
    var document = jsdom(templateHandler.archiveDeletionPage);

    document.title = lang.titArchiveDeletion;

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