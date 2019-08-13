'use strict';

// The dbMigrations.s couldn't be any larger, this is where any migration from
// 1.6 onward will be

var db = require('./db');
var aggregatedLogs = db.aggregatedLogs();
var logs = db.logs();
var files = db.files();
var settings = require('./settingsHandler').getGeneralSettings();
var reports = db.reports();
var threads = db.threads();
var posts = db.posts();

// Added on 1.7
exports.deleteGhostReport = function(id, callback) {

  reports.deleteOne({
    _id : id
  }, function deletedReport(error) {
    if (error) {
      callback(error);
    } else {
      exports.removeGhostReports(callback, id);
    }
  });

};

exports.removeGhostReports = function(callback, lastId) {

  reports.findOne(lastId ? {
    _id : {
      $gt : lastId
    }
  } : {}, {
    projection : {
      boardUri : 1,
      threadId : 1,
      postId : 1
    }
  }, function gotReport(error, report) {

    if (error) {
      callback(error);
    } else if (!report) {
      callback();
    } else {

      var collectionToUse = report.postId ? posts : threads;

      // style exception, too simple
      collectionToUse.findOne({
        boardUri : report.boardUri,
        threadId : report.threadId,
        postId : report.postId
      }, {
        projection : {
          boardUri : 1,
          _id : 0
        }
      }, function gotPosting(error, posting) {

        if (error) {
          callback(error);
        } else if (posting) {
          exports.removeGhostReports(callback, report._id);
        } else {
          exports.deleteGhostReport(report._id, callback);
        }

      });
      // style exception, too simple

    }

  });

};

// Added on 2.0
function getNamesToDelete() {

  var names = [ '/', '/index.json' ];

  if (settings.overboard) {
    names.push('/' + settings.sfwOverboard + '/');
    names.push('/' + settings.sfwOverboard + '/index.rss');
    names.push('/' + settings.sfwOverboard + '/1.json');
  }

  if (settings.sfwOverboard) {
    names.push('/' + settings.overboard + '/');
    names.push('/' + settings.overboard + '/index.rss');
    names.push('/' + settings.overboard + '/1.json');
  }

  return names;

}

function eraseOldCache(callback) {

  files.aggregate(
      [
          {
            $match : {
              $or : [
                  {
                    filename : {
                      $in : getNamesToDelete()
                    }
                  },
                  {
                    'metadata.type' : {
                      $in : [ 'board', 'thread', 'catalog', 'rules', 'log',
                          'multiboard', 'preview' ]
                    }
                  } ]
            }
          }, {
            $group : {
              _id : 0,
              files : {
                $push : '$filename'
              }
            }
          } ]).toArray(
      function(error, results) {

        if (error) {
          callback(error);
        } else if (!results.length) {
          callback();
        } else {

          require('./engine/gridFsHandler').removeFiles(results[0].files,
              callback);
        }

      });

}

exports.cleanCache = function(callback) {

  files.updateMany({
    filename : /\/custom\.(css|js|spoiler)$/,
    'metadata.boardUri' : {
      $exists : true
    }
  }, {
    $set : {
      'metadata.type' : 'custom'
    }
  }, function updateCustomFiles(error) {

    if (error) {
      callback(error);
    } else {
      eraseOldCache(callback);
    }

  });

};

// Added on 2.3
exports.generateOperation = function(results, date, toInsert) {

  if (!results.length) {
    return;
  }

  for (var i = 0; i < results.length; i++) {

    var entry = results[i];

    toInsert.push({
      boardUri : entry._id,
      logs : entry.ids,
      date : date
    });
  }

};

exports.iterateDays = function(date, callback, toInsert) {

  toInsert = toInsert || [];

  if (date >= new Date()) {
    aggregatedLogs.deleteMany({}, function clearedCollection(error) {

      if (error) {
        callback(error);
      } else {
        aggregatedLogs.insertMany(toInsert, callback);
      }

    });

    return;
  }

  var next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);

  logs.aggregate([ {
    $match : {
      time : {
        $gte : date,
        $lt : next
      }
    }
  }, {
    $project : {
      time : 1,
      boardUri : 1
    }
  }, {
    $group : {
      _id : '$boardUri',
      ids : {
        $push : '$_id'
      }
    }
  } ]).toArray(function gotLogs(error, results) {

    if (error) {
      callback();
    } else {

      exports.generateOperation(results, date, toInsert);

      exports.iterateDays(next, callback, toInsert);

    }

  });

};

exports.aggregateLogs = function(callback) {

  logs.aggregate([ {
    $project : {
      time : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 0,
      time : {
        $min : '$time'
      }
    }
  } ]).toArray(function gotOldestLog(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {

      var earliest = results[0].time;

      earliest.setUTCHours(0);
      earliest.setUTCMinutes(0);
      earliest.setUTCSeconds(0);
      earliest.setUTCMilliseconds(0);

      exports.iterateDays(earliest, callback);
    }

  });

};