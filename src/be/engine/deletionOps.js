'use strict';

// handles any operation regarding logic of deletion, including gridFs files

var db = require('../db');
var files = db.files();
var threads = db.threads();
var gridFs = require('./gridFsHandler');
var boards = db.boards();
var settings = require('../boot').getGeneralSettings();
var verbose = settings.verbose;
var threadLimit = settings.maxThreadCount;

function removeThreads(boardUri, threadsToDelete, callback) {

  threads.remove({
    boardUri : boardUri,
    threadId : {
      $in : threadsToDelete
    }
  }, function removedThreads(error, result) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      boards.update({
        boardUri : boardUri
      }, {
        $inc : {
          threadCount : -threadsToDelete.length
        }
      }, function updatedThreadCount(error) {
        callback(error);
      });

      // style exception, too simple

    }

  });

}

function getThreadFilesToRemove(boardUri, threadsToRemove, callback) {

  files.aggregate([ {
    $match : {
      'metadata.boardUri' : boardUri,
      'metadata.threadId' : {
        $in : threadsToRemove
      }
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function gotFilesToDelete(error, filesToDelete) {
    if (error) {
      callback(error);
    } else if (!filesToDelete.length) {
      callback();
    } else {

      // style exception, too simple
      gridFs.removeFiles(filesToDelete[0].files, function deletedFiles(error) {
        if (error) {
          callback(error);
        } else {
          removeThreads(boardUri, threadsToRemove, callback);
        }
      });

      // style exception, too simple

    }
  });

}

exports.cleanThreads = function(boardUri, callback) {

  if (verbose) {
    console.log('Cleaning threads of ' + boardUri);
  }

  threads.aggregate([ {
    $match : {
      boardUri : boardUri
    }
  }, {
    $sort : {
      lastBump : -1
    }
  }, {
    $skip : threadLimit
  }, {
    $group : {
      _id : 0,
      threads : {
        $push : '$threadId'
      }
    }
  } ], function gotThreads(error, threadsToRemove) {
    if (error) {
      callback(error);
    } else if (!threadsToRemove.length) {
      callback();
    } else {
      getThreadFilesToRemove(boardUri, threadsToRemove[0].threads, callback);
    }
  });

};