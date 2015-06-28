'use strict';

// any operation regarding posting
var db = require('../db');
var threads = db.threads();
var boards = db.boards();
var tripcodes = db.tripcodes();
var stats = db.stats();
var posts = db.posts();
var captchaOps = require('./captchaOps');
var miscOps = require('./miscOps');
var generator = require('./generator');
var uploadHandler = require('./uploadHandler');
var delOps = require('./deletionOps');
var crypto = require('crypto');
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var latestPostsCount = boot.latestPostCount();
var threadLimit = boot.maxThreads();
var bumpLimit = settings.autoSageLimit || 500;
var defaultAnonymousName = settings.defaultAnonymousName || 'Anonymous';

var postingParameters = [ {
  field : 'subject',
  length : 128,
  removeHTML : true
}, {
  field : 'email',
  length : 64,
  removeHTML : true
}, {
  field : 'name',
  length : 32,
  removeHTML : true
}, {
  field : 'message',
  length : 2048
}, {
  field : 'password',
  length : 8
} ];

function addPostToStats(boardUri, callback) {

  var statHour = new Date();

  statHour.setMilliseconds(0);
  statHour.setSeconds(0);
  statHour.setMinutes(0);

  stats.updateOne({
    boardUri : boardUri,
    startingTime : statHour
  }, {
    $set : {
      boardUri : boardUri,
      startingTime : statHour
    },
    $inc : {
      posts : 1
    }
  }, {
    upsert : true
  }, function updatedStats(error) {
    callback(error);
  });

}

function applyFilters(filters, message) {

  if (!filters || !filters.length) {
    return message;
  }

  for (var i = 0; i < filters.length; i++) {

    var filter = filters[i];

    message = message.replace(filter.originalTerm, filter.replacementTerm);

  }

  return message;

}

// start of markdown functions
function replaceStyleMarkdown(message) {

  var split = message.split('\n');

  var greenTextFunction = function(match) {
    return '<span class="greenText">' + match + '</span>';
  };

  var spoilerFunction = function(match) {

    var content = match.substring(9, match.length - 10);

    return '<span class="spoiler">' + content + '</span>';
  };

  for (var i = 0; i < split.length; i++) {

    split[i] = split[i].replace(/^>[^\&\s].+/g, greenTextFunction);

    split[i] = split[i].replace(/\[spoiler\].+\[\/spoiler\]/g, spoilerFunction);

  }

  message = split.join('<br>');
  return message;

}

function replaceMarkdown(message, posts, board, callback) {

  var postObject = {};

  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];

    var boardPosts = postObject[post.boardUri] || {};

    boardPosts[post.postId] = post.threadId;

    postObject[post.boardUri] = boardPosts;
  }

  message = message.replace(/>>>\/\w+\/\d+/g, function crossQuote(match) {

    var quoteParts = match.match(/(\w+|\d+)/g);

    var quotedBoard = quoteParts[0];
    var quotedPost = +quoteParts[1];

    var boardPosts = postObject[quotedBoard] || {};

    var quotedThread = boardPosts[quotedPost] || quotedPost;

    var link = '/' + quotedBoard + '/res/';

    link += quotedThread + '.html#' + quotedPost;

    var toReturn = '<a class="quoteLink" href="' + link + '">&gt&gt&gt';
    toReturn += match.substring(3) + '</a>';

    return toReturn;

  });

  message = message.replace(/>>>\/\w+\//g, function board(match) {

    var quotedBoard = match.substring(3);

    return '<a href="' + quotedBoard + '">&gt&gt&gt' + quotedBoard + '</a>';

  });

  message = message.replace(/>>\d+/g, function quote(match) {

    var quotedPost = match.substring(2);

    var boardPosts = postObject[board] || {};

    var quotedThread = boardPosts[quotedPost] || quotedPost;

    var link = '/' + board + '/res/';

    link += quotedThread + '.html#' + quotedPost;

    var toReturn = '<a class="quoteLink" href="' + link + '">&gt&gt';

    toReturn += quotedPost + '</a>';

    return toReturn;

  });

  message = message.replace(/(http|https)\:\/\/\S+/g, function links(match) {

    return '<a target="blank" href="' + match + '">' + match + '</a>';

  });

  message = replaceStyleMarkdown(message);

  callback(null, message);

}

function getCrossQuotes(message, postsToFindObject) {

  var crossQuotes = message.match(/>>>\/\w+\/\d+/g) || [];

  for (var i = 0; i < crossQuotes.length; i++) {

    var crossQuote = crossQuotes[i];

    var quoteParts = crossQuote.match(/(\w+|\d+)/g);

    var quotedBoard = quoteParts[0];
    var quotedPost = +quoteParts[1];

    var boardPosts = postsToFindObject[quotedBoard] || [];

    if (boardPosts.indexOf(quotedPost) === -1) {
      boardPosts.push(quotedPost);
    }

    postsToFindObject[quotedBoard] = boardPosts;

  }

}

function getQuotes(message, board, postsToFindObject) {

  var quotes = message.match(/>>\d+/g) || [];

  for (var i = 0; i < quotes.length; i++) {

    var quote = quotes[i];

    var quotedPost = +quote.substring(2);

    var boardPosts = postsToFindObject[board] || [];

    if (boardPosts.indexOf(quotedPost) === -1) {
      boardPosts.push(quotedPost);
    }

    postsToFindObject[board] = boardPosts;

  }

}

function markdownText(message, board, callback) {

  message = message.replace(/</g, '&lt');

  var postsToFindObject = {};

  getCrossQuotes(message, postsToFindObject);

  getQuotes(message, board, postsToFindObject);

  var orBlock = [];

  for ( var quotedBoardKey in postsToFindObject) {

    orBlock.push({
      boardUri : quotedBoardKey,
      postId : {
        $in : postsToFindObject[quotedBoardKey]
      }
    });

  }

  if (!orBlock.length) {
    replaceMarkdown(message, [], board, callback);
  } else {

    posts.aggregate([ {
      $match : {
        $or : orBlock
      }
    }, {
      $project : {
        _id : 0,
        postId : 1,
        threadId : 1,
        boardUri : 1
      }
    }, {
      $group : {
        _id : 0,
        posts : {
          $push : {
            boardUri : '$boardUri',
            postId : '$postId',
            threadId : '$threadId'
          }
        }

      }
    } ], function gotPosts(error, result) {

      if (error) {
        callback(error);
      } else if (!result.length) {
        replaceMarkdown(message, [], board, callback);
      } else {
        replaceMarkdown(message, result[0].posts, board, callback);
      }

    });
  }
}
// end of markdown functions

// start of tripcode functions
function generateSecureTripcode(name, password, parameters, callback) {

  var tripcode = crypto.createHash('sha256').update(password + Math.random())
      .digest('base64').substring(0, 6);

  tripcodes.insert({
    password : password,
    tripcode : tripcode
  }, function createdTripcode(error) {
    if (error && error.code === 11000) {
      generateSecureTripcode(name, password, parameters, callback);
    } else {

      parameters.name = name + '##' + tripcode;
      callback(error, parameters);
    }
  });

}

function checkForSecureTripcode(name, parameters, callback) {

  var password = name.substring(name.indexOf('##') + 2);

  name = name.substring(0, name.indexOf('##'));

  tripcodes.findOne({
    password : password
  }, function gotTripcode(error, tripcode) {
    if (error) {
      callback(error);
    } else if (!tripcode) {

      generateSecureTripcode(name, password, parameters, callback);

    } else {

      parameters.name = name + '##' + tripcode.tripcode;

      callback(null, parameters);
    }

  });

}

function checkForTripcode(parameters, callback) {

  var name = parameters.name;

  if (!name || name.indexOf('#') === -1) {

    callback(null, parameters);
    return;
  }

  var secure = name.indexOf('##') > -1;

  if (!secure) {

    var password = name.substring(name.indexOf('#') + 1);
    name = name.substring(0, name.indexOf('#'));

    if (!password.length) {
      callback(null, parameters);
      return;
    }

    password = crypto.createHash('sha256').update(password).digest('base64')
        .substring(0, 6);

    parameters.name = name + '#' + password;

    callback(null, parameters);
  } else {
    checkForSecureTripcode(name, parameters, callback);
  }

}
// end of tripcode functions

function getSignedRole(userData, board) {

  board.volunteers = board.volunteers || [];

  if (!userData) {
    return null;
  } else if (board.owner === userData.login) {
    return 'Board owner';
  } else if (board.volunteers.indexOf(userData.login) > -1) {
    return 'Board volunteer';
  } else if (userData.globalRole > miscOps.getMaxStaffRole) {
    return null;
  } else {
    return miscOps.getGlobalRoleLabel(userData.globalRole);
  }

}

function createId(salt, boardUri, ip) {
  return crypto.createHash('sha256').update(salt + ip + boardUri).digest('hex')
      .substring(0, 6);

}

// start of thread creation
function finishThreadCreation(boardUri, threadId, callback, thread) {

  // signal rebuild of board pages
  process.send({
    board : boardUri
  });

  // signal rebuild of thread
  process.send({
    board : boardUri,
    thread : threadId
  });

  addPostToStats(boardUri, function updatedStats(error) {
    if (error) {
      console.log(error.toString());
    }

    // style exception, too simple
    generator.preview(null, null, null, function generatedPreview(error) {
      callback(error, threadId);

    }, thread);
    // style exception, too simple

  });

}

function updateBoardForThreadCreation(boardUri, threadId, callback, thread) {

  boards.findOneAndUpdate({
    boardUri : boardUri
  }, {
    $set : {
      lastPostId : threadId
    },
    $inc : {
      threadCount : 1
    }
  }, {
    returnOriginal : false
  }, function updatedBoard(error, board) {
    if (error) {
      callback(error);
    } else {

      if (board.value.threadCount > threadLimit) {

        // style exception, too simple
        delOps.cleanThreads(boardUri, function cleanedThreads(error) {
          if (error) {
            callback(error);
          } else {
            finishThreadCreation(boardUri, threadId, callback, thread);
          }
        });
        // style exception, too simple

      } else {
        finishThreadCreation(boardUri, threadId, callback, thread);
      }

    }
  });
}

function createThread(req, userData, parameters, board, threadId, callback) {

  var salt = crypto.createHash('sha256').update(
      threadId + parameters.toString() + Math.random() + new Date()).digest(
      'hex');

  var hideId = board.settings.indexOf('disableIds') > -1;

  var ip = req.connection.remoteAddress;

  var id = hideId ? null : createId(salt, parameters.boardUri, ip);

  var threadToAdd = {
    boardUri : parameters.boardUri,
    threadId : threadId,
    salt : salt,
    ip : ip,
    id : id,
    markdown : parameters.markdown,
    lastBump : new Date(),
    creation : new Date(),
    subject : parameters.subject,
    pinned : false,
    locked : false,
    signedRole : getSignedRole(userData, board),
    name : parameters.name || board.anonymousName || defaultAnonymousName,
    message : parameters.message,
    email : parameters.email
  };

  if (parameters.password) {
    threadToAdd.password = parameters.password;
  }

  threads.insert(threadToAdd, function createdThread(error) {
    if (error && error.code === 11000) {
      createThread(req, userData, parameters, board, threadId + 1, callback);
    } else if (error) {
      callback(error);
    } else {

      // style exception, too simple
      uploadHandler.saveUploads(parameters.boardUri, threadId, null,
          parameters.files, parameters.spoiler, function savedUploads(error) {
            if (error) {
              callback(error);
            } else {
              updateBoardForThreadCreation(parameters.boardUri, threadId,
                  callback, threadToAdd);
            }
          });
      // style exception, too simple

    }
  });

}

function checkCaptchaForThread(req, userData, parameters, board, threadId,
    callback, captchaId) {

  captchaOps.attemptCaptcha(captchaId, parameters.captcha, board,
      function solvedCaptcha(error) {
        if (error) {
          callback(error);
        } else {
          // style exception, too simple
          checkForTripcode(parameters,
              function setTripCode(error, parameters) {
                if (error) {
                  callback(error);
                } else {
                  createThread(req, userData, parameters, board, threadId,
                      callback);
                }
              });
          // style exception, too simple
        }

      });

}

exports.newThread = function(req, userData, parameters, captchaId, callback) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    owner : 1,
    volunteers : 1,
    filters : 1,
    anonymousName : 1,
    settings : 1,
    lastPostId : 1
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback('Board not found');
    } else {

      if (board.settings.indexOf('forceAnonymity') > -1) {
        parameters.name = null;
      }

      miscOps.sanitizeStrings(parameters, postingParameters);

      parameters.message = applyFilters(board.filters, parameters.message);

      // style exception, too simple
      markdownText(parameters.message, parameters.boardUri,
          function gotMarkdown(error, markdown) {
            if (error) {
              callback(error);
            } else {
              parameters.markdown = markdown;

              checkCaptchaForThread(req, userData, parameters, board,
                  (board.lastPostId || 0) + 1, callback, captchaId);
            }

          });

      // style exception, too simple

    }
  });

};
// end of thread creation

// start of post creation

function updateBoardForPostCreation(parameters, postId, thread, callback) {

  if (parameters.email !== 'sage') {

    for (var i = 0; i < (thread.page || 1); i++) {

      // signal rebuild of board pages
      process.send({
        board : parameters.boardUri,
        page : i + 1
      });
    }
  } else if (thread.page) {
    process.send({
      board : parameters.boardUri,
      page : thread.page
    });
  }

  // signal rebuild of thread
  process.send({
    board : parameters.boardUri,
    thread : parameters.threadId
  });

  // signal rebuild of board
  process.send({
    board : parameters.boardUri,
    catalog : true
  });

  addPostToStats(parameters.boardUri, function updatedStats(error) {
    if (error) {
      console.log(error.toString());
    }

    // style exception, too simple
    boards.update({
      boardUri : parameters.boardUri
    }, {
      $set : {
        lastPostId : postId
      }
    }, function updatedBoard(error, result) {

      callback(error, postId);

    });
    // style exception, too simple
  });

}

function updateThread(parameters, postId, thread, callback, post) {

  var latestPosts = thread.latestPosts || [];

  latestPosts.push(postId);

  latestPosts = latestPosts.sort(function compareNumbers(a, b) {
    return a - b;
  });

  // TODO remove the while, cut all exceeding elements at once
  while (latestPosts.length > latestPostsCount) {
    latestPosts.shift();
  }

  var updateBlock = {
    $set : {
      latestPosts : latestPosts
    },
    $inc : {
      postCount : 1
    }
  };

  if (!thread.autoSage) {

    if (thread.postCount >= bumpLimit) {
      updateBlock.$set.autoSage = true;
    }

    if (parameters.email !== 'sage') {
      updateBlock.$set.lastBump = new Date();
    }
  }

  threads.update({
    boardUri : parameters.boardUri,
    threadId : parameters.threadId
  }, updateBlock, function updatedThread(error, result) {
    if (error) {
      callback(error);
    } else {
      // style exception, too simple
      generator.preview(null, null, null, function generatedPreview(error) {
        if (error) {
          callback(error);
        } else {
          updateBoardForPostCreation(parameters, postId, thread, callback);
        }
      }, post);

      // style exception, too simple
    }

  });

}

function createPost(req, parameters, userData, postId, thread, board, cb) {

  var ip = req.connection.remoteAddress;

  var hideId = board.settings.indexOf('disableIds') > -1;

  var id = hideId ? null : createId(thread.salt, parameters.boardUri, ip);

  var postToAdd = {
    boardUri : parameters.boardUri,
    postId : postId,
    markdown : parameters.markdown,
    ip : ip,
    threadId : parameters.threadId,
    signedRole : getSignedRole(userData, board),
    creation : new Date(),
    subject : parameters.subject,
    name : parameters.name || board.anonymousName || defaultAnonymousName,
    id : id,
    message : parameters.message,
    email : parameters.email
  };

  if (parameters.password) {
    postToAdd.password = parameters.password;
  }

  posts.insert(postToAdd, function createdPost(error) {
    if (error && error.code === 11000) {
      createPost(req, parameters, userData, postId + 1, thread, board, cb);
    } else if (error) {
      cb(error);
    } else {

      // style exception, too simple
      uploadHandler.saveUploads(parameters.boardUri, parameters.threadId,
          postId, parameters.files, parameters.spoiler, function savedFiles(
              error) {
            if (error) {
              cb(error);
            } else {
              updateThread(parameters, postId, thread, cb, postToAdd);
            }

          });
      // style exception, too simple

    }
  });

}

function getThread(req, parameters, userData, postId, board, callback) {

  threads.findOne({
    boardUri : parameters.boardUri,
    threadId : parameters.threadId
  }, {
    latestPosts : 1,
    autoSage : 1,
    locked : 1,
    salt : 1,
    postCount : 1,
    page : 1,
    _id : 1
  }, function gotThread(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback('Thread not found');
    } else if (thread.locked) {
      callback('You cannot reply to a locked thread');
    } else {

      if (board.settings.indexOf('forceAnonymity') > -1) {
        parameters.name = null;
      }

      miscOps.sanitizeStrings(parameters, postingParameters);

      // style exception, too simple
      checkForTripcode(parameters,
          function setTripCode(error, parameters) {
            if (error) {
              callback(error);
            } else {
              createPost(req, parameters, userData, postId, thread, board,
                  callback);
            }
          });
      // style exception, too simple

    }
  });

}

function getPostMarkdown(req, parameters, userData, postId, board, callback) {

  parameters.message = applyFilters(board.filters, parameters.message);

  markdownText(parameters.message, parameters.boardUri, function gotMarkdown(
      error, markdown) {

    if (error) {
      callback(error);
    } else {
      parameters.markdown = markdown;

      getThread(req, parameters, userData, postId, board, callback);
    }

  });

}

exports.newPost = function(req, userData, parameters, captchaId, callback) {

  parameters.threadId = +parameters.threadId;

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    lastPostId : 1,
    filters : 1,
    owner : 1,
    anonymousName : 1,
    settings : 1,
    volunteers : 1
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback('Board not found');
    } else {

      // style exception, too simple

      captchaOps.attemptCaptcha(captchaId, parameters.captcha, board,
          function solvedCaptcha(error) {

            if (error) {
              callback(error);
            } else {
              getPostMarkdown(req, parameters, userData,
                  (board.lastPostId || 0) + 1, board, callback);
            }

          });

      // style exception, too simple

    }
  });

};
// end of post creation
