'use strict';

var fs = require('fs');
var db = require('../db');
var bucket = new (require('mongodb')).GridFSBucket(db.conn());
var threads = db.threads();
var posts = db.posts();
var files = db.files();
var chunks = db.chunks();
var references = db.uploadReferences();
var maxGlobalStaffRole;
var gridFsHandler;
var lang;
var redactedModNames;
var pruningMode;
var maxFilesToDisplay;
var miscOps;
var logOps;

exports.loadDependencies = function() {

  logOps = require('./logOps');
  miscOps = require('./miscOps');
  gridFsHandler = require('./gridFsHandler');
  lang = require('./langOps').languagePack;

  maxGlobalStaffRole = require('./miscOps').getMaxStaffRole();
};

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();
  redactedModNames = settings.redactModNames;
  maxFilesToDisplay = settings.mediaPageSize;
  pruningMode = settings.pruningMode;

};

// Section 1: Reference decrease {
exports.clearNewOrphans = function(identifiers, callback) {

  references.aggregate([ {
    $match : {
      identifier : {
        $in : identifiers
      },
      references : {
        $lt : 1
      }
    }
  }, {
    $group : {
      _id : 0,
      identifiers : {
        $push : '$identifier'
      }
    }
  } ]).toArray(

  function(error, results) {

    if (error || !results.length) {
      return callback(error);
    }

    exports.removePrunedFiles(results[0].identifiers, callback);

  });

};

exports.checkNewOrphans = function(identifiers, callback) {

  references.aggregate([ {
    $match : {
      identifier : {
        $in : identifiers
      }
    }
  }, {
    $project : {
      extension : 1,
      identifier : 1,
      references : 1,
      _id : 0
    }
  } ]).toArray(function gotReferences(error, results) {

    if (error || !results.length) {
      return callback(error);
    }

    // style exception, too simple
    exports.reaggregateReferences(results, null, function(error) {

      if (error || pruningMode !== 1) {
        callback(error);
      } else {
        exports.clearNewOrphans(identifiers, callback);
      }

    });
    // style exception, too simple

  });

};

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

  var groupedReferences = postReferences.concat(threadReferences);

  var identifiers = [];

  for (var i = 0; i < groupedReferences.length; i++) {

    var reference = groupedReferences[i];
    identifiers.push(reference._id.replace('/', ''));

  }

  if (deleteMedia) {
    exports.deleteFiles(identifiers, userData, language, callback, true);
  } else {
    exports.checkNewOrphans(identifiers, callback);
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

          // style exception, too simple
          threads.updateMany(query, {
            $set : {
              files : []
            },
            $unset : miscOps.individualCaches
          }, function(error) {
            if (error) {
              return callback(error);
            }

            exports.updateReferencesCount(postReferences, results, deleteMedia,
                userData, language, callback);

          });
          // style exception, too simple

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

          // style exception, too simple
          posts.updateMany(query, {
            $set : {
              files : []
            },
            $unset : miscOps.individualCaches
          }, function(error) {

            if (error) {
              return callback(error);
            }

            exports.getThreadReferences(results, boardUri, threadsToClear,
                mediaDeletion, userData, language, callback);

          });
          // style exception, too simple

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
exports.deletePrunedFiles = function(identifiers, files, callback) {

  gridFsHandler.removeFiles(files, function deletedFiles(error) {

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
  } ]).toArray(
      function gotNames(error, results) {

        if (error) {
          callback(error);
        } else {
          exports.deletePrunedFiles(identifiers,
              results.length ? results[0].files : [], callback);
        }

      });

};

exports.logPruning = function(identifiers, page, callback) {

  logOps.insertLog({
    type : 'filePruning',
    time : new Date(),
    description : lang().logFilePruning.replace('{$identifiers}', identifiers
        .join(', ')),
    global : true
  }, function loggedPruning(error) {

    if (error) {
      console.log(error);
    }

    // style exception, too simple
    exports.removePrunedFiles(identifiers, function(error) {
      if (error) {
        callback(error);
      } else {
        exports.getFilesToPrune(callback, ++page);
      }
    });
    // style exception, too simple

  });

};

exports.getFilesToPrune = function(callback, page) {

  page = page || 0;

  references.aggregate([ {
    $match : {
      references : {
        $lt : 1
      }
    }
  }, {
    $sort : {
      _id : 1
    }
  }, {
    $limit : maxFilesToDisplay
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
  } ]).toArray(function gotIdentifiers(error, results) {

    if (error || !results.length) {
      callback(error);
    } else {
      exports.logPruning(results[0].identifiers, page, callback);
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

exports.flipPage = function(page, callback) {

  if (null === page) {
    callback();
  } else {
    exports.prune(callback, ++page);
  }

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
            exports.flipPage(page, callback);
          } else {

            // style exception, too simple
            references.bulkWrite(bulkOperations,
                function wroteReferences(error) {

                  if (error) {
                    callback(error);
                  } else {
                    exports.flipPage(page, callback);
                  }

                });
            // style exception, too simple

          }

        }

      });

};

exports.reaggregateReferences = function(results, page, callback) {

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
      exports.reaggregateReferences(results, page, callback);
    }

  });

};
// } Section 2: File pruning

// Section 3: Media listing {
exports.getReferencesFromQuery = function(queryBlock, parameters, language,
    callback) {

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

exports.handleFoundResults = function(queryBlock, threadResults, postResults,
    parameters, language, callback) {

  threadResults = threadResults.length ? threadResults[0].identifiers : [];

  postResults = postResults.length ? postResults[0].identifiers : [];

  queryBlock.identifier = {
    $in : threadResults.concat(postResults).map(function(element) {
      return element.replace('/', '');
    })
  };

  exports.getReferencesFromQuery(queryBlock, parameters, language, callback);

};

exports.fetchPostResults = function(query, pipeLine, parameters, language,
    callback) {

  threads.aggregate(pipeLine).toArray(
      function(error, threadResults) {

        if (error) {
          return callback(error);
        }

        posts.aggregate(pipeLine).toArray(
            function(error, postResults) {

              if (error) {
                return callback(error);
              }
              exports.handleFoundResults(query, threadResults, postResults,
                  parameters, language, callback);

            });

      });

};

exports.getMediaFromPost = function(query, parameters, language, callback) {

  var postQuery = {
    boardUri : parameters.boardUri
  };

  var colToUse;

  if (parameters.threadId) {
    colToUse = threads;
    postQuery.threadId = +parameters.threadId;
    delete parameters.postId;
  } else {
    colToUse = posts;
    postQuery.postId = +parameters.postId;
  }

  colToUse.findOne(postQuery, function foundPost(error, posting) {

    if (error) {
      return callback(error);
    } else if (!posting || (!posting.ip && !posting.bypassId)) {
      return exports.getReferencesFromQuery(query, parameters, language,
          callback);
    }

    var orList = [];

    if (posting.ip) {
      orList.push({
        ip : posting.ip
      });
    }

    if (posting.bypassId) {
      orList.push({
        bypassId : posting.bypassId
      });
    }

    var pipeLine = [ {
      $match : {
        $or : orList,
        'files.0' : {
          $exists : true
        }
      }
    }, {
      $unwind : '$files'
    }, {
      $group : {
        _id : 0,
        identifiers : {
          $addToSet : {
            $concat : [ '$files.md5', '-', '$files.mime' ]
          }
        }
      }
    } ];

    exports.fetchPostResults(query, pipeLine, parameters, language, callback);

  });

};

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

  if (parameters.boardUri && (parameters.threadId || parameters.postId)) {
    exports.getMediaFromPost(queryBlock, parameters, language, callback);
  } else {
    exports.getReferencesFromQuery(queryBlock, parameters, language, callback);
  }

};
// } Section 3: Media listing

// Section 4: File deletion {
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
            redactedModNames ? lang().guiRedactedName : userData.login)
            .replace('{$identifiers}', identifiers.join(', ')),
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
      return callback(lang(language).errDeniedMediaManagement);
    }
  } else if (!identifiers || !identifiers.length) {
    return callback();
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
// } Section 4: File deletion

// Section 5: Media details {
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
// } Section 6: Media details

// Section 7: Media moving {
exports.moveToDisk = function(toMove, callback) {

  var newDoc = {
    filename : toMove.filename,
    onDisk : true,
    contentType : toMove.contentType,
    metadata : toMove.metadata,
    length : toMove.length,
    md5 : toMove.md5
  };

  files.insertOne(newDoc, function inserted(error) {

    if (error) {
      return callback(error);
    }

    var stringId = newDoc._id.toString();
    var destDir = __dirname + '/../media/';
    destDir += stringId.substring(stringId.length - 3) + '/';

    try {
      fs.mkdirSync(destDir, {
        recursive : true
      });
    } catch (error) {
      callback(error);
    }

    var uploadStream = fs.createWriteStream(destDir + stringId);
    var readStream = bucket.openDownloadStream(toMove._id);

    readStream.on('error', callback);
    uploadStream.on('error', callback);
    uploadStream.once('finish', function() {

      // style exception, too simple
      chunks.removeMany({
        'files_id' : toMove._id
      }, function removedChunks(error) {

        if (error) {
          callback(error);
        } else {

          files.deleteOne({
            _id : toMove._id
          }, callback);

        }

      });
      // style exception, too simple

    });

    readStream.pipe(uploadStream);

  });

};

exports.moveToDb = function(toMove, callback) {

  var uploadStream = bucket.openUploadStream(toMove.filename, {
    metadata : toMove.metadata,
    contentType : toMove.contentType
  });

  var stringId = toMove._id.toString();
  var destDir = __dirname + '/../media/';
  destDir += stringId.substring(stringId.length - 3) + '/';

  var readStream = fs.createReadStream(destDir + stringId);

  readStream.on('error', callback);
  uploadStream.on('error', callback);

  uploadStream.once('finish', function() {

    // style exception, too simple
    fs.unlink(destDir + stringId, function removedFile(error) {

      if (error) {
        callback(error);
      } else {

        files.deleteOne({
          _id : toMove._id
        }, callback);

      }

    });
    // style exception, too simple

  });

  readStream.pipe(uploadStream);

};

exports.move = function(toDisk, callback, lastId) {

  var match = {
    'metadata.type' : 'media'
  };

  if (lastId) {
    match._id = {
      $gt : lastId
    };
  }

  if (!toDisk) {
    match.onDisk = true;
  } else {
    match.onDisk = {
      $ne : true
    };
  }

  files.find(match).sort({
    _id : 1
  }).limit(1).toArray(
      function(error, results) {

        if (error || !results.length) {

          if (error) {
            console.log(error);
          }

          callback();

        } else {

          // style exception, too simple
          (toDisk ? exports.moveToDisk : exports.moveToDb)(results[0],
              function moved(error) {

                if (error) {
                  console.log(error);
                }

                exports.move(toDisk, callback, results[0]._id);

              });
          // style exception, too simple

        }
      });

};
// } Section 7: Media moving
