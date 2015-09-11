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

var reloadDirectories = [ 'engine', 'form', 'api', 'addons' ];
var reloadIgnore = [ 'index.js', '.ignore', '.git', 'dont-reload' ];

var MINIMUM_WORKER_UPTIME = 5000;
var forkTime = {};

var defaultFilesArray;
var defaultImages = [ 'thumb', 'audioThumb', 'defaultBanner', 'spoiler' ];

var defaultFilesRelation;

var archiveSettings;
var dbSettings;
var generalSettings;
var templateSettings;
var genericThumb;
var defaultBanner;
var genericAudioThumb;
var spoilerImage;
var fePath;
var tempDirectory;

exports.getDefaultSettings = function() {

  return {
    address : '0.0.0.0',
    port : 80,
    fePath : __dirname + '/../fe',
    tempDirectory : '/tmp',
    pageSize : 10,
    latestPostCount : 5,
    maxBoardTags : 5,
    autoSageLimit : 500,
    maxFiles : 3,
    maxThreadCount : 50,
    emailSender : 'noreply@mychan.com',
    captchaExpiration : 5,
    maxRequestSizeMB : 2,
    maxFileSizeMB : Infinity,
    acceptedMimes : [ 'image/png', 'image/jpeg', 'image/gif', 'image/bmp',
        'video/webm', 'audio/mpeg', 'video/mp4', 'video/ogg', 'audio/ogg',
        'audio/webm' ],
    logPageSize : 50,
    topBoardsCount : 25,
    boardsPerPage : 50,
    torSource : 'https://check.torproject.org/exit-addresses',
    maxBoardRules : 20,
    thumbSize : 128,
    maxFilters : 20,
    maxBoardVolunteers : 20,
    maxBannerSizeKB : 200,
    maxFlagSizeKB : 32,
    floodTimerSec : 10,
    archiveLevel : 0,
    torAccess : 0,
    proxyAccess : 0,
    clearIpMinRole : 0,
    boardCreationRequirement : 4
  };

};

function broadCastReload(reloadsToMake, callback) {

  process.send({
    upStream : true,
    reload : true,
    rebuilds : reloadsToMake
  });

  callback();

}

function checkGeneralSettingsChanged(settings, reloadsToMake, callback) {

  var rebuildFP = generalSettings.siteTitle !== settings.siteTitle;

  var topChanged = generalSettings.topBoardsCount !== settings.topBoardsCount;

  // was top boards enabled or disabled on this change?
  var tDChange = generalSettings.disableTopBoards !== settings.disableTopBoards;
  topChanged = topChanged || tDChange;

  rebuildFP = rebuildFP || topChanged;

  if (rebuildFP) {
    reloadsToMake.push({
      frontPage : true
    });
  }

  var rebuildBoards = generalSettings.pageSize !== settings.pageSize;
  var fileSizeDelta = generalSettings.maxFileSizeMB !== settings.maxFileSizeMB;

  rebuildBoards = rebuildBoards || fileSizeDelta;

  if (rebuildBoards) {
    reloadsToMake.push({
      allBoards : true
    });
  }

  broadCastReload(reloadsToMake, callback);
  
  if (!settings.allowBoardCustomJs && generalSettings.allowBoardCustomJs) {
    require('./engine/boardOps').custom.clearCstomJs();
  }
}

function checkSettingsChanges(settings, callback) {
  var reloadsToMake = [];

  if (generalSettings.fePath !== settings.fePath) {
    reloadsToMake.push({
      globalRebuild : true
    });

    broadCastReload(reloadsToMake, callback);
    return;
  }

  checkGeneralSettingsChanged(settings, reloadsToMake, callback);

}

exports.setNewSettings = function(settings, callback) {

  fs.writeFile(__dirname + '/settings/general.json', new Buffer(JSON.stringify(
      settings, null, 2), 'utf-8'), function wroteFile(error) {
    if (error) {
      callback(error);
    } else {

      var exceptionalFields = [ 'siteTitle', 'captchaFonts',
          'languagePackPath', 'defaultAnonymousName', 'defaultBanMessage',
          'disableTopBoards', 'allowBoardCustomJs' ];

      for ( var key in generalSettings) {
        if (!settings[key] && exceptionalFields.indexOf(key) === -1) {
          settings[key] = generalSettings[key];
        }
      }

      checkSettingsChanges(settings, callback);
    }
  });

};

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

exports.reload = function() {

  for (var i = 0; i < reloadDirectories.length; i++) {

    reloadDirectory(__dirname + '/' + reloadDirectories[i]);

  }

  exports.loadSettings();

  exports.startEngine();

  require('./engine/templateHandler').loadTemplates();
  require('./archive').reload();

  if (cluster.isMaster) {
    require('./scheduleHandler').reload();
  } else {
    require('./workerBoot').reload();
  }

};

var informedArguments = {
  debug : {
    short : '-d',
    long : '--debug',
    type : 'boolean'
  },
  torDebug : {
    short : '-td',
    long : '--tor-debug',
    type : 'boolean'
  },
  noDaemon : {
    short : '-nd',
    long : '--no-daemon',
    type : 'boolean'
  },
  setRole : {
    short : '-sr',
    long : '--set-role',
    type : 'boolean'
  },
  createAccount : {
    short : '-ca',
    long : '--create-account',
    type : 'boolean'
  },
  reload : {
    short : '-r',
    long : '--reload',
    type : 'boolean'
  },
  reloadLogin : {
    short : '-rl',
    long : '--reload-login',
    type : 'boolean'
  },
  reloadBanner : {
    short : '-rb',
    long : '--reload-banner',
    type : 'boolean'
  },
  reloadFront : {
    short : '-rf',
    long : '--reload-front',
    type : 'boolean'
  },
  reloadNotFound : {
    short : '-rn',
    long : '--reload-notfound',
    type : 'boolean'
  },
  reloadAudio : {
    short : '-ra',
    long : '--reload-audio',
    type : 'boolean'
  },
  reloadThumb : {
    short : '-rt',
    long : '--reload-thumb',
    type : 'boolean'
  },
  reloadSpoiler : {
    short : '-rs',
    long : '--reload-spoiler',
    type : 'boolean'
  },
  reloadMaintenance : {
    short : '-rm',
    long : '--reload-maintenance',
    type : 'boolean'
  },
  login : {
    short : '-l',
    long : '--login',
    type : 'value'
  },
  password : {
    short : '-p',
    long : '--password',
    type : 'value'
  },
  globalRole : {
    short : '-gr',
    long : '--global-role',
    type : 'value'
  }
};

var args = process.argv;

for ( var key in informedArguments) {

  var element = informedArguments[key];

  switch (element.type) {
  case 'value':
    var elementIndex = args.indexOf(element.short);
    if (elementIndex === -1) {
      elementIndex = args.indexOf(elementIndex);
    }

    if (elementIndex !== -1) {
      element.value = args[elementIndex + 1];
    }
    break;
  case 'boolean':
    element.informed = args.indexOf(element.short) > -1;

    if (!element.informed) {
      element.informed = args.indexOf(element.long) > -1;
    }

    break;
  }

}

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

exports.torDebug = function() {
  return informedArguments.torDebug.informed;
};

exports.getDbSettings = function() {

  return dbSettings;
};

exports.getArchiveSettings = function() {
  return archiveSettings;
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
  if (generalSettings.maxFileSizeMB !== Infinity) {
    generalSettings.maxFileSizeB = generalSettings.maxFileSizeMB * 1024 * 1024;
  } else {
    generalSettings.maxFileSizeB = Infinity;
  }

  var requestSizeB = generalSettings.maxRequestSizeMB * 1024 * 1024;
  generalSettings.maxRequestSizeB = requestSizeB;

  var bannerSizeB = generalSettings.maxBannerSizeKB * 1024;
  generalSettings.maxBannerSizeB = bannerSizeB;

  var flagSizeB = generalSettings.maxFlagSizeKB * 1024;
  generalSettings.maxFlagSizeB = flagSizeB;

}

function checkImagesSet() {

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

  var thumbExt = templateSettings.thumb.split('.');

  thumbExt = thumbExt[thumbExt.length - 1].toLowerCase();

  genericThumb = '/genericThumb' + '.' + thumbExt;

  var audioThumbExt = templateSettings.audioThumb.split('.');

  audioThumbExt = audioThumbExt[audioThumbExt.length - 1].toLowerCase();

  genericAudioThumb = '/audioGenericThumb' + '.' + audioThumbExt;

  var bannerExt = templateSettings.defaultBanner.split('.');

  bannerExt = bannerExt[bannerExt.length - 1].toLowerCase();

  defaultBanner = '/defaultBanner' + '.' + bannerExt;

  var spoilerExt = templateSettings.spoiler.split('.');

  spoilerExt = spoilerExt[spoilerExt.length - 1].toLowerCase();

  spoilerImage = '/spoiler' + '.' + spoilerExt;
}

function composeDefaultFiles() {
  defaultFilesArray = [ '/', '/404.html', genericThumb, '/login.html',
      defaultBanner, spoilerImage, '/maintenance.html', genericAudioThumb ];

  defaultFilesRelation = {
    '/' : {
      generatorFunction : 'frontPage',
      command : informedArguments.reloadFront.informed
    },
    '/404.html' : {
      generatorFunction : 'notFound',
      command : informedArguments.reloadNotFound.informed
    },
    '/login.html' : {
      generatorFunction : 'login',
      command : informedArguments.reloadLogin.informed
    },
    '/maintenance.html' : {
      generatorFunction : 'maintenance',
      command : informedArguments.reloadMaintenance.informed
    }
  };

  defaultFilesRelation[genericThumb] = {
    generatorFunction : 'thumb',
    command : informedArguments.reloadThumb.informed
  };

  defaultFilesRelation[spoilerImage] = {
    generatorFunction : 'spoiler',
    command : informedArguments.reloadSpoiler.informed
  };

  defaultFilesRelation[defaultBanner] = {
    generatorFunction : 'defaultBanner',
    command : informedArguments.reloadBanner.informed
  };

  defaultFilesRelation[genericAudioThumb] = {
    generatorFunction : 'audioThumb',
    command : informedArguments.reloadAudio.informed
  };

}

function loadDatabasesSettings() {
  var dbSettingsPath = __dirname + '/settings/db.json';

  dbSettings = JSON.parse(fs.readFileSync(dbSettingsPath));

  try {
    var archivePath = __dirname + '/settings/archive.json';

    archiveSettings = JSON.parse(fs.readFileSync(archivePath));
  } catch (error) {

  }
}

function loadGeneralSettings() {

  var defaultSettings = exports.getDefaultSettings();

  var generalSettingsPath = __dirname + '/settings/general.json';

  generalSettings = JSON.parse(fs.readFileSync(generalSettingsPath));

  for ( var key in defaultSettings) {
    if (!generalSettings[key]) {
      generalSettings[key] = defaultSettings[key];
    }
  }

}

exports.loadSettings = function() {

  loadDatabasesSettings();

  loadGeneralSettings();

  fePath = generalSettings.fePath;

  tempDirectory = generalSettings.tempDirectory || '/tmp';

  setMaxSizes();

  var templateSettingsPath = fePath + '/templateSettings.json';

  templateSettings = JSON.parse(fs.readFileSync(templateSettingsPath));

  checkImagesSet();

  setDefaultImages();

  composeDefaultFiles();

  require('./engine/langOps').init();

};

exports.noDaemon = function() {
  return noDaemon;
};

// after everything is all right, call this function to start the workers
function bootWorkers() {

  var genQueue = require('./generationQueue');

  if (noDaemon) {
    db.conn().close();
    return;
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

      if (message.upStream) {
        message.upStream = false;

        if (message.reload) {
          exports.reload();

          genQueue.reload();

          for (var i = 0; i < message.rebuilds.length; i++) {
            genQueue.queue(message.rebuilds[i]);
          }

        }

        for ( var id in cluster.workers) {
          cluster.workers[id].send(message);
        }

      } else {
        genQueue.queue(message);
      }

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

function iterateDefaultPages(foundFiles, index) {

  index = index || 0;

  if (index >= defaultFilesArray.length) {
    bootWorkers();
    return;

  }

  var fileToCheck = defaultFilesArray[index];

  var fileData = defaultFilesRelation[fileToCheck];

  if (foundFiles.indexOf(fileToCheck) === -1 || fileData.command) {
    generator[fileData.generatorFunction](function generated(error) {
      if (error) {
        if (generalSettings.verbose) {
          console.log(error);
        }

        if (debug) {
          throw error;
        }
      } else {
        iterateDefaultPages(foundFiles, index + 1);
      }
    });
  } else {
    iterateDefaultPages(foundFiles, index + 1);
  }

}

// we need to check if the default pages can be found
function checkForDefaultPages() {

  generator = require('./engine/generator');
  require('./engine/templateHandler').loadTemplates();

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
      if (generalSettings.verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }
    } else if (files.length) {
      iterateDefaultPages(files[0].pages);
    } else {
      regenerateAll();
    }
  });

}

exports.loadSettings();

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
    require('./engine/' + dirListing[i]).loadDependencies();
  }

  require('./engine/addonOps').startAddons();

};

function initTorControl() {

  require('./engine/torOps').init(function initializedTorControl(error) {
    if (error) {
      throw error;
    } else {
      if (!noDaemon) {
        require('./scheduleHandler').start();
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

function checkDbVersions() {

  db.checkVersion(function checkedVersion(error) {

    if (error) {
      throw error;
    } else {
      initTorControl();
    }

  });

}

if (cluster.isMaster) {

  db.init(function bootedDb(error) {

    if (error) {
      throw error;
    } else {
      exports.startEngine();

      checkDbVersions();
    }

  });

} else {

  process.on('message', function messageReceived(msg) {
    if (msg.reload) {
      exports.reload();
    }
  });

  require('./workerBoot').boot();
}
