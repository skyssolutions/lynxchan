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
  exports.notFound = require('../generator').global.notFound;
};

exports.maintenance = function(callback) {

  files.aggregate([ {
    $match : {
      $or : [ {
        filename : '/maintenance.html'
      }, {
        'metadata.referenceFile' : '/maintenance.html'
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

exports.login = function(callback) {

  files.aggregate([ {
    $match : {
      $or : [ {
        filename : '/login.html'
      }, {
        'metadata.referenceFile' : '/login.html'
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

exports.audioThumb = function(callback) {

  files.aggregate([ {
    $match : {
      $or : [ {
        filename : kernel.genericAudioThumb()
      }, {
        'metadata.referenceFile' : kernel.genericAudioThumb()
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

exports.spoiler = function(callback) {

  files.aggregate([ {
    $match : {
      $or : [ {
        filename : kernel.spoilerImage()
      }, {
        'metadata.referenceFile' : kernel.spoilerImage()
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

exports.defaultBanner = function(callback) {

  files.aggregate([ {
    $match : {
      $or : [ {
        filename : kernel.defaultBanner()
      }, {
        'metadata.referenceFile' : kernel.defaultBanner()
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

exports.maintenanceImage = function(callback) {

  files.aggregate([ {
    $match : {
      $or : [ {
        filename : kernel.maintenanceImage()
      }, {
        'metadata.referenceFile' : kernel.maintenanceImage()
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

exports.thumb = function(callback) {

  files.aggregate([ {
    $match : {
      $or : [ {
        filename : kernel.genericThumb()
      }, {
        'metadata.referenceFile' : kernel.genericThumb()
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
  }

  if (overboard) {
    paths.push('/' + overboard + '/');
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

exports.log = function(date, callback, logData) {

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