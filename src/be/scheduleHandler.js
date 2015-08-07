var fs = require('fs');
var logger = require('./logger');
var boot = require('./boot');
var settings = boot.getGeneralSettings();
var verbose = settings.verbose;
var tempDirectory = settings.tempDirectory;
var captchaExpiration = settings.captchaExpiration;
var debug = boot.debug();
var gridFsHandler = require('./engine/gridFsHandler');
var db = require('./db');
var generator = require('./engine/generator');
var boards = db.boards();
var stats = db.stats();
var files = db.files();
var torHandler = require('./engine/torOps');

// handles schedules in general.
// currently it handles the removal of expired captcha's images, applies board
// hourly stats and removes invalid temporary files.

exports.reload = function() {
  
  gridFsHandler = require('./engine/gridFsHandler');
  generator = require('./engine/generator');
  torHandler = require('./engine/torOps');
};

exports.start = function() {

  expiredCaptcha(true);

  if (debug) {
    tempFiles(true);
  }

  boardsStats();

  torRefresh();
};

// start of tor refresh
function refreshTorEntries() {

  torHandler.updateIps(function updatedTorIps(error) {
    if (error) {

      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }
    }

    torRefresh();

  });

}

function torRefresh() {

  var nextRefresh = new Date();

  nextRefresh.setSeconds(5);
  nextRefresh.setMinutes(0);
  nextRefresh.setHours(0);
  nextRefresh.setDate(nextRefresh.getDate() + 1);

  setTimeout(function() {
    refreshTorEntries();
  }, nextRefresh.getTime() - new Date().getTime());

}
// end of tor refresh

// start of board stats recording

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
      if (verbose) {
        console.log(error.toString());
      }

      if (debug) {
        throw error;
      }
    } else {
      // style exception, too simple
      generator.frontPage(function generatedFrontPage(error) {
        if (error) {
          if (verbose) {
            console.log(error.toString());
          }

          if (debug) {
            throw error;
          }
        } else {
          boardsStats();
        }
      });
      // style exception, too simple

    }

  });

}

function getStats() {

  var timeToApply = new Date();
  timeToApply.setMilliseconds(0);
  timeToApply.setSeconds(0);
  timeToApply.setMinutes(0);
  timeToApply.setHours(timeToApply.getHours() - 1);

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
      if (verbose) {
        console.log(error.toString());
      }
      if (debug) {
        throw error;
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

  tickTime.setMilliseconds(0);
  tickTime.setSeconds(5);
  tickTime.setMinutes(0);
  tickTime.setHours(tickTime.getHours() + 1);

  setTimeout(function() {

    getStats();

  }, tickTime.getTime() - current);
}
// end of board stats recording

// start of temp files cleanup
function iterateFiles(files) {

  if (files.length) {
    var file = tempDirectory + '/' + files.shift();

    fs.stat(file, function gotStats(error, stats) {

      if (error) {
        if (verbose) {
          console.log(error);
        }

        if (debug) {
          throw error;
        } else {
          iterateFiles(files);
        }

      } else {

        var deleteFile = stats.isFile() && !stats.size;

        if (deleteFile && new Date() > logger.addMinutes(stats.ctime, 1)) {

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
      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }
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
// end of temp files cleanup

// start of captcha cleanup
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

      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }

    } else if (results.length) {

      var expiredFiles = results[0].files;

      if (verbose) {
        var message = 'Deleting expired captchas: ';
        message += JSON.stringify(expiredFiles);
        console.log(message);
      }

      // style exception, too simple
      gridFsHandler.removeFiles(expiredFiles, function deletedFiles(error) {
        if (error) {
          if (verbose) {
            console.log(error);
          }

          if (debug) {
            throw error;
          }
        } else {
          expiredCaptcha();
        }
      });

      // style exception, too simple

    } else {
      expiredCaptcha();
    }
  });

}
// end of captcha cleanup
