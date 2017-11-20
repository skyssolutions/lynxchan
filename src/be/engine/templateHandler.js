'use strict';

// loads, tests and hands html templates

var debug = require('../kernel').debug();
var settingsHandler = require('../settingsHandler');
var verbose;
var fs = require('fs');
var JSDOM = require('jsdom').JSDOM;
var defaultTemplates = {};
var alternativeTemplates = {};
var preBuiltDefault = {};
var preBuiltAlternative = {};

var simpleAttributes = [ 'download', 'style', 'value', 'name', 'checked' ];
var simpleProperties = [ 'href', 'title', 'src' ];

require('jsdom').defaultDocumentFeatures = {
  FetchExternalResources : false,
  ProcessExternalResources : false,
  // someone said it might break stuff. If weird bugs, disable.
  MutationEvents : false
};

exports.getAlternativeTemplates = function(language, prebuilt) {

  var toReturn = prebuilt ? preBuiltAlternative[language._id]
      : alternativeTemplates[language._id];

  if (!toReturn) {

    try {
      exports.loadTemplates(language);
      toReturn = prebuilt ? preBuiltAlternative[language._id]
          : alternativeTemplates[language._id];
    } catch (error) {
      if (debug) {
        throw error;
      }
    }

  }

  return toReturn;

};

exports.getTemplates = function(language, preBuilt) {

  var defaultToUse = preBuilt ? preBuiltDefault : defaultTemplates;

  if (language) {

    return exports.getAlternativeTemplates(language, preBuilt) || defaultToUse;

  } else {
    return defaultToUse;
  }

};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;

};

exports.getCellTests = function() {

  return [
      {
        template : 'latestImageCell',
        fields : [ 'linkPost' ],
        prebuiltFields : [ {
          name : 'linkPost',
          uses : [ 'children', 'href' ]
        } ]
      },
      {
        template : 'topBoardCell',
        fields : [ 'boardLink' ],
        prebuiltFields : [ {
          name : 'boardLink',
          uses : [ 'inner', 'href' ]
        } ]
      },
      {
        template : 'catalogCell',
        fields : [ 'linkThumb', 'labelReplies', 'labelImages', 'labelPage',
            'labelSubject', 'divMessage', 'lockIndicator', 'pinIndicator',
            'cyclicIndicator', 'bumpLockIndicator' ],
        prebuiltFields : [ {
          name : 'linkThumb',
          uses : [ 'inner', 'href' ]
        }, {
          name : 'labelReplies',
          uses : [ 'inner' ]
        }, {
          name : 'labelImages',
          uses : [ 'inner' ]
        }, {
          name : 'labelPage',
          uses : [ 'inner' ]
        }, {
          name : 'bumpLockIndicator',
          uses : [ 'removal' ]
        }, {
          name : 'cyclicIndicator',
          uses : [ 'removal' ]
        }, {
          name : 'labelSubject',
          uses : [ 'removal', 'inner' ]
        }, {
          name : 'divMessage',
          uses : [ 'inner' ]
        }, {
          name : 'lockIndicator',
          uses : [ 'removal' ]
        }, {
          name : 'pinIndicator',
          uses : [ 'removal' ]
        } ]
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
            'labelOmission', 'labelNarrowRange', 'linkEdit', 'labelLastEdit',
            'imgFlag', 'labelIp', 'contentOmissionIndicator', 'linkFullText',
            'bumpLockIndicator' ],
        prebuiltFields : [ {
          name : 'contentOmissionIndicator',
          uses : [ 'removal' ]
        }, {
          name : 'linkName',
          uses : [ 'inner', 'href' ],
          attributes : [ 'class' ]
        }, {
          name : 'linkFullText',
          uses : [ 'href' ]
        }, {
          name : 'labelIp',
          uses : [ 'inner' ]
        }, {
          name : 'panelRange',
          uses : [ 'removal' ]
        }, {
          name : 'linkEdit',
          uses : [ 'href', 'removal' ]
        }, {
          name : 'imgFlag',
          uses : [ 'title', 'src', 'removal' ],
          attributes : [ 'class' ]
        }, {
          name : 'labelLastEdit',
          uses : [ 'inner', 'removal' ]
        }, {
          name : 'labelOmission',
          uses : [ 'inner', 'removal' ]
        }, {
          name : 'panelUploads',
          uses : [ 'children' ]
        }, {
          name : 'panelIp',
          uses : [ 'removal' ]
        }, {
          name : 'labelBroadRange',
          uses : [ 'inner' ]
        }, {
          name : 'labelNarrowRange',
          uses : [ 'inner' ]
        }, {
          name : 'labelSubject',
          uses : [ 'inner', 'removal' ]
        }, {
          name : 'labelCreated',
          uses : [ 'inner' ]
        }, {
          name : 'divMessage',
          uses : [ 'inner' ]
        }, {
          name : 'divPosts',
          uses : [ 'children' ]
        }, {
          name : 'linkReply',
          uses : [ 'href', 'removal' ]
        }, {
          name : 'linkSelf',
          uses : [ 'href' ]
        }, {
          name : 'linkQuote',
          uses : [ 'href', 'inner' ]
        }, {
          name : 'linkQuote',
          uses : [ 'href', 'inner' ]
        }, {
          name : 'deletionCheckBox',
          attributes : [ 'name' ],
          uses : [ 'removal' ]
        }, {
          name : 'lockIndicator',
          uses : [ 'removal' ]
        }, {
          name : 'bumpLockIndicator',
          uses : [ 'removal' ]
        }, {
          name : 'cyclicIndicator',
          uses : [ 'removal' ]
        }, {
          name : 'pinIndicator',
          uses : [ 'removal' ]
        }, {
          name : 'spanId',
          uses : [ 'removal' ]
        }, {
          name : 'labelId',
          uses : [ 'inner' ],
          attributes : [ 'style' ]
        }, {
          name : 'labelRole',
          uses : [ 'inner', 'removal' ]
        }, {
          name : 'divBanMessage',
          uses : [ 'inner', 'removal' ]
        } ]
      },
      {
        template : 'postCell',
        fields : [ 'linkName', 'panelUploads', 'labelSubject', 'labelCreated',
            'divMessage', 'linkSelf', 'deletionCheckBox', 'labelId',
            'panelRange', 'labelRole', 'divBanMessage', 'spanId', 'panelIp',
            'labelBroadRange', 'linkQuote', 'labelNarrowRange', 'linkEdit',
            'labelLastEdit', 'imgFlag', 'labelIp', 'contentOmissionIndicator',
            'linkFullText' ],
        prebuiltFields : [ {
          name : 'contentOmissionIndicator',
          uses : [ 'removal' ]
        }, {
          name : 'linkFullText',
          uses : [ 'href' ]
        }, {
          name : 'labelIp',
          uses : [ 'inner' ]
        }, {
          name : 'divBanMessage',
          uses : [ 'removal', 'inner' ]
        }, {
          name : 'imgFlag',
          uses : [ 'src', 'removal', 'title' ],
          attributes : [ 'class' ]
        }, {
          name : 'labelLastEdit',
          uses : [ 'inner', 'removal' ]
        }, {
          name : 'linkEdit',
          uses : [ 'href', 'removal' ]
        }, {
          name : 'panelRange',
          uses : [ 'removal' ]
        }, {
          name : 'panelIp',
          uses : [ 'removal' ]
        }, {
          name : 'labelBroadRange',
          uses : [ 'inner' ]
        }, {
          name : 'labelNarrowRange',
          uses : [ 'inner' ]
        }, {
          name : 'panelUploads',
          uses : [ 'children' ]
        }, {
          name : 'labelRole',
          uses : [ 'inner', 'removal' ]
        }, {
          name : 'linkName',
          uses : [ 'inner', 'href' ],
          attributes : [ 'class' ]
        }, {
          name : 'labelSubject',
          uses : [ 'inner', 'removal' ]
        }, {
          name : 'labelCreated',
          uses : [ 'inner' ]
        }, {
          name : 'divMessage',
          uses : [ 'inner' ]
        }, {
          name : 'linkSelf',
          uses : [ 'href' ]
        }, {
          name : 'linkQuote',
          uses : [ 'href', 'inner' ]
        }, {
          name : 'deletionCheckBox',
          attributes : [ 'name' ],
          uses : [ 'removal' ]
        }, {
          name : 'spanId',
          uses : [ 'removal' ]
        }, {
          name : 'labelId',
          uses : [ 'inner' ],
          attributes : [ 'style' ]
        } ]
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
            'denyIdentifier', 'denyForm', 'boardLabel', 'boardPanel' ]
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
            'originalNameLink', 'dimensionLabel' ],
        prebuiltFields : [ {
          name : 'sizeLabel',
          uses : [ 'inner' ]
        }, {
          name : 'imgLink',
          uses : [ 'children', 'href' ],
          attributes : [ 'data-filewidth', 'data-fileheight', 'data-filemime' ]
        }, {
          name : 'nameLink',
          uses : [ 'href' ]
        }, {
          name : 'divHash',
          uses : [ 'removal' ]
        }, {
          name : 'labelHash',
          uses : [ 'inner' ]
        }, {
          name : 'originalNameLink',
          uses : [ 'inner', 'href' ],
          attributes : [ 'download' ]
        }, {
          name : 'dimensionLabel',
          uses : [ 'removal', 'inner' ]
        } ]
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
        fields : [ 'labelPreview', 'linkPost' ],
        prebuiltFields : [ {
          name : 'labelPreview',
          uses : [ 'inner' ]
        }, {
          name : 'linkPost',
          uses : [ 'inner', 'href' ]
        } ]
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
            'referencesLabel', 'detailsLink' ]
      },
      {
        template : 'languageCell',
        fields : [ 'languageIdentifier', 'frontEndLabel', 'languagePackLabel',
            'headerValuesLabel' ]
      }, {
        template : 'accountCell',
        fields : [ 'accountLink' ]
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
            'captchaDiv', 'boardIdentifier', 'flagCombobox', 'postingForm',
            'noFlagDiv' ],
        headChildren : true,
        prebuiltFields : [ {
          name : 'noFlagDiv',
          uses : [ 'removal' ]
        }, {
          name : 'divThreads',
          uses : [ 'children' ]
        }, {
          name : 'labelBoard',
          uses : [ 'inner' ]
        }, {
          name : 'flagsDiv',
          uses : [ 'removal' ]
        }, {
          name : 'flagCombobox',
          uses : [ 'children' ]
        }, {
          name : 'boardIdentifier',
          attributes : [ 'value' ]
        }, {
          name : 'captchaDiv',
          uses : [ 'removal' ]
        }, {
          name : 'labelMaxFileSize',
          uses : [ 'inner' ]
        }, {
          name : 'labelMaxFiles',
          uses : [ 'inner' ]
        }, {
          name : 'labelMessageLength',
          uses : [ 'inner' ]
        }, {
          name : 'divUpload',
          uses : [ 'removal' ]
        }, {
          name : 'postingForm',
          uses : [ 'removal' ]
        } ]
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
            'labelTotalSize' ],
        prebuiltFields : [ {
          name : 'divBoards',
          uses : [ 'removal', 'children' ]
        }, {
          name : 'divLatestImages',
          uses : [ 'removal', 'children' ]
        }, {
          name : 'divLatestPosts',
          uses : [ 'removal', 'children' ]
        }, {
          name : 'linkEngine',
          uses : [ 'href', 'inner' ]
        }, {
          name : 'divStats',
          uses : [ 'removal' ]
        }, {
          name : 'labelTotalPosts',
          uses : [ 'inner' ]
        }, {
          name : 'labelTotalIps',
          uses : [ 'inner' ]
        }, {
          name : 'labelTotalBoards',
          uses : [ 'inner' ]
        }, {
          name : 'labelTotalPPH',
          uses : [ 'inner' ]
        }, {
          name : 'labelTotalFiles',
          uses : [ 'inner' ]
        }, {
          name : 'labelTotalSize',
          uses : [ 'inner' ]
        } ]

      },
      {
        template : 'boardPage',
        fields : [ 'labelName', 'labelDescription', 'divThreads', 'divPages',
            'boardIdentifier', 'linkManagement', 'bannerImage', 'captchaDiv',
            'divName', 'linkModeration', 'labelMaxFileSize', 'linkPrevious',
            'linkNext', 'flagsDiv', 'flagCombobox', 'panelMessage',
            'divMessage', 'labelMaxFiles', 'labelMessageLength', 'divUpload',
            'noFlagDiv' ],
        headChildren : true,
        bodyChildren : true,
        prebuiltFields : [ {
          name : 'labelName',
          uses : [ 'inner' ]
        }, {
          name : 'labelDescription',
          uses : [ 'inner' ]
        }, {
          name : 'noFlagDiv',
          uses : [ 'removal' ]
        }, {
          name : 'panelMessage',
          uses : [ 'removal' ]
        }, {
          name : 'divMessage',
          uses : [ 'inner' ]
        }, {
          name : 'flagsDiv',
          uses : [ 'removal' ]
        }, {
          name : 'flagCombobox',
          uses : [ 'children' ]
        }, {
          name : 'divThreads',
          uses : [ 'children' ]
        }, {
          name : 'divPages',
          uses : [ 'children' ]
        }, {
          name : 'boardIdentifier',
          attributes : [ 'value' ]
        }, {
          name : 'linkManagement',
          uses : [ 'href' ]
        }, {
          name : 'linkModeration',
          uses : [ 'href' ]
        }, {
          name : 'bannerImage',
          uses : [ 'src' ]
        }, {
          name : 'captchaDiv',
          uses : [ 'removal' ]
        }, {
          name : 'divName',
          uses : [ 'removal' ]
        }, {
          name : 'labelMaxFileSize',
          uses : [ 'inner' ]
        }, {
          name : 'linkPrevious',
          uses : [ 'href', 'removal' ]
        }, {
          name : 'linkNext',
          uses : [ 'href', 'removal' ]
        }, {
          name : 'labelMaxFiles',
          uses : [ 'inner' ]
        }, {
          name : 'labelMessageLength',
          uses : [ 'inner' ]
        }, {
          name : 'divUpload',
          uses : [ 'removal' ]
        } ]
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
            'labelMessageLength', 'noFlagDiv' ],
        headChildren : true,
        bodyChildren : true,
        prebuiltFields : [ {
          name : 'noFlagDiv',
          uses : [ 'removal' ]
        }, {
          name : 'ipDeletionForm',
          uses : [ 'removal' ]
        }, {
          name : 'panelMessage',
          uses : [ 'removal' ]
        }, {
          name : 'divMessage',
          uses : [ 'inner' ]
        }, {
          name : 'labelName',
          uses : [ 'inner' ]
        }, {
          name : 'flagsDiv',
          uses : [ 'removal' ]
        }, {
          name : 'flagCombobox',
          uses : [ 'children' ]
        }, {
          name : 'labelDescription',
          uses : [ 'inner' ]
        }, {
          name : 'divThreads',
          uses : [ 'children' ]
        }, {
          name : 'boardIdentifier',
          attributes : [ 'value' ]
        }, {
          name : 'threadIdentifier',
          attributes : [ 'value' ]
        }, {
          name : 'linkManagement',
          uses : [ 'href' ]
        }, {
          name : 'linkMod',
          uses : [ 'href' ]
        }, {
          name : 'divMod',
          uses : [ 'removal' ]
        }, {
          name : 'divControls',
          uses : [ 'removal' ]
        }, {
          name : 'controlBoardIdentifier',
          attributes : [ 'value' ]
        }, {
          name : 'controlThreadIdentifier',
          attributes : [ 'value' ]
        }, {
          name : 'checkboxLock',
          attributes : [ 'checked' ]
        }, {
          name : 'checkboxPin',
          attributes : [ 'checked' ]
        }, {
          name : 'checkboxCyclic',
          attributes : [ 'checked' ]
        }, {
          name : 'checkboxCyclic',
          attributes : [ 'checked' ]
        }, {
          name : 'bannerImage',
          uses : [ 'src' ]
        }, {
          name : 'captchaDiv',
          uses : [ 'removal' ]
        }, {
          name : 'divName',
          uses : [ 'removal' ]
        }, {
          name : 'labelMaxFileSize',
          uses : [ 'inner' ]
        }, {
          name : 'formTransfer',
          uses : [ 'removal' ]
        }, {
          name : 'transferBoardIdentifier',
          attributes : [ 'value' ]
        }, {
          name : 'transferThreadIdentifier',
          attributes : [ 'value' ]
        }, {
          name : 'labelMaxFiles',
          uses : [ 'inner' ]
        }, {
          name : 'labelMessageLength',
          uses : [ 'inner' ]
        }, {
          name : 'divUpload',
          uses : [ 'removal' ]
        } ]
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
            'languagesLink', 'accountsLink', 'socketLink', 'massBanPanel' ]
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
            'uniqueFilesCheckbox', 'uniquePostsCheckbox', 'locationComboBox',
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
        template : 'filterManagement',
        fields : [ 'divFilters', 'boardIdentifier', 'checkboxCaseInsensitive' ]
      },
      {
        template : 'boardModerationPage',
        fields : [ 'boardTransferIdentifier', 'boardDeletionIdentifier',
            'labelTitle', 'labelOwner', 'labelLastSeen', 'checkboxSfw',
            'specialSettingsIdentifier', 'checkboxLocked', 'divVolunteers' ]
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
            'postIdentifier', 'labelMessageLength', 'fieldSubject' ]
      },
      {
        template : 'flagsPage',
        fields : [ 'flagsDiv', 'boardIdentifier', 'maxSizeLabel',
            'maxNameLengthLabel' ]
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
            'checkboxMediaThumb', 'checkboxMaintenance', 'checkboxVerboseMisc',
            'checkboxMultipleReports', 'fieldMaster', 'checkboxAutoPruneFiles',
            'checkboxDisableAccountCreation', 'comboBoardCreationRequirement',
            'fieldMaxTags', 'fieldGlobalLatestImages', 'fieldTorPort',
            'checkboxDisableFloodCheck', 'comboSsl', 'fieldSfwOverboard',
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
            'comboTorPostingLevel', 'checkboxAllowTorFiles',
            'checkboxUseAlternativeLanguages', 'checkboxVerboseGenerator',
            'checkboxVerboseQueue', 'checkboxVerboseGridfs',
            'checkboxVerboseStatic', 'checkboxVerboseApis',
            'fieldIncrementalSpamIpsSource', 'fieldFlagNameLength',
            'checkboxBlockedReport', 'checkboxPreemptiveCaching' ]
      },
      {
        template : 'hashBanPage',
        fields : [ 'hashBansPanel' ]
      },
      {
        template : 'overboard',
        fields : [ 'divThreads' ]
      },
      {
        template : 'bypassPage',
        fields : [ 'indicatorValidBypass', 'renewForm' ]
      },
      {
        template : 'logIndexPage',
        fields : [ 'divDates' ]
      },
      {
        template : 'graphsIndexPage',
        fields : [ 'divDates' ]
      },
      {
        template : 'mediaManagementPage',
        fields : [ 'filesDiv', 'pagesDiv' ]
      },
      {
        template : 'languagesManagementPage',
        fields : [ 'languagesDiv' ]
      },
      {
        template : 'accountsPage',
        fields : [ 'divAccounts' ]
      },
      {
        template : 'socketManagementPage',
        fields : [ 'statusLabel' ]
      },
      {
        template : 'accountManagementPage',
        fields : [ 'emailLabel', 'lastSeenLabel', 'ownedBoardsDiv',
            'volunteeredBoardsDiv', 'globalRoleLabel' ]
      },
      {
        template : 'mediaDetailsPage',
        fields : [ 'labelSize', 'labelUploadDate', 'panelReferences',
            'labelIdentifier' ]
      } ];

};

exports.testPageFields = function(dom, page, prebuiltObject, errors) {

  var document = dom.window.document;

  var error = '';

  for (var j = 0; j < page.fields.length; j++) {

    var field = page.fields[j];

    if (!document.getElementById(field)) {
      error += '\nError, missing element with id ' + field;
    }

  }

  if (page.prebuiltFields) {

    document.title = '__title__';

    if (page.headChildren) {
      document.getElementsByTagName('head')[0].appendChild(document
          .createTextNode('__head_children__'));
    }

    if (page.bodyChildren) {
      document.getElementsByTagName('body')[0].appendChild(document
          .createTextNode('__body_children__'));
    }

    exports.loadPrebuiltFields(dom, document, prebuiltObject, page);

  }

  return error;
};

exports.processPage = function(errors, page, fePath, templateSettings,
    templateObject, prebuiltObject) {

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

  var dom = new JSDOM(template);

  var error = exports.testPageFields(dom, page, prebuiltObject, errors);

  if (error.length) {

    errors.push('\nPage ' + page.template + error);
  }

};

exports.loadPages = function(errors, fePath, templateSettings, templateObject,
    prebuiltObject) {

  var pages = exports.getPageTests();

  for (var i = 0; i < pages.length; i++) {

    var page = pages[i];

    if (!templateSettings[page.template]) {
      errors.push('\nTemplate ' + page.template + ' is not defined.');

      continue;
    }

    exports.processPage(errors, page, fePath, templateSettings, templateObject,
        prebuiltObject);

  }
};

exports.processFieldUses = function(field, removed, element, document) {

  for (var i = 0; field.uses && i < field.uses.length; i++) {

    if (simpleProperties.indexOf(field.uses[i]) > -1) {

      var value = '__' + field.name + '_' + field.uses[i] + '__';

      element[field.uses[i]] = value;

      continue;
    }

    switch (field.uses[i]) {

    case 'removal': {
      removed.push(field.name);
      break;
    }

    case 'children': {
      var text = '__' + field.name + '_children__';

      element.appendChild(document.createTextNode(text));
      break;
    }

    case 'inner': {
      element.innerHTML = '__' + field.name + '_inner__';
      break;
    }

    }

  }

};

exports.processFieldAttributes = function(element, field) {

  for (var i = 0; field.attributes && i < field.attributes.length; i++) {

    if (simpleAttributes.indexOf(field.attributes[i]) > -1) {

      var value = '__' + field.name + '_' + field.attributes[i] + '__';

      element.setAttribute(field.attributes[i], value);

      continue;
    }

    switch (field.attributes[i]) {

    case 'data-filemime': {
      element.setAttribute('data-filemime', '__' + field.name + '_mime__');
      break;
    }

    case 'data-fileheight': {
      element.setAttribute('data-fileheight', '__' + field.name + '_height__');
      break;
    }

    case 'data-filewidth': {
      element.setAttribute('data-filewidth', '__' + field.name + '_width__');
      break;
    }

    case 'class': {
      element.className += ' __' + field.name + '_class__';
      break;
    }

    }

  }

};

exports.handleRemovableFields = function(removed, cell, document, base) {

  var removable = {};

  for (var i = 0; i < removed.length; i++) {

    var element = cell ? base.getElementsByClassName(removed[i])[0] : document
        .getElementById(removed[i]);

    var textNode = document.createTextNode('__' + removed[i] + '_location__');

    element.parentNode.insertBefore(textNode, element);

    removable[removed[i]] = element.outerHTML;

    element.remove();

  }

  return removable;

};

exports.iteratePrebuiltFields = function(template, base, document, removed,
    cell) {

  for (var j = 0; j < template.prebuiltFields.length; j++) {

    var field = template.prebuiltFields[j];

    var element = null;

    if (cell) {

      var elements = base.getElementsByClassName(field.name);

      if (elements) {
        element = elements[0];
      }

    } else {
      element = document.getElementById(field.name);
    }

    if (element) {
      exports.processFieldUses(field, removed, element, document);

      exports.processFieldAttributes(element, field);
    }

  }

};

exports.loadPrebuiltFields = function(dom, base, object, template, cell) {

  var removed = [];

  var document = dom.window.document;

  exports.iteratePrebuiltFields(template, base, document, removed, cell);

  var removable = exports.handleRemovableFields(removed, cell, document, base);

  var toInsert = {
    template : cell ? base.innerHTML : dom.serialize(),
    removable : removable
  };

  object[template.template] = toInsert;

};

exports.getCellsErrors = function(cell, cellElement) {

  var error = '';

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

exports.testCell = function(dom, cell, fePath, templateSettings,
    templateObject, prebuiltObject) {
  var error = '';

  var document = dom.window.document;

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

  error += exports.getCellsErrors(cell, cellElement);

  if (cell.prebuiltFields) {
    exports.loadPrebuiltFields(dom, cellElement, prebuiltObject, cell, true);
  }

  cellElement.remove();

  return error;
};

exports.loadCells = function(errors, fePath, templateSettings, templateObject,
    prebuiltObject) {

  var dom = new JSDOM('<html></html>');

  var cells = exports.getCellTests();

  for (var i = 0; i < cells.length; i++) {

    var cell = cells[i];

    if (!templateSettings[cell.template]) {
      errors.push('\nTemplate ' + cell.template + ' is not defined.');

      continue;
    }

    var error = exports.testCell(dom, cell, fePath, templateSettings,
        templateObject, prebuiltObject);

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

exports.runTemplateLoading = function(fePath, templateSettings, templateObject,
    prebuiltTemplateObject) {

  var errors = [];

  exports.loadCells(errors, fePath, templateSettings, templateObject,
      prebuiltTemplateObject);
  exports.loadPages(errors, fePath, templateSettings, templateObject,
      prebuiltTemplateObject);

  exports.handleLoadingErrors(errors);

};

exports.loadTemplates = function(language) {

  if (!language) {
    var fePath = settingsHandler.getGeneralSettings().fePath;
    var templateSettings = settingsHandler.getTemplateSettings();
    var templateObject = defaultTemplates;
    var prebuiltTemplateObject = preBuiltDefault;
  } else {

    if (verbose) {
      console.log('Loading alternative front-end: ' + language.headerValues);
    }

    fePath = language.frontEnd;
    templateObject = {};
    prebuiltTemplateObject = {};

    var finalPath = fePath + '/templateSettings.json';
    templateSettings = JSON.parse(fs.readFileSync(finalPath));

    alternativeTemplates[language._id] = templateObject;
    preBuiltAlternative[language._id] = prebuiltTemplateObject;

  }

  exports.runTemplateLoading(fePath, templateSettings, templateObject,
      prebuiltTemplateObject);

};

exports.dropAlternativeTemplates = function() {
  alternativeTemplates = {};
  preBuiltAlternative = {};
};