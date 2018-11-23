'use strict';

var db = require('../db');
var boards = db.boards();
var threads = db.threads();
var boardAllowedArchives;
var boardOps;
var lang;
var pageSize = 50;

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();
  boardAllowedArchives = settings.allowBoardStaffArchiving;

};

exports.loadDependencies = function() {
  lang = require('./langOps').languagePack;
  boardOps = require('./boardOps').meta;
};

// Section 1: Archival {
exports.setArchive = function(thread, callback) {

  threads.updateOne({
    _id : thread._id
  }, {
    $set : {
      archived : true
    },
    $unset : {
      innerCache : 1,
      outerCache : 1,
      previewCache : 1,
      clearCache : 1,
      alternativeCaches : 1,
      hashedCache : 1
    }
  }, function(error) {

    if (error) {
      callback(error);
    } else {

      process.send({
        board : thread.boardUri,
        thread : thread.threadId
      });

      process.send({
        board : thread.boardUri
      });

      boards.updateOne({
        boardUri : thread.boardUri
      }, {
        $inc : {
          threadCount : -1
        }
      }, callback);

    }

  });

};

exports.addToArchive = function(language, parameters, callback) {

  threads.findOne({
    boardUri : parameters.boardUri,
    threadId : +parameters.threadId,
    archived : {
      $ne : true
    }
  }, function gotThread(error, thread) {

    if (error) {
      callback(error);
    } else if (!thread) {
      callback(lang(language).errThreadNotFound);
    } else {
      exports.setArchive(thread, callback);
    }

  });

};

exports.archiveThread = function(language, parameters, userData, callback) {

  if (!parameters.confirmation) {
    callback(lang(language).errArchiveConfirmation);
    return;
  }

  parameters.boardUri = parameters.boardUri.toString();

  if (userData.globalRole <= 2) {
    exports.addToArchive(language, parameters, callback);
    return;
  } else if (!boardAllowedArchives) {
    callback(lang(language).errNotAllowedToArchive);
    return;
  }

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    projection : {
      owner : 1,
      volunteers : 1
    }
  }, function gotBoard(error, board) {

    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else {

      var allowed = userData.login === board.owner;

      if (!allowed && board.volunteers) {
        allowed = board.volunteers.indexOf(userData.login) >= 0;
      }

      if (!allowed) {
        callback(lang(language).errNotAllowedToArchive);
      } else {
        exports.addToArchive(language, parameters, callback);
      }

    }

  });

};
// } Section 1: Archival

exports.getArchives = function(parameters, callback) {

  parameters.boards = (parameters.boards || '').split(',').map(
      function(element) {
        return element.trim();
      });

  for (var i = parameters.boards.length; i >= 0; i--) {
    if (!parameters.boards[i]) {
      parameters.boards.splice(i, 1);
    }
  }

  var query = {
    archived : true
  };

  if (parameters.boards.length) {
    query.boardUri = {
      $in : parameters.boards
    };
  }

  threads.countDocuments(query, function counted(error, count) {

    if (error) {
      callback(error);
    } else {

      var pageCount = Math.ceil(count / pageSize);
      pageCount = pageCount || 1;

      var page = parameters.page || 1;

      // style exception, too simple
      threads.find(query, {
        projection : {
          _id : 0,
          boardUri : 1,
          threadId : 1,
          subject : 1,
          message : 1,
          creation : 1
        }
      }).sort({
        creation : 1
      }).skip((page - 1) * pageSize).limit(pageSize).toArray(
          function gotThreads(error, foundThreads) {
            callback(error, foundThreads, pageCount);
          });
      // style exception, too simple

    }

  });

};