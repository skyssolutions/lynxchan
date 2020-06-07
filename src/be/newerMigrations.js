'use strict';

// The dbMigrations.s couldn't be any larger, this is where any migration from
// 1.6 onward will be

var exec = require('child_process').exec;
var crypto = require('crypto');
var fs = require('fs');
var settings = require('./settingsHandler').getGeneralSettings();
var db = require('./db');
var bucket = new (require('mongodb')).GridFSBucket(db.conn());
var aggregatedLogs = db.aggregatedLogs();
var logs = db.logs();
var port = settings.port;
var chunks = db.chunks();
var masterNode = settings.master;
var files = db.files();
var versions = db.versions();
var references = db.uploadReferences();
var reports = db.reports();
var threads = db.threads();
var posts = db.posts();

// Added on 1.7
exports.deleteGhostReport = function(id, callback) {

  reports.deleteOne({
    _id : id
  }, function deletedReport(error) {
    if (error) {
      callback(error);
    } else {
      exports.removeGhostReports(callback, id);
    }
  });

};

exports.removeGhostReports = function(callback, lastId) {

  reports.findOne(lastId ? {
    _id : {
      $gt : lastId
    }
  } : {}, {
    projection : {
      boardUri : 1,
      threadId : 1,
      postId : 1
    }
  }, function gotReport(error, report) {

    if (error) {
      callback(error);
    } else if (!report) {
      callback();
    } else {

      var collectionToUse = report.postId ? posts : threads;

      // style exception, too simple
      collectionToUse.findOne({
        boardUri : report.boardUri,
        threadId : report.threadId,
        postId : report.postId
      }, {
        projection : {
          boardUri : 1,
          _id : 0
        }
      }, function gotPosting(error, posting) {

        if (error) {
          callback(error);
        } else if (posting) {
          exports.removeGhostReports(callback, report._id);
        } else {
          exports.deleteGhostReport(report._id, callback);
        }

      });
      // style exception, too simple

    }

  });

};

// Added on 2.0
function getNamesToDelete() {

  var names = [ '/', '/index.json' ];

  if (settings.overboard) {
    names.push('/' + settings.sfwOverboard + '/');
    names.push('/' + settings.sfwOverboard + '/index.rss');
    names.push('/' + settings.sfwOverboard + '/1.json');
  }

  if (settings.sfwOverboard) {
    names.push('/' + settings.overboard + '/');
    names.push('/' + settings.overboard + '/index.rss');
    names.push('/' + settings.overboard + '/1.json');
  }

  return names;

}

function eraseOldCache(callback) {

  files.aggregate(
      [
          {
            $match : {
              $or : [
                  {
                    filename : {
                      $in : getNamesToDelete()
                    }
                  },
                  {
                    'metadata.type' : {
                      $in : [ 'board', 'thread', 'catalog', 'rules', 'log',
                          'multiboard', 'preview' ]
                    }
                  } ]
            }
          }, {
            $group : {
              _id : 0,
              files : {
                $push : '$filename'
              }
            }
          } ]).toArray(
      function(error, results) {

        if (error) {
          callback(error);
        } else if (!results.length) {
          callback();
        } else {

          require('./engine/gridFsHandler').removeFiles(results[0].files,
              callback);
        }

      });

}

exports.cleanCache = function(callback) {

  files.updateMany({
    filename : /\/custom\.(css|js|spoiler)$/,
    'metadata.boardUri' : {
      $exists : true
    }
  }, {
    $set : {
      'metadata.type' : 'custom'
    }
  }, function updateCustomFiles(error) {

    if (error) {
      callback(error);
    } else {
      eraseOldCache(callback);
    }

  });

};

// Added on 2.3
exports.generateOperation = function(results, date, toInsert) {

  if (!results.length) {
    return;
  }

  for (var i = 0; i < results.length; i++) {

    var entry = results[i];

    toInsert.push({
      boardUri : entry._id,
      logs : entry.ids,
      date : date
    });
  }

};

exports.iterateDays = function(date, callback, toInsert) {

  toInsert = toInsert || [];

  if (date >= new Date()) {
    aggregatedLogs.deleteMany({}, function clearedCollection(error) {

      if (error) {
        callback(error);
      } else {
        aggregatedLogs.insertMany(toInsert, callback);
      }

    });

    return;
  }

  var next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);

  logs.aggregate([ {
    $match : {
      time : {
        $gte : date,
        $lt : next
      }
    }
  }, {
    $project : {
      time : 1,
      boardUri : 1
    }
  }, {
    $group : {
      _id : '$boardUri',
      ids : {
        $push : '$_id'
      }
    }
  } ]).toArray(function gotLogs(error, results) {

    if (error) {
      callback();
    } else {

      exports.generateOperation(results, date, toInsert);

      exports.iterateDays(next, callback, toInsert);

    }

  });

};

exports.aggregateLogs = function(callback) {

  logs.aggregate([ {
    $project : {
      time : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 0,
      time : {
        $min : '$time'
      }
    }
  } ]).toArray(function gotOldestLog(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {

      var earliest = results[0].time;

      earliest.setUTCHours(0);
      earliest.setUTCMinutes(0);
      earliest.setUTCSeconds(0);
      earliest.setUTCMilliseconds(0);

      exports.iterateDays(earliest, callback);
    }

  });

};

// Added on 2.4
exports.updatePostings = function(reference, file, hash, callback) {

  var newPath = '/.media/' + hash;

  if (reference.extension) {
    newPath += '.' + reference.extension;
  }

  var newThumbPath = reference.hasThumb ? ('/.media/t_' + hash) : newPath;
  var currentThumbPath = '/.media/t_' + reference.identifier;

  var ops = [ {
    updateMany : {
      filter : {
        'files.path' : file.filename
      },
      update : {
        $set : {
          'files.$[file].thumb' : newThumbPath
        }
      },
      arrayFilters : [ {
        'file.thumb' : reference.hasThumb ? currentThumbPath : file.filename
      } ]
    }
  }, {
    updateMany : {
      filter : {
        'files.path' : file.filename
      },
      update : {
        $set : {
          'files.$[file].path' : newPath,
          'files.$[file].sha256' : hash
        },
        $unset : {
          'files.$[file].md5' : 1
        }
      },
      arrayFilters : [ {
        'file.path' : file.filename
      } ]
    }
  } ];

  posts.bulkWrite(ops, function(error) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      threads.bulkWrite(ops, function(error) {
        callback(error, hash);
      });
      // style exception, too simple

    }

  });

};

exports.hashFile = function(reference, file, callback) {

  if (file.onDisk) {
    var idString = file._id.toString();

    var diskPath = __dirname + '/media/';
    diskPath += idString.substring(idString.length - 3) + '/' + idString;
  }

  var stream = file.onDisk ? fs.createReadStream(diskPath) : bucket
      .openDownloadStreamByName(file.filename);

  var hash = crypto.createHash('sha256');

  stream.on('error', function(error) {

    if (error.code === 'ENOENT') {
      callback();
    } else {
      callback(error);
    }

  });

  stream.on('data', function(data) {
    hash.update(data, 'utf8');
  });

  stream.on('end', function() {
    exports.updatePostings(reference, file, hash.digest('hex'), callback);
  });

};

exports.renameFiles = function(reference, file, hash, callback) {

  var newPath = '/.media/' + hash;

  if (reference.extension) {
    newPath += '.' + reference.extension;
  }

  files.bulkWrite([ {
    updateOne : {
      filter : {
        filename : '/.media/t_' + reference.identifier
      },
      update : {
        $set : {
          filename : '/.media/t_' + hash
        }
      }
    }
  }, {
    updateOne : {
      filter : {
        filename : file.filename
      },
      update : {
        $set : {
          filename : newPath
        }
      }
    }
  } ], function(error) {
    callback(error, hash);
  });

};

exports.findFile = function(reference, callback) {

  var path = '/.media/' + reference.identifier;

  if (reference.extension) {
    path += '.' + reference.extension;
  }

  files.findOne({
    filename : path
  }, function(error, file) {

    if (error || !file) {
      return callback(error);
    }

    // style exception, too simple
    exports.hashFile(reference, file, function(error, hash) {

      if (error) {
        callback(error);
      } else {
        exports.renameFiles(reference, file, hash, callback);
      }

    });
    // style exception, too simple

  });

};

exports.checkForWrongThumb = function(reference, callback) {

  if (reference.hasThumb) {
    return exports.findFile(reference, callback);
  }

  files.findOne({
    filename : '/.media/t_' + reference.identifier
  }, function(error, foundFile) {

    if (error) {
      return callback(error);
    } else if (!foundFile) {
      return exports.findFile(reference, callback);
    }

    // style exception, too simple
    references.updateOne({
      _id : reference._id
    }, {
      $set : {
        hasThumb : true
      }
    }, function(error) {

      if (error) {
        callback(error);
      } else {
        reference.hasThumb = true;
        exports.findFile(reference, callback);
      }

    });
    // style exception, too simple

  });

};

exports.applySha256 = function(callback, lastId) {

  references.find({
    identifier : {
      $exists : true
    },
    _id : lastId ? {
      $gt : lastId
    } : {
      $exists : true
    }
  }).sort({
    _id : 1
  }).limit(1).toArray(function(error, foundReferences) {

    if (error || !foundReferences.length) {
      return callback(error);
    }

    exports.checkForWrongThumb(foundReferences[0], function(error, sha256) {

      if (error) {
        return callback(error);
      }

      if (!sha256) {

        // style exception, too simple
        return references.removeOne({
          _id : foundReferences[0]._id
        }, function(error) {

          if (error) {
            return callback(error);
          } else {
            exports.applySha256(callback, foundReferences[0]._id);
          }

        });
        // style exception, too simple

      }

      // style exception, too simple
      references.updateOne({
        _id : foundReferences[0]._id
      }, {
        $set : {
          sha256 : sha256
        },
        $unset : {
          identifier : 1
        }
      }, function(error) {

        if (error) {
          callback(error);
        } else {
          exports.applySha256(callback, foundReferences[0]._id);
        }

      });
      // style exception, too simple

    });

  });

};

// Added both on 2.5 and retroactively on 2.4
exports.removeGridFsFiles = function(onDb, callback) {

  if (!onDb || !onDb.ids.length) {
    return callback();
  }

  chunks.removeMany({
    'files_id' : {
      $in : onDb.ids
    }
  }, function removedChunks(error) {

    if (error) {
      callback();
    } else {

      // style exception, too simple
      files.removeMany({
        _id : {
          $in : onDb.ids
        }
      }, function() {
        callback();
      });
      // style exception, too simple

    }

  });

};

exports.removeFilesFromMaster = function(toRemove, callback, attempts, error) {

  attempts = attempts || 0;

  if (attempts >= 10) {
    return callback(error);
  }

  var cmd = 'curl http://';
  cmd += masterNode + ':' + port + '/removeFiles.js?ids=' + toRemove.join(',');

  exec(cmd, function(error, data) {

    if (error) {
      return exports.sendFileToMaster(toRemove, callback, ++attempts, error);
    } else {
      callback();
    }

  });

};

exports.removeFilesFromDisk = function(toRemove, callback, index) {

  index = index || 0;

  if (index >= toRemove.length) {
    return callback();
  }

  var idString = toRemove[index].toString();

  var path = __dirname + '/../media/' + idString.substring(idString.length - 3);
  path += '/' + idString;

  fs.unlink(path, function(error) {

    if (error && error.code !== 'ENOENT') {
      callback(error);
    } else {
      exports.removeFilesFromDisk(toRemove, callback, ++index);
    }

  });

};

exports.removeDiskFiles = function(onDisk, onDb, callback) {

  if (!onDisk || !onDisk.ids.length) {
    return exports.removeGridFsFiles(onDb, callback);
  }

  var toRemove = onDisk.ids.splice(0, 10);

  var removalCallback = function(error) {

    if (error) {
      return exports.removeGridFsFiles(onDb, callback);
    }

    files.removeMany({
      _id : {
        $in : toRemove
      }
    }, function(error) {

      if (error) {
        exports.removeGridFsFiles(onDb, callback);
      } else {
        exports.removeDiskFiles(onDisk, onDb, callback);
      }

    });

  };

  if (masterNode) {
    exports.removeFilesFromMaster(toRemove, removalCallback);
  } else {
    exports.removeFilesFromDisk(toRemove, removalCallback);
  }

};

exports.separateToBeRemoved = function(results, callback) {

  var onDisk;
  var onDb;

  for (var i = 0; i < results.length; i++) {

    var result = results[i];

    if (result._id) {

      if (!onDisk) {
        onDisk = result;
      } else {
        onDisk.ids = onDisk.ids.concat(result.ids);
      }

    } else {

      if (!onDb) {
        onDb = result;
      } else {
        onDb.ids = onDb.ids.concat(result.ids);
      }

    }

  }

  exports.removeDiskFiles(onDisk, onDb, callback);

};

exports.removeDuplicates = function(file, callback) {

  files.aggregate([ {
    $match : {
      _id : {
        $ne : file._id
      },
      filename : file.filename
    }
  }, {
    $group : {
      _id : '$onDisk',
      ids : {
        $push : '$_id'
      }
    }
  } ]).toArray(function gotArray(error, results) {

    if (error || !results.length) {
      callback(error);
    } else {
      exports.separateToBeRemoved(results, callback);
    }
  });

};

exports.cleanDuplicates = function(callback, lastId) {

  files.find({
    _id : lastId ? {
      $gt : lastId
    } : {
      $exists : true
    }
  }).sort({
    _id : 1
  }).limit(1).toArray(function(error, foundFiles) {

    if (error || !foundFiles.length) {
      return callback(error);
    }

    exports.removeDuplicates(foundFiles[0], function(error) {

      if (error) {
        callback(error);
      } else {
        exports.cleanDuplicates(callback, foundFiles[0]._id);
      }

    });

  });

};

exports.handleMissingSha256 = function(reference, callback) {

  var path = '/.media/' + reference.sha256;

  if (reference.extension) {
    path += '.' + reference.extension;
  }

  files.bulkWrite([ {
    updateOne : {
      filter : {
        filename : '/.media/t_' + reference.sha256
      },
      update : {
        $set : {
          'metadata.sha256' : reference.sha256
        },
        $unset : {
          'metadata.identifier' : true
        }
      }
    }
  }, {
    updateOne : {
      filter : {
        filename : path
      },
      update : {
        $set : {
          'metadata.sha256' : reference.sha256
        },
        $unset : {
          'metadata.identifier' : true
        }
      }
    }
  } ], callback);

};

exports.fixMissingSha256 = function(callback, lastId) {

  references.find({
    _id : lastId ? {
      $gt : lastId
    } : {
      $exists : true
    }
  }).sort({
    _id : 1
  }).limit(1).toArray(function(error, foundReferences) {

    if (error) {
      return callback(error);
    } else if (!foundReferences.length) {
      return exports.cleanDuplicates(callback);
    }

    exports.handleMissingSha256(foundReferences[0], function(error) {

      if (error) {
        callback(error);
      } else {
        exports.fixMissingSha256(callback, foundReferences[0]._id);
      }

    });

  });

};

exports.runMissingSha256 = function(callback) {

  versions.findOne({
    version : 13
  }, function(error, document) {

    if (error || !document) {
      callback(error);
    } else {
      exports.fixMissingSha256(callback);
    }

  });

};