'use strict';

var fs = require('fs');
var http = require('http');
var kernel = require('./kernel');
var defaultSettings = require('./data/defaultSettings.json');
defaultSettings.fePath = __dirname + '/../fe';
var dbSettings;
var generalSettings;

var MAX_ATTEMPTS = 4;

exports.zeroSettingsExceptions = [ 'boardCreationRequirement',
    'staticExpiration', 'captchaMode' ];

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
    path : '/takeSettings.js',
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

  req.write(JSON.stringify(newSettings));
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

function categoriesChanged(settings) {

  var newCats = settings.reportCategories;
  var oldCats = generalSettings.reportCategories;

  var newCatsExists = !!newCats;
  var oldCatsExists = !!oldCats;

  if (newCatsExists !== oldCatsExists || newCats.length !== oldCats.length) {
    return true;
  }

  for (var i = 0; i < oldCats.length; i++) {
    if (newCats.indexOf(oldCats[i]) === -1) {
      return true;
    }

  }

}

function getRebuildBoards(settings) {

  var rebuildBoards = generalSettings.pageSize !== settings.pageSize;
  var fileSizeDelta = generalSettings.maxFileSizeMB !== settings.maxFileSizeMB;
  var globalCChanged = generalSettings.forceCaptcha ^ settings.forceCaptcha;
  var fileCChanged = generalSettings.maxFiles !== settings.maxFiles;
  var lPC = generalSettings.latestPostPinned !== settings.latestPostPinned;
  var catalogPostingChanged = generalSettings.disableCatalogPosting
      ^ settings.disableCatalogPosting;
  var unboundChanged = generalSettings.unboundBoardLimits
      ^ settings.unboundBoardLimits;
  var reportCaptchaChanged = generalSettings.noReportCaptcha
      ^ settings.noReportCaptcha;
  var mLengthChanged = generalSettings.messageLength !== settings.messageLength;

  rebuildBoards = unboundChanged || rebuildBoards || catalogPostingChanged;
  rebuildBoards = rebuildBoards || fileCChanged || mLengthChanged;
  rebuildBoards = rebuildBoards || reportCaptchaChanged;
  rebuildBoards = rebuildBoards || categoriesChanged(settings);

  return rebuildBoards || fileSizeDelta || globalCChanged || lPC;

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

function rebuildOverboard(settings, changedOmission) {

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
    reaggregate : reaggregate || changedOmission,
    omit : settings.omitUnindexedContent
  });

}

function checkOverboardChanged(settings) {

  var overboardChanged = settings.overboard !== generalSettings.overboard;

  if (!overboardChanged) {
    overboardChanged = settings.sfwOverboard !== generalSettings.sfwOverboard;
  }

  var overboardReduced = settings.overBoardThreadCount;
  overboardReduced = overboardReduced < generalSettings.overBoardThreadCount;

  overboardReduced = overboardReduced || categoriesChanged(settings);

  var changedOmission = settings.omitUnindexedContent
      ^ generalSettings.omitUnindexedContent;

  var changedReportCaptcha = generalSettings.noReportCaptcha
      ^ settings.noReportCaptcha;

  if (overboardReduced || changedOmission || changedReportCaptcha) {
    rebuildOverboard(settings, changedOmission);
  }

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

  var gs = generalSettings;

  var redactChanged = settings.redactModNames ^ gs.redactModNames;
  var latestChanged = gs.latestPostsAmount !== settings.latestPostsAmount;

  if (redactChanged) {
    reloadsToMake.push({
      log : true,
      clearInner : true
    });
  }

  if (redactChanged || latestChanged || getRebuildBoards(settings)) {

    reloadsToMake.push({
      allBoards : true,
      clearInner : redactChanged || latestChanged
    });
  }

  broadCastReload(reloadsToMake, callback);

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
      hashedCache : 1,
      previewHashedCache : 1,
      outerHashedCache : 1,
      outerClearCache : 1
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
        hashedCache : 1,
        previewHashedCache : 1,
        outerHashedCache : 1,
        outerClearCache : 1
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

  var feChanged = generalSettings.fePath !== settings.fePath;
  var lChanged = generalSettings.languagePackPath !== settings.languagePackPath;

  if (!settings.allowBoardCustomJs && generalSettings.allowBoardCustomJs) {
    require('./engine/boardOps').custom.clearCustomJs();
  }

  if (feChanged || lChanged) {

    exports.clearIndividualCaches(function clearedIndividualCaches() {

      reloadsToMake.push({
        globalRebuild : true
      });

      broadCastReload(reloadsToMake, callback, true);
    });

    return;
  } else if (generalSettings.latestPostPinned !== settings.latestPostPinned) {

    require('./db').threads().updateMany({
      pinned : true
    }, {
      $unset : {
        innerCache : 1,
        outerCache : 1,
        previewCache : 1,
        clearCache : 1,
        alternativeCaches : 1,
        hashedCache : 1,
        previewHashedCache : 1,
        outerHashedCache : 1,
        outerClearCache : 1
      }
    }, function clearedThreads(error) {

      if (error) {
        console.log(error);
      }

    });
  }

  checkGeneralSettingsChanged(settings, reloadsToMake, callback);

}

function prepareSettingsForChangeCheck(settings, callback) {

  // these fields won`t be set with the current values if none is provided
  // because we want them to be null when comparing
  var defaultToNull = [ 'siteTitle', 'globalLatestImages', 'languagePackPath',
      'defaultAnonymousName', 'defaultBanMessage', 'allowBoardCustomJs',
      'topBoardsCount', 'globalLatestPosts', 'forceCaptcha', 'overboard',
      'frontPageStats', 'disableAccountCreation', 'disableCatalogPosting',
      'redactModNames', 'omitUnindexedContent', 'unboundBoardLimits',
      'noReportCaptcha', 'reportCategories' ];

  // these ones default to the default values
  var defaultToDefault = [ 'pageSize', 'latestPostsAmount', 'maxFileSizeMB',
      'maxFiles', 'fePath', 'messageLength' ];

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

function validatePorts(settings) {

  var ports = [ 443, settings.port || 80, settings.torPort ];

  for (var i = 0; i < ports.length; i++) {

    if (settings.wsPort && settings.wsPort === ports[i]) {
      return true;
    }

    if (settings.wssPort && settings.wssPort === ports[i]) {
      return true;
    }

  }

}

function writeNewSettings(settings, language, callback) {

  if (validatePorts(settings)) {

    var lang = require('./engine/langOps').languagePack;

    return callback(lang(language).errInvalidWsPort);
  }

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

  if (!settings.overboard && !settings.sfwOverboard) {
    return writeNewSettings(settings, language, callback);
  }

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
      writeNewSettings(settings, language, callback);
    }
  });

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
  return exports.zeroSettingsExceptions.indexOf(setting) > -1 && !isNaN(value);
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

};
// } Section 2: Load settings

exports.getDefaultSettings = function() {
  return defaultSettings;
};

exports.getDbSettings = function() {

  return dbSettings;
};

exports.getGeneralSettings = function() {
  return generalSettings;
};

exports.getTemplateSettings = function() {

  var templateSettingsPath = generalSettings.fePath + '/templateSettings.json';
  return JSON.parse(fs.readFileSync(templateSettingsPath));

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