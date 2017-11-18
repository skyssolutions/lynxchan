'use strict';

var settingsHandler = require('../../settingsHandler');
var verbose;
var db = require('../../db');
var files = db.files();
var cacheLocks = db.cacheLocks();
var gridFsHandler;

exports.loadDependencies = function() {
  gridFsHandler = require('../gridFsHandler');
};

exports.loadSettings = function() {
  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseGenerator;
};

exports.thread = function(boardUri, threadId, callback) {

  if (verbose) {
    console.log('Degenerating thread ' + threadId + ' of board ' + boardUri);
  }

  files.aggregate([ {
    $match : {
      'metadata.boardUri' : boardUri,
      'metadata.threadId' : threadId,
      'metadata.type' : 'thread'
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

      gridFsHandler.removeFiles(results[0].files, function deletedFiles(error) {

        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          cacheLocks.deleteOne({
            type : 'thread',
            boardUri : boardUri,
            postingId : threadId
          }, callback);
          // style exception, too simple

        }

      });
    }

  });

};

exports.page = function(boardUri, page, callback) {

  if (verbose) {
    console.log('Degenerating page ' + page + ' of board ' + boardUri);
  }

  var filesNames = [ '/' + boardUri + '/' + page + '.json',
      '/' + boardUri + '/' + (page > 1 ? (page + '.html') : '') ];

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

      gridFsHandler.removeFiles(results[0].files, function deletedFiles(error) {

        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          cacheLocks.deleteOne({
            type : 'board',
            boardUri : boardUri,
            page : page
          }, callback);
          // style exception, too simple

        }

      });
    }

  });

};

exports.catalog = function(boardUri, callback) {

  if (verbose) {
    console.log('Degenerating catalog of ' + boardUri);
  }

  files.aggregate([ {
    $match : {
      'metadata.boardUri' : boardUri,
      'metadata.type' : 'catalog'
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

      gridFsHandler.removeFiles(results[0].files, function deletedFiles(error) {

        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          cacheLocks.deleteOne({
            type : 'catalog',
            boardUri : boardUri
          }, callback);
          // style exception, too simple

        }

      });
    }

  });

};

exports.board = function(boardUri, reloadThreads, reloadRules, callback) {

  if (verbose) {
    console.log('Degenerating ' + boardUri);
  }

  var exceptions = [ 'flag', 'banner', 'custom' ];

  if (!reloadRules) {
    exceptions.push('rules');
  }

  if (!reloadThreads) {
    exceptions.push('thread');
  }

  files.aggregate([ {
    $match : {
      'metadata.boardUri' : boardUri,
      'metadata.type' : {
        $not : {
          $in : exceptions
        }
      }
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

      gridFsHandler.removeFiles(results[0].files, function deletedFiles(error) {

        if (error) {
          callback(error);
        } else {

          var deletionTypes = [ 'board', 'catalog' ];

          if (reloadRules) {
            deletionTypes.push('rules');
          }

          if (reloadThreads) {
            deletionTypes.push('thread');
          }

          // style exception, too simple
          cacheLocks.deleteMany({
            type : {
              $in : deletionTypes
            },
            boardUri : boardUri
          }, callback);
          // style exception, too simple

        }

      });
    }

  });

};

exports.rules = function(boardUri, callback) {

  if (verbose) {
    console.log('Degenerating rules on ' + boardUri);
  }

  files.aggregate([ {
    $match : {
      'metadata.boardUri' : boardUri,
      'metadata.type' : 'rules'
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

      gridFsHandler.removeFiles(results[0].files, function deletedFiles(error) {

        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          cacheLocks.deleteOne({
            type : 'rules',
            boardUri : boardUri
          }, callback);
          // style exception, too simple

        }

      });

    }

  });

};

exports.boards = function(callback) {

  if (verbose) {
    console.log('Degenerating boards');
  }

  files.aggregate([ {
    $match : {
      'metadata.boardUri' : {
        $exists : true
      },
      'metadata.type' : {
        $not : {
          $in : [ 'flag', 'banner', 'custom' ]
        }
      }
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

      gridFsHandler.removeFiles(results[0].files, function filesRemoved(error) {

        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          cacheLocks.deleteMany({
            type : {
              $in : [ 'board', 'catalog', 'thread', 'rules' ]
            }
          }, callback);
          // style exception, too simple

        }

      });
    }

  });

};
