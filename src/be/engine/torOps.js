'use strict';

// Handles anything related to TOR

var fs = require('fs');
var logger = require('../logger');
var torDebug = require('../kernel').torDebug();
var ipSource;
var spamOps;
var torDnsbl;
var locationOps;
var https = require('https');
var http = require('http');
var compiledTORIps = __dirname + '/../TORIps';

exports.loadSettings = function() {
  var settings = require('../settingsHandler').getGeneralSettings();
  ipSource = settings.torSource;
  torDnsbl = settings.torDNSBL;
};

exports.loadDependencies = function() {
  spamOps = require('./spamOps');
  locationOps = require('./locationOps');
};

// Section 1: Update {
exports.processData = function(match, callback) {

  if (!match) {
    console.log('No ips found in the provided list of TOR exit nodes.');
    callback();
    return;
  }

  var foundIps = spamOps.getSortedIps(match);

  var fileStream = fs.createWriteStream(compiledTORIps);

  var stopped = false;

  fileStream.once('error', function(error) {
    stopped = true;
    callback(error);
  });

  for (var i = 0; i < foundIps.length; i++) {

    if (stopped) {
      return;
    }

    fileStream.write(Buffer.from(foundIps[i]));

  }

  if (stopped) {
    return;
  }

  fileStream.end(callback);

};

exports.updateIps = function(callback) {

  var data = '';

  var operationToUse = ipSource.indexOf('https') > -1 ? https : http;

  var req = operationToUse.request(ipSource, function gotData(res) {

    // style exception, too simple
    res.on('data', function(chunk) {
      data += chunk;
    });

    res.on('end', function() {
      exports.processData(data.match(/\d+\.\d+\.\d+\.\d+/g), callback);
    });
    // style exception, too simple

  });

  req.once('error', function(error) {
    callback(error);
  });

  req.end();

};
// } Section 1: Update

exports.markAsTor = function(req, callback) {

  if (req.isTor) {
    callback(null, req);
    return;
  }

  var rawArray = logger.convertIpToArray(logger.getRawIp(req));

  if (torDnsbl) {

    return logger.runDNSBL(rawArray, torDnsbl, function(error, matched) {

      if (error) {
        callback(error);
      } else {
        req.isTor = matched || !!torDebug;
        callback();
      }

    });

  }

  logger.binarySearch({
    ip : rawArray
  }, compiledTORIps, 4, function compare(a, b) {
    return logger.compareArrays(a.ip, b.ip);
  }, spamOps.parseIpBuffer, function gotIp(error, ip) {

    if (error) {
      callback(error);
    } else {
      req.isTor = !!ip || !!torDebug;
      callback();
    }

  });

};

exports.init = function(callback) {

  try {
    fs.statSync(compiledTORIps);
    callback();
  } catch (error) {
    if (error.code === 'ENOENT') {
      exports.updateIps(callback);
    } else {
      callback(error);
    }

  }

};