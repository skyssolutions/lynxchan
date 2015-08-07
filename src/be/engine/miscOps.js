'use strict';

// miscellaneous
var settings = require('../boot').getGeneralSettings();
var verbose = settings.verbose;
var formOps = require('./formOps');
var db = require('../db');
var users = db.users();
var boot = require('../boot');
var lang = require('./langOps').languagePack();
var reports = db.reports();

var MAX_STAFF_ROLE = 3;

var MIMETYPES = {
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

var replaceTable = {
  '<' : '&lt;',
  '>' : '&gt;'
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
    mime = MIMETYPES[extension.toLowerCase()] || 'text/plain';

  } else {
    mime = 'text/plain';
  }

  return mime;
};

// parameters must be an array of objects. each object must contain two keys:
// one with a string with the name of the parameter, the other with a number
// with its maximum length
function sanitizeParameter(object, parameter) {

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
              return replaceTable[match];
            });
      }

    }
  }
}

exports.sanitizeStrings = function(object, parameters) {

  for (var i = 0; i < parameters.length; i++) {

    var parameter = parameters[i];

    sanitizeParameter(object, parameter);

  }

};

// It uses the provided contentType and builds a header ready for CORS.
// Currently it just allows everything.
exports.corsHeader = function(contentType) {
  return [ [ 'Content-Type', contentType ],
      [ 'access-control-allow-origin', '*' ] ];
};

exports.getGlobalRoleLabel = function(role) {

  switch (role) {
  case 0:
    return lang.miscRoleRoot;
  case 1:
    return lang.miscRoleAdmin;
  case 2:
    return lang.miscRoleGlobalVolunteer;
  case 3:
    return lang.miscRoleGlobalJanitor;
  default:
    return lang.miscRoleUser;
  }

};

exports.getGlobalSettingsData = function(userData, callback) {

  if (userData.globalRole !== 0) {
    callback(lang.errDeniedGlobalSettings);
  } else {
    callback(null, settings);
  }

};

exports.getManagementData = function(userRole, userLogin, callback) {

  if (userRole > MAX_STAFF_ROLE) {

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
        }).sort({
          creation : -1
        }).toArray(function(gotReportserror, reports) {
          callback(error, users, reports);
        });
      }
      // style exception, too simple

    });
  }
};

exports.getRange = function(ip) {

  return ip ? ip.match(/(\d+.\d+).\d+.\d+/)[1] : null;

};

function getParametersArray() {

  return [ {
    param : 'address',
    type : 'string',
    setting : 'address'
  }, {
    param : 'port',
    type : 'number',
    setting : 'port'
  }, {
    param : 'fePath',
    type : 'string',
    setting : 'fePath'
  }, {
    param : 'boardPageSize',
    type : 'number',
    setting : 'pageSize'
  }, {
    param : 'latestPostsCount',
    type : 'number',
    setting : 'latestPostCount'
  }, {
    param : 'autoSageLimit',
    type : 'number',
    setting : 'autoSageLimit'
  }, {
    param : 'threadLimit',
    type : 'number',
    setting : 'maxThreadCount'
  }, {
    param : 'tempDir',
    type : 'string',
    setting : 'tempDirectory'
  }, {
    param : 'senderEmail',
    type : 'string',
    setting : 'emailSender'
  }, {
    param : 'captchaExpiration',
    type : 'number',
    setting : 'captchaExpiration'
  }, {
    param : 'captchaFonts',
    type : 'array',
    setting : 'captchaFonts'
  }, {
    param : 'siteTitle',
    type : 'string',
    setting : 'siteTitle'
  }, {
    param : 'maxRequestSize',
    type : 'number',
    setting : 'maxRequestSizeMB'
  }, {
    param : 'maxFileSize',
    type : 'number',
    setting : 'maxFileSizeMB'
  }, {
    param : 'acceptedMimes',
    type : 'array',
    setting : 'acceptedMimes'
  }, {
    param : 'maxFiles',
    type : 'number',
    setting : 'maxFiles'
  }, {
    param : 'banMessage',
    type : 'string',
    setting : 'defaultBanMessage'
  }, {
    param : 'logPageSize',
    type : 'number',
    setting : 'logPageSize'
  }, {
    param : 'anonymousName',
    type : 'string',
    setting : 'defaultAnonymousName'
  }, {
    param : 'topBoardsCount',
    type : 'number',
    setting : 'topBoardsCount'
  }, {
    param : 'boardsPerPage',
    type : 'number',
    setting : 'boardsPerPage'
  }, {
    param : 'torSource',
    type : 'string',
    setting : 'torSource'
  }, {
    param : 'languagePack',
    type : 'string',
    setting : 'languagePackPath'
  }, {
    param : 'thumbSize',
    type : 'number',
    setting : 'thumbSize'
  }, {
    param : 'maxRules',
    type : 'number',
    setting : 'maxBoardRules'
  }, {
    param : 'maxFilters',
    type : 'number',
    setting : 'maxFilters'
  }, {
    param : 'maxVolunteers',
    type : 'number',
    setting : 'maxBoardVolunteers'
  }, {
    param : 'maxBannerSize',
    type : 'number',
    setting : 'maxBannerSizeKB'
  }, {
    param : 'maxFlagSize',
    type : 'number',
    setting : 'maxFlagSizeKB'
  }, {
    param : 'floodInterval',
    type : 'number',
    setting : 'floodTimerSec'
  }, {
    param : 'disable304',
    type : 'boolean',
    setting : 'disable304'
  }, {
    param : 'verbose',
    type : 'boolean',
    setting : 'verbose'
  }, {
    param : 'blockTor',
    type : 'boolean',
    setting : 'blockTor'
  }, {
    param : 'mediaThumb',
    type : 'boolean',
    setting : 'mediaThumb'
  }, {
    param : 'maintenance',
    type : 'boolean',
    setting : 'maintenance'
  }, {
    param : 'disableAccountCreation',
    type : 'boolean',
    setting : 'disableAccountCreation'
  }, {
    param : 'retrictBoardCreation',
    type : 'boolean',
    setting : 'restrictBoardCreation'
  }, {
    param : 'multipleReports',
    type : 'boolean',
    setting : 'multipleReports'
  }, {
    param : 'ssl',
    type : 'boolean',
    setting : 'ssl'
  }, {
    param : 'serveArchive',
    type : 'boolean',
    setting : 'serveArchive'
  }, {
    param : 'archiveLevel',
    type : 'range',
    setting : 'archiveLevel',
    limit : 2
  } ];
}

function arraysDif(defaultArray, processedArray) {

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

}

function processArraySetting(item, parameters, newSettings, defaultSettings) {

  var processedParameter = parameters[item.param];

  if (processedParameter.length) {

    if (arraysDif(defaultSettings[item.setting], processedParameter)) {
      newSettings[item.setting] = processedParameter;
    }
  }
}

function processStringSetting(item, parameters, defaultSettings, newSettings) {

  var processedParameter = parameters[item.param];

  if (processedParameter) {
    processedParameter = processedParameter.toString().trim();

    if (processedParameter !== defaultSettings[item.setting]) {
      newSettings[item.setting] = processedParameter;
    }
  }

}

function processRangeSetting(item, parameters, defaultSettings, newSettings) {

  var processedParameter = +parameters[item.param];

  if (processedParameter) {
    if (processedParameter !== defaultSettings[item.setting]) {
      newSettings[item.setting] = processedParameter > item.limit ? item.limit
          : processedParameter;
    }
  }
}

function processNumberSetting(parameters, defaultSettings, item, newSettings) {

  var processedParameter = +parameters[item.param];

  if (processedParameter) {
    if (processedParameter !== defaultSettings[item.setting]) {
      newSettings[item.setting] = processedParameter;
    }
  }
}

exports.setGlobalSettings = function(userData, parameters, callback) {

  if (userData.globalRole !== 0) {
    callback(lang.errDeniedGlobalSettings);

    return;
  }

  var parametersArray = getParametersArray();

  var newSettings = {};

  var defaultSettings = boot.getDefaultSettings();

  for (var i = 0; i < parametersArray.length; i++) {
    var item = parametersArray[i];

    var processedParameter;

    switch (item.type) {
    case 'string':
      processStringSetting(item, parameters, defaultSettings, newSettings);
      break;

    case 'array':
      processArraySetting(item, parameters, newSettings, defaultSettings);
      break;

    case 'boolean':
      if (parameters[item.param]) {
        newSettings[item.setting] = true;
      }
      break;

    case 'number':
      processNumberSetting(parameters, defaultSettings, item, newSettings);

      break;

    case 'range':
      processRangeSetting(item, parameters, defaultSettings, newSettings);

      break;
    }
  }

  if (verbose) {
    console.log('New settings: ' + JSON.stringify(newSettings, null, 2));
  }

  boot.setNewSettings(newSettings, callback);

};