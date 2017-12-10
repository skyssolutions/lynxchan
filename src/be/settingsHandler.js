'use strict';

var fs = require('fs');
var http = require('http');
var kernel = require('./kernel');
var dbSettings;
var generalSettings;
var templateSettings;

var MAX_ATTEMPTS = 4;

var zeroSettingsExceptions = [ 'boardCreationRequirement' ];

// Section 1: New settings {
function broadCastToSlaves(newSettings, callback, index, attempts) {

  index = index || 0;

  // no more slaves
  if (index >= newSettings.slaves.length) {

    callback();
    return;
  }

  attempts = attempts || 0;

  // failed to broadcast to slave, try next one
  if (attempts >= MAX_ATTEMPTS) {
    console.log('Failed to contact ' + newSettings.slaves[index]);

    broadCastToSlaves(newSettings, callback, ++index);

    return;
  }

  if (generalSettings.verbose || generalSettings.verboseMisc) {
    console.log('Attempt ' + attempts + ' to ' + newSettings.slaves[index]);
  }

  var req = http.request({
    hostname : newSettings.slaves[index],
    port : generalSettings.port,
    path : '/.api/takeSettings.js',
    method : 'POST'
  }, function gotResponse(res) {

    if (res.statusCode !== 200) {

      broadCastToSlaves(newSettings, callback, index, ++attempts);
      return;
    }

    var response = '';

    res.on('data', function(data) {

      response += data;
    });

    res.on('end', function() {

      try {

        var parsedResponse = JSON.parse(response);

        if (parsedResponse.status === 'ok') {
          broadCastToSlaves(newSettings, callback, ++index);
        } else {
          broadCastToSlaves(newSettings, callback, index, ++attempts);
        }

      } catch (error) {
        broadCastToSlaves(newSettings, callback, index, ++attempts);
      }

    });

  });

  req.on('error', function(error) {
    broadCastToSlaves(newSettings, callback, index, ++attempts);
  });

  req.write(JSON.stringify({
    parameters : newSettings
  }));
  req.end();

}

function broadCastReload(reloadsToMake, callback, feChanged) {

  process.send({
    upStream : true,
    reloadSettings : true,
    rebuilds : reloadsToMake,
    reloadFE : feChanged
  });

  callback();

}

function getRebuildBoards(settings) {

  var rebuildBoards = generalSettings.pageSize !== settings.pageSize;
  var fileSizeDelta = generalSettings.maxFileSizeMB !== settings.maxFileSizeMB;
  var globalCChanged = generalSettings.forceCaptcha ^ settings.forceCaptcha;
  var fileCChanged = generalSettings.maxFiles !== settings.maxFiles;
  var catalogPostingChanged = generalSettings.disableCatalogPosting
      ^ settings.disableCatalogPosting;
  var mLengthChanged = generalSettings.messageLength !== settings.messageLength;

  rebuildBoards = rebuildBoards || catalogPostingChanged || mLengthChanged;

  return fileCChanged || rebuildBoards || fileSizeDelta || globalCChanged;

}

function rebuildFp(settings) {

  if (generalSettings.frontPageStats ^ settings.frontPageStats) {
    return true;
  }

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

  if (!overboardChanged) {
    overboardChanged = settings.sfwOverboard !== generalSettings.sfwOverboard;
  }

  var overboardReduced = settings.overBoardThreadCount;
  overboardReduced = overboardReduced < generalSettings.overBoardThreadCount;

  if (!overboardChanged && !overboardReduced) {
    return;
  }

  require('./engine/degenerator').global.overboard(function degenerated(error) {

    if (error) {
      console.log(error);
    }

  }, generalSettings.overboard, generalSettings.sfwOverboard);

  var reaggregate = settings.overboard && !generalSettings.overboard;

  if (!reaggregate) {
    reaggregate = settings.sfwOverboard && !generalSettings.sfwOverboard;
  }

  require('./engine/overboardOps').reaggregate({
    overboard : true,
    reaggregate : reaggregate
  });

}

function checkGeneralSettingsChanged(settings, reloadsToMake, callback) {

  var rebuildLogin = settings.disableAccountCreation
      ^ generalSettings.disableAccountCreation;

  if (rebuildLogin) {
    reloadsToMake.push({
      login : true
    });
  }

  checkOverboardChanged(settings);

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

function clearStaffIndividualCaches(callback) {

  require('./db').logs().updateMany({}, {
    $unset : {
      cache : 1,
      alternativeCaches : 1
    }
  }, function clearedCaches(error) {

    if (error) {
      console.log(error);
    }

    if (callback) {
      callback();
    }

  });

}

exports.clearIndividualCaches = function(callback) {

  require('./db').threads().updateMany({}, {
    $unset : {
      innerCache : 1,
      outerCache : 1,
      previewCache : 1,
      clearCache : 1,
      alternativeCaches : 1,
      hashedCache : 1
    }
  }, function clearedThreads(error) {

    if (error) {
      console.log(error);
    }

    // style exception, too simple
    require('./db').posts().updateMany({}, {
      $unset : {
        innerCache : 1,
        outerCache : 1,
        previewCache : 1,
        alternativeCaches : 1,
        clearCache : 1,
        hashedCache : 1
      }
    }, function clearedPosts(error) {

      if (error) {
        console.log(error);
      }

      clearStaffIndividualCaches(callback);

    });
    // style exception, too simple

  });

};

function checkSettingsChanges(settings, callback) {
  var reloadsToMake = [];

  if (generalSettings.fePath !== settings.fePath) {

    exports.clearIndividualCaches(function clearedIndividualCaches() {

      reloadsToMake.push({
        globalRebuild : true
      });

      broadCastReload(reloadsToMake, callback, true);
    });

    return;
  }

  checkGeneralSettingsChanged(settings, reloadsToMake, callback);

}

function prepareSettingsForChangeCheck(settings, callback) {

  // these fields won`t be set with the current values if none is provided
  // because we want them to be null when comparing
  var defaultToNull = [ 'siteTitle', 'globalLatestImages', 'languagePackPath',
      'defaultAnonymousName', 'defaultBanMessage', 'disableTopBoards',
      'allowBoardCustomJs', 'topBoardsCount', 'globalLatestPosts',
      'forceCaptcha', 'overboard', 'frontPageStats', 'disableAccountCreation',
      'disableCatalogPosting' ];

  // these ones default to the default values
  var defaultToDefault = [ 'pageSize', 'maxFileSizeMB', 'maxFiles', 'fePath',
      'messageLength' ];

  var defaults = exports.getDefaultSettings();

  for ( var key in generalSettings) {

    if (settings[key]) {
      continue;
    }

    if (defaultToDefault.indexOf(key) > -1) {
      settings[key] = defaults[key];
    } else if (defaultToNull.indexOf(key) === -1) {

      settings[key] = generalSettings[key];
    }
  }

  checkSettingsChanges(settings, callback);

}

function writeNewSettings(settings, callback) {

  fs.writeFile(__dirname + '/settings/general.json', Buffer.from(JSON
      .stringify(settings, null, 2), 'utf-8'), function wroteFile(error) {
    if (error) {
      callback(error);
    } else if (settings.master) {

      broadCastReload([], callback);

    } else if (settings.slaves && settings.slaves.length) {
      broadCastToSlaves(settings, function broadCastedToSlaves() {
        prepareSettingsForChangeCheck(settings, callback);
      });

    } else {
      prepareSettingsForChangeCheck(settings, callback);
    }
  });

}

exports.setNewSettings = function(settings, language, callback) {

  if (settings.overboard || settings.sfwOverboard) {

    var lang = require('./engine/langOps').languagePack(language);

    var boardsToTest = [];

    if (settings.overboard) {

      if (/\W/.test(settings.overboard)) {
        callback(lang.errInvalidUri);
        return;
      }

      boardsToTest.push(settings.overboard);

    }

    if (settings.sfwOverboard) {

      if (/\W/.test(settings.sfwOverboard)) {
        callback(lang.errInvalidUri);
        return;
      }

      boardsToTest.push(settings.sfwOverboard);

    }

    require('./db').boards().findOne({
      boardUri : {
        $in : boardsToTest
      }
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

}

exports.isZeroException = function(setting, value) {

  return zeroSettingsExceptions.indexOf(setting) > -1 && !isNaN(value);

};

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
    var value = generalSettings[key];

    if (!value && !exports.isZeroException(key, value)) {
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

};
// } Section 2: Load settings

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
    mediaPageSize : 100,
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
    clearIpMinRole : 0,
    boardCreationRequirement : 4,
    overBoardThreadCount : 50,
    bypassMaxPosts : 30,
    bypassDurationHours : 24,
    bypassMode : 0,
    ssl : 0,
    rssDomain : '',
    slaves : [],
    messageLength : 4096,
    spamIpsSource : 'https://www.stopforumspam.com/downloads/bannedips.zip',
    flagNameLength : 32,
    boardMessageLength : 256,
    incSpamIpsSource : 'https://www.stopforumspam.com/downloads/listed_ip_1.zip'
  };

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

exports.changeMaintenanceMode = function(newMode) {

  var path = __dirname + '/settings/general.json';
  var currentSettings = JSON.parse(fs.readFileSync(path));

  currentSettings.maintenance = newMode;

  fs.writeFile(__dirname + '/settings/general.json', Buffer.from(JSON
      .stringify(currentSettings, null, 2), 'utf-8'),
      function wroteFile(error) {
        if (error) {
          console.log(error);
        } else {
          kernel.broadCastTopDownMessage({
            reloadSettings : true
          });
        }
      });

};