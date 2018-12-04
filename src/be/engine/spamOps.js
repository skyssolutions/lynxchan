'use strict';

var fs = require('fs');
var exec = require('child_process').exec;
var logger = require('../logger');
var command = 'curl -s {$host} | gunzip -';
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

exports.getSortedIps = function(ips) {

  var foundIps = [];

  for (var i = 0; i < ips.length; i++) {
    var ip = ips[i];

    if (!ip.length) {
      continue;
    }

    foundIps.push(locationOps.ipToInt(logger.convertIpToArray(ip)));
  }

  return foundIps.sort(function(a, b) {
    return a - b;
  });

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
      exports.processData(exports.getSortedIps(data.split(',')), callback);
    }

  });

};
// } Section 1: Updating spammer list

exports.parseIpBuffer = function(buffer) {

  return {
    ip : buffer.readUInt32BE(0)
  };

};

exports.checkIp = function(ip, callback, override) {

  if (disabled && !override) {
    callback();
    return;
  }

  logger.binarySearch({
    ip : locationOps.ipToInt(ip)
  }, exports.spamDataPath, ipLineSize, function compare(a, b) {
    return a.ip - b.ip;
  }, exports.parseIpBuffer, function searched(error, ip) {

    if (error) {
      callback(error);
    } else {
      callback(null, !!ip);
    }

  });

};

// Section 2: Incrementing spammer list {
exports.iterateNewIps = function(newIps, currentArray, callback, index,
    inserted) {

  index = index || 0;

  if (index >= newIps.length) {

    if (inserted) {
      exports.processData(currentArray.sort(function(a, b) {
        return a - b;
      }), callback);

    } else {
      callback();
    }

    return;
  }

  var ipString = newIps[index];

  if (!ipString.length) {
    exports.iterateNewIps(newIps, currentArray, callback, ++index, inserted);
    return;
  }

  var ip = logger.convertIpToArray(ipString);

  exports.checkIp(ip, function checked(error, spammer) {

    if (error) {
      callback(error);
    } else {

      if (!spammer) {
        inserted = true;
        currentArray.push(locationOps.ipToInt(ip));
      }

      exports.iterateNewIps(newIps, currentArray, callback, ++index, inserted);

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
// } Section 2: Incrementing spammer list

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