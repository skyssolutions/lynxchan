'use strict';

var fs = require('fs');
var exec = require('child_process').exec;
var logger = require('../logger');
var command = 'curl {$host} | gunzip -';
var ipLineSize = 4;
var ipSource;
var incrementalIpSource;
var disabled;
var locationOps;

exports.loadDependencies = function() {
  locationOps = require('./locationOps');
};

exports.loadSettings = function() {
  var settings = require('../settingsHandler').getGeneralSettings();

  disabled = settings.disableSpamCheck;
  incrementalIpSource = settings.incSpamIpsSource;
  ipSource = settings.spamIpsSource;
};

exports.spamDataPath = __dirname + '/../spamData';

// Section 1: Updating spammer list {
exports.writeIpToStream = function(ip, fileStream) {

  var buffer = Buffer.alloc(ipLineSize);
  buffer.writeUInt32BE(ip);
  fileStream.write(buffer);

};

exports.getSortedIps = function(data) {

  var foundIps = [];

  var ips = data.split(',');

  for (var i = 0; i < ips.length; i++) {
    var ip = ips[i];

    if (!ip.length) {
      continue;
    }

    foundIps.push(locationOps.ipToInt(logger.convertIpToArray(ip)));
  }

  foundIps = foundIps.sort(function(a, b) {
    return a - b;
  });

  return foundIps;

};

exports.processData = function(foundIps, callback) {

  var fileStream = fs.createWriteStream(exports.spamDataPath);

  var stopped = false;

  fileStream.once('error', function(error) {
    stopped = true;
    callback(error);
  });

  for (var i = 0; i < foundIps.length; i++) {

    if (stopped) {
      return;
    }

    exports.writeIpToStream(foundIps[i], fileStream);

  }

  if (stopped) {
    return;
  }

  fileStream.end(callback);

};

exports.updateSpammers = function(callback) {

  exec(command.replace('{$host}', ipSource), {
    maxBuffer : Infinity
  }, function gotData(error, data) {

    if (error) {
      callback(error);
    } else {
      exports.processData(exports.getSortedIps(data), callback);
    }

  });

};
// } Section 1: Updating spammer list

// Section 2: Checking ip {
exports.bufferToIpElement = function(index, buffer) {

  return {
    index : index,
    ip : buffer.readUInt32BE(0)
  };

};

exports.searchIpInfo = function(fd, ip, first, last, callback) {

  var lineToRead = first.index + Math.round((last.index - first.index) / 2);

  var linePoint = lineToRead * ipLineSize;

  fs.read(fd, Buffer.alloc(ipLineSize), 0, ipLineSize, linePoint,
      function read(error, readBytes, buffer) {

        if (error) {
          fs.close(fd);
          callback(error);
        } else {

          var current = exports.bufferToIpElement(lineToRead, buffer);

          if (current.ip === ip) {
            fs.close(fd);
            callback(null, true);
          } else if (last.index - first.index < 3) {
            fs.close(fd);
            callback();
          } else if (current.ip > ip) {
            exports.searchIpInfo(fd, ip, first, current, callback);
          } else if (current.ip < ip) {
            exports.searchIpInfo(fd, ip, current, last, callback);
          }

        }

      });
};

exports.getFirstAndLastIp = function(fd, ip, fileSize, callback) {

  fs.read(fd, Buffer.alloc(ipLineSize), 0, ipLineSize, 0, function read(error,
      readBytes, buffer) {

    if (error) {
      fs.close(fd);
      callback(error);
    } else {

      var first = exports.bufferToIpElement(0, buffer);

      var lastIndex = (fileSize / ipLineSize) - 1;

      var position = lastIndex * ipLineSize;

      // style exception, too simple
      fs.read(fd, Buffer.alloc(ipLineSize), 0, ipLineSize, position,
          function read(error, readBytes, buffer) {

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
                callback(null, true);
              } else if (last.ip === ip) {
                fs.close(fd);
                callback(null, true);
              } else {
                exports.searchIpInfo(fd, ip, first, last, callback);
              }

            }

          });
      // style exception, too simple

    }

  });

};

exports.checkIp = function(ip, callback, override) {

  if (disabled && !override) {
    callback();
    return;
  }

  fs.stat(exports.spamDataPath, function gotStats(error, stats) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      fs.open(exports.spamDataPath, 'r', function openedFile(error, fd) {

        if (error) {
          callback(error);
        } else {
          exports.getFirstAndLastIp(fd, locationOps.ipToInt(ip), stats.size,
              callback);
        }

      });
      // style exception, too simple

    }
  });

};
// } Section 2: Checking ip

// Section 3: Incrementing spammer list {
exports.iterateNewIps = function(newIps, currentArray, callback, index) {

  index = index || 0;

  if (index >= newIps.length) {

    exports.processData(currentArray.sort(function(a, b) {
      return a - b;
    }), callback);

    return;
  }

  var ipString = newIps[index];

  if (!ipString.length) {
    exports.iterateNewIps(newIps, currentArray, callback, ++index);
    return;
  }

  var ip = logger.convertIpToArray(ipString);

  exports.checkIp(ip, function checked(error, spammer) {

    if (error) {
      callback(error);
    } else {

      if (!spammer) {
        currentArray.push(locationOps.ipToInt(ip));
      }

      exports.iterateNewIps(newIps, currentArray, callback, ++index);

    }

  }, true);

};

exports.incrementSpammers = function(callback) {

  exec(command.replace('{$host}', incrementalIpSource), {
    maxBuffer : Infinity
  }, function gotData(error, data) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      fs.readFile(exports.spamDataPath, function gotExistingData(error,
          existingData) {
        if (error) {
          callback(error);
        } else {

          var currentArray = [];

          for (var i = 0; i < existingData.length / 4; i++) {
            currentArray.push(existingData.readUInt32BE(i * 4));
          }

          exports.iterateNewIps(data.split('\n'), currentArray, callback);
        }
      });
      // style exception, too simple

    }

  });

};
// } Section 3: Incrementing spammer list

exports.init = function(callback) {

  try {
    fs.statSync(exports.spamDataPath);
    callback();
  } catch (error) {
    if (error.code === 'ENOENT') {
      exports.updateSpammers(callback);
    } else {
      callback(error);
    }

  }

};