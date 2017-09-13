'use strict';

var db = require('../../db');
var files = db.files();
var gridFsHandler;

exports.loadDependencies = function() {
  gridFsHandler = require('../gridFsHandler');
};

exports.preview = function(boardUri, threadId, postId, callback) {

  var matchBlock = {
    'metadata.type' : 'preview',
    'metadata.boardUri' : boardUri
  };

  if (postId) {
    matchBlock['metadata.postId'] = postId;
  } else {

    matchBlock['metadata.postId'] = {
      $exists : false
    };
    matchBlock['metadata.threadId'] = threadId;

  }

  files.aggregate([ {
    $match : matchBlock
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

exports.previews = function(callback) {

  files.aggregate([ {
    $match : {
      'metadata.type' : 'preview'
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