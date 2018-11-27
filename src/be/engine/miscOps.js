'use strict';

// miscellaneous operations

var settingsHandler = require('../settingsHandler');
var verbose;
var db = require('../db');
var bans = db.bans();
var crypto = require('crypto');
var fs = require('fs');
var users = db.users();
var reports = db.reports();
var reportOps;
var formOps;
var omitUnindexed;
var CSP;
var globalBoardModeration;
var lang;
var sender;
var ssl;
var clearIpMinRole;
var settingsRelation;
var mailer;

var MAX_STAFF_ROLE = 3;
exports.plainTextMimes = [ 'application/x-javascript', 'application/json',
    'application/rss+xml' ];
exports.optionList = [ 'guiBypassModes', 'guiTorPostingLevels', 'miscRoles',
    'miscRoles', 'guiBypassModes' ];

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();

  ssl = settings.ssl;
  sender = settings.emailSender;
  globalBoardModeration = settings.allowGlobalBoardModeration;
  CSP = settings.CSP;
  clearIpMinRole = settings.clearIpMinRole;
  omitUnindexed = settings.omitUnindexedContent;
  verbose = settings.verbose || settings.verboseMisc;

  mailer = require('nodemailer').createTransport(settings.useSendmail ? {
    sendmail : true
  } : require('nodemailer-direct-transport')());

};

exports.htmlReplaceTable = {
  '<' : '&lt;',
  '>' : '&gt;'
};

exports.loadDependencies = function() {

  formOps = require('./formOps');
  reportOps = require('./modOps').report;
  lang = require('./langOps').languagePack;

  fs.readFile(__dirname + '/../data/settingsRelation.json', function read(
      error, data) {

    if (error) {
      console.log(error);
      return;
    }

    settingsRelation = data.toString('utf8');

  });

};

exports.sendMail = function(subject, content, recipient, callback) {

  var data = {
    from : sender,
    subject : subject,
    html : content
  };

  if (Array.isArray(recipient)) {
    data.bcc = recipient.join(', ');
  } else {
    data.to = recipient;
  }

  mailer.sendMail(data, callback);

};

exports.omitted = function(boardData) {

  var settings = boardData.settings || [];

  if (settings.indexOf('unindex') === -1) {
    return false;
  } else {
    return omitUnindexed;
  }

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

  if (!mime.indexOf('text/') || exports.plainTextMimes.indexOf(mime) > -1) {
    return true;
  }

};

exports.convertHeader = function(header) {

  var finalHeader = {};

  for (var i = 0; i < header.length; i++) {

    var key = header[i][0];
    var value = header[i][1];

    finalHeader[key] = finalHeader[key] || [];

    finalHeader[key].push(value);

  }

  return finalHeader;

};

exports.setCookies = function(header, cookies) {

  for (var i = 0; i < cookies.length; i++) {
    var cookie = cookies[i];

    var toPush = [ 'Set-Cookie', cookie.field + '=' + cookie.value ];

    if (cookie.expiration) {
      toPush[1] += '; expires=' + cookie.expiration.toUTCString();
    }

    if (cookie.path) {
      toPush[1] += '; path=' + cookie.path;
    }

    header.push(toPush);

  }

};

exports.getHeader = function(contentType, auth, header, cookies) {

  header = header || [];

  if (cookies) {
    exports.setCookies(header, cookies);
  }

  if (ssl) {
    header.push([ 'Strict-Transport-Security', 'max-age=31536000' ]);
  }

  if (contentType) {
    var isPlainText = exports.isPlainText(contentType);
    header.push([ 'Content-Type',
        contentType + (isPlainText ? '; charset=utf-8' : '') ]);
  }

  if (CSP) {
    header.push([ 'Content-Security-Policy', CSP ]);
  }

  if (auth && auth.authStatus === 'expired') {

    var cookieString = 'hash=' + auth.newHash + '; path=/; expires=';
    cookieString += auth.expiration.toUTCString();

    header.push([ 'Set-Cookie', cookieString ]);

  }

  return exports.convertHeader(header);

};

exports.getGlobalRoleLabel = function(role, language) {

  if (role >= 0 && role <= 3) {
    return lang(language).miscRoles[role];
  } else {
    return lang(language).miscRoles[4];
  }

};

exports.getGlobalSettingsData = function(userData, language, callback) {

  if (userData.globalRole !== 0) {
    callback(lang(language).errDeniedGlobalSettings);
  } else {
    callback();
  }

};

// Section 1: Global management data {
exports.getAppealedBans = function(userRole, users, reports, callback) {

  if (userRole < 3) {

    var query = {
      appeal : {
        $exists : true
      },
      denied : {
        $exists : false
      }
    };

    if (!globalBoardModeration) {

      query.boardUri = {
        $exists : false
      };
    }

    bans.find(query, {
      projection : {
        reason : 1,
        appeal : 1,
        boardUri : 1,
        denied : 1,
        expiration : 1,
        appliedBy : 1
      }
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

exports.getManagementData = function(userRole, language, userLogin,
    associateContent, callback) {

  var globalStaff = userRole <= MAX_STAFF_ROLE;

  if (!globalStaff) {
    callback(lang(language).errDeniedGlobalManagement);
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
      projection : {
        _id : 0,
        login : 1,
        globalRole : 1
      }
    }).sort({
      login : 1
    }).toArray(
        function gotUsers(error, foundUsers) {

          if (error) {
            callback(error);
          } else {

            var query = {
              closedBy : {
                $exists : false
              }
            };

            if (!globalBoardModeration) {
              query.global = true;
            }

            // style exception, too simple
            reports.find(query, {
              projection : {
                boardUri : 1,
                reason : 1,
                threadId : 1,
                creation : 1,
                postId : 1
              }
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

exports.getParametersArray = function(language) {

  var toRet = JSON.parse(settingsRelation);

  for (var i = 0; i < exports.optionList.length; i++) {
    toRet[i].options = lang(language)[exports.optionList[i]];
  }

  return toRet;

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

  defaultArray = defaultArray || [];
  processedArray = processedArray || [];

  if (defaultArray.length === processedArray.length) {

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

    var diff = exports.arraysDiff(defaultSettings[item.setting],
        processedParameter);

    if (!defaultSettings[item.setting] || diff) {
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

  var exception = settingsHandler.isZeroException(item.setting,
      processedParameter);

  if (processedParameter || exception) {
    if (processedParameter !== defaultSettings[item.setting]) {
      newSettings[item.setting] = processedParameter > item.limit ? item.limit
          : processedParameter;
    }
  }
};

exports.processNumberSetting = function(parameters, defaultSettings, item,
    newSettings) {

  var processedParameter = +parameters[item.setting];

  var exception = settingsHandler.isZeroException(item.setting,
      processedParameter);

  if (processedParameter || exception) {
    if (processedParameter !== defaultSettings[item.setting]) {
      newSettings[item.setting] = processedParameter;
    }
  }
};

exports.setGlobalSettings = function(userData, language, parameters, callback) {

  if (userData.globalRole !== 0) {
    callback(lang(language).errDeniedGlobalSettings);

    return;
  }

  var parametersArray = exports.getParametersArray(language);

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

  settingsHandler.setNewSettings(newSettings, language, callback);

};
// end of new settings sanitization
