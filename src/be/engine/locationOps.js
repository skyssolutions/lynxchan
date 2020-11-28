'use strict';

var logger = require('../logger');
var compiledLocations = __dirname + '/../locationData/compiledLocations';
var compiledIps = __dirname + '/../locationData/compiledIps';
var compiledIpsV6 = __dirname + '/../locationData/compiledIpsV6';
var compiledASN = __dirname + '/../locationData/compiledASNs';
var compiledASNV6 = __dirname + '/../locationData/compiledASNsV6';

var locationLineSize = 60;
var ipLength = 4;
var ipLengthV6 = 16;
var ipLineSize = 10;
var ipLineSizeV6 = 22;
var ASNLineSize = 8;
var ASNLineSizeV6 = 20;

var ipv6Localhost = logger.convertIpToArray('::1');

var localRanges = [ {
  top : [ 10, 0, 0, 0 ],
  bottom : [ 10, 255, 255, 255 ]
}, {
  top : [ 127, 0, 0, 1 ],
  bottom : [ 127, 255, 255, 254 ]
}, {
  top : [ 172, 16, 0, 0 ],
  bottom : [ 172, 31, 255, 255 ]
}, {
  top : [ 192, 168, 0, 0 ],
  bottom : [ 192, 168, 255, 255 ]
} ];

exports.isLocal = function(ip) {

  if (ip.length > 4) {

    var isNotLocalhost = logger.compareArrays(ip, ipv6Localhost);

    if (!isNotLocalhost) {
      return true;
    }

    var ULA = ip[0] === 252 || ip[0] === 253;

    var prefix = ip[0] === 1 && !ip[1];

    return ULA || prefix || (ip[0] === 254 && ip[1] === 128);
  }

  for (var i = 0; i < localRanges.length; i++) {
    var range = localRanges[i];

    var topComparison = logger.compareArrays(ip, range.top) >= 0;

    if (topComparison && logger.compareArrays(ip, range.bottom) <= 0) {
      return true;
    }

  }

};

exports.getLocationInfo = function(ip, callback) {

  if (exports.isLocal(ip)) {
    return callback();
  }

  var v6 = ip.length > 4;

  var length = v6 ? ipLineSizeV6 : ipLineSize;
  var ipLengthToUse = v6 ? ipLengthV6 : ipLength;
  var location = v6 ? compiledIpsV6 : compiledIps;

  logger.binarySearch({
    ip : ip
  }, location, length, function compare(a, b) {
    return logger.compareArrays(a.ip, b.ip);
  }, function parse(buffer) {

    var tempArray = Array(ip.length);

    for (var i = 0; i < tempArray.length; i++) {
      tempArray[i] = buffer[i];
    }

    return {
      ip : tempArray,
      geoId : buffer.readUIntBE(ipLengthToUse, 6)
    };

  }, function gotIpInfo(error, info) {

    if (error) {
      callback(error);
    } else if (!info) {
      callback();
    } else {

      logger.binarySearch(info, compiledLocations, locationLineSize,
          function compare(a, b) {
            return a.geoId - b.geoId;
          }, function parse(buffer) {

            return {
              geoId : buffer.readUIntBE(0, 6),
              country : buffer.toString('utf8', 6, 8),
              region : buffer.toString('utf8', 8, 11).replace(/\u0000.*/, ''),
              city : buffer.toString('utf8', 11).replace(/\u0000.*/, '')
            };

          }, callback);

    }

  }, true);

};

exports.getASN = function(ip, callback) {

  if (exports.isLocal(ip)) {
    return callback();
  }

  var v6 = ip.length > 4;

  var length = v6 ? ASNLineSizeV6 : ASNLineSize;
  var ipLengthToUse = v6 ? ipLengthV6 : ipLength;
  var location = v6 ? compiledASNV6 : compiledASN;

  logger.binarySearch({
    ip : ip
  }, location, length, function compare(a, b) {
    return logger.compareArrays(a.ip, b.ip);
  }, function parse(buffer) {

    var tempArray = Array(ip.length);

    for (var i = 0; i < tempArray.length; i++) {
      tempArray[i] = buffer[i];
    }

    var newASN = buffer.readUInt32BE(ipLengthToUse);

    return {
      ip : tempArray,
      asn : newASN
    };

  }, function gotIpInfo(error, info) {

    if (error || !info) {
      callback(error);
    } else {
      callback(null, info.asn);
    }

  }, true);

};