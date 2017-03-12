'use strict';

var db = require('../db');
var threads = db.threads();
var posts = db.posts();
var files = db.files();
var references = db.uploadReferences();
var maxGlobalStaffRole;
var gridFsHandler;
var lang;
var maxFilesToDisplay;

exports.loadDependencies = function() {
  gridFsHandler = require('./gridFsHandler');
  lang = require('./langOps').languagePack;

  maxGlobalStaffRole = require('./miscOps').getMaxStaffRole();
};

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();
  maxFilesToDisplay = settings.mediaPageSize;

};

// Section 1: Reference decrease {
exports.getAggregationQuery = function(matchQuery) {

  return [ {
    $match : matchQuery
  }, {
    $project : {
      _id : 0,
      'files.md5' : 1,
      'files.mime' : 1
    }
  }, {
    $unwind : '$files'
  }, {
    $group : {
      _id : {
        $concat : [ '$files.md5', '-', '$files.mime' ]
      },
      count : {
        $sum : 1
      }
    }
  } ];

};

exports.getOperations = function(postReferences, threadReferences) {

  var finalReferences = {};

  for (var i = 0; i < postReferences.length; i++) {
    var reference = postReferences[i];
    finalReferences[reference._id] = reference.count;

  }

  for (i = 0; i < threadReferences.length; i++) {
    reference = threadReferences[i];

    if (finalReferences[reference._id]) {
      finalReferences[reference._id] += reference.count;
    } else {
      finalReferences[reference._id] = reference.count;
    }

  }

  var operations = [];

  for ( var key in finalReferences) {

    if (finalReferences.hasOwnProperty(key)) {

      operations.push({
        updateOne : {
          filter : {
            identifier : key.replace('/', '')
          },
          update : {
            $inc : {
              references : -finalReferences[key]
            }
          }
        }
      });

    }

  }

  return operations;

};

exports.updateReferencesCount = function(postReferences, threadReferences,
    deleteMedia, language, callback) {

  if (deleteMedia) {

    var identifiers = [];

    var groupedReferences = postReferences.concat(threadReferences);

    for (var i = 0; i < groupedReferences.length; i++) {

      var reference = groupedReferences[i];
      identifiers.push(reference._id.replace('/', ''));

    }

    exports.deleteFiles(identifiers, null, language, callback, true);

  } else {

    var operations = exports.getOperations(postReferences, threadReferences);

    if (!operations.length) {
      callback();
      return;
    }

    references.bulkWrite(operations, callback);
  }

};

exports.getThreadReferences = function(postReferences, boardUri,
    threadsToClear, deleteMedia, language, callback, boardDeletion) {

  if ((!threadsToClear || !threadsToClear.length) && !boardDeletion) {
    exports.updateReferencesCount(postReferences, [], deleteMedia, language,
        callback);

    return;
  }

  var query = {
    boardUri : boardUri,
    'files.0' : {
      $exists : 1
    }
  };

  if (threadsToClear && threadsToClear.length) {
    query.threadId = {
      $in : threadsToClear
    };
  }

  threads.aggregate(exports.getAggregationQuery(query),
      function countedReferences(error, results) {

        if (error) {
          callback(error);
        } else {
          exports.updateReferencesCount(postReferences, results, deleteMedia,
              language, callback);
        }

      });

};

exports.clearPostingReferences = function(boardUri, threadsToClear,
    postsToClear, onlyFilesDeletion, mediaDeletion, language, callback) {

  var query = {
    boardUri : boardUri,
    'files.0' : {
      $exists : 1
    }
  };

  var addedLimiter = false;

  if (threadsToClear && threadsToClear.length && !onlyFilesDeletion) {
    query.threadId = {
      $in : threadsToClear
    };

    addedLimiter = true;
  }

  if (postsToClear && postsToClear.length) {
    query.postId = {
      $in : postsToClear
    };

    addedLimiter = true;
  }

  if (!addedLimiter) {
    exports.getThreadReferences([], boardUri, threadsToClear, mediaDeletion,
        language, callback);

    return;
  }

  posts.aggregate(exports.getAggregationQuery(query),
      function countedReferences(error, results) {

        if (error) {
          callback(error);
        } else {

          exports.getThreadReferences(results, boardUri, threadsToClear,
              mediaDeletion, language, callback);
        }

      });

};

exports.clearBoardReferences = function(boardUri, language, callback) {

  posts.aggregate(exports.getAggregationQuery({
    boardUri : boardUri,
    'files.0' : {
      $exists : 1
    }
  }), function gotPostsReferences(error, results) {

    if (error) {
      callback(error);
    } else {
      exports.getThreadReferences(results, boardUri, null, false, language,
          callback, true);
    }

  });

};
// } Section 1: Reference decrease

// Section 2: File pruning {
exports.deletePrunedFiles = function(files, callback) {

  gridFsHandler.removeFiles(files, function deletedFiles(error) {

    if (error) {
      callback(error);
    } else {
      references.removeMany({
        references : {
          $lt : 1
        }
      }, callback);
    }
  });

};

exports.prune = function(callback) {

  references.aggregate([ {
    $match : {
      references : {
        $lt : 1
      }
    }
  }, {
    $project : {
      identifier : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 0,
      identifiers : {
        $push : '$identifier'
      }
    }
  } ], function gotIdentifiers(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {

      // style exception, too simple
      files.aggregate([ {
        $match : {
          'metadata.identifier' : {
            $in : results[0].identifiers
          }
        }
      }, {
        $project : {
          filename : 1,
          _id : 0
        }
      }, {
        $group : {
          _id : 0,
          files : {
            $push : '$filename'
          }
        }
      } ], function gotNames(error, results) {

        if (error) {
          callback(error);
        } else if (!results.length) {

          references.removeMany({
            references : {
              $lt : 1
            }
          }, callback);

        } else {
          exports.deletePrunedFiles(results[0].files, callback);
        }

      });
      // style exception, too simple

    }

  });

};
// } Section 2: File pruning

exports.getMedia = function(userData, parameters, language, callback) {

  var globalStaff = userData.globalRole <= maxGlobalStaffRole;

  if (!globalStaff) {

    callback(lang(language).errDeniedMediaManagement);

    return;
  }

  var queryBlock = {};

  if (parameters.orphaned) {
    queryBlock.references = {
      $lt : 1
    };
  }

  references.count(queryBlock, function counted(error, count) {

    if (error) {
      callback(error);
    } else {

      var pageCount = Math.ceil(count / maxFilesToDisplay);

      pageCount = pageCount || 1;

      var page = parameters.page || 1;

      // style exception, too simple
      references.find(queryBlock, {
        _id : 0,
        references : 1,
        identifier : 1,
        extension : 1
      }).sort({
        _id : -1
      }).skip((page - 1) * maxFilesToDisplay).limit(maxFilesToDisplay).toArray(
          function gotReferences(error, foundReferences) {
            callback(error, foundReferences, pageCount);
          });
      // style exception, too simple

    }

  });

};

exports.deleteFiles = function(identifiers, userData, language, callback,
    override) {

  if (!override) {
    var allowed = userData.globalRole <= maxGlobalStaffRole;
    if (!allowed) {

      callback(lang(language).errDeniedMediaManagement);

      return;
    }
  } else if (!identifiers || !identifiers.length) {
    callback();
    return;
  }

  files.aggregate([ {
    $match : {
      'metadata.identifier' : {
        $in : identifiers
      }
    }
  }, {
    $project : {
      filename : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function gotNames(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {

      references.removeMany({
        identifier : {
          $in : identifiers
        }
      }, callback);

    } else {

      // style exception, too simple
      gridFsHandler.removeFiles(results[0].files, function deletedFiles(error) {

        if (error) {
          callback(error);
        } else {
          references.removeMany({
            identifier : {
              $in : identifiers
            }
          }, callback);
        }
      });
      // style exception, too simple

    }

  });

};