'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var settings = require('../../boot').getGeneralSettings();
var maxFlagSize = settings.maxFlagSizeB;
var gridFsHandler;
var miscOps;
var db;
var boards;
var threads;
var posts;
var flags;
var lang;

var globalBoardModeration = settings.allowGlobalBoardModeration;

var newFlagParameters = [ {
  field : 'flagName',
  length : 16,
  removeHTML : true
} ];

exports.loadDependencies = function() {

  gridFsHandler = require('../gridFsHandler');
  miscOps = require('../miscOps');
  db = require('../../db');
  boards = db.boards();
  threads = db.threads();
  posts = db.posts();
  flags = db.flags();
  lang = require('../langOps').languagePack();

};

// Section 1: Flag creation {
function processFlagFile(toInsert, file, callback) {

  var newUrl = '/' + toInsert.boardUri + '/flags/' + toInsert._id;

  gridFsHandler.writeFile(file.pathInDisk, newUrl, file.mime, {
    boardUri : toInsert.boardUri,
    type : 'flag'
  }, function addedFlagFile(error) {
    if (error) {

      // style exception, too simple
      flags.removeOne({
        _id : new ObjectID(toInsert._id)
      }, function removedFlag(deletionError) {
        callback(deletionError || error);
      });
      // style exception, too simple

    } else {
      process.send({
        board : toInsert.boardUri,
        buildAll : true
      });

      callback(null, toInsert._id);
    }
  });

}

exports.createFlag = function(userData, parameters, callback) {

  if (!parameters.files.length) {
    callback(lang.errNoFiles);
    return;
  } else if (parameters.files[0].mime.indexOf('image/') === -1) {
    callback(lang.errNotAnImage);
    return;
  } else if (parameters.files[0].size > maxFlagSize) {
    callback(lang.errFlagTooLarge);
  }

  miscOps.sanitizeStrings(parameters, newFlagParameters);

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.deniedFlagManagement);
    } else {

      var toInsert = {
        boardUri : parameters.boardUri,
        name : parameters.flagName
      };

      // style exception, too simple
      flags.insertOne(toInsert, function insertedFlag(error) {
        if (error && error.code === 11000) {
          callback(lang.errRepeatedFlag);
        } else if (error) {
          callback(error);
        } else {
          processFlagFile(toInsert, parameters.files[0], callback);
        }
      });
      // style exception, too simple

    }
  });
};
// } Section 1: Flag creation

// Section 2: Flag deletion {
function cleanFlagFromPostings(flagUrl, boardUri, callback) {

  threads.updateMany({
    boardUri : boardUri,
    flag : flagUrl
  }, {
    $unset : {
      flag : 1,
      flagName : 1
    }
  }, function cleanedThreads() {

    // style exception, too simple
    posts.updateMany({
      boardUri : boardUri,
      flag : flagUrl
    }, {
      $unset : {
        flag : 1,
        flagName : 1
      }
    }, function cleanedPosts() {
      process.send({
        board : boardUri,
        buildAll : true
      });

      callback(null, boardUri);
    });
    // style exception, too simple

  });

}

function removeFlag(flag, callback) {

  flags.removeOne({
    _id : new ObjectID(flag._id)
  }, function removedFlag(error) {
    if (error) {
      callback(error);
    } else {

      var flagUrl = '/' + flag.boardUri + '/flags/' + flag._id;

      // style exception, too simple
      gridFsHandler.removeFiles(flagUrl, function removedFlagFile(error) {

        if (error) {
          callback(error);
        } else {
          cleanFlagFromPostings(flagUrl, flag.boardUri, callback);
        }

      });
      // style exception, too simple

    }
  });

}

exports.deleteFlag = function(userData, flagId, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  flags.findOne({
    _id : new ObjectID(flagId)
  }, function gotFlag(error, flag) {
    if (error) {
      callback(error);
    } else if (!flag) {
      callback(lang.errFlagNotFound);
    } else {

      // style exception, too simple
      boards.findOne({
        boardUri : flag.boardUri
      }, function gotBoard(error, board) {
        if (error) {
          callback(error);
        } else if (!board) {
          callback(lang.errBoardNotFound);
        } else if (board.owner !== userData.login && !globallyAllowed) {
          callback(lang.deniedFlagManagement);
        } else {
          removeFlag(flag, callback);
        }
      });
      // style exception, too simple

    }
  });

};
// } Section 2: Flag deletion

exports.getFlagsData = function(userData, boardUri, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.deniedFlagManagement);
    } else {

      flags.find({
        boardUri : boardUri
      }, {
        name : 1
      }).sort({
        name : 1
      }).toArray(callback);

    }
  });

};
