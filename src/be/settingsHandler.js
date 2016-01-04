'use strict';

var fs = require('fs');
var kernel = require('./kernel');
var archiveSettings;
var dbSettings;
var generalSettings;
var templateSettings;

// Section 1: New settings {
function broadCastReload(reloadsToMake, callback) {

  process.send({
    upStream : true,
    reload : true,
    rebuilds : reloadsToMake
  });

  callback();

}

function getRebuildBoards(settings) {

  var rebuildBoards = generalSettings.pageSize !== settings.pageSize;
  var fileSizeDelta = generalSettings.maxFileSizeMB !== settings.maxFileSizeMB;
  var globalCTurnedOn = !generalSettings.forceCaptcha && settings.forceCaptcha;
  var globalCTurnedOff = generalSettings.forceCaptcha && !settings.forceCaptcha;
  var globalCChanged = globalCTurnedOn || globalCTurnedOff;

  return rebuildBoards || fileSizeDelta || globalCChanged;

}

function rebuildFp(settings) {

  var propertiesToCheck = [ 'siteTitle', 'topBoardsCount', 'globalLatestPosts',
      'globalLatestImages' ];

  for (var i = 0; i < propertiesToCheck.length; i++) {
    var property = propertiesToCheck[i];

    if (generalSettings[property] !== settings[property]) {
      return true;
    }
  }

  return false;

}

function checkOverboardChanged(settings) {

  var overboardChanged = settings.overboard !== generalSettings.overboard;

  var overboardReduced = settings.overBoardThreadCount;
  overboardReduced = overboardReduced < generalSettings.overBoardThreadCount;

  return overboardChanged || overboardReduced;

}

function checkGeneralSettingsChanged(settings, reloadsToMake, callback) {

  if (checkOverboardChanged(settings)) {
    reloadsToMake.push({
      overboard : true,
      reaggregate : settings.overboard && !generalSettings.overboard
    });

  }

  if (rebuildFp(settings)) {
    reloadsToMake.push({
      frontPage : true
    });
  }

  if (getRebuildBoards(settings)) {
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

function writeNewSettings(settings, callback) {

  fs.writeFile(__dirname + '/settings/general.json', new Buffer(JSON.stringify(
      settings, null, 2), 'utf-8'), function wroteFile(error) {
    if (error) {
      callback(error);
    } else {

      var exceptionalFields = [ 'siteTitle', 'captchaFonts', 'pageSize',
          'globalLatestImages', 'languagePackPath', 'defaultAnonymousName',
          'defaultBanMessage', 'disableTopBoards', 'allowBoardCustomJs',
          'topBoardsCount', 'globalLatestPosts', 'forceCaptcha', 'overboard' ];

      for ( var key in generalSettings) {
        if (!settings[key] && exceptionalFields.indexOf(key) === -1) {
          settings[key] = generalSettings[key];
        }
      }

      checkSettingsChanges(settings, callback);
    }
  });

}

exports.setNewSettings = function(settings, callback) {

  if (settings.overboard) {

    var lang = require('./engine/langOps').languagePack();

    if (/\W/.test(settings.overboard)) {
      callback(lang.errInvalidUri);
      return;
    }

    require('./db').boards().findOne({
      boardUri : settings.overboard
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (board) {
        callback(lang.errUriInUse);
      } else {
        writeNewSettings(settings, callback);
      }
    });

  } else {
    writeNewSettings(settings, callback);
  }

};
// } Section 1: New settings

// Section 2: Load settings {
function loadDatabasesSettings() {
  var dbSettingsPath = __dirname + '/settings/db.json';

  try {
    dbSettings = JSON.parse(fs.readFileSync(dbSettingsPath));
  } catch (error) {
    if (error.code === 'ENOENT') {

      dbSettings = {
        address : 'mongodb',
        port : 27017,
        db : 'lynxchan'
      };

      fs.writeFileSync(dbSettingsPath, JSON.stringify(dbSettings, null, 2));

    } else {
      throw error;
    }
  }

  try {
    var archivePath = __dirname + '/settings/archive.json';

    archiveSettings = JSON.parse(fs.readFileSync(archivePath));
  } catch (error) {

    if (error.code !== 'ENOENT') {
      throw error;
    }

  }
}

function loadGeneralSettings() {

  var defaultSettings = exports.getDefaultSettings();

  var generalSettingsPath = __dirname + '/settings/general.json';

  try {
    generalSettings = JSON.parse(fs.readFileSync(generalSettingsPath));
  } catch (error) {

    // Resilience, if there is no file for settings, create a new one empty so
    // we just use the default settings
    if (error.code === 'ENOENT') {

      generalSettings = {};

      fs.writeFileSync(generalSettingsPath, JSON.stringify(generalSettings,
          null, 2));

    } else {
      throw error;
    }
  }

  for ( var key in defaultSettings) {
    if (!generalSettings[key]) {
      generalSettings[key] = defaultSettings[key];
    }
  }

}

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

exports.loadSettings = function() {

  loadDatabasesSettings();

  loadGeneralSettings();

  setMaxSizes();

  var templateSettingsPath = generalSettings.fePath + '/templateSettings.json';

  templateSettings = JSON.parse(fs.readFileSync(templateSettingsPath));

  require('./engine/langOps').init();

};
// } Section 2: Load settings

exports.getDefaultSettings = function() {

  return {
    address : '0.0.0.0',
    port : 80,
    concurrentRebuildMessages : 1,
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
    clearIpMinRole : 0,
    boardCreationRequirement : 4,
    overBoardThreadCount : 50,
    bypassMaxPosts : 30,
    bypassDurationHours : 24,
    bypassMode : 0,
    rssDomain : ''
  };

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

exports.changeMaintenanceMode = function(newMode) {

  var path = __dirname + '/settings/general.json';
  var currentSettings = JSON.parse(fs.readFileSync(path));

  currentSettings.maintenance = newMode;

  fs.writeFile(__dirname + '/settings/general.json', new Buffer(JSON.stringify(
      currentSettings, null, 2), 'utf-8'), function wroteFile(error) {
    if (error) {
      console.log(error);
    } else {
      kernel.broadCastTopDownReload();
    }
  });

};