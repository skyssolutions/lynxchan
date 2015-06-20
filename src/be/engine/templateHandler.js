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

function loadEmailTemplates(fePath, templateSettings) {

  var recoveryEmailPath = fePath + templateSettings.recoveryEmail;
  recoveryEmailTemplate = fs.readFileSync(recoveryEmailPath);
  resetEmailTemplate = fs.readFileSync(fePath + templateSettings.resetEmail);

}

function loadCellTemplates(fePath, templateSettings) {
  opTemplate = fs.readFileSync(fePath + templateSettings.opCell);
  staffCellTemplate = fs.readFileSync(fePath + templateSettings.staffCell);
  postTemplate = fs.readFileSync(fePath + templateSettings.postCell);
  reportCellTemplate = fs.readFileSync(fePath + templateSettings.reportCell);

  uploadCellTemplate = fs.readFileSync(fePath + templateSettings.uploadCell);

  var closedReportPath = fePath + templateSettings.closedReportCell;
  closedReportCellTemplate = fs.readFileSync(closedReportPath);

  var volunteerPath = fePath + templateSettings.volunteerCell;
  volunteerCellTemplate = fs.readFileSync(volunteerPath);

  banCellTemplate = fs.readFileSync(fePath + templateSettings.banCell);

  bannerCellTemplate = fs.readFileSync(fePath + templateSettings.bannerCell);

  catalogCellTemplate = fs.readFileSync(fePath + templateSettings.catalogCell);
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

  var bannerManagementPath = fePath + templateSettings.bannerManagementPage;
  bannerManagementTemplate = fs.readFileSync(bannerManagementPath);

  var closedReportsPath = fePath + templateSettings.closedReportsPage;
  closedReportsPageTemplate = fs.readFileSync(closedReportsPath);
}

function loadMainTemplates(fePath, templateSettings) {

  threadTemplate = fs.readFileSync(fePath + templateSettings.threadPage);
  frontPageTemplate = fs.readFileSync(fePath + templateSettings.index);
  boardTemplate = fs.readFileSync(fePath + templateSettings.boardPage);
  loginTemplate = fs.readFileSync(fePath + templateSettings.loginPage);
  catalogPageTemplate = fs.readFileSync(fePath + templateSettings.catalogPage);

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
        error += '\nError, missing element ' + field;
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
        error += '\nError, missing element ' + field;
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
            'labelSubject', 'divMessage', 'lockIndicator', 'pinIndicator' ]
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
            'divBanMessage' ]
      },
      {
        template : 'postCell',
        content : postTemplate,
        fields : [ 'linkName', 'panelUploads', 'labelSubject', 'labelCreated',
            'divMessage', 'linkSelf', 'deletionCheckBox', 'labelId',
            'labelRole', 'divBanMessage' ]
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
            'boardLabel' ]
      }, {
        template : 'uploadCell',
        content : uploadCellTemplate,
        fields : [ 'infoLabel', 'imageLink', 'nameLink' ]
      } ];

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
            'boardIdentifier', 'linkManagement', 'bannerImage' ]
      },
      {
        template : 'threadPage',
        content : threadTemplate,
        fields : [ 'labelName', 'labelDescription', 'divPostings',
            'boardIdentifier', 'linkManagement', 'threadIdentifier', 'linkMod',
            'inputBan', 'divBanInput', 'divControls', 'controlBoardIdentifier',
            'controlThreadIdentifier', 'checkboxLock', 'checkboxPin',
            'bannerImage' ]
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
            'globalManagementLink', 'boardCreationDiv' ]
      },
      {
        template : 'banPage',
        content : banPageTemplate,
        fields : [ 'boardLabel', 'reasonLabel', 'expirationLabel' ]
      },
      {
        template : 'gManagement',
        content : gManagementTemplate,
        fields : [ 'divStaff', 'userLabel', 'addStaffForm', 'newStaffCombo',
            'reportDiv', 'bansLink' ]
      },
      {
        template : 'bManagement',
        content : bManagementTemplate,
        fields : [ 'volunteersDiv', 'boardLabel', 'ownerControlDiv',
            'addVolunteerBoardIdentifier', 'transferBoardIdentifier',
            'deletionIdentifier', 'reportDiv', 'closedReportsLink', 'bansLink',
            'bannerManagementLink' ]
      }, {
        template : 'closedReportsPage',
        content : closedReportsPageTemplate,
        fields : [ 'reportDiv' ]
      }, {
        template : 'bansPage',
        content : bansPageTemplate,
        fields : [ 'bansDiv' ]
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
  loadCellTemplates(fePath, templateSettings);

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