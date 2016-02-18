'use strict';

var db = require('../db');
var threads = db.threads();
var posts = db.posts();
var references = db.uploadReferences();

exports.getAggregationQuery = function(matchQuery) {

  return [ {
    $match : matchQuery
  }, {
    $project : {
      _id : 0,
      'files.md5' : 1,
      'files.mime' : 1
    }
  }, {
    $unwind : '$files'
  }, {
    $group : {
      _id : {
        $concat : [ '$files.md5', '-', '$files.mime' ]
      },
      count : {
        $sum : 1
      }
    }
  } ];

};

exports.getOperations = function(postReferences, threadReferences) {

  var finalReferences = {};

  for (var i = 0; i < postReferences.length; i++) {
    var reference = postReferences[i];
    finalReferences[reference._id] = reference.count;

  }

  for (i = 0; i < threadReferences.length; i++) {
    reference = threadReferences[i];

    if (finalReferences[reference._id]) {
      finalReferences[reference._id] += reference.count;
    } else {
      finalReferences[reference._id] = reference.count;
    }

  }

  var operations = [];

  for ( var key in finalReferences) {

    if (finalReferences.hasOwnProperty(key)) {

      operations.push({
        updateOne : {
          filter : {
            identifier : key.replace('/', '')
          },
          update : {
            $inc : {
              references : -finalReferences[key]
            }
          }
        }
      });

    }

  }

  return operations;

};

exports.updateReferencesCount = function(postReferences, threadReferences,
    callback) {

  var operations = exports.getOperations(postReferences, threadReferences);

  if (!operations.length) {
    callback();
    return;
  }

  references.bulkWrite(operations, callback);

};

exports.getThreadReferences = function(postReferences, boardUri,
    threadsToClear, callback, boardDeletion) {

  if ((!threadsToClear || !threadsToClear.length) && !boardDeletion) {
    exports.updateReferencesCount(postReferences, [], callback);

    return;
  }

  var query = {
    boardUri : boardUri,
    'files.0' : {
      $exists : 1
    }
  };

  if (threadsToClear && threadsToClear.length) {
    query.threadId = {
      $in : threadsToClear
    };
  }

  threads.aggregate(exports.getAggregationQuery(query),
      function countedReferences(error, results) {

        if (error) {
          callback(error);
        } else {
          exports.updateReferencesCount(postReferences, results, callback);
        }

      });

};

exports.clearPostingReferences = function(boardUri, threadsToClear,
    postsToClear, onlyFilesDeletion, callback) {

  var query = {
    boardUri : boardUri,
    'files.0' : {
      $exists : 1
    }
  };

  var addedLimiter = false;

  if (threadsToClear && threadsToClear.length && !onlyFilesDeletion) {
    query.threadId = {
      $in : threadsToClear
    };

    addedLimiter = true;
  }

  if (postsToClear && postsToClear.length) {
    query.postId = {
      $in : postsToClear
    };

    addedLimiter = true;
  }

  if (!addedLimiter) {
    exports.getThreadReferences([], boardUri, threadsToClear, callback);

    return;
  }

  posts.aggregate(exports.getAggregationQuery(query),
      function countedReferences(error, results) {

        if (error) {
          callback(error);
        } else {

          exports.getThreadReferences(results, boardUri, threadsToClear,
              callback);
        }

      });

};

exports.clearBoardReferences = function(boardUri, callback) {

  posts.aggregate(exports.getAggregationQuery({
    boardUri : boardUri,
    'files.0' : {
      $exists : 1
    }
  }), function gotPostsReferences(error, results) {

    if (error) {
      callback(error);
    } else {
      exports.getThreadReferences(results, boardUri, null, callback, true);
    }

  });

};