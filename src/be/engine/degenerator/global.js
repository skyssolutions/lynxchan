'use strict';

// handles generation of pages not specific to any board

var kernel = require('../../kernel');
var db = require('../../db');
var logger = require('../../logger');
var files = db.files();
var overboard;
var overboardSFW;
var verbose;
var gridFsHandler;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  overboardSFW = settings.sfwOverboard;
  overboard = settings.overboard;
  verbose = settings.verbose || settings.verboseGenerator;

};

exports.loadDependencies = function() {
  gridFsHandler = require('../gridFsHandler');

  var generator = require('../generator').global;

  exports.maintenance = generator.maintenance;
  exports.login = generator.login;
  exports.audioThumb = generator.audioThumb;
  exports.spoiler = generator.spoiler;
  exports.defaultBanner = generator.defaultBanner;
  exports.maintenanceImage = generator.maintenanceImage;
  exports.thumb = generator.thumb;
  exports.notFound = generator.notFound;

};

exports.frontPage = function(callback) {

  if (verbose) {
    console.log('Degenerating front-page');
  }

  files.aggregate([ {
    $match : {
      'metadata.type' : 'frontPage'
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {
      gridFsHandler.removeFiles(results[0].files, callback);
    }

  });

};

exports.overboard = function(callback, altUri, altUriSFW) {

  if (verbose) {
    console.log('Degenerating overboard');
  }

  files.aggregate([ {
    $match : {
      'metadata.type' : 'overboard'
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {
      gridFsHandler.removeFiles(results[0].files, callback);
    }

  });

};

exports.log = function(date, callback) {

  var dateString = logger.formatedDate(date);

  if (verbose) {
    console.log('Degenerating log from ' + dateString);
  }

  var prefix = '/.global/logs/' + dateString;

  var filesNames = [ prefix + '.html', prefix + '.json' ];

  files.aggregate([ {
    $match : {
      $or : [ {
        filename : {
          $in : filesNames
        }
      }, {
        'metadata.referenceFile' : {
          $in : filesNames
        }
      } ]
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {
      gridFsHandler.removeFiles(results[0].files, callback);
    }

  });

};

exports.logs = function(callback) {

  if (verbose) {
    console.log('Degenerating logs');
  }

  files.aggregate([ {
    $match : {
      'metadata.type' : 'log'
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {
      gridFsHandler.removeFiles(results[0].files, callback);
    }

  });

};