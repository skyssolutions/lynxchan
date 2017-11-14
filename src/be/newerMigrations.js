'use strict';

// The dbMigrations.s couldn't be any larger, this is where any migration from
// 1.6 onward will be

var db = require('./db');
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
    boardUri : 1,
    threadId : 1,
    postId : 1
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
        boardUri : 1,
        _id : 0
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
function fillOverboardExtraTypesOperations(operations) {

  if (!settings.overboard && !settings.sfwOverboard) {
    return;
  }

  var overboardPaths = [];

  if (settings.overboard) {
    overboardPaths.push('/' + settings.sfwOverboard + '/');
    overboardPaths.push('/' + settings.sfwOverboard + '/index.rss');
    overboardPaths.push('/' + settings.sfwOverboard + '/1.json');
  }

  if (settings.sfwOverboard) {
    overboardPaths.push('/' + settings.overboard + '/');
    overboardPaths.push('/' + settings.overboard + '/index.rss');
    overboardPaths.push('/' + settings.overboard + '/1.json');
  }

  operations.push({
    updateMany : {
      filter : {
        $or : [ {
          filename : {
            $in : overboardPaths
          }
        }, {
          'metadata.referenceFile' : {
            $in : overboardPaths
          }
        } ]
      },
      update : {
        $set : {
          'metadata.type' : 'overboard'
        }
      }
    }

  });

}

exports.addExtraTypes = function(callback) {

  var operations = [];

  fillOverboardExtraTypesOperations(operations);

  var frontPagePaths = [ '/', '/index.json' ];

  operations.push({
    updateMany : {
      filter : {
        $or : [ {
          filename : {
            $in : frontPagePaths
          }
        }, {
          'metadata.referenceFile' : {
            $in : frontPagePaths
          }
        } ]
      },
      update : {
        $set : {
          'metadata.type' : 'frontPage'
        }
      }

    }
  });

  operations.push({
    updateMany : {
      filter : {
        filename : /\/custom\.(css|js|spoiler)$/,
        'metadata.boardUri' : {
          $exists : true
        }
      },
      update : {
        $set : {
          'metadata.type' : 'custom'
        }
      }
    }

  });

  files.bulkWrite(operations, callback);

};