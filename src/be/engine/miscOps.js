'use strict';

// miscellaneous operations

var settingsHandler = require('../settingsHandler');
var verbose;
var db = require('../db');
var bans = db.bans();
var crypto = require('crypto');
var users = db.users();
var reports = db.reports();
var reportOps;
var formOps;
var CSP;
var lang;
var clearIpMinRole;

var MAX_STAFF_ROLE = 3;
var plainTextMimes = [ 'application/x-javascript', 'application/json',
    'application/rss+xml' ];

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();

  CSP = settings.CSP;
  clearIpMinRole = settings.clearIpMinRole;
  verbose = settings.verbose;

};

exports.htmlReplaceTable = {
  '<' : '&lt;',
  '>' : '&gt;'
};

exports.loadDependencies = function() {

  formOps = require('./formOps');
  reportOps = require('./modOps').report;
  lang = require('./langOps').languagePack();

};

exports.getRandomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

exports.getMaxStaffRole = function() {
  return MAX_STAFF_ROLE;
};

exports.hashIpForDisplay = function(ip, salt, userRole) {

  if (userRole <= clearIpMinRole) {
    return ip.join('.');
  }

  return crypto.createHash('sha256').update(salt + ip).digest('hex').substring(
      0, 48);

};

// parameters must be an array of objects. each object must contain two keys:
// one with a string with the name of the parameter, the other with a number
// with its maximum length
exports.sanitizeParameter = function(object, parameter) {

  var hasProperty = object.hasOwnProperty(parameter.field);

  if (hasProperty && object[parameter.field] != null) {

    object[parameter.field] = object[parameter.field].toString().trim();

    if (!object[parameter.field].length) {

      delete object[parameter.field];

    } else if (parameter.length) {
      object[parameter.field] = object[parameter.field].substring(0,
          parameter.length);

      if (parameter.removeHTML) {
        object[parameter.field] = object[parameter.field].replace(/[<>]/g,
            function replace(match) {
              return exports.htmlReplaceTable[match];
            });
      }

    }
  }
};

exports.sanitizeStrings = function(object, parameters) {

  for (var i = 0; i < parameters.length; i++) {

    var parameter = parameters[i];

    exports.sanitizeParameter(object, parameter);

  }

};

exports.isPlainText = function(mime) {

  if (!mime.indexOf('text/') || plainTextMimes.indexOf(mime) > -1) {
    return true;
  }

};

exports.corsHeader = function(contentType, auth) {

  var header = [];

  if (contentType) {
    var isPlainText = exports.isPlainText(contentType);
    header.push([ 'Content-Type',
        contentType + (isPlainText ? '; charset=utf-8' : '') ]);
  }

  if (CSP) {
    header.push([ 'Content-Security-Policy', CSP ]);
  }

  if (auth && auth.authStatus === 'expired') {
    header.push([ 'Set-Cookie', 'hash=' + auth.newHash + ';path=/' ]);
  }

  return header;
};

exports.getGlobalRoleLabel = function(role) {

  if (role >= 0 && role <= 3) {
    return lang.miscRoles[role];
  } else {
    return lang.miscRoles[4];
  }

};

exports.getGlobalSettingsData = function(userData, callback) {

  if (userData.globalRole !== 0) {
    callback(lang.errDeniedGlobalSettings);
  } else {
    callback();
  }

};

// Section 1: Global management data {
exports.getAppealedBans = function(userRole, users, reports, callback) {

  if (userRole < 3) {

    bans.find({
      boardUri : {
        $exists : false
      },
      appeal : {
        $exists : true
      },
      denied : {
        $exists : false
      }
    }, {
      reason : 1,
      appeal : 1,
      denied : 1,
      expiration : 1,
      appliedBy : 1
    }).toArray(function gotBans(error, foundBans) {
      callback(error, users, reports, foundBans);
    });

  } else {
    callback(null, users, reports);
  }

};

exports.getReportsAssociations = function(userRole, foundUsers, foundReports,
    callback) {

  reportOps.associateContent(foundReports, function associatedContent(error) {

    if (error) {
      callback(error);
    } else {
      exports.getAppealedBans(userRole, foundUsers, foundReports, callback);
    }

  });

};

exports.getManagementData = function(userRole, userLogin, associateContent,
    callback) {

  var globalStaff = userRole <= MAX_STAFF_ROLE;

  if (!globalStaff) {
    callback(lang.errDeniedGlobalManagement);
  } else {

    users.find({
      login : {
        $ne : userLogin
      },
      globalRole : {
        $gt : userRole,
        $lte : MAX_STAFF_ROLE
      }
    }, {
      _id : 0,
      login : 1,
      globalRole : 1
    }).sort({
      login : 1
    }).toArray(
        function gotUsers(error, foundUsers) {

          if (error) {
            callback(error);
          } else {

            // style exception, too simple
            reports.find({
              global : true,
              closedBy : {
                $exists : false
              }
            }, {
              boardUri : 1,
              reason : 1,
              threadId : 1,
              creation : 1,
              postId : 1
            }).sort({
              creation : -1
            }).toArray(
                function gotReports(error, foundReports) {

                  if (error) {
                    callback(error);
                  } else {
                    if (!associateContent) {
                      exports.getAppealedBans(userRole, foundUsers,
                          foundReports, callback);
                    } else {
                      exports.getReportsAssociations(userRole, foundUsers,
                          foundReports, callback);
                    }
                  }

                });
            // style exception, too simple

          }

        });
  }
};
// } Section 1: Global management data

exports.getRange = function(ip, threeQuarters) {

  if (!ip) {
    return null;
  }

  return ip.slice(0, ip.length * (threeQuarters ? 0.75 : 0.5));

};

exports.getParametersArray = function() {

  return [ {
    // array
    type : 'array',
    setting : 'addons',
    element : 'fieldAddons'
  }, {
    type : 'array',
    setting : 'acceptedMimes',
    element : 'fieldAcceptedMimes'
  }, {
    type : 'array',
    setting : 'slaves',
    element : 'fieldSlaves'
  }, {
    // string
    type : 'string',
    setting : 'address',
    element : 'fieldAddress'
  }, {
    type : 'string',
    setting : 'fePath',
    element : 'fieldFePath'
  }, {
    type : 'string',
    setting : 'master',
    element : 'fieldMaster'
  }, {
    type : 'string',
    setting : 'tempDirectory',
    element : 'fieldTempDir'
  }, {
    type : 'string',
    setting : 'rssDomain',
    element : 'fieldRssDomain'
  }, {
    type : 'string',
    setting : 'sslPass',
    element : 'fieldSslPass'
  }, {
    type : 'string',
    setting : 'emailSender',
    element : 'fieldSenderEmail'
  }, {
    type : 'string',
    setting : 'siteTitle',
    element : 'fieldSiteTitle'
  }, {
    type : 'string',
    setting : 'defaultBanMessage',
    element : 'fieldBanMessage'
  }, {
    type : 'string',
    setting : 'defaultAnonymousName',
    element : 'fieldAnonymousName'
  }, {
    type : 'string',
    setting : 'torSource',
    element : 'fieldTorSource'
  }, {
    type : 'string',
    setting : 'CSP',
    element : 'fieldCSP'
  }, {
    type : 'string',
    setting : 'languagePackPath',
    element : 'fieldLanguagePack'
  }, {
    type : 'string',
    setting : 'overboard',
    element : 'fieldOverboard'
  }, {
    type : 'string',
    setting : 'sfwOverboard',
    element : 'fieldSfwOverboard'
  }, {
    type : 'string',
    setting : 'spamIpsSource',
    element : 'fieldSpamIpsSource'
  }, {
    type : 'string',
    setting : 'thumbExtension',
    element : 'fieldThumbExtension'
  }, {
    // number
    type : 'number',
    setting : 'port',
    element : 'fieldPort'
  }, {
    type : 'number',
    setting : 'globalLatestImages',
    element : 'fieldGlobalLatestImages'
  }, {
    type : 'number',
    setting : 'messageLength',
    element : 'fieldMessageLength'
  }, {
    type : 'number',
    setting : 'ipExpirationDays',
    element : 'fieldIpExpiration'
  }, {
    type : 'number',
    setting : 'inactivityThreshold',
    element : 'fieldInactivityThreshold'
  }, {
    type : 'number',
    setting : 'torPort',
    element : 'fieldTorPort'
  }, {
    type : 'number',
    setting : 'captchaExpiration',
    element : 'fieldCaptchaExpiration'
  }, {
    type : 'number',
    setting : 'overBoardThreadCount',
    element : 'fieldOverBoardThreads'
  }, {
    type : 'number',
    setting : 'pageSize',
    element : 'fieldPageSize'
  }, {
    type : 'number',
    setting : 'latestPostCount',
    element : 'fieldLatestPostsCount'
  }, {
    type : 'number',
    setting : 'autoSageLimit',
    element : 'fieldAutoSageLimit'
  }, {
    type : 'number',
    setting : 'multiboardThreadCount',
    element : 'fieldMultiBoardThreadCount'
  }, {
    type : 'number',
    setting : 'maxThreadCount',
    element : 'fieldThreadLimit'
  }, {
    type : 'number',
    setting : 'maxRequestSizeMB',
    element : 'fieldMaxRequestSize'
  }, {
    type : 'number',
    setting : 'maxFileSizeMB',
    element : 'fieldMaxFileSize'
  }, {
    type : 'number',
    setting : 'maxFiles',
    element : 'fieldMaxFiles'
  }, {
    type : 'number',
    setting : 'bypassDurationHours',
    element : 'fieldBypassHours'
  }, {
    type : 'number',
    setting : 'bypassMaxPosts',
    element : 'fieldBypassPosts'
  }, {
    type : 'number',
    setting : 'topBoardsCount',
    element : 'fieldTopBoardsCount'
  }, {
    type : 'number',
    setting : 'boardsPerPage',
    element : 'fieldBoardsPerPage'
  }, {
    type : 'number',
    setting : 'thumbSize',
    element : 'fieldThumbSize'
  }, {
    type : 'number',
    setting : 'maxBoardRules',
    element : 'fieldMaxRules'
  }, {
    type : 'number',
    setting : 'maxBoardTags',
    element : 'fieldMaxTags'
  }, {
    type : 'number',
    setting : 'maxFilters',
    element : 'fieldMaxFilters'
  }, {
    type : 'number',
    setting : 'maxBoardVolunteers',
    element : 'fieldMaxVolunteers'
  }, {
    type : 'number',
    setting : 'maxBannerSizeKB',
    element : 'fieldMaxBannerSize'
  }, {
    type : 'number',
    setting : 'maxFlagSizeKB',
    element : 'fieldMaxFlagSize'
  }, {
    type : 'number',
    setting : 'floodTimerSec',
    element : 'fieldFloodInterval'
  }, {
    type : 'number',
    setting : 'globalLatestPosts',
    element : 'fieldGlobalLatestPosts'
  }, {
    type : 'number',
    setting : 'concurrentRebuildMessages',
    element : 'fieldConcurrentRebuildMessages'
  }, {
    type : 'number',
    setting : 'mediaPageSize',
    element : 'fieldMediaPageSize'
  }, {
    // boolean
    type : 'boolean',
    setting : 'disable304',
    element : 'checkboxDisable304'
  }, {
    type : 'boolean',
    setting : 'verbose',
    element : 'checkboxVerbose'
  }, {
    type : 'boolean',
    setting : 'onlySfwLatestImages',
    element : 'checkboxSFWLatestImages'
  }, {
    type : 'boolean',
    setting : 'ffmpegGifs',
    element : 'checkboxFfmpegGifs'
  }, {
    type : 'boolean',
    setting : 'autoPruneFiles',
    element : 'checkboxAutoPruneFiles'
  }, {
    type : 'boolean',
    setting : 'useGlobalBanners',
    element : 'checkboxGlobalBanners'
  }, {
    type : 'boolean',
    setting : 'disableFloodCheck',
    element : 'checkboxDisableFloodCheck'
  }, {
    type : 'boolean',
    setting : 'disableSpamCheck',
    element : 'checkboxDisableSpamCheck'
  }, {
    type : 'boolean',
    setting : 'mediaThumb',
    element : 'checkboxMediaThumb'
  }, {
    type : 'boolean',
    setting : 'allowGlobalBoardModeration',
    element : 'checkboxGlobalBoardModeration'
  }, {
    type : 'boolean',
    setting : 'maintenance',
    element : 'checkboxMaintenance'
  }, {
    type : 'boolean',
    setting : 'disableAccountCreation',
    element : 'checkboxDisableAccountCreation'
  }, {
    type : 'boolean',
    setting : 'allowBoardCustomJs',
    element : 'checkboxAllowCustomJs'
  }, {
    type : 'boolean',
    setting : 'multipleReports',
    element : 'checkboxMultipleReports'
  }, {
    type : 'boolean',
    setting : 'ssl',
    element : 'checkboxSsl'
  }, {
    type : 'boolean',
    setting : 'forceCaptcha',
    element : 'checkboxGlobalCaptcha'
  }, {
    type : 'boolean',
    setting : 'allowSpamBypass',
    element : 'checkboxSpamBypass'
  }, {
    type : 'boolean',
    setting : 'frontPageStats',
    element : 'checkboxFrontPageStats'
  }, {
    type : 'boolean',
    setting : 'disableCatalogPosting',
    element : 'checkboxDisableCatalogPosting'
  }, {
    type : 'boolean',
    setting : 'allowTorPosting',
    element : 'checkboxAllowTorPosting'
  }, {
    type : 'boolean',
    setting : 'allowTorFiles',
    element : 'checkboxAllowTorFiles'
  }, {
    type : 'boolean',
    setting : 'useAlternativeLanguages',
    element : 'checkboxUseAlternativeLanguages'
  }, {
    // range
    type : 'range',
    limit : 2,
    options : lang.guiBypassModes,
    setting : 'bypassMode',
    element : 'comboBypassMode'
  }, {
    type : 'range',
    setting : 'clearIpMinRole',
    limit : 3,
    element : 'comboMinClearIpRole',
    options : lang.miscRoles
  }, {
    type : 'range',
    setting : 'boardCreationRequirement',
    limit : 4,
    element : 'comboBoardCreationRequirement',
    options : lang.miscRoles
  } ];
};

exports.sanitizeIp = function(ip) {

  var processedIp = [];

  if (!ip) {
    return processedIp;
  }

  var informedIp = ip.toString().trim().split('.');

  for (var i = 0; i < informedIp.length && i < 8; i++) {

    var part = +informedIp[i];

    if (!isNaN(part) && part <= 255 && part >= 0) {
      processedIp.push(part);
    }
  }

  return processedIp;

};

// start of new settings sanitization
exports.arraysDiff = function(defaultArray, processedArray) {

  if (defaultArray && defaultArray.length === processedArray.length) {

    for (var i = 0; i < defaultArray.length; i++) {
      if (processedArray.indexOf(defaultArray[i]) === -1) {
        return true;
      }
    }

  } else {
    return true;
  }

  return false;

};

exports.processArraySetting = function(item, parameters, newSettings,
    defaultSettings) {

  var processedParameter = parameters[item.setting];

  if (processedParameter && processedParameter.length) {

    if (exports.arraysDiff(defaultSettings[item.setting], processedParameter)) {
      newSettings[item.setting] = processedParameter;
    }
  }
};

exports.processStringSetting = function(item, parameters, defaultSettings,
    newSettings) {

  var processedParameter = parameters[item.setting];

  if (processedParameter) {
    processedParameter = processedParameter.toString().trim();

    if (processedParameter !== defaultSettings[item.setting]) {
      newSettings[item.setting] = processedParameter;
    }
  }

};

exports.processRangeSetting = function(item, parameters, defaultSettings,
    newSettings) {

  var processedParameter = +parameters[item.setting];

  if (processedParameter) {
    if (processedParameter !== defaultSettings[item.setting]) {
      newSettings[item.setting] = processedParameter > item.limit ? item.limit
          : processedParameter;
    }
  }
};

exports.processNumberSetting = function(parameters, defaultSettings, item,
    newSettings) {

  var processedParameter = +parameters[item.setting];

  if (processedParameter) {
    if (processedParameter !== defaultSettings[item.setting]) {
      newSettings[item.setting] = processedParameter;
    }
  }
};

exports.setGlobalSettings = function(userData, parameters, callback) {

  if (userData.globalRole !== 0) {
    callback(lang.errDeniedGlobalSettings);

    return;
  }

  var parametersArray = exports.getParametersArray();

  var newSettings = {};

  var defaultSettings = settingsHandler.getDefaultSettings();

  for (var i = 0; i < parametersArray.length; i++) {
    var item = parametersArray[i];

    var processedParameter;

    switch (item.type) {
    case 'string':
      exports.processStringSetting(item, parameters, defaultSettings,
          newSettings);
      break;

    case 'array':
      exports.processArraySetting(item, parameters, newSettings,
          defaultSettings);
      break;

    case 'boolean':
      if (parameters[item.setting]) {
        newSettings[item.setting] = true;
      }
      break;

    case 'number':
      exports.processNumberSetting(parameters, defaultSettings, item,
          newSettings);

      break;

    case 'range':
      exports.processRangeSetting(item, parameters, defaultSettings,
          newSettings);

      break;
    }
  }

  if (verbose) {
    console.log('New settings: ' + JSON.stringify(newSettings, null, 2));
  }

  settingsHandler.setNewSettings(newSettings, callback);

};
// end of new settings sanitization
