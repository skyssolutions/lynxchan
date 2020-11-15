'use strict';

// handles board customization operations

var spoilerPath = require('../../kernel').spoilerImage();
var db = require('../../db');
var threads = db.threads();
var posts = db.posts();
var miscOps;
var boards = db.boards();
var lang;
var gridFsHandler;

var globalBoardModeration;
var customJs;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();
  globalBoardModeration = settings.allowGlobalBoardModeration;
  customJs = settings.allowBoardCustomJs;

};

exports.loadDependencies = function() {

  miscOps = require('../miscOps');
  gridFsHandler = require('../gridFsHandler');
  lang = require('../langOps').languagePack;

};

// Section 1: Custom CSS upload {
exports.updateBoardAfterNewCss = function(board, callback) {

  if (!boards.usesCustomCss) {
    boards.updateOne({
      boardUri : board.boardUri
    }, {
      $set : {
        usesCustomCss : true
      }
    }, function updatedBoard(error) {
      if (error) {
        callback(error);
      } else {
        process.send({
          board : board.boardUri,
          buildAll : true
        });

        callback();
      }

    });
  } else {
    callback();
  }

};

exports.setCustomCss = function(userData, boardUri, file, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedCssManagement);
    } else if (file.mime !== 'text/css') {
      callback(lang(language).errOnlyCssAllowed);
    } else {

      // style exception, too simple
      gridFsHandler.writeFile(file.pathInDisk, '/' + boardUri + '/custom.css',
          file.mime, {
            type : 'custom',
            boardUri : boardUri
          }, function savedFile(error) {
            if (error) {
              callback(error);
            } else {
              exports.updateBoardAfterNewCss(board, callback);
            }
          });
      // style exception, too simple

    }
  });

};
// } Section 1: Custom CSS upload

// Section 2: Custom CSS deletion {
exports.updateBoardAfterDeleteCss = function(board, callback) {

  if (board.usesCustomCss) {
    boards.updateOne({
      boardUri : board.boardUri
    }, {
      $set : {
        usesCustomCss : false
      }
    }, function updatedBoard(error) {
      if (error) {
        callback(error);
      } else {
        process.send({
          board : board.boardUri,
          buildAll : true
        });
        callback();
      }

    });
  } else {
    callback();
  }

};

exports.deleteCustomCss = function(userData, boardUri, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedCssManagement);
    } else {

      // style exception, too simple
      gridFsHandler.removeFiles('/' + boardUri + '/custom.css',
          function removedFile(error) {
            if (error) {
              callback(error);
            } else {
              exports.updateBoardAfterDeleteCss(board, callback);
            }
          });
      // style exception, too simple

    }
  });

};
// } Section 2: Custom CSS deletion

exports.setCustomSpoiler = function(userData, boardUri, file, language,
    callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedSpoilerManagement);
    } else if (file.mime.indexOf('image/') === -1) {
      callback(lang(language).errNotAnImage);
    } else {

      var newPath = '/' + boardUri + '/custom.spoiler';

      // style exception, too simple
      gridFsHandler.writeFile(file.pathInDisk, newPath, file.mime, {
        type : 'custom',
        boardUri : boardUri
      }, function savedFile(error) {

        if (error) {
          callback(error);
        } else if (!boards.usesCustomSpoiler) {
          boards.updateOne({
            boardUri : board.boardUri
          }, {
            $set : {
              usesCustomSpoiler : true
            }
          }, callback);
        } else {
          callback();
        }

      });
      // style exception, too simple

    }
  });
};

// Section 3: spoiler deletion {
exports.removeUsedSpoilers = function(boardUri, callback) {

  var filter = {
    boardUri : boardUri,
    'files.thumb' : '/' + boardUri + '/custom.spoiler'
  };

  var update = {
    $set : {
      'files.$[file].thumb' : spoilerPath
    },
    $unset : miscOps.individualCaches
  };

  var options = {
    arrayFilters : [ {
      'file.thumb' : '/' + boardUri + '/custom.spoiler'
    } ]
  };

  posts.updateMany(filter, update, options, function(error) {

    // style exception, too simple
    threads.updateMany(filter, update, options, function(error) {

      process.send({
        board : boardUri,
        buildAll : true
      });

      callback();

    });
    // style exception, too simple

  });

};

exports.eraseSpoilerFile = function(boardUri, callback) {

  gridFsHandler.removeFiles('/' + boardUri + '/custom.spoiler',
      function removedFile(error) {

        if (error) {
          return callback(error);
        }

        // style exception, too simple
        boards.updateOne({
          boardUri : boardUri
        }, {
          $set : {
            usesCustomSpoiler : false
          }
        }, function(error) {

          if (error) {
            return callback(error);
          }

          exports.removeUsedSpoilers(boardUri, callback);

        });
        // style exception, too simple

      });

};

exports.deleteCustomSpoiler = function(userData, boardUri, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedSpoilerManagement);
    } else {

      exports.eraseSpoilerFile(boardUri, callback);

    }
  });

};

// } Section 3: spoiler deletion

// Section 4: Custom javascript upload {
exports.updateBoardAfterNewJs = function(board, callback) {

  if (!board.usesCustomJs) {
    boards.updateOne({
      boardUri : board.boardUri
    }, {
      $set : {
        usesCustomJs : true
      }
    }, function updatedBoard(error) {
      if (error) {
        callback(error);
      } else {
        process.send({
          board : board.boardUri,
          buildAll : true
        });

        callback();
      }

    });
  } else {
    callback();
  }

};

exports.allowCustomJs = function(board) {

  var allow = (board.specialSettings || []).indexOf('allowJs') >= 0;

  return allow || customJs;
};

exports.setCustomJs = function(userData, boardUri, file, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  var isJS = file.mime === 'application/javascript';

  if (!isJS) {
    isJS = file.mime === 'application/x-javascript';
  }

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {

    if (error) {
      return callback(error);
    } else if (!board) {
      return callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      return callback(lang(language).errDeniedJsManagement);
    } else if (!isJS) {
      return callback(lang(language).errOnlyJsAllowed);
    } else if (!exports.allowCustomJs(board)) {
      return callback(lang(language).errNoCustomJs);
    }

    // style exception, too simple
    gridFsHandler.writeFile(file.pathInDisk, '/' + boardUri + '/custom.js',
        file.mime, {
          type : 'custom',
          boardUri : boardUri
        }, function savedFile(error) {
          if (error) {
            callback(error);
          } else {
            exports.updateBoardAfterNewJs(board, callback);
          }
        });
    // style exception, too simple

  });

};
// } Section 4: Custom javascript upload

// Section 5: Custom javascript deletion {
exports.updateBoardAfterDeleteJs = function(board, callback) {

  if (board.usesCustomJs) {
    boards.updateOne({
      boardUri : board.boardUri
    }, {
      $set : {
        usesCustomJs : false
      }
    }, function updatedBoard(error) {
      if (error) {
        callback(error);
      } else {
        process.send({
          board : board.boardUri,
          buildAll : true
        });

        callback();
      }

    });
  } else {
    callback();
  }

};

exports.deleteCustomJs = function(userData, boardUri, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedJsManagement);
    } else {

      // style exception, too simple
      gridFsHandler.removeFiles('/' + boardUri + '/custom.js',
          function removedFile(error) {
            if (error) {
              callback(error);
            } else {
              exports.updateBoardAfterDeleteJs(board, callback);
            }
          });
      // style exception, too simple

    }
  });

};
// } Section 5: Custom javascript deletion

// Section 6: Clearing custom javascript
exports.removeAllCustomJs = function(urisToClean) {

  var filesToDelete = [];

  for (var i = 0; i < urisToClean.length; i++) {
    filesToDelete.push('/' + urisToClean[i] + '/custom.js');
  }

  gridFsHandler.removeFiles(filesToDelete, function removedFile(error) {
    if (error) {
      console.log(error);
    } else {

      for (i = 0; i < urisToClean.length; i++) {
        process.send({
          board : urisToClean[i],
          buildAll : true
        });

      }

    }
  });

};

exports.clearCustomJs = function() {

  boards.aggregate([ {
    $match : {
      usesCustomJs : true,
      specialSettings : {
        $ne : 'allowJs'
      }
    }
  }, {
    $group : {
      _id : 0,
      boards : {
        $push : '$boardUri'
      }
    }
  } ]).toArray(function gotBoards(error, foundBoards) {

    if (error) {
      console.log(error);
    }

    if (!foundBoards.length) {
      return;
    }

    var urisToClean = foundBoards[0].boards;

    // style exception, too simple
    boards.updateMany({
      boardUri : {
        $in : urisToClean
      }
    }, {
      $set : {
        usesCustomJs : false
      }
    }, function updatedBoards(error) {
      if (error) {
        console.log(error);
      } else {
        exports.removeAllCustomJs(urisToClean);
      }
    });
    // style exception, too simple

  });

};
// Section 6: Clearing custom javascript
