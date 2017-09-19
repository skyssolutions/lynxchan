'use strict';

// handles generation of pages not specific to any board

var kernel = require('../../kernel');
var db = require('../../db');
var logger = require('../../logger');
var files = db.files();
var overboard;
var overboardSFW;
var gridFsHandler;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  overboardSFW = settings.sfwOverboard;
  overboard = settings.overboard;

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

  var filesNames = [ '/', '/index.json' ];

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

exports.overboard = function(callback) {

  var paths = [];

  if (overboardSFW) {
    paths.push('/' + overboardSFW + '/');
    paths.push('/' + overboardSFW + '/index.rss');
    paths.push('/' + overboardSFW + '/1.json');
  }

  if (overboard) {
    paths.push('/' + overboard + '/');
    paths.push('/' + overboard + '/index.rss');
    paths.push('/' + overboard + '/1.json');
  }

  if (!paths.length) {
    callback();
    return;
  }

  files.aggregate([ {
    $match : {
      $or : [ {
        filename : {
          $in : paths
        }
      }, {
        'metadata.referenceFile' : {
          $in : paths
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

exports.log = function(date, callback) {

  var prefix = '/.global/logs/' + logger.formatedDate(date);

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