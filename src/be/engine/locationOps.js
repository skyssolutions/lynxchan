'use strict';

var logger = require('../logger');
var compiledLocations = __dirname + '/../locationData/compiledLocations';
var compiledIps = __dirname + '/../locationData/compiledIps';

var locationLineSize = 60;
var ipLineSize = 10;

exports.ipToInt = function(ip) {

  var toReturn = ip[0] << 24 >>> 0;
  toReturn += ip[1] << 16 >>> 0;
  toReturn += ip[2] << 8 >>> 0;
  toReturn += ip[3];

  return toReturn;

};

var localRanges = [ {
  top : exports.ipToInt([ 10, 0, 0, 0 ]),
  bottom : exports.ipToInt([ 10, 255, 255, 255 ])
}, {
  top : exports.ipToInt([ 127, 0, 0, 1 ]),
  bottom : exports.ipToInt([ 127, 255, 255, 254 ])
}, {
  top : exports.ipToInt([ 172, 16, 0, 0 ]),
  bottom : exports.ipToInt([ 172, 31, 255, 255 ])
}, {
  top : exports.ipToInt([ 192, 168, 0, 0 ]),
  bottom : exports.ipToInt([ 192, 168, 255, 255 ])
}

];

exports.getLocationInfo = function(ip, callback) {

  var convertedIp = exports.ipToInt(ip);

  for (var i = 0; i < localRanges.length; i++) {
    var range = localRanges[i];

    if (convertedIp >= range.top && convertedIp <= range.bottom) {
      callback();
      return;
    }

  }

  logger.binarySearch({
    ip : convertedIp
  }, compiledIps, ipLineSize, function compare(a, b) {
    return a.ip - b.ip;
  }, function parse(buffer) {

    return {
      ip : buffer.readUInt32BE(0),
      geoId : buffer.readUIntBE(4, 6)
    };

  }, function gotIpInfor(error, info) {

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