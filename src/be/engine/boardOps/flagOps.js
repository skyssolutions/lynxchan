'use strict';

// handles flag management operations on boards

var mongo = require('mongodb');
var ObjectID = mongo.ObjectId;
var maxFlagSize;
var gridFsHandler;
var miscOps;
var db;
var boards;
var threads;
var posts;
var flagLimit;
var flags;
var lang;

var globalBoardModeration;

var newFlagParameters = [ {
  field : 'flagName',
  removeHTML : true
} ];

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();
  maxFlagSize = settings.maxFlagSizeB;
  globalBoardModeration = settings.allowGlobalBoardModeration;
  newFlagParameters[0].length = settings.flagNameLength;
  flagLimit = settings.flagLimit;

};

exports.loadDependencies = function() {

  gridFsHandler = require('../gridFsHandler');
  miscOps = require('../miscOps');
  db = require('../../db');
  boards = db.boards();
  threads = db.threads();
  posts = db.posts();
  flags = db.flags();
  lang = require('../langOps').languagePack;

};

// Section 1: Flag creation {
exports.processFlagFile = function(toInsert, file, callback) {

  var newUrl = '/' + toInsert.boardUri + '/flags/' + toInsert._id;

  gridFsHandler.writeFile(file.pathInDisk, newUrl, file.mime, {
    boardUri : toInsert.boardUri,
    type : 'flag'
  }, function addedFlagFile(error) {
    if (error) {

      // style exception, too simple
      flags.deleteOne({
        _id : toInsert._id
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

};

exports.insertFlag = function(parameters, language, callback) {

  var toInsert = {
    boardUri : parameters.boardUri,
    name : parameters.flagName
  };

  flags.insertOne(toInsert, function insertedFlag(error) {
    if (error && error.code === 11000) {
      callback(lang(language).errRepeatedFlag);
    } else if (error) {
      callback(error);
    } else {
      exports.processFlagFile(toInsert, parameters.files[0], callback);
    }
  });

};

exports.createFlag = function(userData, parameters, language, callback) {

  if (!parameters.files.length) {
    return callback(lang(language).errNoFiles);
  }

  var isSVG = parameters.files[0].mime.indexOf('image/svg') >= 0;

  if (parameters.files[0].mime.indexOf('image/') === -1 || isSVG) {
    return callback(lang(language).errNotAnImage);
  } else if (parameters.files[0].size > maxFlagSize) {
    return callback(lang(language).errFlagTooLarge);
  }

  miscOps.sanitizeStrings(parameters, newFlagParameters);

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedFlagManagement);
    } else {

      flags.countDocuments({
        boardUri : parameters.boardUri
      }, function(error, count) {

        if (error) {
          callback(error);
        } else if (count >= flagLimit) {
          callback(lang(language).errTooManyFlags);
        } else {
          exports.insertFlag(parameters, language, callback);
        }

      });

    }
  });
};
// } Section 1: Flag creation

// Section 2: Flag deletion {
exports.cleanFlagFromPostings = function(flagUrl, boardUri, callback) {

  threads.updateMany({
    boardUri : boardUri,
    flag : flagUrl
  }, {
    $unset : {
      flag : 1,
      flagName : 1,
      innerCache : 1,
      outerCache : 1,
      previewCache : 1,
      clearCache : 1,
      alternativeCaches : 1,
      hashedCache : 1,
      previewHashedCache : 1,
      outerHashedCache : 1,
      outerClearCache : 1
    }
  }, function cleanedThreads() {

    // style exception, too simple
    posts.updateMany({
      boardUri : boardUri,
      flag : flagUrl
    }, {
      $unset : {
        flag : 1,
        flagName : 1,
        innerCache : 1,
        outerCache : 1,
        previewCache : 1,
        alternativeCaches : 1,
        clearCache : 1,
        hashedCache : 1,
        previewHashedCache : 1,
        outerHashedCache : 1,
        outerClearCache : 1
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

};

exports.removeFlag = function(flag, callback) {

  flags.deleteOne({
    _id : flag._id
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
          exports.cleanFlagFromPostings(flagUrl, flag.boardUri, callback);
        }

      });
      // style exception, too simple

    }
  });

};

exports.deleteFlag = function(userData, flagId, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  try {
    flagId = new ObjectID(flagId);
  } catch (error) {
    callback(lang(language).errFlagNotFound);
    return;
  }

  flags.findOne({
    _id : flagId
  }, function gotFlag(error, flag) {
    if (error) {
      callback(error);
    } else if (!flag) {
      callback(lang(language).errFlagNotFound);
    } else {

      // style exception, too simple
      boards.findOne({
        boardUri : flag.boardUri
      }, function gotBoard(error, board) {
        if (error) {
          callback(error);
        } else if (!board) {
          callback(lang(language).errBoardNotFound);
        } else if (board.owner !== userData.login && !globallyAllowed) {
          callback(lang(language).errDeniedFlagManagement);
        } else {
          exports.removeFlag(flag, callback);
        }
      });
      // style exception, too simple

    }
  });

};
// } Section 2: Flag deletion

exports.getFlagsData = function(userData, boardUri, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedFlagManagement);
    } else {

      flags.find({
        boardUri : boardUri
      }, {
        projection : {
          name : 1
        }
      }).sort({
        name : 1
      }).toArray(callback);

    }
  });

};
