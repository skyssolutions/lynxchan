'use strict';

var master = require('cluster').isMaster;
var db = require('../db');
var aggregatedLogs = db.aggregatedLogs();
var logs = db.logs();
var generator;

exports.loadDependencies = function() {
  generator = require('./generator').global;
};

// Section 1: Log insertion {
exports.aggregateLog = function(entryTime, collectedIds, callback) {

  entryTime.setUTCHours(0);
  entryTime.setUTCMinutes(0);
  entryTime.setUTCSeconds(0);
  entryTime.setUTCMilliseconds(0);

  aggregatedLogs.updateOne({
    date : entryTime
  }, {
    $push : {
      logs : {
        $each : collectedIds
      }
    },
    $setOnInsert : {
      date : entryTime
    }
  }, {
    upsert : true
  }, function aggregatedLog(error) {

    if (error) {
      console.log('Failed to aggregate log: ' + error.toString());
    }

    if (!master) {
      process.send({
        log : true,
        date : entryTime
      });
      callback();
    } else {
      generator.log(entryTime, callback);
    }

  });
};

exports.insertLog = function(entry, callback) {

  if (!Array.isArray(entry)) {
    entry = [ entry ];
  }

  logs.insertMany(entry, function addedLog(error) {

    if (error) {
      console.log(error);
      callback();
    } else {

      var collectedIds = [];

      for (var i = 0; i < entry.length; i++) {
        collectedIds.push(entry[i]._id);
      }

      exports.aggregateLog(entry[0].time, collectedIds, callback);
    }

  });

};
// } Section 1: Log insertion

