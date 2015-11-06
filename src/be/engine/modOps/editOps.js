'use strict';

// handle editing operations

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../../db');
var boards = db.boards();
var threads = db.threads();
var posts = db.posts();
var lang;
var miscOps;
var postOps;
var common;

var editArguments = [ {
  field : 'message',
  length : 2048,
  removeHTML : false
} ];

exports.loadDependencies = function() {

  lang = require('../langOps').languagePack();
  miscOps = require('../miscOps');
  postOps = require('../postingOps').common;
  common = require('.').common;

};

exports.getPostingToEdit = function(userData, parameters, callback) {

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (!globalStaff && !common.isInBoardStaff(userData, board)) {
      callback(callback(lang.errDeniedEdit));
    } else {

      var collectionToUse;
      var query;

      if (parameters.postId) {

        query = {
          postId : +parameters.postId
        };
        collectionToUse = parameters.postId ? posts : threads;
      } else {
        collectionToUse = threads;

        query = {
          threadId : +parameters.threadId
        };

      }

      query.boardUri = parameters.boardUri;

      // style exception, too simple
      collectionToUse.findOne(query, function gotPosting(error, posting) {
        if (error) {
          callback(error);
        } else if (!posting) {
          callback(lang.errPostingNotFound);
        } else {
          callback(null, posting.message);
        }
      });
      // style exception, too simple
    }

  });

};

// Section 1: Thread settings {
exports.setNewThreadSettings = function(parameters, thread, callback) {

  parameters.lock = parameters.lock ? true : false;
  parameters.pin = parameters.pin ? true : false;
  parameters.cyclic = parameters.cyclic ? true : false;

  var changePin = parameters.pin !== thread.pinned;
  var changeLock = parameters.lock !== thread.locked;
  var changeCyclic = parameters.cyclic !== thread.cyclic;

  if (!changeLock && !changePin && !changeCyclic) {
    callback();

    return;
  }

  threads.updateOne({
    _id : new ObjectID(thread._id)
  }, {
    $set : {
      locked : parameters.lock,
      pinned : parameters.pin,
      cyclic : parameters.cyclic,
      autoSage : !parameters.cyclic
    }
  }, function updatedThread(error) {

    if (!error) {
      // signal rebuild of thread
      process.send({
        board : thread.boardUri,
        thread : thread.threadId
      });

      if (changePin) {
        // signal rebuild of board pages
        process.send({
          board : thread.boardUri
        });
      } else {
        // signal rebuild of page
        process.send({
          board : thread.boardUri,
          page : thread.page
        });
      }

    }

    callback(error);

  });
};

exports.getThreadToChangeSettings = function(parameters, callback) {

  threads.findOne({
    boardUri : parameters.boardUri,
    threadId : +parameters.threadId
  }, function gotThread(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback(lang.errThreadNotFound);
    } else {

      exports.setNewThreadSettings(parameters, thread, callback);

    }
  });
};

exports.setThreadSettings = function(userData, parameters, callback) {

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (!common.isInBoardStaff(userData, board) && !globalStaff) {
      callback(lang.errDeniedThreadManagement);
    } else {
      exports.getThreadToChangeSettings(parameters, callback);
    }
  });

};
// } Section 1: Thread settings

// Section 2: Save edit {
exports.queueRebuild = function(page, board, threadId, callback) {
  process.send({
    board : board,
    thread : threadId
  });

  process.send({
    board : board,
    page : page
  });

  callback();
};

exports.recordEdit = function(parameters, login, callback) {

  var collectionToUse;
  var query;

  if (parameters.postId) {

    query = {
      postId : +parameters.postId
    };
    collectionToUse = parameters.postId ? posts : threads;
  } else {
    collectionToUse = threads;

    query = {
      threadId : +parameters.threadId
    };

  }

  query.boardUri = parameters.boardUri;

  collectionToUse.findOneAndUpdate(query, {
    $set : {
      lastEditTime : new Date(),
      lastEditLogin : login,
      markdown : parameters.markdown,
      message : parameters.message
    }
  }, function savedEdit(error, posting) {
    if (error) {
      callback(error);
    } else if (!posting.value) {
      callback(lang.errPostingNotFound);
    } else if (posting.value.postId) {

      // style exception, too simple
      threads.findOne({
        boardUri : parameters.boardUri,
        threadId : posting.value.threadId
      }, function gotThread(error, thread) {
        if (error) {
          callback(error);
        } else {
          exports.queueRebuild(thread.page, parameters.boardUri,
              posting.value.threadId, callback);
        }
      });
      // style exception, too simple

    } else {
      exports.queueRebuild(posting.value.page, parameters.boardUri,
          posting.value.threadId, callback);
    }
  });
};

exports.saveEdit = function(userData, parameters, callback) {

  miscOps.sanitizeStrings(parameters, editArguments);

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (!globalStaff && !common.isInBoardStaff(userData, board)) {
      callback(callback(lang.errDeniedEdit));
    } else {

      // style exception, too simple
      postOps.markdownText(parameters.message, parameters.boardUri,
          board.settings.indexOf('allowCode') > -1, function gotMarkdown(error,
              markdown) {
            if (error) {
              callback(error);
            } else {
              parameters.markdown = markdown;
              exports.recordEdit(parameters, userData.login, callback);
            }
          });
      // style exception, too simple

    }
  });
};
// } Section 2: Save edit
