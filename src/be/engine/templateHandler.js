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

// templates
var frontPageTemplate;
var threadTemplate;
var boardTemplate;
var notFoundTemplate;
var messageTemplate;
var loginTemplate;
var opTemplate;
var postTemplate;
var recoveryEmailTemplate;
var resetEmailTemplate;
var accountTemplate;
var gManagementTemplate;
var staffCellTemplate;
var bManagementTemplate;
var volunteerCellTemplate;
var reportCellTemplate;
var closedReportCellTemplate;
var closedReportsPageTemplate;
var bansPageTemplate;
var banCellTemplate;
var uploadCellTemplate;
var errorTemplate;
var banPageTemplate;
var bannerManagementTemplate;
var bannerCellTemplate;
var catalogPageTemplate;
var catalogCellTemplate;
var logsPageTemplate;
var logCellTemplate;
var previewPageTemplate;
var filterMagementPage;
var filterCellTemplate;
var boardModerationTemplate;
var boardsTemplate;
var boardsCellTemplate;
var noCookieCaptcha;
var rangeBansTemplate;
var rangeBanCellTemplate;
var rangeBanPageTemplate;
var hashBansTemplate;
var hashBanCellTemplate;

function loadEmailTemplates(fePath, templateSettings) {

  var recoveryEmailPath = fePath + templateSettings.recoveryEmail;
  recoveryEmailTemplate = fs.readFileSync(recoveryEmailPath);
  resetEmailTemplate = fs.readFileSync(fePath + templateSettings.resetEmail);

}

function loadLongPathCellTemplates(fePath, templateSettings) {
  var closedReportPath = fePath + templateSettings.closedReportCell;
  closedReportCellTemplate = fs.readFileSync(closedReportPath);

  var volunteerPath = fePath + templateSettings.volunteerCell;
  volunteerCellTemplate = fs.readFileSync(volunteerPath);

  var rangeBanPath = fePath + templateSettings.rangeBanCell;
  rangeBanCellTemplate = fs.readFileSync(rangeBanPath);

}

function loadCellTemplates(fePath, templateSettings) {
  opTemplate = fs.readFileSync(fePath + templateSettings.opCell);
  staffCellTemplate = fs.readFileSync(fePath + templateSettings.staffCell);
  postTemplate = fs.readFileSync(fePath + templateSettings.postCell);
  reportCellTemplate = fs.readFileSync(fePath + templateSettings.reportCell);
  uploadCellTemplate = fs.readFileSync(fePath + templateSettings.uploadCell);
  banCellTemplate = fs.readFileSync(fePath + templateSettings.banCell);
  bannerCellTemplate = fs.readFileSync(fePath + templateSettings.bannerCell);
  catalogCellTemplate = fs.readFileSync(fePath + templateSettings.catalogCell);
  logCellTemplate = fs.readFileSync(fePath + templateSettings.logCell);
  filterCellTemplate = fs.readFileSync(fePath + templateSettings.filterCell);
  boardsCellTemplate = fs.readFileSync(fePath + templateSettings.boardsCell);
  hashBanCellTemplate = fs.readFileSync(fePath + templateSettings.hashBanCell);

}

function loadLongPathDynamicTemplates(fePath, templateSettings) {
  var boardModerationPath = fePath + templateSettings.boardModerationPage;
  boardModerationTemplate = fs.readFileSync(boardModerationPath);

  var bannerManagementPath = fePath + templateSettings.bannerManagementPage;
  bannerManagementTemplate = fs.readFileSync(bannerManagementPath);

  var closedReportsPath = fePath + templateSettings.closedReportsPage;
  closedReportsPageTemplate = fs.readFileSync(closedReportsPath);

  var filterManagementPath = fePath + templateSettings.filterManagement;
  filterMagementPage = fs.readFileSync(filterManagementPath);

  var noCookieCaptchaPath = fePath + templateSettings.noCookieCaptchaPage;
  noCookieCaptcha = fs.readFileSync(noCookieCaptchaPath);

  var rangeBanPath = fePath + templateSettings.rangeBanPage;
  rangeBanPageTemplate = fs.readFileSync(rangeBanPath);
}

function loadDynamicTemplates(fePath, templateSettings) {

  bManagementTemplate = fs.readFileSync(fePath + templateSettings.bManagement);
  bansPageTemplate = fs.readFileSync(fePath + templateSettings.bansPage);
  notFoundTemplate = fs.readFileSync(fePath + templateSettings.notFoundPage);
  messageTemplate = fs.readFileSync(fePath + templateSettings.messagePage);
  accountTemplate = fs.readFileSync(fePath + templateSettings.accountPage);
  gManagementTemplate = fs.readFileSync(fePath + templateSettings.gManagement);
  errorTemplate = fs.readFileSync(fePath + templateSettings.errorPage);
  banPageTemplate = fs.readFileSync(fePath + templateSettings.banPage);
  logsPageTemplate = fs.readFileSync(fePath + templateSettings.logsPage);
  boardsTemplate = fs.readFileSync(fePath + templateSettings.boardsPage);
  rangeBansTemplate = fs.readFileSync(fePath + templateSettings.rangeBansPage);
  hashBansTemplate = fs.readFileSync(fePath + templateSettings.hashBansPage);

}

function loadMainTemplates(fePath, templateSettings) {

  threadTemplate = fs.readFileSync(fePath + templateSettings.threadPage);
  frontPageTemplate = fs.readFileSync(fePath + templateSettings.index);
  boardTemplate = fs.readFileSync(fePath + templateSettings.boardPage);
  loginTemplate = fs.readFileSync(fePath + templateSettings.loginPage);
  catalogPageTemplate = fs.readFileSync(fePath + templateSettings.catalogPage);
  previewPageTemplate = fs.readFileSync(fePath + templateSettings.previewPage);

}

function checkPageErrors(errors, tests) {

  for (var i = 0; i < tests.length; i++) {

    var test = tests[i];

    var document = jsdom(test.content);

    var errorFound = false;

    var error = '\nPage ' + test.template;

    for (var j = 0; j < test.fields.length; j++) {

      var field = test.fields[j];

      if (!document.getElementById(field)) {
        errorFound = true;
        error += '\nError, missing element with id ' + field;
      }

    }

    if (errorFound) {
      errors.push(error);
    }

  }

}

function getTestCell(document, content) {

  var toReturn = document.createElement('div');

  toReturn.innerHTML = content;

  return toReturn;
}

function checkCellErrors(errors, tests) {

  var document = jsdom('<html></html>');

  for (var i = 0; i < tests.length; i++) {

    var test = tests[i];

    var cell = getTestCell(document, test.content);

    var errorFound = false;

    var error = '\nCell ' + test.template;

    for (var j = 0; j < test.fields.length; j++) {

      var field = test.fields[j];

      if (!cell.getElementsByClassName(field).length) {
        errorFound = true;
        error += '\nError, missing element with class ' + field;
      } else if (cell.getElementsByClassName(field).length > 1) {
        errorFound = true;
        error += '\nWarning, more than one element with class ' + field;
      }

    }

    if (errorFound) {
      errors.push(error);
    }

  }

}

function testTemplates(settings) {

  var cellTests = [
      {
        template : 'catalogCell',
        content : catalogCellTemplate,
        fields : [ 'linkThumb', 'labelReplies', 'labelImages', 'labelPage',
            'labelSubject', 'divMessage', 'lockIndicator', 'pinIndicator',
            'cyclicIndicator' ]
      },
      {
        template : 'bannerCell',
        content : bannerCellTemplate,
        fields : [ 'bannerImage', 'bannerIdentifier' ]
      },
      {
        template : 'opCell',
        content : opTemplate,
        fields : [ 'linkName', 'panelUploads', 'labelSubject', 'labelCreated',
            'divMessage', 'linkReply', 'linkSelf', 'deletionCheckBox',
            'lockIndicator', 'pinIndicator', 'labelId', 'labelRole',
            'divBanMessage', 'spanId', 'panelRange', 'labelRange',
            'cyclicIndicator' ]
      },
      {
        template : 'postCell',
        content : postTemplate,
        fields : [ 'linkName', 'panelUploads', 'labelSubject', 'labelCreated',
            'divMessage', 'linkSelf', 'deletionCheckBox', 'labelId',
            'labelRole', 'divBanMessage', 'spanId', 'panelRange', 'labelRange' ]
      },
      {
        template : 'staffCell',
        content : staffCellTemplate,
        fields : [ 'userIdentifier', 'userLabel', 'roleCombo' ]
      },
      {
        template : 'volunteerCell',
        content : volunteerCellTemplate,
        fields : [ 'boardIdentifier', 'userIdentifier', 'userLabel' ]
      },
      {
        template : 'reportCell',
        content : reportCellTemplate,
        fields : [ 'reasonLabel', 'link', 'idIdentifier' ]
      },
      {
        template : 'closedReportCell',
        content : closedReportCellTemplate,
        fields : [ 'reasonLabel', 'link', 'closedByLabel', 'closedDateLabel' ]
      },
      {
        template : 'banCell',
        content : banCellTemplate,
        fields : [ 'reasonLabel', 'expirationLabel', 'appliedByLabel',
            'boardLabel', 'idLabel' ]
      },
      {
        template : 'logCell',
        content : logCellTemplate,
        fields : [ 'indicatorGlobal', 'labelUser', 'labelTime',
            'labelDescription', 'labelBoard', 'labelType' ]
      },
      {
        template : 'filterCell',
        content : filterCellTemplate,
        fields : [ 'labelOriginal', 'labelReplacement', 'boardIdentifier',
            'filterIdentifier' ]
      },
      {
        template : 'boardsCell',
        content : boardsCellTemplate,
        fields : [ 'linkBoard', 'labelPostsPerHour', 'labelPostCount',
            'divDescription' ]
      }, {
        template : 'rangeBanCell',
        content : rangeBanCellTemplate,
        fields : [ 'rangeLabel', 'idIdentifier' ]
      }, {
        template : 'hashBanCell',
        content : hashBanCellTemplate,
        fields : [ 'hashLabel', 'idIdentifier' ]
      } ];

  cellTests.push({
    template : 'uploadCell',
    content : uploadCellTemplate,
    fields : [ 'infoLabel', 'imageLink', 'nameLink', 'divHash', 'labelHash' ]
  });

  var pageTests = [
      {
        template : 'loginPage',
        content : loginTemplate,
        fields : [ 'divCreation' ]
      },
      {
        template : 'catalogPage',
        content : catalogPageTemplate,
        fields : [ 'divThreads', 'labelBoard' ]
      },
      {
        template : 'resetEmail',
        content : resetEmailTemplate,
        fields : [ 'labelNewPass' ]
      },
      {
        template : 'bannerManagementPage',
        content : bannerManagementTemplate,
        fields : [ 'bannersDiv', 'boardIdentifier' ]
      },
      {
        template : 'errorPage',
        content : errorTemplate,
        fields : [ 'codeLabel', 'errorLabel' ]
      },
      {
        template : 'recoveryEmail',
        content : recoveryEmailTemplate,
        fields : [ 'linkRecovery' ]
      },
      {
        template : 'index',
        content : frontPageTemplate,
        fields : [ 'divBoards' ]
      },
      {
        template : 'boardPage',
        content : boardTemplate,
        fields : [ 'labelName', 'labelDescription', 'divPostings', 'divPages',
            'boardIdentifier', 'linkManagement', 'bannerImage', 'captchaDiv',
            'divName', 'linkModeration', 'labelMaxFileSize' ]
      },
      {
        template : 'threadPage',
        content : threadTemplate,
        fields : [ 'labelName', 'labelDescription', 'divPostings',
            'boardIdentifier', 'linkManagement', 'threadIdentifier', 'linkMod',
            'inputBan', 'divBanInput', 'divControls', 'controlBoardIdentifier',
            'controlThreadIdentifier', 'checkboxLock', 'checkboxPin',
            'bannerImage', 'captchaDiv', 'divName', 'labelMaxFileSize',
            'checkboxCyclic' ]
      },
      {
        template : 'messagePage',
        content : messageTemplate,
        fields : [ 'labelMessage', 'linkRedirect' ]
      },
      {
        template : 'accountPage',
        content : accountTemplate,
        fields : [ 'labelLogin', 'boardsDiv', 'emailField',
            'globalManagementLink', 'boardCreationDiv', 'checkboxAlwaysSign' ]
      },
      {
        template : 'banPage',
        content : banPageTemplate,
        fields : [ 'boardLabel', 'reasonLabel', 'expirationLabel', 'idLabel' ]
      },
      {
        template : 'gManagement',
        content : gManagementTemplate,
        fields : [ 'divStaff', 'userLabel', 'addStaffForm', 'newStaffCombo',
            'reportDiv', 'bansLink', 'rangeBansLink', 'hashBansLink' ]
      },
      {
        template : 'bManagement',
        content : bManagementTemplate,
        fields : [ 'volunteersDiv', 'boardLabel', 'ownerControlDiv',
            'addVolunteerBoardIdentifier', 'transferBoardIdentifier',
            'deletionIdentifier', 'reportDiv', 'closedReportsLink', 'bansLink',
            'bannerManagementLink', 'boardNameField', 'boardDescriptionField',
            'boardSettingsIdentifier', 'disableIdsCheckbox',
            'disableCaptchaCheckbox', 'forceAnonymityCheckbox',
            'filterManagementLink', 'anonymousNameField', 'rangeBansLink',
            'hashBansLink' ]
      },
      {
        template : 'closedReportsPage',
        content : closedReportsPageTemplate,
        fields : [ 'reportDiv' ]
      },
      {
        template : 'bansPage',
        content : bansPageTemplate,
        fields : [ 'bansDiv' ]
      },
      {
        template : 'logsPage',
        content : logsPageTemplate,
        fields : [ 'divLogs', 'divPages', 'checkboxExcludeGlobals',
            'fieldBoard', 'comboboxType', 'fieldBefore', 'fieldAfter',
            'fieldUser' ]
      },
      {
        template : 'previewPage',
        content : previewPageTemplate,
        fields : [ 'panelContent' ]
      },
      {
        template : 'filterManagement',
        content : filterMagementPage,
        fields : [ 'divFilters', 'boardIdentifier' ]
      },
      {
        template : 'boardModeration',
        content : boardModerationTemplate,
        fields : [ 'boardTransferIdentifier', 'boardDeletionIdentifier',
            'labelTitle', 'labelOwner' ]
      },
      {
        template : 'boardsPage',
        content : boardsTemplate,
        fields : [ 'divBoards', 'divPages' ]
      },
      {
        template : 'noCookieCaptchaPage',
        content : noCookieCaptcha,
        fields : [ 'divSolvedCaptcha', 'labelCaptchaId', 'inputCaptchaId',
            'imageCaptcha' ]
      }, {
        template : 'rangeBansPage',
        content : rangeBansTemplate,
        fields : [ 'rangeBansDiv', 'boardIdentifier' ]
      }, {
        template : 'rangeBanPage',
        content : rangeBanPageTemplate,
        fields : [ 'boardLabel', 'rangeLabel' ]
      }, {
        template : 'hashBansPage',
        content : hashBansTemplate,
        fields : [ 'hashBansDiv', 'boardIdentifier' ]
      } ];

  var errors = [];

  checkCellErrors(errors, cellTests);

  checkPageErrors(errors, pageTests);

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

  loadMainTemplates(fePath, templateSettings);
  loadEmailTemplates(fePath, templateSettings);
  loadDynamicTemplates(fePath, templateSettings);
  loadLongPathDynamicTemplates(fePath, templateSettings);
  loadCellTemplates(fePath, templateSettings);
  loadLongPathCellTemplates(fePath, templateSettings);

  testTemplates(templateSettings);

};

exports.frontPageTemplate = function() {
  return frontPageTemplate;
};

exports.threadTemplate = function() {
  return threadTemplate;
};

exports.boardTemplate = function() {
  return boardTemplate;
};

exports.notFoundTemplate = function() {
  return notFoundTemplate;
};

exports.messageTemplate = function() {
  return messageTemplate;
};

exports.loginTemplate = function() {
  return loginTemplate;
};

exports.opTemplate = function() {
  return opTemplate;
};

exports.postTemplate = function() {
  return postTemplate;
};

exports.recoveryEmailTemplate = function() {
  return recoveryEmailTemplate;
};

exports.resetEmailTemplate = function() {
  return resetEmailTemplate;
};

exports.accountTemplate = function() {
  return accountTemplate;
};

exports.gManagementTemplate = function() {
  return gManagementTemplate;
};

exports.staffCellTemplate = function() {
  return staffCellTemplate;
};

exports.bManagementTemplate = function() {
  return bManagementTemplate;
};

exports.volunteerCellTemplate = function() {
  return volunteerCellTemplate;
};

exports.reportCellTemplate = function() {
  return reportCellTemplate;
};

exports.closedReportCellTemplate = function() {
  return closedReportCellTemplate;
};

exports.closedReportsPageTemplate = function() {
  return closedReportsPageTemplate;
};

exports.bansPageTemplate = function() {
  return bansPageTemplate;
};

exports.banCellTemplate = function() {
  return banCellTemplate;
};

exports.uploadCellTemplate = function() {
  return uploadCellTemplate;
};

exports.errorTemplate = function() {
  return errorTemplate;
};

exports.banPageTemplate = function() {
  return banPageTemplate;
};

exports.bannerManagementTemplate = function() {
  return bannerManagementTemplate;
};

exports.bannerCellTemplate = function() {
  return bannerCellTemplate;
};

exports.catalogPageTemplate = function() {
  return catalogPageTemplate;
};

exports.catalogCellTemplate = function() {
  return catalogCellTemplate;
};

exports.logsPageTemplate = function() {
  return logsPageTemplate;
};

exports.logCellTemplate = function() {
  return logCellTemplate;
};

exports.previewPageTemplate = function() {
  return previewPageTemplate;
};

exports.filterManagementPage = function() {
  return filterMagementPage;
};

exports.filterCellTemplate = function() {
  return filterCellTemplate;
};

exports.boardModerationTemplate = function() {
  return boardModerationTemplate;
};

exports.boardsTemplate = function() {
  return boardsTemplate;
};

exports.boardsCellTemplate = function() {
  return boardsCellTemplate;
};

exports.noCookieCaptcha = function() {
  return noCookieCaptcha;
};

exports.rangeBansTemplate = function() {
  return rangeBansTemplate;
};

exports.rangeBanCellTemplate = function() {
  return rangeBanCellTemplate;
};

exports.rangeBanPageTemplate = function() {
  return rangeBanPageTemplate;
};

exports.hashBansTemplate = function() {
  return hashBansTemplate;
};

exports.hashBanCellTemplate = function() {
  return hashBanCellTemplate;
};