'use strict';

// handle editing operations

var taskListener = require('../../taskListener');
var db = require('../../db');
var boards = db.boards();
var threads = db.threads();
var posts = db.posts();
var lang;
var miscOps;
var postOps;
var overboardOps;
var common;
var wsEnabled;
var r9k;
var sfwOverboard;
var overboard;

exports.editArguments = [ {
  field : 'message',
  removeHTML : false
}, {
  field : 'subject',
  length : 128,
  removeHTML : true
} ];

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();

  exports.editArguments[0].length = settings.messageLength;

  wsEnabled = settings.wsPort || settings.wssPort;
  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
};

exports.loadDependencies = function() {

  lang = require('../langOps').languagePack;
  miscOps = require('../miscOps');
  overboardOps = require('../overboardOps');
  postOps = require('../postingOps').common;
  common = require('.').common;
  r9k = require('../r9k');

};

exports.getPostingToEdit = function(userData, parameters, language, callback) {

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (!globalStaff && !common.isInBoardStaff(userData, board)) {
      callback(lang(language).errDeniedEdit);
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
      collectionToUse.findOne(query, {
        subject : 1,
        message : 1
      }, function gotPosting(error, posting) {
        if (error) {
          callback(error);
        } else if (!posting) {
          callback(lang(language).errPostingNotFound);
        } else {
          callback(null, posting);
        }
      });
      // style exception, too simple
    }

  });

};

// Section 1: Thread settings {
exports.setNewThreadSettings = function(parameters, thread, callback) {

  parameters.lock = !!parameters.lock;
  parameters.pin = !!parameters.pin;
  parameters.cyclic = !!parameters.cyclic;

  var changePin = parameters.pin !== thread.pinned;
  var changeLock = parameters.lock !== thread.locked;
  var changeCyclic = parameters.cyclic !== thread.cyclic;

  if (!changeLock && !changePin && !changeCyclic) {
    callback();

    return;
  }

  threads.updateOne({
    _id : thread._id
  }, {
    $set : {
      locked : parameters.lock,
      pinned : parameters.pin,
      cyclic : parameters.cyclic,
      autoSage : thread.autoSage && !parameters.cyclic
    },
    $unset : miscOps.individualCaches
  }, function updatedThread(error) {

    if (!error) {
      // signal rebuild of thread
      process.send({
        board : thread.boardUri,
        thread : thread.threadId
      });

      if (changePin) {

        // signal rebuild of board pages
        postOps.setThreadsPage(thread.boardUri, function(errr) {
          if (error) {
            console.log(error);
          } else {
            process.send({
              board : thread.boardUri
            });
          }
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

exports.getThreadToChangeSettings = function(parameters, language, callback) {

  threads.findOne({
    boardUri : parameters.boardUri,
    threadId : +parameters.threadId
  }, function gotThread(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback(lang(language).errThreadNotFound);
    } else {

      exports.setNewThreadSettings(parameters, thread, callback);

    }
  });
};

exports.setThreadSettings = function(userData, parameters, language, callback) {

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (!common.isInBoardStaff(userData, board) && !globalStaff) {
      callback(lang(language).errDeniedThreadManagement);
    } else {
      exports.getThreadToChangeSettings(parameters, language, callback);
    }
  });

};
// } Section 1: Thread settings

// Section 2: Save edit {
exports.queueRebuild = function(page, board, posting, callback) {

  process.send({
    board : board,
    thread : posting.threadId
  });

  process.send({
    board : board,
    thread : posting.threadId
  });

  if (overboard || sfwOverboard) {
    overboardOps.reaggregate({
      overboard : true
    });
  }

  process.send({
    board : board,
    page : page
  });

  callback();
};

exports.recordEdit = function(parameters, login, language, callback) {

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
      hash : parameters.hash,
      markdown : parameters.markdown,
      message : parameters.message,
      subject : parameters.subject
    },
    $unset : miscOps.individualCaches
  }, function savedEdit(error, posting) {
    if (error) {
      callback(error);
    } else if (!posting.value) {
      callback(lang(language).errPostingNotFound);
    } else if (posting.value.postId) {

      if (wsEnabled) {

        taskListener.sendToSocket(null, {
          type : 'notifySockets',
          threadId : posting.value.threadId,
          boardUri : parameters.boardUri,
          target : [ posting.value.postId ],
          action : 'edit'
        });

      }

      // style exception, too simple
      threads.findOne({
        boardUri : parameters.boardUri,
        threadId : posting.value.threadId
      }, function gotThread(error, thread) {
        if (error) {
          callback(error);
        } else {
          exports.queueRebuild(thread.page, parameters.boardUri, posting.value,
              callback);
        }
      });
      // style exception, too simple

    } else {
      exports.queueRebuild(posting.value.page, parameters.boardUri,
          posting.value, callback);
    }
  });
};

exports.getMarkdown = function(parameters, userData, board, language, cb) {

  postOps.markdownText(parameters.message, parameters.boardUri, board.settings
      .indexOf('allowCode') > -1, function gotMarkdown(error, markdown) {
    if (error) {
      cb(error);
    } else {
      parameters.markdown = markdown;
      exports.recordEdit(parameters, userData.login, language, cb);
    }
  });

};

exports.saveEdit = function(userData, parameters, language, callback) {

  miscOps.sanitizeStrings(parameters, exports.editArguments);

  parameters.hash = r9k.getMessageHash(parameters.message);

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (!globalStaff && !common.isInBoardStaff(userData, board)) {
      callback(lang(language).errDeniedEdit);
    } else {

      // style exception, too simple
      r9k.check(parameters, board, language, function checked(error) {

        if (error) {
          callback(error);
        } else {
          exports.getMarkdown(parameters, userData, board, language, callback);
        }
      });
      // style exception, too simple

    }
  });
};
// } Section 2: Save edit
