'use strict';

var boot = require('../boot');
var debug = boot.debug();
var settings = boot.getGeneralSettings();
var verbose = settings.verbose;
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

function testPageFields(document, page, errors) {

  var error = '';

  for (var j = 0; j < page.fields.length; j++) {

    var field = page.fields[j];

    if (!document.getElementById(field)) {
      error += '\nError, missing element with id ' + field;
    }

  }

  return error;
}

function loadPages(errors, templatesPath, templateSettings, pages) {

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

    var error = testPageFields(document, page, errors);

    if (error.length) {

      errors.push('\nPage ' + page.template + error);
    }
  }
}

function getTestCell(document, templateName, fePath, templateSettings) {

  var toReturn = document.createElement('div');

  var fullPath = fePath + templateSettings[templateName];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (error) {
    console.log('Error loading ' + templateName + '.');
    throw error;
  }

  exports[templateName] = template;

  toReturn.innerHTML = template;

  return toReturn;
}

function testCell(document, templatesPath, templateSettings, cell) {
  var error = '';

  var cellElement = getTestCell(document, cell.template, templatesPath,
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
}

function loadCells(errors, templatesPath, templateSettings, cells) {

  var document = jsdom('<html></html>');

  for (var i = 0; i < cells.length; i++) {

    var cell = cells[i];

    var errorFound = false;

    var error = testCell(document, templatesPath, templateSettings, cell);

    if (error.length) {
      errors.push('\nCell ' + cell.template + error);
    }

  }

}

function loadAndTestTemplates(path, templateSettings) {

  var cellTests = [
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
            'linkPreview', 'linkEdit', 'labelLastEdit', 'imgFlag', 'labelIp' ]
      },
      {
        template : 'postCell',
        fields : [ 'linkName', 'panelUploads', 'labelSubject', 'labelCreated',
            'divMessage', 'linkSelf', 'deletionCheckBox', 'labelId',
            'labelRole', 'divBanMessage', 'spanId', 'panelIp', 'labelRange',
            'linkQuote', 'linkPreview', 'linkEdit', 'labelLastEdit', 'imgFlag',
            'labelIp' ]
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
            'idLabel' ]
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
      } ];

  var pageTests = [
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
        fields : [ 'divBoards' ]
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
            'divMessage' ]
      },
      {
        template : 'messagePage',
        fields : [ 'labelMessage', 'linkRedirect' ]
      },
      {
        template : 'accountPage',
        fields : [ 'labelLogin', 'boardsDiv', 'emailField',
            'globalManagementLink', 'boardCreationDiv', 'checkboxAlwaysSign' ]
      },
      {
        template : 'banPage',
        fields : [ 'boardLabel', 'reasonLabel', 'expirationLabel', 'idLabel' ]
      },
      {
        template : 'gManagement',
        fields : [ 'divStaff', 'userLabel', 'addStaffForm', 'newStaffCombo',
            'reportDiv', 'bansLink', 'rangeBansLink', 'hashBansLink',
            'globalSettingsLink', 'archiveDeletionLink', 'ipDeletionForm' ]
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
            'hashBansLink', 'customSpoilerIndicator', 'tagsField' ]
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
        fields : [ 'divLogs', 'divPages', 'checkboxExcludeGlobals',
            'fieldBoard', 'comboboxType', 'fieldBefore', 'fieldAfter',
            'fieldUser' ]
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
            'labelTitle', 'labelOwner' ]
      },
      {
        template : 'boardsPage',
        fields : [ 'divBoards', 'divPages' ]
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
            'fieldCaptchaFonts', 'fieldSiteTitle', 'fieldMaxRequestSize',
            'fieldMaxFileSize', 'fieldAcceptedMimes', 'fieldMaxFiles',
            'fieldBanMessage', 'fieldLogPageSize', 'fieldAnonymousName',
            'fieldTopBoardsCount', 'fieldBoardsPerPage', 'fieldTorSource',
            'fieldLanguagePack', 'fieldMaxRules', 'fieldThumbSize',
            'fieldMaxFilters', 'fieldMaxVolunteers', 'fieldMaxBannerSize',
            'fieldMaxFlagSize', 'fieldFloodInterval', 'checkboxVerbose',
            'checkboxDisable304', 'checkboxSsl', 'comboTorAccess',
            'checkboxMediaThumb', 'checkboxMaintenance', 'comboArchive',
            'checkboxMultipleReports', 'checkboxDisableAccountCreation',
            'comboBoardCreationRequirement', 'checkboxServeArchive',
            'fieldMaxTags', 'checkboxDisableFloodCheck', 'comboProxyAccess',
            'comboMinClearIpRole', 'fieldThumbExtension',
            'checkboxDisableTopBoards', 'checkboxGlobalBoardModeration' ]
      }, {
        template : 'archiveDeletionPage',
        fields : []
      } ];

  var errors = [];

  loadCells(errors, path, templateSettings, cellTests);

  loadPages(errors, path, templateSettings, pageTests);

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
}

exports.loadTemplates = function() {

  var fePath = boot.getFePath() + '/templates/';
  var templateSettings = boot.getTemplateSettings();

  loadAndTestTemplates(fePath, templateSettings);
};