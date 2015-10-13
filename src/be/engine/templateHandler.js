'use strict';

// loads, tests and hands html templates

var debug = require('../boot').debug();
var settingsHandler = require('../settingsHandler');
var verbose = settingsHandler.getGeneralSettings().verbose;
var fs = require('fs');
var jsdom = require('jsdom').jsdom;

require('jsdom').defaultDocumentFeatures = {
  FetchExternalResources : false,
  ProcessExternalResources : false,
  // someone said it might break stuff. If weird bugs, disable.
  MutationEvents : false
};

exports.loadDependencies = function() {
};

exports.getCellTests = function() {

  return [
      {
        template : 'catalogCell',
        fields : [ 'linkThumb', 'labelReplies', 'labelImages', 'labelPage',
            'labelSubject', 'divMessage', 'lockIndicator', 'pinIndicator',
            'cyclicIndicator' ]
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
            'divBanMessage', 'spanId', 'panelIp', 'labelRange',
            'cyclicIndicator', 'linkQuote', 'divPosts', 'labelOmission',
            'linkPreview', 'linkEdit', 'labelLastEdit', 'imgFlag', 'labelIp',
            'labelProxyIp', 'panelProxyIp', 'contentOmissionIndicator',
            'linkFullText' ]
      },
      {
        template : 'postCell',
        fields : [ 'linkName', 'panelUploads', 'labelSubject', 'labelCreated',
            'divMessage', 'linkSelf', 'deletionCheckBox', 'labelId',
            'labelRole', 'divBanMessage', 'spanId', 'panelIp', 'labelRange',
            'linkQuote', 'linkPreview', 'linkEdit', 'labelLastEdit', 'imgFlag',
            'labelIp', 'labelProxyIp', 'panelProxyIp',
            'contentOmissionIndicator', 'linkFullText' ]
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
        fields : [ 'reasonLabel', 'link', 'idIdentifier' ]
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
            'filterIdentifier' ]
      },
      {
        template : 'boardsCell',
        fields : [ 'linkBoard', 'labelPostsPerHour', 'labelPostCount',
            'divDescription', 'labelTags' ]
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
      }, {
        template : 'ruleManagementCell',
        fields : [ 'indexIdentifier', 'boardIdentifier', 'textLabel' ]
      }, {
        template : 'ruleCell',
        fields : [ 'indexLabel', 'textLabel' ]
      }, {
        template : 'flagCell',
        fields : [ 'flagImg', 'nameLabel', 'idIdentifier' ]
      }, {
        template : 'mainArchiveCell',
        fields : [ 'linkBoard' ]
      }, {
        template : 'boardArchiveCell',
        fields : [ 'linkThread' ]
      }, {
        template : 'hashBanCellDisplay',
        fields : [ 'labelFile', 'labelBoard' ]
      }, {
        template : 'latestPostCell',
        fields : [ 'labelPreview', 'linkPost' ]
      }, {
        template : 'proxyBanCell',
        fields : [ 'ipLabel', 'idIdentifier' ]
      }, {
        template : 'logIndexCell',
        fields : [ 'dateLink' ]
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
        fields : [ 'divThreads', 'labelBoard' ]
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
        fields : [ 'divBoards', 'divLatestPosts' ]
      },
      {
        template : 'boardPage',
        fields : [ 'labelName', 'labelDescription', 'divThreads', 'divPages',
            'boardIdentifier', 'linkManagement', 'bannerImage', 'captchaDiv',
            'divName', 'linkModeration', 'labelMaxFileSize', 'linkPrevious',
            'linkNext', 'flagsDiv', 'flagCombobox', 'panelMessage',
            'divMessage' ]
      },
      {
        template : 'threadPage',
        fields : [ 'labelName', 'labelDescription', 'divThreads',
            'boardIdentifier', 'linkManagement', 'threadIdentifier', 'linkMod',
            'inputBan', 'divBanInput', 'divControls', 'controlBoardIdentifier',
            'controlThreadIdentifier', 'checkboxLock', 'checkboxPin',
            'bannerImage', 'captchaDiv', 'divName', 'labelMaxFileSize',
            'checkboxCyclic', 'flagsDiv', 'flagCombobox', 'panelMessage',
            'divMessage', 'formTransfer', 'transferBoardIdentifier',
            'transferThreadIdentifier', 'inputSpoil', 'ipDeletionForm' ]
      },
      {
        template : 'messagePage',
        fields : [ 'labelMessage', 'linkRedirect' ]
      },
      {
        template : 'accountPage',
        fields : [ 'labelLogin', 'boardsDiv', 'emailField',
            'globalManagementLink', 'boardCreationDiv', 'checkboxAlwaysSign',
            'checkboxLock' ]
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
            'globalSettingsLink', 'archiveDeletionLink', 'globalBannersLink',
            'proxyBansLink', 'appealedBansPanel' ]
      },
      {
        template : 'bManagement',
        fields : [ 'volunteersDiv', 'ownerControlDiv', 'bansLink',
            'forceAnonymityCheckbox', 'customSpoilerIdentifier',
            'addVolunteerBoardIdentifier', 'transferBoardIdentifier',
            'deletionIdentifier', 'reportDiv', 'closedReportsLink',
            'bannerManagementLink', 'boardNameField', 'boardDescriptionField',
            'boardMessageField', 'boardSettingsIdentifier', 'unindexCheckbox',
            'disableIdsCheckbox', 'rangeBansLink', 'disableCaptchaCheckbox',
            'filterManagementLink', 'anonymousNameField', 'boardLabel',
            'customCssIdentifier', 'ruleManagementLink', 'allowCodeCheckbox',
            'flagManagementLink', 'enableArchiveCheckbox', 'early404Checkbox',
            'hourlyThreadLimitField', 'autoCaptchaThresholdField',
            'hashBansLink', 'customSpoilerIndicator', 'tagsField',
            'customJsForm', 'customJsIdentifier', 'blockDeletionCheckbox',
            'requireFileCheckbox', 'proxyBansLink', 'appealedBansPanel',
            'linkSelf' ]
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
        fields : [ 'divFilters', 'boardIdentifier' ]
      },
      {
        template : 'boardModerationPage',
        fields : [ 'boardTransferIdentifier', 'boardDeletionIdentifier',
            'labelTitle', 'labelOwner', 'labelLastSeen' ]
      },
      {
        template : 'boardsPage',
        fields : [ 'divBoards', 'divPages', 'linkOverboard' ]
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
            'postIdentifier' ]
      },
      {
        template : 'flagsPage',
        fields : [ 'flagsDiv', 'boardIdentifier', 'maxSizeLabel' ]
      },
      {
        template : 'mainArchivePage',
        fields : [ 'boardsDiv' ]
      },
      {
        template : 'boardArchivePage',
        fields : [ 'threadsDiv' ]
      },
      {
        template : 'globalSettingsPage',
        fields : [ 'fieldAddress', 'fieldPort', 'fieldFePath', 'fieldPageSize',
            'fieldLatestPostsCount', 'fieldAutoSageLimit', 'fieldThreadLimit',
            'fieldTempDir', 'fieldSenderEmail', 'fieldCaptchaExpiration',
            'fieldSiteTitle', 'fieldMaxRequestSize', 'fieldMaxFileSize',
            'fieldAcceptedMimes', 'fieldMaxFiles', 'fieldBanMessage',
            'fieldAnonymousName', 'fieldTopBoardsCount', 'fieldBoardsPerPage',
            'fieldTorSource', 'fieldLanguagePack', 'fieldMaxRules',
            'fieldThumbSize', 'fieldMaxFilters', 'fieldMaxVolunteers',
            'fieldMaxBannerSize', 'fieldMaxFlagSize', 'fieldFloodInterval',
            'checkboxVerbose', 'checkboxDisable304', 'checkboxSsl',
            'comboTorAccess', 'checkboxMediaThumb', 'checkboxMaintenance',
            'comboArchive', 'checkboxMultipleReports',
            'checkboxDisableAccountCreation', 'comboBoardCreationRequirement',
            'checkboxServeArchive', 'fieldMaxTags',
            'checkboxDisableFloodCheck', 'comboProxyAccess',
            'comboMinClearIpRole', 'fieldThumbExtension',
            'checkboxGlobalBoardModeration', 'checkboxGlobalBanners',
            'checkboxAllowCustomJs', 'fieldGlobalLatestPosts',
            'checkboxGlobalCaptcha', 'fieldTcpPort', 'fieldOverboard',
            'comboBypassMode', 'fieldBypassHours', 'fieldBypassPosts',
            'fieldMultiBoardThreadCount', 'fieldConcurrentRebuildMessages' ]
      }, {
        template : 'archiveDeletionPage',
        fields : []
      }, {
        template : 'hashBanPage',
        fields : [ 'hashBansPanel' ]
      }, {
        template : 'overboard',
        fields : [ 'bannerImage', 'divThreads' ]
      }, {
        template : 'proxyBansPage',
        fields : [ 'proxyBansDiv', 'boardIdentifier' ]
      }, {
        template : 'proxyBanPage',
        fields : [ 'boardLabel' ]
      }, {
        template : 'bypassPage',
        fields : [ 'indicatorValidBypass' ]
      }, {
        template : 'logIndexPage',
        fields : [ 'divDates' ]
      }, {
        template : 'unlockEmail',
        fields : [ 'unlockLink' ]
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

exports.loadPages = function(errors, templatesPath, templateSettings, pages) {

  for (var i = 0; i < pages.length; i++) {

    var page = pages[i];

    var fullPath = templatesPath + templateSettings[page.template];

    try {
      var template = fs.readFileSync(fullPath);
    } catch (error) {
      console.log('Error loading ' + page.template + '.');
      throw error;
    }

    exports[page.template] = template;

    var document = jsdom(template);

    var error = exports.testPageFields(document, page, errors);

    if (error.length) {

      errors.push('\nPage ' + page.template + error);
    }
  }
};

exports.getTestCell = function(document, name, fePath, templateSettings) {

  var toReturn = document.createElement('div');

  var fullPath = fePath + templateSettings[name];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (error) {
    console.log('Error loading ' + name + '.');
    throw error;
  }

  exports[name] = template;

  toReturn.innerHTML = template;

  return toReturn;
};

exports.testCell = function(document, templatesPath, templateSettings, cell) {
  var error = '';

  var cellElement = exports.getTestCell(document, cell.template, templatesPath,
      templateSettings);

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

exports.loadCells = function(errors, templatesPath, templateSettings, cells) {

  var document = jsdom('<html></html>');

  for (var i = 0; i < cells.length; i++) {

    var cell = cells[i];

    var errorFound = false;

    var error = exports.testCell(document, templatesPath, templateSettings,
        cell);

    if (error.length) {
      errors.push('\nCell ' + cell.template + error);
    }
  }
};

exports.loadAndTestTemplates = function(path, templateSettings) {

  var cellTests = exports.getCellTests();

  var pageTests = exports.getPageTests();

  var errors = [];

  exports.loadCells(errors, path, templateSettings, cellTests);

  exports.loadPages(errors, path, templateSettings, pageTests);

  if (errors.length) {

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

  }
};

exports.loadTemplates = function() {

  var fePath = settingsHandler.getFePath() + '/templates/';
  var templateSettings = settingsHandler.getTemplateSettings();

  exports.loadAndTestTemplates(fePath, templateSettings);
};