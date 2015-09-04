'use strict';

var torIps = require('../db').torIps();
var boot = require('../boot');
var logger = require('../logger');
var torDebug = boot.torDebug();
var settings = boot.getGeneralSettings();
var verbose = settings.verbose;
var ipSource = settings.torSource;
var https = require('https');
var http = require('http');

// Handles anything related to TOR

// start of update
function processData(data, callback) {

  var match = data.match(/\d+\.\d+\.\d+\.\d+/g);

  if (!match) {
    callback('No ips found in the provided list of TOR exit nodes.');
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
          $set : {
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

}

exports.updateIps = function(callback) {

  var data = '';

  var operationToUse = ipSource.indexOf('https') > -1 ? https : http;

  operationToUse.request(ipSource, function gotData(res) {

    // style exception, too simple
    res.on('data', function(chunk) {
      data += chunk;
    });

    res.on('end', function() {
      processData(data, callback);
    });
    // style exception, too simple

  }).end();

};

// end of update
function markAsProxy(ip, req) {

  if (req.headers && req.headers['x-forwarded-for']) {
    var proxy = req.headers['x-forwarded-for'];

    if (proxy !== ip) {
      req.isProxy = true;
    }
  }

}

exports.markAsTor = function(req, callback) {

  var ip = logger.convertIpToArray(req.connection.remoteAddress);

  torIps.count({
    ip : ip
  }, function gotCount(error, count) {
    if (error) {
      callback(error);
    } else {

      if (count || torDebug) {
        req.isTor = true;
        if (verbose) {
          console.log('Marked ip ' + ip + ' as TOR.');
        }
      } else {
        markAsProxy(ip, req);
      }
      callback(null, req);
    }
  });

};

exports.init = function(callback) {

  torIps.count(function gotCount(error, count) {
    if (error) {
      callback(error);
    } else if (!count) {
      exports.updateIps(callback);
    } else {
      callback();
    }
  });

};