'use strict';

// Starting point of the application.
// Controls the workers.

var cluster = require('cluster');

try {
  exports.native = require('./build/Release/native');
} catch (error) {
  if (require('cluster').isMaster) {
    console.log('Could not load native functions.');
    console.log('Exec functions will be used as a fallback.');
    console.log(error);
  }
}

var db;
var fs = require('fs');
var settingsHandler = require('./settingsHandler');
var generator;

var MINIMUM_WORKER_UPTIME = 5000;
var forkTime = {};

var defaultFilesArray;
var defaultImages = [ 'thumb', 'audioThumb', 'defaultBanner', 'spoiler',
    'maintenanceImage' ];

var defaultFilesRelation;

var genericThumb;
var defaultBanner;
var maintenanceImage;
var genericAudioThumb;
var spoilerImage;
var genQueue;

function reloadCore() {

  require('./taskListener').reload();

  if (cluster.isMaster) {
    require('./scheduleHandler').reload();
    require('./generationQueue').reload();
  } else {
    require('./workerBoot').reload();
  }
}

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

  var templateHandler = require('./engine/templateHandler');

  templateHandler.dropAlternativeTemplates();
  templateHandler.loadTemplates();
  require('./engine/cacheHandler').dropStaticCache();

}

var informedArguments = require('./argumentHandler').informedArguments;

exports.informedArguments = function() {
  return informedArguments;
};

var optionalReloads = [ {
  generatorModule : 'global',
  generatorFunction : 'frontPage',
  command : informedArguments.reloadFront.informed
}, {
  generatorFunction : 'overboard',
  generatorModule : 'global',
  command : informedArguments.reloadOverboard.informed
}, {
  generatorFunction : 'multiboard',
  generatorModule : 'global',
  command : informedArguments.reloadMultiboard.informed
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

exports.maintenanceImage = function() {
  return maintenanceImage;
};

exports.feDebug = function() {
  return informedArguments.frontDebug.informed;
};

exports.torDebug = function() {
  return informedArguments.torDebug.informed;
};

exports.ip = function() {
  return informedArguments.ip.value;
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

function getExtension(fileName) {
  var parts = fileName.split('.');

  return parts[parts.length - 1].toLowerCase();
}

function setDefaultImages() {

  var templateSettings = settingsHandler.getTemplateSettings();

  genericThumb = '/genericThumb.' + getExtension(templateSettings.thumb);

  var audioTumbExt = getExtension(templateSettings.audioThumb);
  genericAudioThumb = '/audioGenericThumb.' + audioTumbExt;

  var bannerThumb = getExtension(templateSettings.defaultBanner);
  defaultBanner = '/defaultBanner.' + bannerThumb;

  var maintenanceExt = getExtension(templateSettings.maintenanceImage);
  maintenanceImage = '/maintenanceImage.' + maintenanceExt;

  spoilerImage = '/spoiler.' + getExtension(templateSettings.spoiler);

}

function composeDefaultFiles() {
  defaultFilesArray = [ '/404.html', genericThumb, '/login.html',
      defaultBanner, spoilerImage, '/maintenance.html', genericAudioThumb,
      maintenanceImage ];

  defaultFilesRelation = {
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

  defaultFilesRelation[maintenanceImage] = {
    generatorFunction : 'maintenanceImage',
    generatorModule : 'global',
    command : informedArguments.reloadMaintenanceImage.informed
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

  if (message.socketStatus) {
    require('./taskListener').status = message.status;
  }

  if (message.shutdown) {

    if (cluster.isMaster) {

      exports.shuttingDown = true;
      require('./scheduleHandler').stop();

    } else {

      require('./workerBoot').stopServers(function serversStoppedCallback() {
        db.client().close();
        process.exit(0);
      });

    }
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

  } else if (message.restartSocket) {
    exports.broadCastTopDownMessage({
      socketStatus : true
    });

    require('./taskListener').start();

  } else {
    genQueue.queue(message);
  }

}

var workerExitCallback = function(worker, code, signal) {

  if (exports.shuttingDown) {

    if (!Object.keys(cluster.workers).length) {
      db.client().close();
    }

    return;
  }

  console.log('Server worker ' + worker.id + ' crashed.');

  if (new Date().getTime() - forkTime[worker.id] < MINIMUM_WORKER_UPTIME) {
    console.log('Crash on boot, not restarting it.');
  } else {
    cluster.fork();
  }

  delete forkTime[worker.id];
};

// after everything is all right, call this function to start the workers
function bootWorkers() {

  if (noDaemon) {
    db.client().close();
    return;
  }

  require('./engine/webSocketHandler').init();

  genQueue = require('./generationQueue');

  var workerLimit = require('os').cpus().length;

  for (var i = 0; i < workerLimit; i++) {
    cluster.fork();
  }

  var bootedWorkers = 0;

  cluster.on('fork', function(worker) {

    bootedWorkers++;

    if (workerLimit === bootedWorkers) {
      require('./taskListener').start(true);
    }

    forkTime[worker.id] = new Date().getTime();

    worker.on('message', function receivedMessage(message) {
      processBottomTopMessage(message);
    });

  });

  cluster.on('exit', workerExitCallback);
}

function regenerateAll() {

  generator.all(function regeneratedAll(error) {

    if (error) {
      console.log(error);
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
              db.client().close(function closed() {
                process.exit(1);
              });
              // style exception, too simple

              return;

            } else {
              console.log(error);
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
          }

          iterateDefaultPages(foundFiles, ++index);

        });
  } else {
    iterateDefaultPages(foundFiles, ++index);
  }

}

// we need to check if the default pages can be found
function checkForDefaultPages() {

  generator = require('./engine/degenerator');

  if (informedArguments.reload.informed) {
    regenerateAll();
    return;
  }

  var files = db.files();

  files.aggregate([ {
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
  } ]).toArray(function gotFiles(error, files) {

    if (error) {
      throw error;
    } else {
      iterateDefaultPages(files.length ? files[0].pages : []);
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
  }, null, function setRole(error) {

    if (error) {
      console.log(error);
    } else {
      console.log('Set role ' + informedRole + ' for ' + informedLogin + '.');
    }

    checkForDefaultPages();

  }, true);

};

function setPassword() {

  require('./engine/accountOps').setUserPassword(informedLogin,
      informedPassword, function setPassword(error) {

        if (error) {
          console.log(error);
        } else {
          console.log('Password set for ' + informedLogin + '.');
        }

        checkForDefaultPages();

      }, true);

}

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

  reloadCore();

};

function checkMaintenanceMode() {

  var parsedValue = !!JSON.parse(informedArguments.maintenance.value);

  var current = !!settingsHandler.getGeneralSettings().maintenance;

  var changed = parsedValue !== current;

  if (changed) {

    require('./taskListener').sendToSocket(null, {
      type : 'maintenance',
      value : parsedValue
    });

  }
}

function initTorControl() {

  require('./engine/torOps').init(function initializedTorControl(error) {
    if (error) {
      throw error;
    } else {
      if (!noDaemon) {
        require('./scheduleHandler').start();
      } else {

        if (informedArguments.maintenance.value) {
          checkMaintenanceMode();
        } else if (informedArguments.reloadFrontEnd.informed) {

          require('./taskListener').sendToSocket(null, {
            type : 'reloadFE'
          });

        } else if (informedArguments.shutdown.informed) {

          require('./taskListener').sendToSocket(null, {
            type : 'shutdown'
          });

        }

      }

      if (createAccount) {
        createAccountFunction();
      } else if (informedArguments.setRole.informed) {
        setRoleFunction();
      } else if (informedArguments.setPassword.informed) {
        setPassword();
      } else {
        checkForDefaultPages();
      }
    }
  });
}

function initSpamData() {

  require('./engine/spamOps').init(function initializedSpamData(error) {

    if (error) {
      console.log(error);
    }

    initTorControl();

  });

}

function checkIndividualCacheDeletion() {

  if (informedArguments.clearCache.informed) {

    settingsHandler.clearIndividualCaches(function clearedCaches() {
      initSpamData();
    });

  } else {
    initSpamData();
  }

}

function checkDiskMediaMoving() {

  if (informedArguments.diskMedia.value) {

    require('./engine/mediaHandler').move(
        !!JSON.parse(informedArguments.diskMedia.value), function moved() {

          checkIndividualCacheDeletion();

        });

  } else {
    checkIndividualCacheDeletion();
  }

}

function checkFilePruning() {

  if (informedArguments.pruneFiles.informed) {

    require('./engine/mediaHandler').prune(function pruned(error) {

      if (error) {
        console.log(error);
      }

      checkDiskMediaMoving();

    });

  } else {
    checkDiskMediaMoving();
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

function bootDb() {

  db.init(function bootedDb(error) {

    if (error) {
      throw error;
    } else {

      exports.startEngine();

      if (!settingsHandler.getGeneralSettings().master) {
        checkDbVersions();
      } else {
        initSpamData();
      }

    }

  });

}

if (cluster.isMaster) {

  try {

    fs.statSync(settingsHandler.getGeneralSettings().tempDirectory);
    fs.statSync(__dirname + '/media');

    bootDb();

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Creating directories.');

      var command = 'mkdir -p ' + __dirname + '/media ';
      command += settingsHandler.getGeneralSettings().tempDirectory;

      require('child_process').exec(command, function createdDirectory() {
        bootDb();
      });
    } else {
      throw error;
    }

  }

} else {

  process.on('message', function messageReceived(msg) {
    exports.processTopDownMessage(msg);
  });

  require('./workerBoot').boot();
}