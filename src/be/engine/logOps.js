'use strict';

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

  entryTime.setHours(0);
  entryTime.setMinutes(0);
  entryTime.setSeconds(0);
  entryTime.setMilliseconds(0);

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

    process.send({
      log : true,
      date : entryTime
    });

    callback();
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
