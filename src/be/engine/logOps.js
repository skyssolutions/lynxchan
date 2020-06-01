'use strict';

var db = require('../db');
var aggregatedLogs = db.aggregatedLogs();
var logs = db.logs();
var generator;

exports.loadDependencies = function() {
  generator = require('./degenerator').global;
};

// Section 1: Log insertion {
exports.createOperation = function(boardUri, list, entryTime, operations) {

  if (!list.length) {
    return;
  }

  operations.push({
    updateOne : {
      filter : {
        date : entryTime,
        boardUri : boardUri
      },
      update : {
        $push : {
          logs : {
            $each : list
          }
        },
        $setOnInsert : {
          date : entryTime,
          boardUri : boardUri
        }
      },
      upsert : true
    }
  });

};

exports.generateOperations = function(globalList, boardRelation, entry,
    callback) {

  var operations = [];

  var entryTime = entry[0].time;

  entryTime.setUTCHours(0);
  entryTime.setUTCMinutes(0);
  entryTime.setUTCSeconds(0);
  entryTime.setUTCMilliseconds(0);

  exports.createOperation(null, globalList, entryTime, operations);

  for ( var key in boardRelation) {
    exports.createOperation(key, boardRelation[key], entryTime, operations);
  }

  aggregatedLogs.bulkWrite(operations, function(error) {
    if (error) {
      console.log('Failed to aggregate log: ' + error.toString());
    }

    generator.log(entryTime, callback);
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

      var boardRelation = {};
      var globalList = [];

      for (var i = 0; i < entry.length; i++) {

        var item = entry[i];

        if (item.boardUri) {

          var boardList = boardRelation[item.boardUri] || [];
          boardRelation[item.boardUri] = boardList;
          boardList.push(entry[i]._id);
        } else {
          globalList.push(entry[i]._id);

        }

      }

      exports.generateOperations(globalList, boardRelation, entry, callback);

    }

  });

};
// } Section 1: Log insertion

