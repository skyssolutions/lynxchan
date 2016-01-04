'use strict';

// miscellaneous operations

var settingsHandler = require('../settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var verbose = settings.verbose;
var db = require('../db');
var bans = db.bans();
var crypto = require('crypto');
var users = db.users();
var reports = db.reports();
var formOps;
var lang;

var MAX_STAFF_ROLE = 3;

exports.MIMETYPES = {
  a : 'application/octet-stream',
  ai : 'application/postscript',
  aif : 'audio/x-aiff',
  aifc : 'audio/x-aiff',
  aiff : 'audio/x-aiff',
  au : 'audio/basic',
  avi : 'video/x-msvideo',
  bat : 'text/plain',
  bin : 'application/octet-stream',
  bmp : 'image/x-ms-bmp',
  c : 'text/plain',
  cdf : 'application/x-cdf',
  csh : 'application/x-csh',
  css : 'text/css',
  dll : 'application/octet-stream',
  doc : 'application/msword',
  dot : 'application/msword',
  dvi : 'application/x-dvi',
  eml : 'message/rfc822',
  eps : 'application/postscript',
  etx : 'text/x-setext',
  exe : 'application/octet-stream',
  gif : 'image/gif',
  gtar : 'application/x-gtar',
  h : 'text/plain',
  hdf : 'application/x-hdf',
  htm : 'text/html',
  html : 'text/html',
  jpe : 'image/jpeg',
  jpeg : 'image/jpeg',
  jpg : 'image/jpeg',
  js : 'application/x-javascript',
  ksh : 'text/plain',
  latex : 'application/x-latex',
  m1v : 'video/mpeg',
  man : 'application/x-troff-man',
  me : 'application/x-troff-me',
  mht : 'message/rfc822',
  mhtml : 'message/rfc822',
  mif : 'application/x-mif',
  mov : 'video/quicktime',
  movie : 'video/x-sgi-movie',
  mp2 : 'audio/mpeg',
  mp3 : 'audio/mpeg',
  mp4 : 'video/mp4',
  mpa : 'video/mpeg',
  mpe : 'video/mpeg',
  mpeg : 'video/mpeg',
  mpg : 'video/mpeg',
  ms : 'application/x-troff-ms',
  nc : 'application/x-netcdf',
  nws : 'message/rfc822',
  o : 'application/octet-stream',
  obj : 'application/octet-stream',
  oda : 'application/oda',
  ogg : 'audio/ogg',
  ogv : 'video/ogg',
  pbm : 'image/x-portable-bitmap',
  pdf : 'application/pdf',
  pfx : 'application/x-pkcs12',
  pgm : 'image/x-portable-graymap',
  png : 'image/png',
  pnm : 'image/x-portable-anymap',
  pot : 'application/vnd.ms-powerpoint',
  ppa : 'application/vnd.ms-powerpoint',
  ppm : 'image/x-portable-pixmap',
  pps : 'application/vnd.ms-powerpoint',
  ppt : 'application/vnd.ms-powerpoint',
  pptx : 'application/vnd.ms-powerpoint',
  ps : 'application/postscript',
  pwz : 'application/vnd.ms-powerpoint',
  py : 'text/x-python',
  pyc : 'application/x-python-code',
  pyo : 'application/x-python-code',
  qt : 'video/quicktime',
  ra : 'audio/x-pn-realaudio',
  ram : 'application/x-pn-realaudio',
  ras : 'image/x-cmu-raster',
  rdf : 'application/xml',
  rgb : 'image/x-rgb',
  roff : 'application/x-troff',
  rtx : 'text/richtext',
  sgm : 'text/x-sgml',
  sgml : 'text/x-sgml',
  sh : 'application/x-sh',
  shar : 'application/x-shar',
  snd : 'audio/basic',
  so : 'application/octet-stream',
  src : 'application/x-wais-source',
  swf : 'application/x-shockwave-flash',
  t : 'application/x-troff',
  tar : 'application/x-tar',
  tcl : 'application/x-tcl',
  tex : 'application/x-tex',
  texi : 'application/x-texinfo',
  texinfo : 'application/x-texinfo',
  tif : 'image/tiff',
  tiff : 'image/tiff',
  tr : 'application/x-troff',
  tsv : 'text/tab-separated-values',
  txt : 'text/plain',
  ustar : 'application/x-ustar',
  vcf : 'text/x-vcard',
  wav : 'audio/x-wav',
  webm : 'video/webm',
  wiz : 'application/msword',
  wsdl : 'application/xml',
  xbm : 'image/x-xbitmap',
  xlb : 'application/vnd.ms-excel',
  xls : 'application/vnd.ms-excel',
  xlsx : 'application/vnd.ms-excel',
  xml : 'text/xml',
  xpdl : 'application/xml',
  xpm : 'image/x-xpixmap',
  xsl : 'application/xml',
  xwd : 'image/x-xwindowdump',
  zip : 'application/zip'
};

exports.htmlReplaceTable = {
  '<' : '&lt;',
  '>' : '&gt;'
};

exports.loadDependencies = function() {

  formOps = require('./formOps');
  lang = require('./langOps').languagePack();

};

exports.getRandomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

exports.getMaxStaffRole = function() {
  return MAX_STAFF_ROLE;
};

exports.getMime = function(pathName) {

  var pathParts = pathName.split('.');

  var mime;

  if (pathParts.length) {
    var extension = pathParts[pathParts.length - 1];
    mime = exports.MIMETYPES[extension.toLowerCase()] || 'text/plain';

  } else {
    mime = 'text/plain';
  }

  return mime;
};

exports.hashIpForDisplay = function(ip, salt, userRole) {

  if (userRole <= settings.clearIpMinRole) {
    return ip.join('.');
  }

  return crypto.createHash('sha256').update(salt + ip).digest('hex');

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

// It uses the provided contentType and builds a header ready for CORS.
// Currently it just allows everything.
exports.corsHeader = function(contentType, auth) {

  var header = [ [ 'Content-Type', contentType ],
      [ 'access-control-allow-origin', '*' ] ];

  if (auth && auth.authStatus === 'expired') {
    header.push([ 'Set-Cookie', 'hash=' + auth.newHash ]);
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
exports.getAppealedBans = function(users, reports, callback) {

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

};

exports.getManagementData = function(userRole, userLogin, callback) {

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
    }).toArray(function gotUsers(error, users) {

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
        }).toArray(function(gotReportserror, reports) {
          if (error) {
            callback(error);
          } else {

            if (userRole < 3) {
              exports.getAppealedBans(users, reports, callback);
            } else {
              callback(null, users, reports);

            }
          }
        });
      }
      // style exception, too simple

    });
  }
};
// } Section 1: Global management data

exports.getRange = function(ip) {

  return ip ? ip.slice(0, ip.length / 2) : null;

};

exports.getParametersArray = function() {

  return [ {
    // array
    param : 'addons',
    type : 'array',
    setting : 'addons',
    element : 'fieldAddons'
  }, {
    param : 'acceptedMimes',
    type : 'array',
    setting : 'acceptedMimes',
    element : 'fieldAcceptedMimes'
  }, {
    // string
    param : 'address',
    type : 'string',
    setting : 'address',
    element : 'fieldAddress'
  }, {
    param : 'fePath',
    type : 'string',
    setting : 'fePath',
    element : 'fieldFePath'
  }, {
    param : 'tempDir',
    type : 'string',
    setting : 'tempDirectory',
    element : 'fieldTempDir'
  }, {
    param : 'rssDomain',
    type : 'string',
    setting : 'rssDomain',
    element : 'fieldRssDomain'
  }, {
    param : 'sslPass',
    type : 'string',
    setting : 'sslPass',
    element : 'fieldSslPass'
  }, {
    param : 'senderEmail',
    type : 'string',
    setting : 'emailSender',
    element : 'fieldSenderEmail'
  }, {
    param : 'siteTitle',
    type : 'string',
    setting : 'siteTitle',
    element : 'fieldSiteTitle'
  }, {
    param : 'banMessage',
    type : 'string',
    setting : 'defaultBanMessage',
    element : 'fieldBanMessage'
  }, {
    param : 'anonymousName',
    type : 'string',
    setting : 'defaultAnonymousName',
    element : 'fieldAnonymousName'
  }, {
    param : 'torSource',
    type : 'string',
    setting : 'torSource',
    element : 'fieldTorSource'
  }, {
    param : 'languagePack',
    type : 'string',
    setting : 'languagePackPath',
    element : 'fieldLanguagePack'
  }, {
    param : 'overboard',
    type : 'string',
    setting : 'overboard',
    element : 'fieldOverboard'
  }, {
    param : 'thumbExtension',
    type : 'string',
    setting : 'thumbExtension',
    element : 'fieldThumbExtension'
  }, {
    // number
    param : 'port',
    type : 'number',
    setting : 'port',
    element : 'fieldPort'
  }, {
    param : 'globalLatestImages',
    type : 'number',
    setting : 'globalLatestImages',
    element : 'fieldGlobalLatestImages'
  }, {
    param : 'captchaExpiration',
    type : 'number',
    setting : 'captchaExpiration',
    element : 'fieldCaptchaExpiration'
  }, {
    param : 'overBoardThreadCount',
    type : 'number',
    setting : 'overBoardThreadCount',
    element : 'fieldOverBoardThreads'
  }, {
    param : 'boardPageSize',
    type : 'number',
    setting : 'pageSize',
    element : 'fieldPageSize'
  }, {
    param : 'latestPostsCount',
    type : 'number',
    setting : 'latestPostCount',
    element : 'fieldLatestPostsCount'
  }, {
    param : 'autoSageLimit',
    type : 'number',
    setting : 'autoSageLimit',
    element : 'fieldAutoSageLimit'
  }, {
    param : 'multiboardThreadCount',
    type : 'number',
    setting : 'multiboardThreadCount',
    element : 'fieldMultiBoardThreadCount'
  }, {
    param : 'threadLimit',
    type : 'number',
    setting : 'maxThreadCount',
    element : 'fieldThreadLimit'
  }, {
    param : 'maxRequestSize',
    type : 'number',
    setting : 'maxRequestSizeMB',
    element : 'fieldMaxRequestSize'
  }, {
    param : 'maxFileSize',
    type : 'number',
    setting : 'maxFileSizeMB',
    element : 'fieldMaxFileSize'
  }, {
    param : 'maxFiles',
    type : 'number',
    setting : 'maxFiles',
    element : 'fieldMaxFiles'
  }, {
    param : 'bypassDurationHours',
    type : 'number',
    setting : 'bypassDurationHours',
    element : 'fieldBypassHours'
  }, {
    param : 'bypassMaxPosts',
    type : 'number',
    setting : 'bypassMaxPosts',
    element : 'fieldBypassPosts'
  }, {
    param : 'topBoardsCount',
    type : 'number',
    setting : 'topBoardsCount',
    element : 'fieldTopBoardsCount'
  }, {
    param : 'boardsPerPage',
    type : 'number',
    setting : 'boardsPerPage',
    element : 'fieldBoardsPerPage'
  }, {
    param : 'thumbSize',
    type : 'number',
    setting : 'thumbSize',
    element : 'fieldThumbSize'
  }, {
    param : 'maxRules',
    type : 'number',
    setting : 'maxBoardRules',
    element : 'fieldMaxRules'
  }, {
    param : 'maxTags',
    type : 'number',
    setting : 'maxBoardTags',
    element : 'fieldMaxTags'
  }, {
    param : 'maxFilters',
    type : 'number',
    setting : 'maxFilters',
    element : 'fieldMaxFilters'
  }, {
    param : 'maxVolunteers',
    type : 'number',
    setting : 'maxBoardVolunteers',
    element : 'fieldMaxVolunteers'
  }, {
    param : 'maxBannerSize',
    type : 'number',
    setting : 'maxBannerSizeKB',
    element : 'fieldMaxBannerSize'
  }, {
    param : 'maxFlagSize',
    type : 'number',
    setting : 'maxFlagSizeKB',
    element : 'fieldMaxFlagSize'
  }, {
    param : 'floodInterval',
    type : 'number',
    setting : 'floodTimerSec',
    element : 'fieldFloodInterval'
  }, {
    param : 'globalLatestPosts',
    type : 'number',
    setting : 'globalLatestPosts',
    element : 'fieldGlobalLatestPosts'
  }, {
    param : 'concurrentRebuildMessages',
    type : 'number',
    setting : 'concurrentRebuildMessages',
    element : 'fieldConcurrentRebuildMessages'
  }, {
    // boolean
    param : 'disable304',
    type : 'boolean',
    setting : 'disable304',
    element : 'checkboxDisable304'
  }, {
    param : 'verbose',
    type : 'boolean',
    setting : 'verbose',
    element : 'checkboxVerbose'
  }, {
    param : 'forceCaptcha',
    type : 'boolean',
    setting : 'forceCaptcha',
    element : 'checkboxGlobalCaptcha'
  }, {
    param : 'useGlobalBanners',
    type : 'boolean',
    setting : 'useGlobalBanners',
    element : 'checkboxGlobalBanners'
  }, {
    param : 'disableFloodCheck',
    type : 'boolean',
    setting : 'disableFloodCheck',
    element : 'checkboxDisableFloodCheck'
  }, {
    param : 'mediaThumb',
    type : 'boolean',
    setting : 'mediaThumb',
    element : 'checkboxMediaThumb'
  }, {
    param : 'allowGlobalBoardModeration',
    type : 'boolean',
    setting : 'allowGlobalBoardModeration',
    element : 'checkboxGlobalBoardModeration'
  }, {
    param : 'maintenance',
    type : 'boolean',
    setting : 'maintenance',
    element : 'checkboxMaintenance'
  }, {
    param : 'disableAccountCreation',
    type : 'boolean',
    setting : 'disableAccountCreation',
    element : 'checkboxDisableAccountCreation'
  }, {
    param : 'allowBoardCustomJs',
    type : 'boolean',
    setting : 'allowBoardCustomJs',
    element : 'checkboxAllowCustomJs'
  }, {
    param : 'multipleReports',
    type : 'boolean',
    setting : 'multipleReports',
    element : 'checkboxMultipleReports'
  }, {
    param : 'serveArchive',
    type : 'boolean',
    setting : 'serveArchive',
    element : 'checkboxServeArchive'
  }, {
    param : 'ssl',
    type : 'boolean',
    setting : 'ssl',
    element : 'checkboxSsl'
  }, {
    // range
    param : 'bypassMode',
    type : 'range',
    limit : 2,
    options : lang.guiBypassModes,
    setting : 'bypassMode',
    element : 'comboBypassMode'
  }, {
    param : 'torAccess',
    type : 'range',
    limit : 2,
    setting : 'torAccess',
    element : 'comboTorAccess',
    options : lang.guiTorLevels
  }, {
    param : 'archiveLevel',
    type : 'range',
    setting : 'archiveLevel',
    limit : 2,
    element : 'comboArchive',
    options : lang.guiArchiveLevels
  }, {
    param : 'clearIpMinRole',
    type : 'range',
    setting : 'clearIpMinRole',
    limit : 3,
    element : 'comboMinClearIpRole',
    options : lang.miscRoles
  }, {
    param : 'boardCreationRequirement',
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

  var processedParameter = parameters[item.param];

  if (processedParameter && processedParameter.length) {

    if (exports.arraysDiff(defaultSettings[item.setting], processedParameter)) {
      newSettings[item.setting] = processedParameter;
    }
  }
};

exports.processStringSetting = function(item, parameters, defaultSettings,
    newSettings) {

  var processedParameter = parameters[item.param];

  if (processedParameter) {
    processedParameter = processedParameter.toString().trim();

    if (processedParameter !== defaultSettings[item.setting]) {
      newSettings[item.setting] = processedParameter;
    }
  }

};

exports.processRangeSetting = function(item, parameters, defaultSettings,
    newSettings) {

  var processedParameter = +parameters[item.param];

  if (processedParameter) {
    if (processedParameter !== defaultSettings[item.setting]) {
      newSettings[item.setting] = processedParameter > item.limit ? item.limit
          : processedParameter;
    }
  }
};

exports.processNumberSetting = function(parameters, defaultSettings, item,
    newSettings) {

  var processedParameter = +parameters[item.param];

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
      if (parameters[item.param]) {
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
