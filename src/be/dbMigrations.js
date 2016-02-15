'use strict';

var crypto = require('crypto');
var mongo = require('mongodb');
var graphOps = require('./graphsOps');
var db = require('./db');
var aggregatedLogs = db.aggregatedLogs();
var logs = db.logs();
var stats = db.stats();
var cachedFiles = db.files();
var ObjectID = mongo.ObjectID;
var cachedPosts = db.posts();
var cachedThreads = db.threads();
var cachedBoards = db.boards();
var cachedTorIps = db.torIps();
var cachedBans = db.bans();
var cachedUsers = db.users();

// Added on 0.4.3
// Section 1: Mime pre-aggregation on upload data on postings {
function setPostingPreAggregatedFileMime(posting, collection, callback) {

  var files = [];

  for (var i = 0; i < posting.files.length; i++) {
    files.push(posting.files[i].path);
  }

  cachedFiles.find({
    filename : {
      $in : files
    }
  }, {
    filename : 1,
    contentType : 1
  }).toArray(function(error, foundFiles) {
    if (error) {
      callback(error);
    } else {

      var fileRelation = {};

      for (i = 0; i < foundFiles.length; i++) {
        var file = foundFiles[i];

        fileRelation[file.filename] = file.contentType;
      }

      for (i = 0; i < posting.files.length; i++) {
        posting.files[i].mime = fileRelation[posting.files[i].path];
      }

      collection.updateOne({
        _id : new ObjectID(posting._id)
      }, {
        $set : {
          files : posting.files
        }
      }, callback);

    }
  });

}

function setPostsPreAggreGatedFileMime(callback, cursor) {
  if (!cursor) {
    cursor = cachedPosts.find({
      'files.0' : {
        $exists : true
      }
    }, {
      files : 1
    });

  }

  cursor.next(function(error, post) {
    if (error) {
      callback(error);
    } else if (!post) {
      callback();
    } else {

      // style exception, too simple
      setPostingPreAggregatedFileMime(post, cachedPosts, function updatedMimes(
          error) {
        if (error) {
          callback(error);
        } else {
          setPostsPreAggreGatedFileMime(callback, cursor);
        }
      });
      // style exception, too simple

    }
  });
}

exports.setThreadsPreAggregatedFileMime = function(callback, cursor) {

  if (!cursor) {
    cursor = cachedThreads.find({
      'files.0' : {
        $exists : true
      }
    }, {
      files : 1
    });

  }

  cursor.next(function(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      setPostsPreAggreGatedFileMime(callback);
    } else {

      // style exception, too simple
      setPostingPreAggregatedFileMime(thread, cachedThreads,
          function updatedMimes(error) {
            if (error) {
              callback(error);
            } else {
              exports.setThreadsPreAggregatedFileMime(callback, cursor);
            }
          });
      // style exception, too simple

    }
  });

};
// } Section 1: Mime pre-aggregation on upload data on postings

// Added on 0.5.1
// Section 2: Board salt creation {
exports.setBoardIpSalt = function(callback) {

  cachedBoards.find({}, {}).toArray(
      function gotBoards(error, boards) {
        if (error || !boards.length) {
          callback(error);
        } else {
          var operations = [];

          for (var i = 0; i < boards.length; i++) {
            var board = boards[i];

            operations.push({
              updateOne : {
                filter : {
                  boardUri : board.boardUri
                },
                update : {
                  $set : {
                    ipSalt : crypto.createHash('sha256').update(
                        JSON.stringify(board) + Math.random() + new Date())
                        .digest('hex')
                  }
                }
              }
            });
          }

          cachedBoards.bulkWrite(operations, callback);

        }
      });

};
// } Section 2: Board salt creation

// Added on 1.0.6
// Section 3: Ip conversion from strings to array of ints {
function convertIp(ip) {

  if (!ip) {
    return null;
  }

  var newIp = [];

  var converted = ip.trim().split('.');

  for (var i = 0; i < converted.length; i++) {
    var part = +converted[i];

    if (!isNaN(part) && part <= 255 && part >= 0) {
      newIp.push(part);
    }
  }

  return newIp;

}

function migrateTorIps(callback) {

  cachedTorIps.find().toArray(function gotTorIps(error, ips) {
    if (error) {
      callback(error);
    } else {

      var operations = [];

      for (var i = 0; i < ips.length; i++) {
        var ip = ips[i];

        operations.push({
          updateOne : {
            filter : {
              _id : new ObjectID(ip._id)
            },
            update : {
              $set : {
                ip : convertIp(ip.ip)
              }
            }
          }
        });

      }

      if (operations.length) {
        cachedTorIps.bulkWrite(operations, callback);

      } else {
        callback();
      }

    }
  });

}

function fixTorIpsIndex(callback) {

  cachedTorIps.dropIndex('ip_1', function indexesDropped(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      cachedTorIps.ensureIndex({
        ip : 1
      }, function setIndex(error, index) {
        if (error) {
          callback(error);

        } else {
          migrateTorIps(callback);
        }
      });
      // style exception, too simple

    }

  });

}

function migrateBanIps(callback) {

  cachedBans.find({}, {
    ip : 1,
    range : 1
  }).toArray(function gotBans(error, bans) {
    if (error) {
      callback(error);
    } else {

      var operations = [];

      for (var i = 0; i < bans.length; i++) {
        var ban = bans[i];

        var setBlock;

        if (ban.ip) {
          setBlock = {
            ip : convertIp(ban.ip)
          };
        } else {
          setBlock = {
            range : convertIp(ban.range)
          };
        }

        operations.push({
          updateOne : {
            filter : {
              _id : new ObjectID(ban._id)
            },
            update : {
              $set : setBlock
            }
          }
        });

      }

      if (operations.length) {
        // style exception, too simple
        cachedBans.bulkWrite(operations, function migratedIps(error) {
          if (error) {
            callback(error);
          } else {
            fixTorIpsIndex(callback);
          }
        });
        // style exception, too simple

      } else {
        fixTorIpsIndex(callback);
      }

    }
  });

}

function migratePostIps(callback) {

  cachedPosts.find({
    ip : {
      $exists : true
    }
  }, {
    ip : 1
  }).toArray(function gotPosts(error, posts) {
    if (error) {
      callback(error);
    } else {
      var operations = [];

      for (var i = 0; i < posts.length; i++) {
        var post = posts[i];

        operations.push({
          updateOne : {
            filter : {
              _id : new ObjectID(post._id)
            },
            update : {
              $set : {
                ip : convertIp(post.ip)
              }
            }
          }
        });
      }

      if (operations.length) {
        // style exception, too simple
        cachedPosts.bulkWrite(operations, function wroteIps(error) {
          if (error) {
            callback(error);
          } else {
            migrateBanIps(callback);
          }
        });
        // style exception, too simple

      } else {
        migrateBanIps(callback);
      }
    }
  });
}

exports.migrateThreadIps = function(callback) {

  cachedThreads.find({
    ip : {
      $exists : true
    }
  }, {
    ip : 1
  }).toArray(function gotThreads(error, threads) {
    if (error) {
      callback(error);
    } else {

      var operations = [];

      for (var i = 0; i < threads.length; i++) {
        var thread = threads[i];

        operations.push({
          updateOne : {
            filter : {
              _id : new ObjectID(thread._id)
            },
            update : {
              $set : {
                ip : convertIp(thread.ip)
              }
            }
          }
        });
      }

      if (operations.length) {

        // style exception, too simple
        cachedThreads.bulkWrite(operations, function wroteIps(error) {
          if (error) {
            callback(error);
          } else {
            migratePostIps(callback);
          }
        });
        // style exception, too simple

      } else {
        migratePostIps(callback);
      }
    }
  });
};
// } Section 3: Ip conversion from strings to array of ints

// Added on 1.3.0
// Section 4: Remove status from banners metadata {
exports.removeBannerStatus = function(callback) {

  cachedFiles.updateMany({
    'metadata.type' : 'banner'
  }, {
    $unset : {
      'metadata.status' : true
    }
  }, callback);

};
// } Section 4: Remove status from banners metadata

// Section 5: Aggregate log information {
exports.iterateDays = function(date, callback, foundResults) {

  foundResults = foundResults || [];

  if (date >= new Date()) {
    aggregatedLogs.deleteMany({}, function clearedCollection(error) {

      if (error) {
        callback(error);
      } else {
        aggregatedLogs.insertMany(foundResults, callback);
      }

    });

    return;
  }

  var next = new Date(date);
  next.setDate(next.getDate() + 1);

  logs.aggregate([ {
    $match : {
      time : {
        $gte : date,
        $lt : next
      }
    }
  }, {
    $project : {
      time : 1
    }
  }, {
    $group : {
      _id : 0,
      ids : {
        $push : '$_id'
      }
    }
  } ], function gotLogs(error, results) {

    if (error) {
      callback();
    } else {

      if (results.length) {
        foundResults.push({
          logs : results[0].ids,
          date : date
        });
      }

      exports.iterateDays(next, callback, foundResults);

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
  } ], function gotOldestLog(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {
      var earliest = results[0].time;

      earliest.setHours(0);
      earliest.setMinutes(0);
      earliest.setSeconds(0);
      earliest.setMilliseconds(0);

      exports.iterateDays(earliest, callback);
    }

  });
};
// } Section 5: Aggregate log information

// Added on 1.4.0
// Section 6: Create message hash for existing postings {
exports.getMessageHash = function(message) {

  if (!message || !message.length) {
    return null;
  }

  message = message.toLowerCase().replace(/[ \n\t]/g, '');

  return crypto.createHash('md5').update(message).digest('base64');

};

exports.updatePostsR9KHashes = function(callback, postsCursor) {

  postsCursor = postsCursor || cachedPosts.find({}, {
    message : 1
  });

  postsCursor.next(function gotPost(error, post) {

    if (error) {
      callback(error);
    } else if (post) {

      // style exception, too simple
      cachedPosts.updateOne({
        _id : post._id
      }, {
        $set : {
          hash : exports.getMessageHash(post.message)
        }
      }, function updatedPost(error) {

        if (error) {
          callback(error);
        } else {
          exports.updatePostsR9KHashes(callback, postsCursor);
        }

      });
      // style exception, too simple

    } else {
      callback();
    }

  });
};

exports.createR9KHashes = function(callback, threadsCursor) {

  threadsCursor = threadsCursor || cachedThreads.find({}, {
    message : 1
  });

  threadsCursor.next(function gotThread(error, thread) {

    if (error) {
      callback(error);
    } else if (thread) {

      // style exception, too simple
      cachedThreads.updateOne({
        _id : thread._id
      }, {
        $set : {
          hash : exports.getMessageHash(thread.message)
        }
      }, function(error) {

        if (error) {
          callback(error);
        } else {
          exports.createR9KHashes(callback, threadsCursor);
        }

      });
      // style exception, too simple

    } else {
      exports.updatePostsR9KHashes(callback);
    }

  });

};
// } Section 6: Create message hash for existing postings

// Added on 1.5.0
exports.aggregateVolunteeredBoards = function(callback) {

  cachedBoards.find({
    'volunteers.0' : {
      $exists : true
    }
  }, {
    _id : 0,
    volunteers : 1,
    boardUri : 1
  }).toArray(function gotBoards(error, boards) {

    if (error) {
      callback(error);
    } else if (!boards.length) {
      callback();
    } else {

      var operations = [];

      for (var i = 0; i < boards.length; i++) {
        operations.push({

          updateMany : {
            filter : {
              login : {
                $in : boards[i].volunteers
              }
            },
            update : {
              $addToSet : {
                volunteeredBoards : boards[i].boardUri
              }
            }
          }

        });

      }

      cachedUsers.bulkWrite(operations, callback);

    }

  });

};

// Section 7: Graph generation {
exports.iterateDates = function(date, step, limit, callback) {

  if (date > limit) {
    callback();
    return;
  }

  graphOps.generate(date, function generated(error) {

    if (error) {
      callback(error);
    } else {

      date.setUTCDate(date.getUTCDate() + step);

      exports.iterateDates(date, step, limit, callback);

    }

  });

};

exports.getGraphStartDate = function(date) {

  var startDate = new Date(date);

  startDate.setUTCMilliseconds(0);
  startDate.setUTCSeconds(0);
  startDate.setUTCMinutes(0);
  startDate.setUTCHours(0);

  return startDate;

};

exports.getGraphLimitDate = function() {

  var newLimit = new Date();

  newLimit.setUTCMilliseconds(0);
  newLimit.setUTCSeconds(0);
  newLimit.setUTCMinutes(0);
  newLimit.setUTCHours(0);
  newLimit.setUTCDate(newLimit.getUTCDate() - 1);

  return newLimit;

};

exports.generateGraphs = function(callback) {

  stats.find().sort({
    startingTime : 1
  }).limit(1).toArray(function gotFirstDate(error, results) {

    if (error) {
      callback(error);
    } else if (results.length) {
      var dateToStart = exports.getGraphStartDate(results[0].startingTime);

      var newLimit = exports.getGraphLimitDate();

      var coreCount = require('os').cpus().length;

      var stopped = false;
      var remaining = coreCount;

      var loopCallBack = function(error) {

        if (stopped) {
          return;
        }

        if (error) {
          stopped = true;
          callback(error);
        } else {

          remaining--;

          if (!remaining) {
            callback();
          }

        }

      };

      for (var i = 0; i < coreCount; i++) {

        var specificDate = new Date(dateToStart);
        specificDate.setUTCDate(specificDate.getUTCDate() + i);

        exports.iterateDates(specificDate, coreCount, newLimit, loopCallBack);

      }

    } else {
      callback();
    }

  });

};
// } Section 7: Graph generation

// Added on 1.6.0
// Section 8: File deduplication {
exports.deduplicateFiles = function(callback) {
  require('./dedupMigration').deduplicateFiles(callback);
};
// } Section 8: File deduplication