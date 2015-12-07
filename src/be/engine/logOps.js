'use strict';

var master = require('cluster').isMaster;
var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var aggregatedLogs = db.aggregatedLogs();
var logs = db.logs();
var generator;

exports.loadDependencies = function() {
  generator = require('./generator').global;
};

// Section 1: Log insertion {
exports.aggregateLog = function(entry, callback) {

  var entryTime = new Date(entry.time);

  entryTime.setUTCHours(0);
  entryTime.setUTCMinutes(0);
  entryTime.setUTCSeconds(0);
  entryTime.setUTCMilliseconds(0);

  aggregatedLogs.updateOne({
    date : entryTime
  }, {
    $push : {
      logs : entry._id
    },
    $set : {
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

  logs.insertOne(entry, function addedLog(error) {

    if (error) {
      var outputMessage = 'Could not log message "' + entry.description;
      outputMessage += '" due to error ' + error.toString() + '.';

      console.log(outputMessage);

      callback();
    } else {

      exports.aggregateLog(entry, callback);
    }

  });

};
// } Section 1: Log insertion
