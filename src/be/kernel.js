'use strict';

// Starting point of the application.
// Controls the workers.

var cluster = require('cluster');
var db;
var fs = require('fs');
var settingsHandler = require('./settingsHandler');
var generator;

var reloadDirectories = [ 'engine', 'form', 'api', 'addons' ];
var reloadIgnore = [ 'index.js', '.ignore', '.git', 'dont-reload' ];

var MINIMUM_WORKER_UPTIME = 5000;
var forkTime = {};

var defaultFilesArray;
var defaultImages = [ 'thumb', 'audioThumb', 'defaultBanner', 'spoiler' ];

var defaultFilesRelation;

var genericThumb;
var defaultBanner;
var genericAudioThumb;
var spoilerImage;
var genQueue;

function reloadDirectory(directory) {

  var dirListing = fs.readdirSync(directory);

  for (var i = 0; i < dirListing.length; i++) {

    var module = dirListing[i];

    if (reloadIgnore.indexOf(module.toLowerCase()) === -1) {

      var fullPath = directory + '/' + module;

      var stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        reloadDirectory(fullPath);
      }

      delete require.cache[require.resolve(fullPath)];
    }
  }

}

function reloadCore() {

  if (cluster.isMaster) {
    require('./scheduleHandler').reload();
    require('./generationQueue').reload();
  } else {
    require('./workerBoot').reload();
  }
}

exports.reload = function() {

  for (var i = 0; i < reloadDirectories.length; i++) {
    reloadDirectory(__dirname + '/' + reloadDirectories[i]);
  }

  settingsHandler.loadSettings();

  checkImagesSet();

  setDefaultImages();

  exports.startEngine();

  reloadCore();

};

function reloadSettings() {

  settingsHandler.loadSettings();

  checkImagesSet();

  setDefaultImages();

  var dirListing = fs.readdirSync(__dirname + '/engine');

  for (var i = 0; i < dirListing.length; i++) {
    var module = require('./engine/' + dirListing[i]);

    if (module.hasOwnProperty('loadSettings')) {
      module.loadSettings();
    }

  }

  reloadCore();

}

function reloadFe() {

  require('./engine/templateHandler').loadTemplates();
  require('./engine/staticHandler').dropCache();

}

var informedArguments = require('./argumentHandler').informedArguments;

exports.informedArguments = function() {
  return informedArguments;
};

var optionalReloads = [ {
  generatorFunction : 'overboard',
  generatorModule : 'global',
  command : informedArguments.reloadOverboard.informed
}, {
  generatorFunction : 'previews',
  generatorModule : 'board',
  command : informedArguments.reloadPreviews.informed
}, {
  generatorFunction : 'logs',
  generatorModule : 'global',
  command : informedArguments.reloadLogs.informed
}, {
  generatorFunction : 'boards',
  generatorModule : 'board',
  command : informedArguments.reloadBoards.informed
}, {
  generatorFunction : 'graphs',
  generatorModule : 'global',
  command : informedArguments.reloadGraphs.informed
} ];

var debug = informedArguments.debug.informed;
var noDaemon = informedArguments.noDaemon.informed;

var informedLogin = informedArguments.login.value;
var informedPassword = informedArguments.password.value;
var informedRole = informedArguments.globalRole.value;

var createAccount = informedArguments.createAccount.informed;

exports.genericThumb = function() {
  return genericThumb;
};

exports.genericAudioThumb = function() {
  return genericAudioThumb;
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

exports.feDebug = function() {
  return informedArguments.frontDebug.informed;
};

exports.torDebug = function() {
  return informedArguments.torDebug.informed;
};

function checkImagesSet() {

  var templateSettings = settingsHandler.getTemplateSettings();

  for (var i = 0; i < defaultImages.length; i++) {

    var image = defaultImages[i];

    if (!templateSettings[image]) {
      var error = 'Template image ' + image;
      error += ' not set on the template settings.';
      throw error;
    }
  }
}

function setDefaultImages() {

  var templateSettings = settingsHandler.getTemplateSettings();

  var thumbExt = templateSettings.thumb.split('.');
  thumbExt = thumbExt[thumbExt.length - 1].toLowerCase();
  genericThumb = '/genericThumb.' + thumbExt;

  var audioThumbExt = templateSettings.audioThumb.split('.');
  audioThumbExt = audioThumbExt[audioThumbExt.length - 1].toLowerCase();
  genericAudioThumb = '/audioGenericThumb.' + audioThumbExt;

  var bannerExt = templateSettings.defaultBanner.split('.');
  bannerExt = bannerExt[bannerExt.length - 1].toLowerCase();
  defaultBanner = '/defaultBanner.' + bannerExt;

  var spoilerExt = templateSettings.spoiler.split('.');
  spoilerExt = spoilerExt[spoilerExt.length - 1].toLowerCase();
  spoilerImage = '/spoiler.' + spoilerExt;

}

function composeDefaultFiles() {
  defaultFilesArray = [ '/', '/404.html', genericThumb, '/login.html',
      defaultBanner, spoilerImage, '/maintenance.html', genericAudioThumb ];

  defaultFilesRelation = {
    '/' : {
      generatorModule : 'global',
      generatorFunction : 'frontPage',
      command : informedArguments.reloadFront.informed
    },
    '/404.html' : {
      generatorModule : 'global',
      generatorFunction : 'notFound',
      command : informedArguments.reloadNotFound.informed
    },
    '/login.html' : {
      generatorModule : 'global',
      generatorFunction : 'login',
      command : informedArguments.reloadLogin.informed
    },
    '/maintenance.html' : {
      generatorModule : 'global',
      generatorFunction : 'maintenance',
      command : informedArguments.reloadMaintenance.informed
    }
  };

  defaultFilesRelation[genericThumb] = {
    generatorFunction : 'thumb',
    generatorModule : 'global',
    command : informedArguments.reloadThumb.informed
  };

  defaultFilesRelation[spoilerImage] = {
    generatorFunction : 'spoiler',
    generatorModule : 'global',
    command : informedArguments.reloadSpoiler.informed
  };

  defaultFilesRelation[defaultBanner] = {
    generatorFunction : 'defaultBanner',
    generatorModule : 'global',
    command : informedArguments.reloadBanner.informed
  };

  defaultFilesRelation[genericAudioThumb] = {
    generatorFunction : 'audioThumb',
    generatorModule : 'global',
    command : informedArguments.reloadAudio.informed
  };

}

exports.noDaemon = function() {
  return noDaemon;
};

// Processes messages generated from master, even on the master process.
exports.processTopDownMessage = function(message) {

  if (message.reloadSettings) {
    reloadSettings();
  }

  if (message.reloadFE) {
    reloadFe();
  }

};

// Processes and broadcasts messages coming from master to workers.
// Top-down messages are generated from the master process and then sent to
// workers instead of being generated from worker processes and then processed
// at the master process
exports.broadCastTopDownMessage = function(message) {

  exports.processTopDownMessage(message);

  for ( var id in cluster.workers) {
    cluster.workers[id].send(message);
  }
};

// Processes messages coming from workers to master.
// The message can be either broadcast back to workers
// or just added to the rebuild queue.
function processBottomTopMessage(message) {

  if (message.upStream) {
    message.upStream = false;

    exports.broadCastTopDownMessage(message);

    if (message.rebuilds) {
      for (var i = 0; i < message.rebuilds.length; i++) {
        genQueue.queue(message.rebuilds[i]);
      }
    }

  } else {
    genQueue.queue(message);
  }

}

// after everything is all right, call this function to start the workers
function bootWorkers() {

  if (noDaemon) {
    db.conn().close();
    return;
  }

  genQueue = require('./generationQueue');

  if (!settingsHandler.getGeneralSettings().master) {
    genQueue.loadUnfinishedMessages();
  }

  var workerLimit;

  var coreCount = require('os').cpus().length;

  if (debug && coreCount > 2) {
    workerLimit = 2;
  } else {
    workerLimit = coreCount;
  }

  for (var i = 0; i < workerLimit; i++) {
    cluster.fork();
  }

  cluster.on('fork', function(worker) {

    forkTime[worker.id] = new Date().getTime();

    worker.on('message', function receivedMessage(message) {
      processBottomTopMessage(message);
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

      console.log(error);

      if (debug) {
        throw error;
      }

    }

    bootWorkers();
  });

}

function iterateOptionalReloads(index) {

  index = index || 0;

  if (index >= optionalReloads.length) {
    bootWorkers();

    return;
  }

  var toCheck = optionalReloads[index];

  if (!toCheck.command) {
    iterateOptionalReloads(index + 1);
  } else {

    generator[toCheck.generatorModule][toCheck.generatorFunction]
        (function generated(error) {

          if (error) {

            if (informedArguments.noFork.informed) {

              console.error(error);

              // style exception, too simple
              db.conn().close(function closed() {
                process.exit(1);
              });
              // style exception, too simple

              return;

            } else {

              console.log(error);

              if (debug) {
                throw error;
              }
            }

          }

          iterateOptionalReloads(index + 1);

        });

  }

}

function iterateDefaultPages(foundFiles, index) {

  index = index || 0;

  if (index >= defaultFilesArray.length) {
    iterateOptionalReloads();
    return;

  }

  var fileToCheck = defaultFilesArray[index];

  var fileData = defaultFilesRelation[fileToCheck];

  if (foundFiles.indexOf(fileToCheck) === -1 || fileData.command) {
    generator[fileData.generatorModule][fileData.generatorFunction]
        (function generated(error) {
          if (error) {

            console.log(error);

            if (debug) {
              throw error;
            }
          }

          iterateDefaultPages(foundFiles, index + 1);

        });
  } else {
    iterateDefaultPages(foundFiles, index + 1);
  }

}

// we need to check if the default pages can be found
function checkForDefaultPages() {

  generator = require('./engine/generator');

  if (informedArguments.reload.informed) {
    regenerateAll();
    return;
  }

  var files = db.files();

  files.aggregate({
    $match : {
      filename : {
        $in : defaultFilesArray
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
      throw error;
    } else if (files.length) {
      iterateDefaultPages(files[0].pages);
    } else {
      regenerateAll();
    }
  });

}

settingsHandler.loadSettings();

checkImagesSet();

setDefaultImages();

composeDefaultFiles();

db = require('./db');

var createAccountFunction = function() {
  require('./engine/accountOps').registerUser({
    login : informedLogin,
    password : informedPassword
  }, function createdUser(error) {

    if (error) {

      console.log(error);

      if (debug) {
        throw error;
      }
    } else {
      console.log('Account ' + informedLogin + ' created.');

    }

    checkForDefaultPages();

  }, informedRole, true);

};

var setRoleFunction = function() {

  require('./engine/accountOps').setGlobalRole(null, {
    role : informedRole,
    login : informedLogin
  }, function setRole(error) {

    if (error) {
      console.log(error);
      if (debug) {
        throw error;
      }

    } else {
      console.log('Set role ' + informedRole + ' for ' + informedLogin + '.');
    }

    checkForDefaultPages();

  }, true);

};

// loads inter-modular dependencies in the engine by making sure every module is
// loaded to only then set references they might have between them
// vroom vroom :v
exports.startEngine = function() {

  var dirListing = fs.readdirSync(__dirname + '/engine');

  for (var i = 0; i < dirListing.length; i++) {
    require('./engine/' + dirListing[i]);
  }

  for (i = 0; i < dirListing.length; i++) {
    var module = require('./engine/' + dirListing[i]);

    if (module.hasOwnProperty('loadDependencies')) {
      module.loadDependencies();
    }

    if (module.hasOwnProperty('loadSettings')) {
      module.loadSettings();
    }
  }

  require('./engine/addonOps').startAddons();

  require('./engine/templateHandler').loadTemplates();

};

var socketLocation = settingsHandler.getGeneralSettings().tempDirectory;
socketLocation += '/unix.socket';

function checkMaintenanceMode() {

  var parsedValue = JSON.parse(informedArguments.maintenance.value) ? true
      : false;

  var current = settingsHandler.getGeneralSettings().maintenance ? true : false;

  var changed = parsedValue !== current;

  if (changed) {
    var client = new require('net').Socket();

    client.connect(socketLocation, function() {
      client.write(JSON.stringify({
        type : 'maintenance',
        value : parsedValue
      }));
      client.destroy();
    });
  }
}

function initTorControl() {

  require('./engine/torOps').init(function initializedTorControl(error) {
    if (error) {
      throw error;
    } else {
      if (!noDaemon) {
        require('./taskListener').start();
        require('./scheduleHandler').start();
      } else {

        if (informedArguments.maintenance.value) {
          checkMaintenanceMode();
        } else if (informedArguments.reloadFrontEnd.informed) {

          var client = new require('net').Socket();

          // style exception, too simple
          client.connect(socketLocation, function() {
            client.write(JSON.stringify({
              type : 'reloadFE'
            }));

            client.destroy();

          });
          // style exception, too simple

        }

      }

      if (createAccount) {
        createAccountFunction();
      } else if (informedArguments.setRole.informed) {
        setRoleFunction();
      } else {
        checkForDefaultPages();
      }
    }
  });
}

function initSpamData() {

  require('./engine/spamOps').init(function initializedSpamData(error) {

    if (error) {

      if (debug) {
        throw error;
      }

      console.log(error);

    }

    initTorControl();

  });

}

function checkFilePruning() {

  if (informedArguments.pruneFiles.informed) {

    require('./engine/mediaHandler').prune(function pruned(error) {

      if (error) {

        console.log(error);
      }

      initSpamData();

    });

  } else {
    initSpamData();
  }

}

function checkDbVersions() {

  db.checkVersion(function checkedVersion(error) {

    if (error) {
      throw error;
    } else {

      var overboard = settingsHandler.getGeneralSettings().overboard;
      var sfwOverboard = settingsHandler.getGeneralSettings().sfwOverboard;

      if (overboard || sfwOverboard) {

        var uris = [];

        if (overboard) {
          uris.push(overboard);
        }

        if (sfwOverboard) {
          uris.push(sfwOverboard);
        }

        db.boards().findOne({
          boardUri : {
            $in : uris
          }
        }, function(error, board) {
          if (error) {
            throw error;
          } else if (board) {
            var toThrow = 'You will have to change your overboard or SFW ';
            toThrow += 'overboard uri, there is already a board with this uri';

            throw toThrow;
          } else {
            checkFilePruning();
          }
        });

      } else {
        checkFilePruning();
      }
    }
  });
}

if (cluster.isMaster) {

  db.init(function bootedDb(error) {

    if (error) {
      throw error;
    } else {
      exports.startEngine();

      if (!settingsHandler.getGeneralSettings().master) {
        checkDbVersions();
      } else {
        initTorControl();
      }

    }

  });

} else {

  process.on('message', function messageReceived(msg) {
    exports.processTopDownMessage(msg);
  });

  require('./workerBoot').boot();
}