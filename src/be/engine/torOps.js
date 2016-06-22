'use strict';

// Handles anything related to TOR

var torIps = require('../db').torIps();
var logger = require('../logger');
var torDebug = require('../kernel').torDebug();
var verbose;
var ipSource;
var https = require('https');
var http = require('http');

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  verbose = settings.verbose;
  ipSource = settings.torSource;

};

// Section 1: Update {
exports.processData = function(data, callback) {

  var match = data.match(/\d+\.\d+\.\d+\.\d+/g);

  if (!match) {
    console.log('No ips found in the provided list of TOR exit nodes.');
    callback();
    return;
  }

  if (verbose) {
    console.log('Found ' + match.length + ' ips of TOR exit nodes.');
  }

  var operations = [];

  var convertedIps = [];

  for (var i = 0; i < match.length; i++) {
    var ip = logger.convertIpToArray(match[i]);

    convertedIps.push(ip);

    operations.push({
      updateOne : {
        filter : {
          ip : ip
        },
        update : {
          $setOnInsert : {
            ip : ip
          }
        },
        upsert : true
      }
    });

  }

  operations.push({
    deleteMany : {
      filter : {
        ip : {
          $nin : convertedIps
        }
      }
    }
  });

  torIps.bulkWrite(operations, callback);

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
      exports.processData(data, callback);
    });
    // style exception, too simple

  });

  req.on('error', function(error) {
    console.log(error);
    callback();
  });

  req.end();

};
// } Section 1: Update

exports.markAsTor = function(req, callback) {

  if (req.isTor) {
    callback(null, req);
  }

  var ip = logger.convertIpToArray(logger.getRawIp(req));

  torIps.findOne({
    ip : ip
  }, function gotIp(error, torIp) {
    if (error) {
      callback(error);
    } else {

      if (torIp || torDebug) {
        req.isTor = true;
        if (verbose) {
          console.log('Marked ip ' + ip + ' as TOR.');
        }
      }

      callback(null, req);
    }
  });

};

exports.init = function(callback) {

  torIps.findOne({}, function gotIp(error, torIp) {
    if (error) {
      callback(error);
    } else if (!torIp) {
      console.log('TOR ips will be downloaded, this might take a while');

      exports.updateIps(callback);
    } else {
      callback();
    }
  });

};