'use strict';

var fs = require('fs');
var kernel = require('./kernel');
var settingsHandler = require('./settingsHandler');
var graphOps = require('./graphsOps');
var settings = settingsHandler.getGeneralSettings();
var verbose = settings.verbose || settings.verboseMisc;
var ipExpiration = settings.ipExpirationDays;
var tempDirectory = settings.tempDirectory;
var captchaExpiration = settings.captchaExpiration;
var gridFsHandler;
var db = require('./db');
var boards = db.boards();
var stats = db.stats();
var threads = db.threads();
var posts = db.posts();
var uniqueIps = db.uniqueIps();
var files = db.files();
var users = db.users();
var cacheHandler;
var torHandler;
var spamOps;
var referenceHandler;
var schedules = {};

exports.reload = function() {

  settings = settingsHandler.getGeneralSettings();

  ipExpiration = settings.ipExpirationDays;
  verbose = settings.verbose || settings.verboseMisc;
  tempDirectory = settings.tempDirectory;
  captchaExpiration = settings.captchaExpiration;
  cacheHandler = require('./engine/cacheHandler');
  gridFsHandler = require('./engine/gridFsHandler');
  torHandler = require('./engine/torOps');
  spamOps = require('./engine/spamOps');
  referenceHandler = require('./engine/mediaHandler');
};

exports.stop = function() {

  for ( var key in schedules) {

    if (schedules.hasOwnProperty(key)) {
      clearTimeout(schedules[key]);
    }

  }

};

exports.start = function() {

  tempFiles(true);

  spamIpRefresh();
  incrementalIp();
  torRefresh();

  if (!settings.master) {
    expiredCaptcha(true);
    boardsStats();
    uniqueIpCount();

    if (settings.autoPruneFiles) {
      autoFilePruning();
    }

    if (settings.inactivityThreshold) {
      inactivityTagging();
    }

  }

};

// Section 1: TOR refresh {
function refreshTorEntries() {

  torHandler.updateIps(function updatedTorIps(error) {
    if (error) {

      console.log(error);

    }

    torRefresh();

  });

}

function torRefresh() {

  var nextRefresh = new Date();

  nextRefresh.setUTCSeconds(0);
  nextRefresh.setUTCMinutes(0);
  nextRefresh.setUTCHours(0);
  nextRefresh.setUTCDate(nextRefresh.getUTCDate() + 1);

  schedules.torRefresh = setTimeout(function() {
    refreshTorEntries();
  }, nextRefresh.getTime() - new Date().getTime());

}
// } Section 1: TOR refresh

// Section 2: Board stats recording {
function applyStats(stats) {

  var operations = [];

  var foundBoards = [];

  for (var i = 0; i < stats.length; i++) {
    var stat = stats[i];

    foundBoards.push(stat.boardUri);

    operations.push({
      updateOne : {
        filter : {
          boardUri : stat.boardUri
        },
        update : {
          $set : {
            postsPerHour : stat.posts
          }
        }
      }
    });
  }

  operations.push({
    updateMany : {
      filter : {
        boardUri : {
          $nin : foundBoards
        }
      },
      update : {
        $set : {
          postsPerHour : 0
        }
      }
    }
  });

  boards.bulkWrite(operations, function updatedStats(error) {

    if (error) {

      console.log(error);

    } else if (settings.topBoardsCount || settings.frontPageStats) {
      require('./generationQueue').queue({
        frontPage : true
      });
    }

    boardsStats();
  });

}

function getStats() {

  var timeToApply = new Date();
  timeToApply.setUTCMilliseconds(0);
  timeToApply.setUTCSeconds(0);
  timeToApply.setUTCMinutes(0);
  timeToApply.setUTCHours(timeToApply.getUTCHours() - 1);

  if (verbose) {
    console.log('Applying stats for ' + timeToApply);
  }

  stats.aggregate([ {
    $match : {
      startingTime : timeToApply
    }
  }, {
    $group : {
      _id : 0,
      stats : {
        $push : {
          boardUri : '$boardUri',
          posts : '$posts'
        }
      }
    }
  } ]).toArray(function gotStats(error, result) {

    if (error) {

      console.log(error);

      boardsStats();

    } else if (!result.length) {
      applyStats([]);
    } else {
      applyStats(result[0].stats);
    }

  });

}

function clearIps() {

  var now = new Date();

  now.setUTCDate(now.getUTCDate() - ipExpiration);

  threads.updateMany({
    ip : {
      $exists : true
    },
    creation : {
      $lt : now
    }
  }, {
    $unset : {
      ip : 1,
      clearCache : 1,
      alternativeCaches : 1,
      hashedCache : 1
    }
  }, function clearedThreadIps(error) {

    if (error) {
      console.log(error);

    } else {

      // style exception, too simple
      posts.updateMany({
        ip : {
          $exists : true
        },
        creation : {
          $lt : now
        }
      }, {
        $unset : {
          ip : 1,
          clearCache : 1,
          alternativeCaches : 1,
          hashedCache : 1
        }
      }, function clearedThreadIps(error) {

        if (error) {
          console.log(error);

        }

      });
      // style exception, too simple

    }

  });

}

function boardsStats() {

  var tickTime = new Date();

  var current = tickTime.getTime();

  tickTime.setUTCMilliseconds(0);
  tickTime.setUTCSeconds(5);
  tickTime.setUTCMinutes(0);
  tickTime.setUTCHours(tickTime.getUTCHours() + 1);

  schedules.boardsStats = setTimeout(function() {

    getStats();

    if (ipExpiration >= 1) {
      clearIps();
    }

    cacheHandler.runTTL();

  }, tickTime.getTime() - current);
}
// } Section 2: Board stats recording

// Section 3: Temp files cleanup {
function oldEnoughToDelete(date) {

  date.setMinutes(date.getMinutes() + 1);

  return new Date() > date;

}

function iterateFiles(files) {

  if (files.length) {
    var file = tempDirectory + '/' + files.shift();

    fs.stat(file, function gotStats(error, stats) {

      if (error) {
        throw error;
      } else {

        var deleteFile = stats.isFile() && !stats.size;

        if (deleteFile && oldEnoughToDelete(stats.ctime)) {

          if (verbose) {
            console.log('Removing expired tmp file ' + file);
          }

          fs.unlinkSync(file);
        }

        iterateFiles(files);
      }

    });
  } else {
    tempFiles();

  }

}

function removeExpiredTempFiles() {
  fs.readdir(tempDirectory, function gotFiles(error, files) {
    if (error) {
      throw error;
    } else {
      iterateFiles(files);
    }

  });
}

function tempFiles(immediate) {

  if (immediate) {
    removeExpiredTempFiles();
  } else {
    schedules.tempFiles = setTimeout(function() {
      removeExpiredTempFiles();
    }, 1000 * 60);
  }

}
// } Section 3: Temp files cleanup

// Section 4: Captcha cleanup {
function expiredCaptcha(immediate) {
  if (immediate) {
    checkExpiredCaptchas();
  } else {

    schedules.expiredCaptcha = setTimeout(function() {
      checkExpiredCaptchas();
    }, captchaExpiration * 1000 * 1);

  }
}

function checkExpiredCaptchas() {

  files.aggregate([ {
    $match : {
      'metadata.type' : 'captcha',
      'metadata.expiration' : {
        $lte : new Date()
      }
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ]).toArray(function gotExpiredFiles(error, results) {
    if (error) {

      console.log(error);
      expiredCaptcha();

    } else if (results.length) {

      var expiredFiles = results[0].files;

      if (verbose) {
        var message = 'Deleting expired captchas: ';
        message += JSON.stringify(expiredFiles, null, 2);
        console.log(message);
      }

      // style exception, too simple
      gridFsHandler.removeFiles(expiredFiles, function deletedFiles(error) {
        if (error) {

          console.log(error);

        }

        expiredCaptcha();

      });
      // style exception, too simple

    } else {
      expiredCaptcha();
    }
  });

}
// } Section 4: Captcha cleanup

// Section 5: Unique IP counting {
function setUniqueIpCount(results) {

  var operations = [];
  var foundBoards = [];

  for (var i = 0; i < results.length; i++) {

    var result = results[i];

    foundBoards.push(result.boardUri);

    operations.push({
      updateOne : {
        filter : {
          boardUri : result.boardUri
        },
        update : {
          $set : {
            uniqueIps : result.count
          }
        }
      }
    });

  }

  operations.push({
    updateMany : {
      filter : {
        boardUri : {
          $nin : foundBoards
        }
      },
      update : {
        $set : {
          uniqueIps : 0
        }
      }
    }
  });

  boards.bulkWrite(operations, function updatedUniqueIps(error) {

    if (error) {
      console.log(error);

    }

    require('./generationQueue').queue({
      frontPage : true
    });

    var graphDate = new Date();

    graphDate.setUTCMilliseconds(0);
    graphDate.setUTCSeconds(0);
    graphDate.setUTCMinutes(0);
    graphDate.setUTCHours(0);
    graphDate.setUTCDate(graphDate.getUTCDate() - 1);

    // style exception, too simple
    graphOps.generate(graphDate, function generated(error) {

      if (error) {
        console.log(error);

      }

      uniqueIpCount();

    });
    // style exception, too simple

  });

}

function updateUniqueIpCount() {

  if (verbose) {
    console.log('Setting unique ips for boards');
  }

  uniqueIps.aggregate([ {
    $project : {
      boardUri : 1,
      count : {
        $size : '$ips'
      }
    }
  } ]).toArray(function gotCount(error, results) {

    uniqueIps.deleteMany({}, function clearedUniqueIps(deletionError) {

      if (deletionError) {
        console.log(deletionError);
      }

    });

    if (error) {

      console.log(error);
      uniqueIpCount();

    } else {
      setUniqueIpCount(results);
    }

  });

}

function uniqueIpCount() {

  var nextRefresh = new Date();

  nextRefresh.setUTCMilliseconds(0);
  nextRefresh.setUTCSeconds(0);
  nextRefresh.setUTCMinutes(0);
  nextRefresh.setUTCHours(0);
  nextRefresh.setUTCDate(nextRefresh.getUTCDate() + 1);

  schedules.uniqueIpCount = setTimeout(function() {
    updateUniqueIpCount();
  }, nextRefresh.getTime() - new Date().getTime());

}
// } Section 5: Unique IP counting

// Section 6: Automatic file pruning {
function commitPruning(takeOffMaintenance) {

  referenceHandler.prune(function prunedFiles(error) {

    if (error) {
      console.log(error);
    }

    if (takeOffMaintenance) {
      settingsHandler.changeMaintenanceMode(false);
    }

    autoFilePruning();

  });

}

function startPruning() {

  if (!settings.maintenance) {

    settingsHandler.changeMaintenanceMode(true);

    var commitAt = new Date();
    commitAt.setUTCMilliseconds(0);
    commitAt.setUTCSeconds(0);
    commitAt.setUTCMinutes(commitAt.getUTCMinutes() + 1);

    schedules.pruningWaiting = setTimeout(function() {
      delete schedules.pruningWaiting;

      commitPruning(true);
    }, commitAt.getTime() - new Date().getTime());

  } else {
    commitPruning(false);
  }

}

function autoFilePruning() {

  var nextPrune = new Date();

  nextPrune.setUTCMilliseconds(0);
  nextPrune.setUTCSeconds(0);
  nextPrune.setUTCMinutes(0);
  nextPrune.setUTCHours(0);
  nextPrune.setUTCDate(nextPrune.getUTCDate() + 7 - nextPrune.getUTCDay());

  schedules.filePruning = setTimeout(function() {
    startPruning();
  }, nextPrune.getTime() - new Date().getTime());

}
// } Section 6: Automatic file pruning

// Section 7: Inactivity check
function setInactiveAccounts(inactiveUsers) {

  users.updateMany({
    login : {
      $in : inactiveUsers
    }
  }, {
    $set : {
      inactive : true
    }
  }, function updatedUsers(error) {

    if (error) {
      console.log(error);
    }

    inactivityTagging();

  });

}

function getInactiveAccounts() {

  var limitDate = new Date();
  var dayToSet = limitDate.getUTCDate() - settings.inactivityThreshold;

  limitDate.setUTCDate(dayToSet);

  users.aggregate([ {
    $match : {
      inactive : {
        $ne : true
      },
      $or : [ {
        lastSeen : {
          $exists : false
        }
      }, {
        lastSeen : {
          $lt : limitDate
        }
      } ]
    }
  }, {
    $project : {
      login : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 0,
      logins : {
        $push : '$login'
      }
    }
  } ]).toArray(function gotInactiveUsers(error, results) {

    if (error) {
      console.log(error);

      inactivityTagging();
    } else if (!results.length) {
      inactivityTagging();
    } else {

      var inactiveUsers = results[0].logins;

      // style exception, too simple
      boards.updateMany({
        owner : {
          $in : inactiveUsers
        }
      }, {
        $set : {
          inactive : true
        }
      }, function updatedBoards(error) {

        if (error) {
          console.log(error);
        } else {
          setInactiveAccounts(inactiveUsers);
        }

      });
      // style exception, too simple

    }

  });

}

function inactivityTagging() {

  var nextCheck = new Date();

  nextCheck.setUTCMilliseconds(0);
  nextCheck.setUTCSeconds(0);
  nextCheck.setUTCMinutes(0);
  nextCheck.setUTCHours(0);
  nextCheck.setUTCDate(nextCheck.getUTCDate() + 1);

  schedules.inactivityTagging = setTimeout(function() {
    getInactiveAccounts();
  }, nextCheck.getTime() - new Date().getTime());
}
// } Section 7: Inactivity check

// Section 8: Spammer ip refresh {
function refreshSpammerIps() {

  spamOps.updateSpammers(function updatedSpammers(error) {

    if (error) {
      console.log(error);

    }

    spamIpRefresh();

  });

}

function spamIpRefresh() {

  var nextRefresh = new Date();

  nextRefresh.setUTCSeconds(0);
  nextRefresh.setUTCMinutes(0);
  nextRefresh.setUTCHours(0);
  nextRefresh.setUTCDate(nextRefresh.getUTCDate() + 1);

  schedules.spamIpRefresh = setTimeout(function() {
    refreshSpammerIps();
  }, nextRefresh.getTime() - new Date().getTime());

}
// } Section 8: Spammer ip refresh

// Section 9: Spammer ip increment:
function incrementSpammerIps() {

  spamOps.incrementSpammers(function incrementedSpammers(error) {
    if (error) {
      console.log(error);

    }

    incrementalIp();

  });

}

function incrementalIp() {

  var nextRefresh = new Date();

  nextRefresh.setUTCSeconds(0);
  nextRefresh.setUTCMinutes(0);

  var hoursToUse = nextRefresh.getUTCHours() === 23 ? 2 : 1;
  nextRefresh.setUTCHours(nextRefresh.getUTCHours() + hoursToUse);

  schedules.incrementalIpRefresh = setTimeout(function() {
    incrementSpammerIps();
  }, nextRefresh.getTime() - new Date().getTime());

}
// } Section 9: Spammer ip increment
