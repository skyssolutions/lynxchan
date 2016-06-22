'use strict';

var fs = require('fs');
var kernel = require('./kernel');
var settingsHandler = require('./settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var verbose = settings.verbose;
var tempDirectory = settings.tempDirectory;
var captchaExpiration = settings.captchaExpiration;
var debug = kernel.debug();
var gridFsHandler = require('./engine/gridFsHandler');
var db = require('./db');
var delOps = require('./engine/deletionOps').miscDeletions;
var boards = db.boards();
var stats = db.stats();
var uniqueIps = db.uniqueIps();
var files = db.files();
var users = db.users();
var torHandler = require('./engine/torOps');
var spamOps = require('./engine/spamOps');
var graphOps = require('./graphsOps');
var referenceHandler = require('./engine/mediaHandler');

// handles schedules in general.
// currently it handles the removal of expired captcha's images, applies board
// hourly stats and removes invalid temporary files.

exports.reload = function() {

  settings = settingsHandler.getGeneralSettings();

  verbose = settings.verbose;
  tempDirectory = settings.tempDirectory;
  captchaExpiration = settings.captchaExpiration;
  gridFsHandler = require('./engine/gridFsHandler');
  delOps = require('./engine/deletionOps').miscDeletions;
  torHandler = require('./engine/torOps');
};

exports.start = function() {

  if (debug) {
    tempFiles(true);
  }

  if (!settings.master) {
    expiredCaptcha(true);
    boardsStats();
    dailyRefresh();
    early404(true);
    uniqueIpCount();

    if (settings.autoPruneFiles) {
      autoFilePruning();
    }

    if (settings.inactivityThreshold) {
      inactivityTagging();
    }

  }

};

// Section 1: Early 404 check {
function cleanEarly404() {

  delOps.cleanEarly404(function cleanedUp(error) {
    if (error) {

      console.log(error);

      if (debug) {
        throw error;
      }
    }

    early404();
  });
}

function early404(immediate) {

  if (immediate) {
    cleanEarly404();
  } else {

    setTimeout(function() {
      cleanEarly404();
    }, 1000 * 60 * 30);
  }
}
// } Section 1: Early 404 check

// Section 2: TOR refresh {
function refreshIpEntries() {

  torHandler.updateIps(function updatedTorIps(error) {
    if (error) {

      if (debug) {
        throw error;
      }

      console.log(error);
    }

    // style exception, too simple
    spamOps.updateSpammers(function updatedSpammers(error) {

      if (error) {
        if (debug) {
          throw error;
        }

        console.log(error);
      }

      dailyRefresh();

    });
    // style exception, too simple

  });

}

function dailyRefresh() {

  var nextRefresh = new Date();

  nextRefresh.setUTCSeconds(0);
  nextRefresh.setUTCMinutes(0);
  nextRefresh.setUTCHours(0);
  nextRefresh.setUTCDate(nextRefresh.getUTCDate() + 1);

  setTimeout(function() {
    refreshIpEntries();
  }, nextRefresh.getTime() - new Date().getTime());

}
// } Section 2: TOR refresh

// Section 3: Board stats recording {
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

      if (debug) {
        throw error;
      }
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
  } ], function gotStats(error, result) {

    if (error) {

      console.log(error);

      if (debug) {
        throw error;
      } else {
        boardsStats();
      }

    } else if (!result.length) {
      applyStats([]);
    } else {
      applyStats(result[0].stats);
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

  setTimeout(function() {

    getStats();

  }, tickTime.getTime() - current);
}
// } Section 3: Board stats recording

// Section 4: Temp files cleanup {
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

          fs.unlink(file);
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
    setTimeout(function() {
      removeExpiredTempFiles();
    }, 1000 * 60);
  }

}
// } Section 4: Temp files cleanup

// Section 5: Captcha cleanup {
function expiredCaptcha(immediate) {
  if (immediate) {
    checkExpiredCaptchas();
  } else {

    setTimeout(function() {
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
  } ], function gotExpiredFiles(error, results) {
    if (error) {

      console.log(error);

      if (debug) {
        throw error;
      } else {
        expiredCaptcha();
      }

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

          if (debug) {
            throw error;
          }
        }

        expiredCaptcha();

      });

      // style exception, too simple

    } else {
      expiredCaptcha();
    }
  });

}
// } Section 5: Captcha cleanup

// Section 6: Unique IP counting {
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
      if (debug) {
        throw error;
      }
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
        if (debug) {
          throw error;
        }

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
  } ], function gotCount(error, results) {

    uniqueIps.deleteMany({}, function clearedUniqueIps(deletionError) {

      if (deletionError) {
        console.log(deletionError);
      }

    });

    if (error) {

      console.log(error);

      if (debug) {
        throw error;
      } else {
        uniqueIpCount();
      }

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

  setTimeout(function() {
    updateUniqueIpCount();
  }, nextRefresh.getTime() - new Date().getTime());

}
// } Section 6: Unique IP counting

// Section 7: Automatic file pruning {
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

    setTimeout(function() {
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

  setTimeout(function() {

    startPruning();

  }, nextPrune.getTime() - new Date().getTime());

}
// } Section 7: Automatic file pruning

// Section 8: Inactivity check
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

  setTimeout(function() {
    getInactiveAccounts();
  }, nextCheck.getTime() - new Date().getTime());
}
// } Section 8: Inactivity check
