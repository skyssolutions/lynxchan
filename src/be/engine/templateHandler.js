'use strict';

// loads, tests and hands html templates

var debug = require('../kernel').debug();
var settingsHandler = require('../settingsHandler');
var verbose;
var fs = require('fs');
var jsdom = require('jsdom').jsdom;
var defaultTemplates = {};
var alternativeTemplates = {};

require('jsdom').defaultDocumentFeatures = {
  FetchExternalResources : false,
  ProcessExternalResources : false,
  // someone said it might break stuff. If weird bugs, disable.
  MutationEvents : false
};

exports.getTemplates = function(language) {

  if (language) {
    var toReturn = alternativeTemplates[language._id];

    if (!toReturn) {
      exports.loadTemplates(language);

      toReturn = alternativeTemplates[language._id];
    }

    return toReturn || defaultTemplates;

  } else {
    return defaultTemplates;
  }

};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose;

};

exports.getCellTests = function() {

  return [
      {
        template : 'latestImageCell',
        fields : [ 'linkPost' ]
      },
      {
        template : 'topBoardCell',
        fields : [ 'boardLink' ]
      },
      {
        template : 'catalogCell',
        fields : [ 'linkThumb', 'labelReplies', 'labelImages', 'labelPage',
            'labelSubject', 'divMessage', 'lockIndicator', 'pinIndicator',
            'cyclicIndicator', 'bumpLockIndicator' ]
      },
      {
        template : 'bannerCell',
        fields : [ 'bannerImage', 'bannerIdentifier' ]
      },
      {
        template : 'opCell',
        fields : [ 'linkName', 'panelUploads', 'labelSubject', 'labelCreated',
            'divMessage', 'linkReply', 'linkSelf', 'deletionCheckBox',
            'lockIndicator', 'pinIndicator', 'labelId', 'labelRole',
            'divBanMessage', 'spanId', 'panelIp', 'labelBroadRange',
            'panelRange', 'cyclicIndicator', 'linkQuote', 'divPosts',
            'labelOmission', 'linkPreview', 'linkEdit', 'labelLastEdit',
            'imgFlag', 'labelIp', 'contentOmissionIndicator', 'linkFullText',
            'bumpLockIndicator', 'labelNarrowRange' ]
      },
      {
        template : 'postCell',
        fields : [ 'linkName', 'panelUploads', 'labelSubject', 'labelCreated',
            'divMessage', 'linkSelf', 'deletionCheckBox', 'labelId',
            'panelRange', 'labelRole', 'divBanMessage', 'spanId', 'panelIp',
            'labelBroadRange', 'linkQuote', 'linkPreview', 'linkEdit',
            'labelLastEdit', 'imgFlag', 'labelIp', 'contentOmissionIndicator',
            'linkFullText', 'labelNarrowRange' ]
      },
      {
        template : 'staffCell',
        fields : [ 'userIdentifier', 'userLabel', 'roleCombo' ]
      },
      {
        template : 'volunteerCell',
        fields : [ 'boardIdentifier', 'userIdentifier', 'userLabel' ]
      },
      {
        template : 'reportCell',
        fields : [ 'reasonLabel', 'link', 'closureCheckbox', 'postingDiv' ]
      },
      {
        template : 'closedReportCell',
        fields : [ 'reasonLabel', 'link', 'closedByLabel', 'closedDateLabel' ]
      },
      {
        template : 'banCell',
        fields : [ 'reasonLabel', 'expirationLabel', 'appliedByLabel',
            'idLabel', 'appealLabel', 'appealPanel', 'liftIdentifier',
            'denyIdentifier', 'denyForm' ]
      },
      {
        template : 'logCell',
        fields : [ 'indicatorGlobal', 'labelUser', 'labelTime',
            'labelDescription', 'labelBoard', 'labelType' ]
      },
      {
        template : 'filterCell',
        fields : [ 'labelOriginal', 'labelReplacement', 'boardIdentifier',
            'filterIdentifier', 'labelCaseInsensitive' ]
      },
      {
        template : 'boardsCell',
        fields : [ 'linkBoard', 'labelPostsPerHour', 'labelPostCount',
            'divDescription', 'labelTags', 'labelUniqueIps', 'indicatorSfw',
            'indicatorInactive' ]
      },
      {
        template : 'rangeBanCell',
        fields : [ 'rangeLabel', 'idIdentifier' ]
      },
      {
        template : 'hashBanCell',
        fields : [ 'hashLabel', 'idIdentifier' ]
      },
      {
        template : 'uploadCell',
        fields : [ 'sizeLabel', 'imgLink', 'nameLink', 'divHash', 'labelHash',
            'originalNameLink', 'dimensionLabel' ]
      },
      {
        template : 'ruleManagementCell',
        fields : [ 'indexIdentifier', 'boardIdentifier', 'textLabel' ]
      },
      {
        template : 'ruleCell',
        fields : [ 'indexLabel', 'textLabel' ]
      },
      {
        template : 'flagCell',
        fields : [ 'flagImg', 'nameLabel', 'idIdentifier' ]
      },
      {
        template : 'hashBanCellDisplay',
        fields : [ 'labelFile', 'labelBoard' ]
      },
      {
        template : 'latestPostCell',
        fields : [ 'labelPreview', 'linkPost' ]
      },
      {
        template : 'logIndexCell',
        fields : [ 'dateLink' ]
      },
      {
        template : 'graphIndexCell',
        fields : [ 'dateLink' ]
      },
      {
        template : 'mediaCell',
        fields : [ 'identifierCheckbox', 'thumbImg', 'fileLink',
            'referencesLabel' ]
      },
      {
        template : 'languageCell',
        fields : [ 'languageIdentifier', 'frontEndLabel', 'languagePackLabel',
            'headerValuesLabel' ]
      } ];

};

exports.getPageTests = function() {

  return [
      {
        template : 'loginPage',
        fields : [ 'divCreation' ]
      },
      {
        template : 'catalogPage',
        fields : [ 'divThreads', 'labelBoard', 'flagsDiv', 'divUpload',
            'labelMessageLength', 'labelMaxFiles', 'labelMaxFileSize',
            'captchaDiv', 'boardIdentifier', 'flagCombobox', 'postingForm' ]
      },
      {
        template : 'resetEmail',
        fields : [ 'labelNewPass' ]
      },
      {
        template : 'bannerManagementPage',
        fields : [ 'bannersDiv', 'boardIdentifier', 'maxSizeLabel' ]
      },
      {
        template : 'errorPage',
        fields : [ 'codeLabel', 'errorLabel' ]
      },
      {
        template : 'recoveryEmail',
        fields : [ 'linkRecovery' ]
      },
      {
        template : 'index',
        fields : [ 'divBoards', 'divLatestPosts', 'divLatestImages',
            'linkEngine', 'divStats', 'labelTotalPosts', 'labelTotalIps',
            'labelTotalBoards', 'labelTotalPPH', 'labelTotalFiles',
            'labelTotalSize' ]
      },
      {
        template : 'boardPage',
        fields : [ 'labelName', 'labelDescription', 'divThreads', 'divPages',
            'boardIdentifier', 'linkManagement', 'bannerImage', 'captchaDiv',
            'divName', 'linkModeration', 'labelMaxFileSize', 'linkPrevious',
            'linkNext', 'flagsDiv', 'flagCombobox', 'panelMessage',
            'divMessage', 'labelMaxFiles', 'labelMessageLength', 'divUpload' ]
      },
      {
        template : 'threadPage',
        fields : [ 'labelName', 'labelDescription', 'divThreads',
            'boardIdentifier', 'linkManagement', 'threadIdentifier', 'linkMod',
            'divMod', 'divControls', 'controlBoardIdentifier', 'divUpload',
            'controlThreadIdentifier', 'checkboxLock', 'checkboxPin',
            'bannerImage', 'captchaDiv', 'divName', 'labelMaxFileSize',
            'checkboxCyclic', 'flagsDiv', 'flagCombobox', 'panelMessage',
            'divMessage', 'formTransfer', 'transferBoardIdentifier',
            'transferThreadIdentifier', 'ipDeletionForm', 'labelMaxFiles',
            'labelMessageLength' ]
      },
      {
        template : 'messagePage',
        fields : [ 'labelMessage', 'linkRedirect' ]
      },
      {
        template : 'accountPage',
        fields : [ 'labelLogin', 'ownedDiv', 'emailField', 'volunteeredDiv',
            'globalManagementLink', 'boardCreationDiv', 'checkboxAlwaysSign' ]
      },
      {
        template : 'banPage',
        fields : [ 'boardLabel', 'reasonLabel', 'expirationLabel', 'idLabel',
            'formAppeal', 'idIdentifier' ]
      },
      {
        template : 'gManagement',
        fields : [ 'divStaff', 'userLabel', 'addStaffForm', 'newStaffCombo',
            'reportDiv', 'bansLink', 'rangeBansLink', 'hashBansLink',
            'globalSettingsLink', 'globalBannersLink', 'appealedBansPanel',
            'languagesLink' ]
      },
      {
        template : 'bManagement',
        fields : [ 'volunteersDiv', 'ownerControlDiv', 'bansLink',
            'forceAnonymityCheckbox', 'customSpoilerIdentifier',
            'addVolunteerBoardIdentifier', 'transferBoardIdentifier',
            'deletionIdentifier', 'reportDiv', 'closedReportsLink',
            'bannerManagementLink', 'boardNameField', 'boardDescriptionField',
            'boardMessageField', 'boardSettingsIdentifier', 'unindexCheckbox',
            'disableIdsCheckbox', 'rangeBansLink', 'captchaModeComboBox',
            'filterManagementLink', 'anonymousNameField', 'boardLabel',
            'customCssIdentifier', 'ruleManagementLink', 'allowCodeCheckbox',
            'flagManagementLink', 'early404Checkbox', 'hourlyThreadLimitField',
            'autoCaptchaThresholdField', 'hashBansLink', 'textBoardCheckbox',
            'customSpoilerIndicator', 'tagsField', 'customJsForm',
            'customJsIdentifier', 'blockDeletionCheckbox',
            'requireFileCheckbox', 'appealedBansPanel', 'linkSelf',
            'uniqueFilesCheckbox', 'uniquePostsCheckbox', 'locationCheckBox',
            'maxFilesField', 'maxFileSizeField', 'maxThreadFields',
            'autoSageLimitField', 'validMimesField', 'maxBumpAgeField' ]
      },
      {
        template : 'closedReportsPage',
        fields : [ 'reportDiv' ]
      },
      {
        template : 'bansPage',
        fields : [ 'bansDiv' ]
      },
      {
        template : 'logsPage',
        fields : [ 'divLogs' ]
      },
      {
        template : 'previewPage',
        fields : [ 'panelContent' ]
      },
      {
        template : 'filterManagement',
        fields : [ 'divFilters', 'boardIdentifier', 'checkboxCaseInsensitive' ]
      },
      {
        template : 'boardModerationPage',
        fields : [ 'boardTransferIdentifier', 'boardDeletionIdentifier',
            'labelTitle', 'labelOwner', 'labelLastSeen', 'checkboxSfw',
            'specialSettingsIdentifier' ]
      },
      {
        template : 'boardsPage',
        fields : [ 'divBoards', 'divPages', 'linkOverboard', 'linkSfwOver' ]
      },
      {
        template : 'noCookieCaptchaPage',
        fields : [ 'divSolvedCaptcha', 'labelCaptchaId', 'inputCaptchaId',
            'imageCaptcha' ]
      },
      {
        template : 'rangeBansPage',
        fields : [ 'rangeBansDiv', 'boardIdentifier' ]
      },
      {
        template : 'rangeBanPage',
        fields : [ 'boardLabel', 'rangeLabel' ]
      },
      {
        template : 'hashBansPage',
        fields : [ 'hashBansDiv', 'boardIdentifier' ]
      },
      {
        template : 'notFoundPage',
        fields : []
      },
      {
        template : 'ruleManagementPage',
        fields : [ 'divRules', 'boardIdentifier' ]
      },
      {
        template : 'rulesPage',
        fields : [ 'boardLabel', 'divRules' ]
      },
      {
        template : 'maintenancePage',
        fields : []
      },
      {
        template : 'editPage',
        fields : [ 'fieldMessage', 'boardIdentifier', 'threadIdentifier',
            'postIdentifier', 'labelMessageLength' ]
      },
      {
        template : 'flagsPage',
        fields : [ 'flagsDiv', 'boardIdentifier', 'maxSizeLabel' ]
      },
      {
        template : 'globalSettingsPage',
        fields : [ 'fieldAddress', 'fieldPort', 'fieldFePath', 'fieldPageSize',
            'fieldLatestPostsCount', 'fieldAutoSageLimit', 'fieldThreadLimit',
            'fieldTempDir', 'fieldSenderEmail', 'fieldCaptchaExpiration',
            'fieldSiteTitle', 'fieldMaxRequestSize', 'fieldMaxFileSize',
            'fieldAcceptedMimes', 'fieldMaxFiles', 'fieldBanMessage',
            'fieldAnonymousName', 'fieldTopBoardsCount', 'fieldBoardsPerPage',
            'fieldTorSource', 'fieldLanguagePack', 'fieldMaxRules', 'fieldCSP',
            'fieldThumbSize', 'fieldMaxFilters', 'fieldMaxVolunteers',
            'fieldMaxBannerSize', 'fieldMaxFlagSize', 'fieldFloodInterval',
            'checkboxVerbose', 'checkboxDisable304', 'comboMinClearIpRole',
            'checkboxMediaThumb', 'checkboxMaintenance',
            'checkboxMultipleReports', 'fieldMaster', 'checkboxAutoPruneFiles',
            'checkboxDisableAccountCreation', 'comboBoardCreationRequirement',
            'fieldMaxTags', 'fieldGlobalLatestImages', 'fieldTorPort',
            'checkboxDisableFloodCheck', 'checkboxSsl', 'fieldSfwOverboard',
            'fieldThumbExtension', 'fieldSslPass', 'checkboxFrontPageStats',
            'checkboxGlobalBoardModeration', 'checkboxGlobalBanners',
            'checkboxAllowCustomJs', 'fieldGlobalLatestPosts', 'fieldSlaves',
            'checkboxGlobalCaptcha', 'fieldRssDomain', 'fieldOverboard',
            'comboBypassMode', 'fieldBypassHours', 'fieldBypassPosts',
            'fieldMultiBoardThreadCount', 'fieldConcurrentRebuildMessages',
            'checkboxSFWLatestImages', 'fieldInactivityThreshold',
            'fieldMediaPageSize', 'fieldMessageLength', 'checkboxFfmpegGifs',
            'fieldSpamIpsSource', 'checkboxSpamBypass', 'fieldIpExpiration',
            'checkboxDisableSpamCheck', 'checkboxDisableCatalogPosting',
            'checkboxAllowTorPosting', 'checkboxAllowTorFiles',
            'checkboxUseAlternativeLanguages' ]
      }, {
        template : 'hashBanPage',
        fields : [ 'hashBansPanel' ]
      }, {
        template : 'overboard',
        fields : [ 'divThreads' ]
      }, {
        template : 'bypassPage',
        fields : [ 'indicatorValidBypass' ]
      }, {
        template : 'logIndexPage',
        fields : [ 'divDates' ]
      }, {
        template : 'graphsIndexPage',
        fields : [ 'divDates' ]
      }, {
        template : 'mediaManagementPage',
        fields : [ 'filesDiv', 'pagesDiv' ]
      }, {
        template : 'languagesManagementPage',
        fields : [ 'languagesDiv' ]
      } ];

};

exports.testPageFields = function(document, page, errors) {

  var error = '';

  for (var j = 0; j < page.fields.length; j++) {

    var field = page.fields[j];

    if (!document.getElementById(field)) {
      error += '\nError, missing element with id ' + field;
    }

  }

  return error;
};

exports.processPage = function(errors, page, fePath, templateSettings,
    templateObject) {

  var fullPath = fePath + '/templates/';
  fullPath += templateSettings[page.template];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (error) {
    errors.push('\nError loading ' + page.template + '.');
    errors.push('\n' + error);

    return;
  }

  templateObject[page.template] = template;

  var document = jsdom(template);

  var error = exports.testPageFields(document, page, errors);

  if (error.length) {

    errors.push('\nPage ' + page.template + error);
  }

};

exports.loadPages = function(errors, fePath, templateSettings, templateObject) {

  var pages = exports.getPageTests();

  for (var i = 0; i < pages.length; i++) {

    var page = pages[i];

    if (!templateSettings[page.template]) {
      errors.push('\nTemplate ' + page.template + ' is not defined.');

      continue;
    }

    exports.processPage(errors, page, fePath, templateSettings, templateObject);

  }
};

exports.testCell = function(document, cell, fePath, templateSettings,
    templateObject) {
  var error = '';

  var cellElement = document.createElement('div');

  var fullPath = fePath + '/templates/' + templateSettings[cell.template];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (thrownError) {
    error += '\nError loading ' + cell.template + '.\n' + thrownError;
    return error;
  }

  templateObject[cell.template] = template;

  cellElement.innerHTML = template;

  for (var j = 0; j < cell.fields.length; j++) {

    var field = cell.fields[j];

    if (!cellElement.getElementsByClassName(field).length) {
      error += '\nError, missing element with class ' + field;
    } else if (cellElement.getElementsByClassName(field).length > 1) {
      error += '\nWarning, more than one element with class ' + field;
    }

  }

  return error;
};

exports.loadCells = function(errors, fePath, templateSettings, templateObject) {

  var document = jsdom('<html></html>');

  var cells = exports.getCellTests();

  for (var i = 0; i < cells.length; i++) {

    var cell = cells[i];

    if (!templateSettings[cell.template]) {
      errors.push('\nTemplate ' + cell.template + ' is not defined.');

      continue;
    }

    var error = exports.testCell(document, cell, fePath, templateSettings,
        templateObject);

    if (error.length) {
      errors.push('\nCell ' + cell.template + error);
    }
  }
};

exports.handleLoadingErrors = function(errors) {

  if (!errors.length) {
    return;
  }

  console.log('Were found issues with templates.');

  if (verbose) {

    for (var i = 0; i < errors.length; i++) {

      var error = errors[i];

      console.log(error);

    }
  } else {
    console.log('Enable verbose mode to output them.');
  }

  if (debug) {
    throw 'Fix the issues on the templates or run without debug mode';
  }

};

exports.loadTemplates = function(language) {

  var errors = [];

  if (!language) {
    var fePath = settingsHandler.getGeneralSettings().fePath;
    var templateSettings = settingsHandler.getTemplateSettings();
    var templateObject = defaultTemplates;
  } else {

    if (verbose) {
      console.log('Loading alternative front-end: ' + language.headerValues);
    }

    fePath = language.frontEnd;
    templateObject = {};
    alternativeTemplates[language._id] = templateObject;

    var finalPath = fePath + '/templateSettings.json';
    templateSettings = JSON.parse(fs.readFileSync(finalPath));

  }

  exports.loadCells(errors, fePath, templateSettings, templateObject);
  exports.loadPages(errors, fePath, templateSettings, templateObject);

  exports.handleLoadingErrors(errors);

};

exports.dropAlternativeTemplates = function() {
  alternativeTemplates = {};
};