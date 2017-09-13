'use strict';

var db = require('../../db');
var gridFsHandler;
var files = db.files();

exports.loadDependencies = function() {
  gridFsHandler = require('../gridFsHandler');
};

exports.thread = function(boardUri, threadId, callback) {

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
      gridFsHandler.removeFiles(results[0].files, callback);
    }

  });

};

exports.page = function(boardUri, page, callback) {

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
      gridFsHandler.removeFiles(results[0].files, callback);
    }

  });

};

exports.catalog = function(boardUri, callback) {

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
      gridFsHandler.removeFiles(results[0].files, callback);
    }

  });

};

exports.board = function(boardUri, reloadThreads, reloadRules, callback) {

  var exceptions = [ 'flag', 'banner', 'preview' ];

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
      gridFsHandler.removeFiles(results[0].files, callback);
    }

  });

};

exports.rules = function(boardUri, callback) {

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
      gridFsHandler.removeFiles(results[0].files, callback);
    }

  });

};

exports.boards = function(callback) {

  files.aggregate([ {
    $match : {
      'metadata.boardUri' : {
        $exists : true
      },
      'metadata.type' : {
        $not : {
          $in : [ 'flag', 'banner', 'preview' ]
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
      gridFsHandler.removeFiles(results[0].files, callback);
    }

  });

};
