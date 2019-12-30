'use strict';

var db = require('../db');
var boards = db.boards();
var threads = db.threads();
var posts = db.posts();
var boardAllowedArchives;
var boardOps;
var lang;
var miscOps;
var pageSize = 50;

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();
  boardAllowedArchives = settings.allowBoardStaffArchiving;

};

exports.loadDependencies = function() {
  miscOps = require('./miscOps');
  lang = require('./langOps').languagePack;
  boardOps = require('./boardOps').meta;
};

// Section 1: Archival {
exports.cleanPasswords = function(thread, callback) {

  posts.updateMany({
    threadId : thread.threadId,
    boardUri : thread.boardUri
  }, {
    $unset : {
      password : 1
    }
  }, callback);

};

exports.setArchive = function(thread, callback) {

  var unset = JSON.parse(JSON.stringify(miscOps.individualCaches));
  unset.password = 1;

  threads.updateOne({
    _id : thread._id
  }, {
    $set : {
      archived : true
    },
    $unset : unset
  }, function(error) {

    if (error) {
      return callback(error);
    }

    process.send({
      board : thread.boardUri,
      thread : thread.threadId
    });

    process.send({
      board : thread.boardUri
    });

    // style exception, too simple
    boards.updateOne({
      boardUri : thread.boardUri
    }, {
      $inc : {
        threadCount : -1
      }
    }, function(error) {

      if (error) {
        callback(error);
      } else {
        exports.cleanPasswords(thread, callback);
      }

    });
    // style exception, too simple

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
    return exports.addToArchive(language, parameters, callback);
  } else if (!boardAllowedArchives) {
    return callback(lang(language).errNotAllowedToArchive);
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
      return callback(error);
    } else if (!board) {
      return callback(lang(language).errBoardNotFound);
    }

    var allowed = userData.login === board.owner;

    if (!allowed && board.volunteers) {
      allowed = board.volunteers.indexOf(userData.login) >= 0;
    }

    if (!allowed) {
      callback(lang(language).errNotAllowedToArchive);
    } else {
      exports.addToArchive(language, parameters, callback);
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

exports.autoArchive = function(ids, board) {

  if (!ids.length) {
    return;
  }

  threads.updateMany({
    boardUri : board,
    threadId : {
      $in : ids
    }
  }, {
    $set : {
      archived : true
    },
    $unset : miscOps.individualCaches
  }, function(error) {

    if (error) {
      console.log(error);
    } else {

      for (var i = 0; i < ids; i++) {

        process.send({
          board : board,
          thread : ids[i]
        });

      }

    }

  });

};