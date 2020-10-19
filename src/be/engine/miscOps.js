'use strict';

// miscellaneous operations

var settingsHandler = require('../settingsHandler');
var verbose;
var db = require('../db');
var bans = db.bans();
var boards = db.boards();
var crypto = require('crypto');
var fs = require('fs');
var users = db.users();
var reports = db.reports();
var formOps;
var reportOps;
var omitUnindexed;
var CSP;
var globalBoardModeration;
var lang;
var sender;
var ssl;
var disableEmail;
var clearIpMinRole;
var settingsRelation;
var mailer;

var htmlReplaceTable = {
  '<' : '&lt;',
  '>' : '&gt;',
  '\"' : '&quot;',
  '\'' : '&apos;',
  '\u202E' : ''
};

var htmlReplaceRegex = new RegExp(/[\u202E<>'"]/g);

var MAX_STAFF_ROLE = 3;
exports.plainTextMimes = [ 'application/x-javascript', 'application/json',
    'application/rss+xml' ];
exports.optionList = [ 'guiBypassModes', 'guiPruningModes',
    'guiTorPostingLevels', 'miscRoles', 'miscRoles', 'guiBypassModes',
    'guiCaptchaSecurity' ];
exports.individualCaches = {
  innerCache : 1,
  outerCache : 1,
  previewCache : 1,
  clearCache : 1,
  alternativeCaches : 1,
  hashedCache : 1,
  previewHashedCache : 1,
  outerHashedCache : 1,
  outerClearCache : 1
};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();

  ssl = settings.ssl;
  sender = settings.emailSender;
  disableEmail = settings.disableEmail;
  globalBoardModeration = settings.allowGlobalBoardModeration;
  CSP = settings.CSP;
  clearIpMinRole = settings.clearIpMinRole;
  omitUnindexed = settings.omitUnindexedContent;
  verbose = settings.verbose || settings.verboseMisc;

  mailer = require('nodemailer').createTransport(settings.useSendmail ? {
    sendmail : true
  } : require('nodemailer-direct-transport')());

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

exports.cleanHTML = function(string) {

  return string.replace(htmlReplaceRegex, function(match) {
    return htmlReplaceTable[match];
  });

};

exports.sendMail = function(subject, content, recipient, callback) {

  if (disableEmail) {
    return callback();
  }

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

exports.formatIpv6 = function(ip) {

  var joinedIp = [];

  for (var i = 0; i < ip.length / 2; i++) {

    var index = i * 2;

    if (!ip[index] && !ip[index + 1]) {
      joinedIp[i] = '0';
      continue;
    }

    if (!ip[index]) {
      joinedIp[i] = ip[index + 1].toString(16);
    } else if (!ip[index + 1]) {
      joinedIp[i] = ip[index].toString(16) + '00';
    } else {
      var secondPart = (ip[index + 1] > 15 ? '' : '0');

      secondPart += ip[index + 1].toString(16);

      joinedIp[i] = ip[index].toString(16) + secondPart;
    }

  }

  return joinedIp.join(':').replace(/\b:?(?:0+:?){2,}/, '::');

};

exports.formatIp = function(ip, ipv6) {

  if (ip.length > 4 || ipv6) {
    return exports.formatIpv6(ip);
  } else {
    return ip.join('.');
  }

};

exports.hashIpForDisplay = function(ip, salt, userRole, ipv6) {

  if (userRole <= clearIpMinRole) {
    return exports.formatIp(ip, ipv6);
  }

  if (!salt) {
    console.log('WARNING, NO SALT FOR IP HASHING');
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
        object[parameter.field] = exports.cleanHTML(object[parameter.field]);
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
    cookieString += auth.expiration;

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
exports.getOpenReportsCount = function(foundUsers, userData, foundBans,
    callback) {

  reports.countDocuments(reportOps.getQueryBlock({}, userData), function(error,
      count) {
    callback(error, foundUsers, foundBans, count);
  });

};

exports.getAppealedBansCount = function(userData, foundUsers, callback) {

  var query = {
    appeal : {
      $exists : true
    },
    denied : {
      $exists : false
    }
  };

  if (!globalBoardModeration) {
    query.boardUri = null;
  }

  bans.countDocuments(query, function gotBans(error, foundBans) {

    if (error) {
      callback(error);
    } else {
      exports.getOpenReportsCount(foundUsers, userData, foundBans, callback);
    }

  });

};

exports.getManagementData = function(userData, language, callback) {

  var globalStaff = userData.globalRole <= MAX_STAFF_ROLE;

  if (!globalStaff) {
    return callback(lang(language).errDeniedGlobalManagement);
  }

  users.find({
    login : {
      $ne : userData.login
    },
    globalRole : {
      $gt : userData.globalRole,
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
  }).toArray(function gotUsers(error, foundUsers) {

    if (error) {
      callback(error);
    } else {
      exports.getAppealedBansCount(userData, foundUsers, callback);
    }

  });

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
