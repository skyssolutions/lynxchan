'use strict';

exports.miscDeletions = require('./miscDelOps');
exports.postingDeletions = require('./postingDelOps');
var db = require('../../db');
var posts = db.posts();
var boards = db.boards();
var threads = db.threads();
var posts = db.posts();
var lang;
var miscOps;
var clearIpMinRole;

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();

  clearIpMinRole = settings.clearIpMinRole;
  exports.miscDeletions.loadSettings();
  exports.postingDeletions.loadSettings();

};

exports.loadDependencies = function() {

  miscOps = require('../miscOps');
  lang = require('../langOps').languagePack;
  exports.miscDeletions.loadDependencies();
  exports.postingDeletions.loadDependencies();

};

// Section 1: Board ip deletion {
exports.gatherContentToDelete = function(boardUri, ips, userData, language,
    callback) {

  var queryBlock = {
    boardUri : boardUri,
    ip : {
      $in : ips
    }
  };

  threads.aggregate([ {
    $match : queryBlock
  }, {
    $project : {
      boardUri : 1,
      threadId : 1
    }
  }, {
    $group : {
      _id : '$boardUri',
      threads : {
        $push : '$threadId'
      }
    }
  } ]).toArray(
      function gotThreads(error, results) {

        if (error) {
          callback(error);
        } else {

          var foundThreads = {};

          for (var i = 0; i < results.length; i++) {

            var result = results[i];

            foundThreads[result._id] = result.threads;

          }

          // style exception, too simple
          posts.aggregate([ {
            $match : queryBlock
          }, {
            $project : {
              boardUri : 1,
              postId : 1
            }
          }, {
            $group : {
              _id : '$boardUri',
              posts : {
                $push : '$postId'
              }
            }
          } ]).toArray(
              function gotPosts(error, results) {
                if (error) {
                  callback(error);
                } else {

                  var foundPosts = {};

                  for (var i = 0; i < results.length; i++) {

                    var result = results[i];

                    foundPosts[result._id] = result.posts;

                  }

                  exports.postingDeletions.posting(userData, {}, foundThreads,
                      foundPosts, language, callback);

                }
              });
          // style exception, too simple

        }

      });

};

exports.gatherIpsToDelete = function(objects, userData, language, callback) {

  var board = objects[0].board;

  var selectedThreads = [];
  var selectedPosts = [];

  for (var i = 0; i < objects.length; i++) {

    var object = objects[i];

    if (object.board !== board) {
      continue;
    }

    if (object.post) {
      selectedPosts.push(+object.post);
    } else {
      selectedThreads.push(+object.thread);
    }

  }

  threads.aggregate([ {
    $match : {
      boardUri : board,
      ip : {
        $ne : null
      },
      threadId : {
        $in : selectedThreads
      }
    }
  }, {
    $group : {
      _id : 0,
      ips : {
        $push : '$ip'
      }
    }
  } ]).toArray(
      function gotThreads(error, results) {

        if (error) {
          callback(error);
        } else {

          var ips = results.length ? results[0].ips : [];

          // style exception, too simple
          posts.aggregate([ {
            $match : {
              boardUri : board,
              ip : {
                $ne : null,
                $nin : ips
              },
              postId : {
                $in : selectedPosts
              }
            }
          }, {
            $group : {
              _id : 0,
              ips : {
                $push : '$ip'
              }
            }
          } ]).toArray(
              function gotPosts(error, results) {

                if (error) {
                  callback(error);
                } else {

                  if (results.length) {
                    ips = ips.concat(results[0].ips);
                  }

                  if (ips.length) {
                    exports.gatherContentToDelete(board, ips, userData,
                        language, callback);
                  } else {
                    callback();
                  }

                }

              });
          // style exception, too simple

        }

      });

};

exports.deleteFromIpOnBoard = function(confirmation, objects, userData,
    language, callback, cleared) {

  if (!confirmation) {
    callback(lang(language).errNoIpDeletionConfirmation);
    return;
  }

  if (!objects.length) {
    callback();
    return;
  }

  if (!cleared) {

    if (userData.globalRole <= miscOps.getMaxStaffRole()) {
      exports.deleteFromIpOnBoard(confirmation, objects, userData, language,
          callback, true);
      return;

    }

    boards.findOne({
      boardUri : objects[0].board
    }, {
      projection : {
        owner : 1,
        volunteers : 1
      }
    }, function gotBoard(error, board) {

      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang(language).errBoardNotFound);
      } else {

        board.volunteers = board.volunteers || [];

        var owner = userData.login === board.owner;
        var volunteer = board.volunteers.indexOf(userData.login) > -1;

        if (owner || volunteer) {
          exports.deleteFromIpOnBoard(confirmation, objects, userData,
              language, callback, true);
        } else {
          callback(lang(language).errDeniedBoardIpDeletion);
        }

      }

    });

    return;
  }

  exports.gatherIpsToDelete(objects, userData, language, callback);

};
// } Section 1: Board ip deletion

exports.deleteFromIp = function(parameters, userData, language, callback) {

  var allowed = userData.globalRole <= clearIpMinRole;

  if (!allowed) {

    callback(lang(language).errDeniedIpDeletion);

    return;
  }

  var processedIp = miscOps.sanitizeIp(parameters.ip);

  var queryBlock = {
    ip : processedIp
  };

  if (parameters.boards) {

    var matches = parameters.boards.toString().match(/\w+/g);

    if (matches) {

      queryBlock.boardUri = {
        $in : matches
      };
    }
  }

  threads.aggregate([ {
    $match : queryBlock
  }, {
    $project : {
      boardUri : 1,
      threadId : 1
    }
  }, {
    $group : {
      _id : '$boardUri',
      threads : {
        $push : '$threadId'
      }
    }
  } ]).toArray(
      function gotThreads(error, results) {

        if (error) {
          callback(error);
        } else {

          var foundThreads = {};

          for (var i = 0; i < results.length; i++) {

            var result = results[i];

            foundThreads[result._id] = result.threads;

          }

          // style exception, too simple
          posts.aggregate([ {
            $match : queryBlock
          }, {
            $project : {
              boardUri : 1,
              postId : 1
            }
          }, {
            $group : {
              _id : '$boardUri',
              posts : {
                $push : '$postId'
              }
            }
          } ]).toArray(
              function gotPosts(error, results) {
                if (error) {
                  callback(error);
                } else {

                  var foundPosts = {};

                  for (var i = 0; i < results.length; i++) {

                    var result = results[i];

                    foundPosts[result._id] = result.posts;

                  }

                  exports.postingDeletions.posting(userData, parameters,
                      foundThreads, foundPosts, language, callback);

                }
              });
          // style exception, too simple

        }

      });

};