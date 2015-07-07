'use strict';

// miscellaneous
var verbose = require('../boot').getGeneralSettings().verbose;
var formOps = require('./formOps');
var db = require('../db');
var users = db.users();
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

exports.getMime = function getHeader(pathName) {

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
    return 'Root';
  case 1:
    return 'Admin';
  case 2:
    return 'Global volunteer';
  case 3:
    return 'Global janitor';
  default:
    return 'User';
  }

};

exports.getManagementData = function(userRole, userLogin, callback) {

  if (userRole > MAX_STAFF_ROLE) {

    var error = 'Your global role does not allow you';

    callback(error + ' to retrieve this information.');

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