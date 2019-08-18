'use strict';

// handles generation of pages not specific to any board

var kernel = require('../../kernel');
var db = require('../../db');
var logger = require('../../logger');
var files = db.files();
var logs = db.logs();
var overboard;
var overboardSFW;
var verbose;
var gridFsHandler;
var cacheHandler;
var taskListener = require('../../taskListener');

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  overboardSFW = settings.sfwOverboard;
  overboard = settings.overboard;
  verbose = settings.verbose || settings.verboseGenerator;
};

exports.loadDependencies = function() {
  gridFsHandler = require('../gridFsHandler');
  cacheHandler = require('../cacheHandler');

  var generator = require('../generator').global;

  exports.maintenance = generator.maintenance;
  exports.login = generator.login;
  exports.audioThumb = generator.audioThumb;
  exports.spoiler = generator.spoiler;
  exports.defaultBanner = generator.defaultBanner;
  exports.maintenanceImage = generator.maintenanceImage;
  exports.thumb = generator.thumb;
  exports.notFound = generator.notFound;
  exports.graphs = generator.graphs;

};

exports.frontPage = function(callback, direct) {

  if (verbose) {
    console.log('Degenerating front-page');
  }

  var task = {
    cacheType : 'frontPage',
    type : 'cacheClear'
  };

  if (direct) {
    try {
      cacheHandler.clear(task);
      callback();
    } catch (error) {
      callback(error);
    }
  } else {
    taskListener.sendToSocket(null, task, callback);
  }

};

exports.overboard = function(callback, direct) {

  if (verbose) {
    console.log('Degenerating overboard');
  }

  var task = {
    cacheType : 'overboard',
    type : 'cacheClear'
  };

  if (direct) {

    try {
      cacheHandler.clear(task);
      callback();
    } catch (error) {
      callback(error);
    }

  } else {
    taskListener.sendToSocket(null, task, callback);
  }

};

exports.log = function(date, callback, direct) {

  if (verbose) {
    var dateString = logger.formatedDate(date);
    console.log('Degenerating log from ' + dateString);
  }

  var task = {
    cacheType : 'log',
    date : date.toUTCString(),
    type : 'cacheClear'
  };

  if (direct) {
    try {
      cacheHandler.clear(task);
      callback();
    } catch (error) {
      callback(error);
    }
  } else {
    taskListener.sendToSocket(null, task, callback);
  }

};

exports.logs = function(callback, direct, innerCaches) {

  if (verbose) {
    console.log('Degenerating logs');
  }

  var task = {
    cacheType : 'log',
    type : 'cacheClear'
  };

  var innerCb = function(error) {

    if (error) {
      console.log(error);
      return callback(error);
    }

    if (direct) {
      try {
        cacheHandler.clear(task);
        callback();
      } catch (error) {
        callback(error);
      }
    } else {
      taskListener.sendToSocket(null, task, callback);
    }

  };

  if (!innerCaches) {
    return innerCb();
  }

  logs.updateMany({}, {
    $unset : {
      cache : 1,
      alternativeCaches : 1
    }
  }, innerCb);

};

exports.multiboard = function(callback, boardUri, direct) {

  if (verbose) {
    console.log('Degenerating multi-boards');
  }

  var task = {
    cacheType : 'multiboard',
    type : 'cacheClear',
    boardUri : boardUri
  };

  if (direct) {
    try {
      cacheHandler.clear(task);
      callback();
    } catch (error) {
      callback(error);
    }
  } else {
    taskListener.sendToSocket(null, task, callback);
  }

};
