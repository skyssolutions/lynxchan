'use strict';

var fs = require('fs');
var crypto = require('crypto');
var dns = require('dns');
var kernel = require('./kernel');

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
  flac : 'audio/flac',
  gif : 'image/gif',
  gtar : 'application/x-gtar',
  gz : 'application/gzip',
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
  svg : 'image/svg+xml',
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
  zip : 'application/zip',
  webp : 'image/webp'
};

exports.reverseMimes = {};

for ( var key in exports.MIMETYPES) {
  exports.reverseMimes[exports.MIMETYPES[key]] = key;
}

exports.runDNSBL = function(ip, domain, callback) {

  for (var i = 0; i < ip.length; i++) {

    if (ip.length === 4) {
      domain = ip[i] + '.' + domain;
    } else {

      var hex = ip[i].toString(16);

      if (hex.length < 2) {
        hex = '0' + hex;
      }

      domain = hex[1] + '.' + hex[0] + '.' + domain;

    }

  }

  dns.resolve(domain, function(error, data) {
    callback(error && error.code !== 'ENOTFOUND' ? error : null, !!data);
  });

};

exports.getMime = function(pathName) {

  var pathParts = pathName.split('.');

  var mime;

  if (pathParts.length) {
    mime = exports.MIMETYPES[pathParts[pathParts.length - 1].toLowerCase()];
  }

  return mime || 'application/octet-stream';
};

// Creates an UCT formated date in 'yyyy-MM-dd' format
exports.formatedDate = function(time) {
  time = time || new Date();

  var monthString = time.getUTCMonth() + 1;

  if (monthString.toString().length < 2) {
    monthString = '0' + monthString;
  }

  var dayString = time.getUTCDate();

  if (dayString.toString().length < 2) {
    dayString = '0' + dayString;
  }

  return time.getUTCFullYear() + '-' + monthString + '-' + dayString;
};

exports.completeIp = function(parts) {

  for (var i = 0; i < parts.length; i++) {

    if (!parts[i].length) {
      parts[i] = '0';

      while (parts.length < 8) {
        parts.splice(i, 0, '0');
      }

      break;

    }
  }

};

exports.parseIpv6 = function(ip) {

  var parts = ip.split(':');

  if (parts.length < 8) {
    exports.completeIp(parts);
  }

  parts = parts.map(function padOctets(part) {
    if (part.length < 4) {
      return ('0000' + part).slice(-4);
    }

    return part;
  });

  var parsedIp = [];

  for (var i = 0; i < parts.length; i++) {

    var part = parts[i];

    parsedIp.push(parseInt(part.substring(0, 2), 16));
    parsedIp.push(parseInt(part.substring(2, 4), 16));

  }

  return parsedIp;

};

exports.compareArrays = function(a, b) {

  if (a.length !== b.length) {

    var max = Math.max(a.length, b.length);
    a = Array(max - a.length).fill(0).concat(a);
    b = Array(max - b.length).fill(0).concat(b);

  }

  for (var i = 0; i < a.length; i++) {

    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }

  }

  return 0;

};

exports.convertIpToArray = function(ip) {

  if (!ip) {
    return null;
  }

  var ipv4Match = ip.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/);

  if (ipv4Match) {

    var parsedIp = [];

    for (var i = 0; i < 4; i++) {
      parsedIp[i] = +ipv4Match[i + 1];
    }

    return parsedIp;
  } else {
    return exports.parseIpv6(ip);
  }
};

exports.ip = function(req) {

  if (req.isTor) {
    return null;
  } else if (req.cachedIp) {
    return req.cachedIp;
  } else {
    req.cachedIp = exports.convertIpToArray(exports.getRawIp(req));

    return req.cachedIp;
  }

};

exports.sha256 = function(path, callback) {

  var stream = fs.createReadStream(path);
  var hash = crypto.createHash('sha256');

  stream.on('error', callback);

  stream.on('data', function(data) {
    hash.update(data, 'utf8');
  });

  stream.on('end', function() {
    callback(null, hash.digest('hex'));
  });

};

exports.getRawIp = function(req) {

  var toRet;

  if (req.headers['x-forwarded-for'] && req.trustedProxy) {
    toRet = req.headers['x-forwarded-for'];
  } else {
    toRet = req.connection.remoteAddress;
  }

  return kernel.ip() || toRet;

};

// Section 1: Binary search: {
exports.descriptorClosingHandler = function(error) {

  if (error) {
    console.log(error);
  }

};

exports.searchOnDescriptor = function(toMatch, fd, entrySize, comparison,
    parsing, aproximate, first, last, firstIndex, lastIndex, callback,
    lastSmallest) {

  var lineToRead = firstIndex + Math.round((lastIndex - firstIndex) / 2);

  fs.read(fd, Buffer.alloc(entrySize), 0, entrySize, lineToRead * entrySize,
      function read(error, readBytes, buffer) {

        if (error) {
          fs.close(fd, exports.descriptorClosingHandler);
          callback(error);
        } else {

          var current = parsing(buffer);

          var comparisonResult = comparison(toMatch, current);

          if (comparisonResult > 0) {
            lastSmallest = current;
          }

          if (!comparisonResult) {
            fs.close(fd, exports.descriptorClosingHandler);
            callback(null, current);
          } else if (lastIndex - firstIndex < 3) {
            fs.close(fd, exports.descriptorClosingHandler);
            callback(null, aproximate ? lastSmallest : null);
          } else if (comparisonResult > 0) {
            exports.searchOnDescriptor(toMatch, fd, entrySize, comparison,
                parsing, aproximate, current, last, lineToRead, lastIndex,
                callback, lastSmallest);
          } else if (comparisonResult < 0) {
            exports.searchOnDescriptor(toMatch, fd, entrySize, comparison,
                parsing, aproximate, first, current, firstIndex, lineToRead,
                callback, lastSmallest);
          }

        }

      });

};

exports.handleEnds = function(lastIndex, buffer, comparison, toMatch, first,
    fd, callback, entrySize, parsing, aproximate) {

  var last = parsing(buffer);

  var firstComparison = comparison(toMatch, first);
  var lastComparison = comparison(toMatch, last);

  if (firstComparison < 0 || lastComparison > 0) {
    fs.close(fd, exports.descriptorClosingHandler);
    callback();
  } else if (!firstComparison) {
    fs.close(fd, exports.descriptorClosingHandler);
    callback(null, first);
  } else if (!lastComparison) {
    fs.close(fd, exports.descriptorClosingHandler);
    callback(null, last);
  } else {
    exports.searchOnDescriptor(toMatch, fd, entrySize, comparison, parsing,
        aproximate, first, last, 0, lastIndex, callback);
  }

};

exports.getFirstAndLastObjects = function(toMatch, fd, entrySize, comparison,
    parsing, size, aproximate, callback) {

  fs.read(fd, Buffer.alloc(entrySize), 0, entrySize, 0, function read(error,
      readBytes, buffer) {

    if (error) {
      fs.close(fd, exports.descriptorClosingHandler);
      callback(error);
    } else {

      var first = parsing(buffer);

      var lastIndex = (size / entrySize) - 1;

      // style exception, too simple
      fs.read(fd, Buffer.alloc(entrySize), 0, entrySize, lastIndex * entrySize,
          function read(error, readBytes, buffer) {

            if (error) {
              fs.close(fd, exports.descriptorClosingHandler);
              callback(error);
            } else if (!readBytes) {
              fs.close(fd, exports.descriptorClosingHandler);

              callback();
            } else {

              exports.handleEnds(lastIndex, buffer, comparison, toMatch, first,
                  fd, callback, entrySize, parsing, aproximate);

            }

          });
      // style exception, too simple

    }

  });

};

exports.binarySearch = function(toMatch, fileLocation, entrySize, comparison,
    parsing, callback, aproximate) {

  fs.stat(fileLocation, function gotStats(error, stats) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      fs.open(fileLocation, 'r', function openedFile(error, fd) {

        if (error) {
          callback(error);
        } else {
          exports.getFirstAndLastObjects(toMatch, fd, entrySize, comparison,
              parsing, stats.size, aproximate, callback);
        }

      });
      // style exception, too simple

    }
  });

};
// } Section 1: Binary search
