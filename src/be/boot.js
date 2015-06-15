#!/usr/bin/env iojs

'use strict';

// Starting point of the application.
// Holds the loaded settings.
// Controls the workers.

var cluster = require('cluster');
var db;
var fs = require('fs');
var logger = require('./logger');
var generator;

var MINIMUM_WORKER_UPTIME = 1000;
var forkTime = {};

var dbSettings;
var generalSettings;
var templateSettings;
var genericThumb;
var defaultBanner;
var spoilerImage;
var fePath;
var tempDirectory;
var maxRequestSize;
var maxFileSize;

var args = process.argv;

var debug = args.indexOf('-d') > -1;
debug = debug || args.indexOf('--debug') > -1;

var reload = args.indexOf('-r') > -1;
reload = reload || args.indexOf('--reload') > -1;

var noDaemon = args.indexOf('-nd') > -1;
noDaemon = noDaemon || args.indexOf('--no-daemon') > -1;

var createAccount = args.indexOf('-ca') > -1;
createAccount = createAccount || args.indexOf('--create-account') > -1;

var informedLogin;
var informedPassword;
var informedRole;

if (createAccount) {
  var loginIndex = args.indexOf('-l');
  if (loginIndex === -1) {
    loginIndex = args.indexOf('--login');
  }

  var passwordIndex = args.indexOf('-p');
  if (passwordIndex === -1) {
    passwordIndex = args.indexOf('--password');
  }

  var roleIndex = args.indexOf('-gr');
  if (roleIndex === -1) {
    roleIndex = args.indexOf('--global-role');
  }

  roleIndex++;
  passwordIndex++;
  loginIndex++;

  if (passwordIndex && passwordIndex < args.length) {
    informedPassword = args[passwordIndex];
  }

  if (loginIndex && loginIndex < args.length) {
    informedLogin = args[loginIndex];
  }

  if (roleIndex && roleIndex < args.length) {
    informedRole = args[roleIndex];
  }

}

exports.genericThumb = function() {
  return genericThumb;
};

exports.spoilerImage = function() {
  return spoilerImage;
};

exports.defaultBanner = function() {
  return defaultBanner;
};

exports.debug = function() {
  return debug;
};

exports.getDbSettings = function() {

  return dbSettings;
};

exports.getGeneralSettings = function() {
  return generalSettings;
};

exports.getTemplateSettings = function() {
  return templateSettings;
};

exports.getFePath = function() {
  return fePath;
};

exports.tempDir = function() {

  return tempDirectory;

};

function setMaxSizes() {
  if (generalSettings.maxFileSizeMB) {
    maxFileSize = generalSettings.maxFileSizeMB * 1024 * 1024;
  } else {
    maxFileSize = Infinity;
  }

  maxRequestSize = (generalSettings.maxRequestSizeMB || 2) * 1024 * 1024;

}

function setDefaultImages() {
  var thumbExt = templateSettings.thumb.split('.');

  thumbExt = thumbExt[thumbExt.length - 1].toLowerCase();

  genericThumb = '/genericThumb' + '.' + thumbExt;

  var bannerExt = templateSettings.defaultBanner.split('.');

  bannerExt = bannerExt[bannerExt.length - 1].toLowerCase();

  defaultBanner = '/defaultBanner' + '.' + bannerExt;

  var spoilerExt = templateSettings.spoiler.split('.');

  spoilerExt = spoilerExt[spoilerExt.length - 1].toLowerCase();

  spoilerImage = '/spoiler' + '.' + spoilerExt;
}

exports.loadSettings = function() {

  var dbSettingsPath = __dirname + '/settings/db.json';

  dbSettings = JSON.parse(fs.readFileSync(dbSettingsPath));

  var generalSettingsPath = __dirname + '/settings/general.json';

  generalSettings = JSON.parse(fs.readFileSync(generalSettingsPath));

  generalSettings.address = generalSettings.address || '127.0.0.1';
  generalSettings.port = generalSettings.port || 8080;

  fePath = generalSettings.fePath || __dirname + '/../fe';

  tempDirectory = generalSettings.tempDirectory || '/tmp';

  setMaxSizes();

  var templateSettingsPath = fePath + '/templateSettings.json';

  templateSettings = JSON.parse(fs.readFileSync(templateSettingsPath));

  setDefaultImages();

};

exports.maxRequestSize = function() {
  return maxRequestSize;
};

exports.maxFileSize = function() {
  return maxFileSize;
};

// after everything is all right, call this function to start the workers
function bootWorkers() {

  var genQueue = require('./generationQueue');

  if (noDaemon) {
    db.conn().close();
    return;
  }

  for (var i = 0; i < require('os').cpus().length; i++) {
    cluster.fork();
  }

  cluster.on('fork', function(worker) {

    forkTime[worker.id] = new Date().getTime();

    worker.on('message', function receivedMessage(message) {
      genQueue.queue(message);
    });
  });

  cluster.on('exit', function(worker, code, signal) {
    console.log('Server worker ' + worker.id + ' crashed.');

    if (new Date().getTime() - forkTime[worker.id] < MINIMUM_WORKER_UPTIME) {
      console.log('Crash on boot, not restarting it.');
    } else {
      cluster.fork();
    }

    delete forkTime[worker.id];
  });
}

function regenerateAll() {

  generator.all(function regeneratedAll(error) {
    if (error) {

      if (generalSettings.verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }

    } else {
      bootWorkers();
    }
  });

}

function checkThumb(files) {
  if (files.indexOf(genericThumb) === -1) {
    generator.defaultBanner(function generated(error) {
      if (error) {
        if (generalSettings.verbose) {
          console.log(error);
        }

        if (debug) {
          throw error;
        }

      } else {
        bootWorkers();
      }
    });
  } else {
    bootWorkers();
  }
}

function checkBanner(files) {
  if (files.indexOf(defaultBanner) === -1) {
    generator.defaultBanner(function generated(error) {
      if (error) {
        if (generalSettings.verbose) {
          console.log(error);
        }

        if (debug) {
          throw error;
        }

      } else {
        checkThumb(files);
      }
    });
  } else {
    checkThumb(files);
  }
}

function checkSpoilerImage(files) {
  if (files.indexOf(spoilerImage) === -1) {
    generator.spoiler(function generated(error) {
      if (error) {
        if (generalSettings.verbose) {
          console.log(error);
        }

        if (debug) {
          throw error;
        }

      } else {
        checkBanner(files);
      }
    });
  } else {
    checkBanner(files);
  }
}

function checkLoginPage(files) {
  if (files.indexOf('/login.html') === -1) {

    generator.login(function generated(error) {
      if (error) {
        if (generalSettings.verbose) {
          console.log(error);
        }

        if (debug) {
          throw error;
        }

      } else {
        checkSpoilerImage(files);
      }

    });

  } else {
    checkSpoilerImage(files);
  }
}

function checkNotFound(files) {

  if (files.indexOf('/404.html') === -1) {

    generator.notFound(function generated(error) {
      if (error) {
        if (generalSettings.verbose) {
          console.log(error);
        }

        if (debug) {
          throw error;
        }

      } else {
        checkLoginPage(files);
      }

    });

  } else {
    checkLoginPage(files);
  }

}

function checkFrontPage(files) {

  if (files.indexOf('/') === -1) {
    generator.frontPage(function generated(error) {
      if (error) {
        if (generalSettings.verbose) {
          console.log(error);
        }

        if (debug) {
          throw error;
        }

      } else {
        checkNotFound(files);
      }

    });
  } else {
    checkNotFound(files);
  }

}

// we need to check if the default pages can be found
function checkForDefaultPages() {

  generator = require('./engine/generator');
  require('./engine/domManipulator').loadTemplates();

  if (reload) {
    regenerateAll();
    return;
  }

  var files = db.files();

  files.aggregate({
    $match : {
      filename : {
        $in : [ '/', '/404.html', genericThumb, '/login.html', defaultBanner,
            spoilerImage ]
      }
    }
  }, {
    $project : {
      filename : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 1,
      pages : {
        $push : '$filename'
      }
    }
  }, function gotFiles(error, files) {
    if (error) {
      if (generalSettings.verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }
    } else if (files.length) {
      checkFrontPage(files[0].pages);
    } else {
      regenerateAll();
    }
  });

}

try {
  exports.loadSettings();
} catch (error) {
  if (generalSettings.verbose) {
    console.log(error);
  }

  if (debug) {
    throw error;
  }
  return;
}

db = require('./db');

function scheduleTempFilesCleaning() {

  setTimeout(function() {

    removeExpiredTempFiles(function removedExpiredFiles(error) {
      if (error) {
        if (generalSettings.verbose) {
          console.log(error);
        }
        if (debug) {
          throw error;
        }
      } else {
        scheduleTempFilesCleaning();
      }

    });
  }, 1000 * 60);

}

function checkDbVersions() {

  db.checkVersion(function checkedVersion(error) {

    if (error) {
      if (generalSettings.verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }
    } else {

      if (!noDaemon) {
        db.scheduleExpiredCaptchaCheck(true);
      }

      if (createAccount) {

        // style exception, too simple
        require('./engine/accountOps').registerUser({
          login : informedLogin,
          password : informedPassword
        }, function createdUser(error) {

          if (error) {

            if (generalSettings.verbose) {
              console.log(error);
            }

            if (debug) {
              throw error;
            }

            checkForDefaultPages();

          } else {
            console.log('Account ' + informedLogin + ' created.');

            checkForDefaultPages();
          }

        }, informedRole);
        // style exception, too simple

      } else {
        checkForDefaultPages();
      }
    }

  });

}

if (cluster.isMaster) {

  if (debug && !noDaemon) {

    removeExpiredTempFiles(function removedExpiredFiles(error) {
      if (error) {
        if (generalSettings.verbose) {
          console.log(error);
        }
        if (debug) {
          throw error;
        }
      } else {
        scheduleTempFilesCleaning();
      }
    });
  }

  db.init(function bootedDb(error) {

    if (error) {
      if (generalSettings.verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }
    } else {

      checkDbVersions();

    }

  });

} else {

  require('./workerBoot').boot();
}

function iterateFiles(files, callback) {

  if (files.length) {
    var file = tempDirectory + '/' + files.shift();

    fs.stat(file, function gotStats(error, stats) {

      if (error) {
        callback(error);
      } else {

        var deleteFile = stats.isFile() && !stats.size;

        if (deleteFile && new Date() > logger.addMinutes(stats.ctime, 1)) {

          if (generalSettings.verbose) {
            console.log('Removing expired tmp file ' + file);
          }

          fs.unlink(file);
        }

        iterateFiles(files, callback);
      }

    });
  } else {
    callback();

  }

}

function removeExpiredTempFiles(callback) {
  fs.readdir(tempDirectory, function gotFiles(error, files) {
    if (error) {
      callback(error);
    } else {
      iterateFiles(files, callback);
    }

  });
}
