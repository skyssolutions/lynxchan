'use strict';

var fs = require('fs');
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

exports.bufferToLocationElement = function(index, buffer) {

  return {
    index : index,
    geoId : buffer.readUIntBE(0, 6),
    country : buffer.toString('utf8', 6, 8),
    region : buffer.toString('utf8', 8, 11).replace(/\u0000.*/, ''),
    city : buffer.toString('utf8', 11).replace(/\u0000.*/, '')
  };

};

exports.bufferToIpElement = function(index, buffer) {

  return {
    index : index,
    ip : buffer.readUInt32BE(0),
    geoId : buffer.readUIntBE(4, 6)
  };

};

// Section 1: Ip lookup {
exports.searchIpInfo = function(fd, ip, first, last, callback) {

  var lineToRead = first.index + Math.round((last.index - first.index) / 2);

  fs.read(fd, new Buffer(ipLineSize), 0, ipLineSize, lineToRead * ipLineSize,
      function read(error, readBytes, buffer) {

        if (error) {
          fs.close(fd);
          callback(error);
        } else {

          var current = exports.bufferToIpElement(lineToRead, buffer);

          if (current.ip === ip || last.index - first.index < 3) {
            fs.close(fd);
            callback(null, current);
          } else if (current.ip > ip) {
            exports.searchIpInfo(fd, ip, first, current, callback);
          } else if (current.ip < ip) {
            exports.searchIpInfo(fd, ip, current, last, callback);
          }
        }

      });
};

exports.getFirstAndLastIp = function(fd, ip, fileSize, callback) {

  fs.read(fd, new Buffer(ipLineSize), 0, ipLineSize, 0, function read(error,
      readBytes, buffer) {

    if (error) {
      fs.close(fd);

      callback(error);
    } else {

      var first = exports.bufferToIpElement(0, buffer);

      var lastIndex = (fileSize / ipLineSize) - 1;

      // style exception, too simple
      fs.read(fd, new Buffer(ipLineSize), 0, ipLineSize,
          lastIndex * ipLineSize, function read(error, readBytes, buffer) {

            if (error) {
              fs.close(fd);
              callback(error);
            } else if (!readBytes) {
              fs.close(fd);
              callback();
            } else {

              var last = exports.bufferToIpElement(lastIndex, buffer);

              if (ip < first.ip || ip > last.ip) {
                fs.close(fd);
                callback();
              } else if (first.ip === ip) {
                fs.close(fd);
                callback(null, first);
              } else if (last.ip === ip) {
                fs.close(fd);
                callback(null, last);
              } else {
                exports.searchIpInfo(fd, ip, first, last, callback);
              }

            }

          });
      // style exception, too simple

    }

  });

};

exports.getIpInfo = function(ip, callback) {

  var convertedIp = exports.ipToInt(ip);

  for (var i = 0; i < localRanges.length; i++) {
    var range = localRanges[i];

    if (convertedIp >= range.top && convertedIp <= range.bottom) {
      callback();
      return;
    }

  }

  fs.stat(compiledIps, function gotStats(error, stats) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      fs.open(compiledIps, 'r', function openedFile(error, fd) {

        if (error) {
          callback(error);
        } else {
          exports.getFirstAndLastIp(fd, convertedIp, stats.size, callback);
        }

      });
      // style exception, too simple

    }
  });

};
// } Section 1: Ip lookup

// Section 2: Location lookup {
exports.searchLocationInfo = function(fd, geoId, first, last, callback) {

  var lineToRead = first.index + Math.round((last.index - first.index) / 2);

  var linePoint = lineToRead * locationLineSize;

  fs.read(fd, new Buffer(locationLineSize), 0, locationLineSize, linePoint,
      function read(error, readBytes, buffer) {

        if (error) {
          fs.close(fd);
          callback(error);
        } else {

          var current = exports.bufferToLocationElement(lineToRead, buffer);

          if (current.geoId === geoId) {
            fs.close(fd);
            callback(null, current);
          } else if (last.index - first.index < 3) {
            fs.close(fd);
            callback();
          } else if (current.geoId > geoId) {
            exports.searchLocationInfo(fd, geoId, first, current, callback);
          } else if (current.geoId < geoId) {
            exports.searchLocationInfo(fd, geoId, current, last, callback);
          }
        }

      });
};

exports.getFirstAndLastLocation = function(fd, geoId, fileSize, callback) {

  fs.read(fd, new Buffer(locationLineSize), 0, locationLineSize, 0,
      function read(error, readBytes, buffer) {

        if (error) {
          fs.close(fd);
          callback(error);
        } else {

          var first = exports.bufferToLocationElement(0, buffer);

          var lastIndex = (fileSize / locationLineSize) - 1;

          // style exception, too simple
          fs
              .read(fd, new Buffer(locationLineSize), 0, locationLineSize,
                  lastIndex * locationLineSize, function read(error, readBytes,
                      buffer) {

                    if (error) {
                      fs.close(fd);
                      callback(error);
                    } else if (!readBytes) {
                      fs.close(fd);
                      callback();
                    } else {

                      var last = exports.bufferToLocationElement(lastIndex,
                          buffer);

                      if (geoId < first.geoId || geoId > last.geoId) {
                        fs.close(fd);
                        callback();
                      } else if (first.geoId === geoId) {
                        fs.close(fd);
                        callback(null, first);
                      } else if (last.geoId === geoId) {
                        fs.close(fd);
                        callback(null, last);
                      } else {
                        exports.searchLocationInfo(fd, geoId, first, last,
                            callback);
                      }

                    }

                  });
          // style exception, too simple

        }

      });

};

exports.searchIpLocation = function(geoId, callback) {

  fs.stat(compiledLocations, function gotStats(error, stats) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      fs.open(compiledLocations, 'r', function openedFile(error, fd) {

        if (error) {
          callback(error);
        } else {
          exports.getFirstAndLastLocation(fd, geoId, stats.size, callback);
        }

      });
      // style exception, too simple

    }
  });

};

exports.getLocationInfo = function(ip, callback) {

  exports.getIpInfo(ip, function gotInfo(error, info) {

    if (error) {
      callback(error);
    } else if (!info) {
      callback();
    } else {
      exports.searchIpLocation(info.geoId, callback);
    }

  });

};
// } Section 2: Location lookup
