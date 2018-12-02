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
var logOps;

exports.loadDependencies = function() {

  logOps = require('./logOps');
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
    deleteMedia, userData, language, callback) {

  if (deleteMedia) {

    var identifiers = [];

    var groupedReferences = postReferences.concat(threadReferences);

    for (var i = 0; i < groupedReferences.length; i++) {

      var reference = groupedReferences[i];
      identifiers.push(reference._id.replace('/', ''));

    }

    exports.deleteFiles(identifiers, userData, language, callback, true);

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
    threadsToClear, deleteMedia, userData, language, callback, boardDeletion) {

  if ((!threadsToClear || !threadsToClear.length) && !boardDeletion) {
    exports.updateReferencesCount(postReferences, [], deleteMedia, userData,
        language, callback);

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

  threads.aggregate(exports.getAggregationQuery(query)).toArray(
      function countedReferences(error, results) {

        if (error) {
          callback(error);
        } else {
          exports.updateReferencesCount(postReferences, results, deleteMedia,
              userData, language, callback);
        }

      });

};

exports.clearPostingReferences = function(boardUri, threadsToClear,
    postsToClear, onlyFilesDeletion, mediaDeletion, userData, language,
    callback) {

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
        userData, language, callback);

    return;
  }

  posts.aggregate(exports.getAggregationQuery(query)).toArray(
      function countedReferences(error, results) {

        if (error) {
          callback(error);
        } else {

          exports.getThreadReferences(results, boardUri, threadsToClear,
              mediaDeletion, userData, language, callback);
        }

      });

};

exports.clearBoardReferences = function(boardUri, language, callback) {

  posts.aggregate(exports.getAggregationQuery({
    boardUri : boardUri,
    'files.0' : {
      $exists : 1
    }
  })).toArray(
      function gotPostsReferences(error, results) {

        if (error) {
          callback(error);
        } else {
          exports.getThreadReferences(results, boardUri, null, false, null,
              language, callback, true);
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

exports.removePrunedFiles = function(identifiers, callback) {

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
  } ]).toArray(function gotNames(error, results) {

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

};

exports.getFilesToPrune = function(callback) {

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
  } ]).toArray(
      function gotIdentifiers(error, results) {

        if (error) {
          callback(error);
        } else if (!results.length) {
          callback();
        } else {

          var identifiers = results[0].identifiers;

          // style exception, too simple
          logOps.insertLog({
            type : 'filePruning',
            time : new Date(),
            description : lang().logFilePruning.replace('{$identifiers}',
                identifiers.join(', ')),
            global : true
          }, function loggedPruning(error) {

            if (error) {
              console.log(error);
            }

            exports.removePrunedFiles(identifiers, callback);

          });
          // style exception, too simple

        }

      });

};

exports.combineCount = function(threadResults, postResults, relation) {

  for (var i = 0; i < threadResults.length; i++) {

    var result = threadResults[i];
    var entry = relation[result._id];

    if (entry) {
      entry.aggregatedCount = result.references;
    }

  }

  for (i = 0; i < postResults.length; i++) {

    result = postResults[i];
    entry = relation[result._id];

    if (entry) {
      entry.aggregatedCount += result.references;
    }

  }

};

exports.getReferenceUpdate = function(threadResults, postResults, relation) {

  var ops = [];

  exports.combineCount(threadResults, postResults, relation);

  for ( var key in relation) {

    var reference = relation[key];

    if (reference.aggregatedCount !== reference.references) {

      ops.push({
        updateOne : {
          filter : {
            identifier : reference.identifier
          },
          update : {
            $set : {
              references : reference.aggregatedCount
            }
          }
        }
      });

    }

  }

  return ops;

};

exports.getRepliesCount = function(threadResults, queryData, page, callback) {

  posts.aggregate(queryData.query).toArray(
      function gotFiles(error, results) {

        if (error) {
          callback(error);
        } else {

          var bulkOperations = exports.getReferenceUpdate(threadResults,
              results, queryData.relation);

          if (!bulkOperations.length) {
            exports.prune(callback, ++page);
          } else {

            // style exception, too simple
            references.bulkWrite(bulkOperations,
                function wroteReferences(error) {

                  if (error) {
                    callback(error);
                  } else {
                    exports.prune(callback, ++page);
                  }

                });
            // style exception, too simple

          }

        }

      });

};

exports.getThreadsCount = function(results, page, callback) {

  var queryData = exports.getReferenceCountQuery(results);

  threads.aggregate(queryData.query).toArray(function gotFiles(error, results) {

    if (error) {
      callback(error);
    } else {
      exports.getRepliesCount(results, queryData, page, callback);
    }

  });

};

exports.getReferenceCountQuery = function(results) {

  var paths = [];
  var countRelation = {};

  for (var i = 0; i < results.length; i++) {

    var result = results[i];

    var path = '/.media/' + result.identifier;
    path += result.extension ? ('.' + result.extension) : '';

    countRelation[path] = {
      identifier : result.identifier,
      references : result.references,
      aggregatedCount : 0
    };

    paths.push(path);

  }

  return {
    relation : countRelation,
    query : [ {
      $match : {
        'files.path' : {
          $in : paths
        }
      }
    }, {
      $project : {
        'files.path' : 1,
        _id : 0
      }
    }, {
      $unwind : '$files'
    }, {
      $group : {
        _id : '$files.path',
        references : {
          $sum : 1
        }
      }
    } ]
  };

};

exports.prune = function(callback, page) {

  page = page || 0;

  references.aggregate([ {
    $sort : {
      _id : 1
    }
  }, {
    $skip : page * maxFilesToDisplay
  }, {
    $limit : maxFilesToDisplay
  }, {
    $project : {
      extension : 1,
      identifier : 1,
      references : 1,
      _id : 0
    }
  } ]).toArray(function gotReferences(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      exports.getFilesToPrune(callback);
    } else {
      exports.getThreadsCount(results, page, callback);
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

  if (parameters.filter) {
    queryBlock.identifier = new RegExp(parameters.filter.toLowerCase());
  }

  references.countDocuments(queryBlock, function counted(error, count) {

    if (error) {
      callback(error);
    } else {

      var pageCount = Math.ceil(count / maxFilesToDisplay);

      pageCount = pageCount || 1;

      var page = parameters.page || 1;

      // style exception, too simple
      references.find(queryBlock, {
        projection : {
          _id : 0,
          references : 1,
          identifier : 1,
          extension : 1
        }
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

// Section 3: File deletion {
exports.deleteReferences = function(userData, identifiers, callback) {

  references.removeMany({
    identifier : {
      $in : identifiers
    }
  }, function removedIdentifiers(error) {

    if (error) {
      callback(error);
    } else {

      logOps.insertLog({
        user : userData.login,
        type : 'mediaDeletion',
        time : new Date(),
        description : lang().logMediaDeletion.replace('{$login}',
            userData.login).replace('{$identifiers}', identifiers.join(', ')),
        global : true
      }, callback);

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
  } ]).toArray(function gotNames(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      exports.deleteReferences(userData, identifiers, callback);
    } else {

      // style exception, too simple
      gridFsHandler.removeFiles(results[0].files, function deletedFiles(error) {

        if (error) {
          callback(error);
        } else {
          exports.deleteReferences(userData, identifiers, callback);
        }
      });
      // style exception, too simple

    }

  });

};
// } Section 3: File deletion

// Section 3: Media details {
exports.postingSorting = function(a, b) {

  if (a.boardUri < b.boardUri) {
    return -1;
  } else if (a.boardUri > b.boardUri) {
    return 1;
  } else {
    return (a.postId || a.threadId) - (b.postId || b.threadId);
  }

};

exports.getPostsForMediaDetails = function(media, path, foundThreads, cb) {

  posts.find({
    'files.path' : path
  }, {
    projection : {
      boardUri : 1,
      threadId : 1,
      postId : 1,
      _id : 0
    }
  }).toArray(
      function gotPosts(error, foundPosts) {

        if (error) {
          cb(error);
        } else {

          cb(null, {
            references : foundThreads.concat(foundPosts).sort(
                exports.postingSorting),
            size : media.size,
            uploadDate : media._id.getTimestamp()
          });

        }

      });

};

exports.getMediaDetails = function(userData, parameters, language, callback) {

  var globalStaff = userData.globalRole <= maxGlobalStaffRole;

  if (!globalStaff) {

    callback(lang(language).errDeniedMediaManagement);

    return;
  }

  references.findOne({
    identifier : parameters.identifier
  }, function found(error, media) {

    if (error) {
      callback(error);
    } else if (!media) {
      callback(lang(language).errMediaNotFound);
    } else {

      var path = '/.media/' + parameters.identifier;

      if (media.extension) {
        path += '.' + media.extension;
      }

      // style exception, too simple
      threads.find({
        'files.path' : path
      }, {
        projection : {
          boardUri : 1,
          threadId : 1,
          _id : 0
        }
      }).toArray(function gotThreads(error, foundThreads) {

        if (error) {
          callback(error);
        } else {
          exports.getPostsForMediaDetails(media, path, foundThreads, callback);
        }

      });
      // style exception, too simple

    }

  });

};
// } Section 3: Media details
