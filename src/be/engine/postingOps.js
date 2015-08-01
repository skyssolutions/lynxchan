'use strict';

// any operation regarding posting
var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var threads = db.threads();
var boards = db.boards();
var flags = db.flags();
var tripcodes = db.tripcodes();
var stats = db.stats();
var posts = db.posts();
var captchaOps = require('./captchaOps');
var miscOps = require('./miscOps');
var logger = require('../logger');
var files = db.files();
var generator = require('./generator');
var uploadHandler = require('./uploadHandler');
var delOps = require('./deletionOps');
var crypto = require('crypto');
var gsHandler = require('./gridFsHandler');
var boot = require('../boot');
var debug = boot.debug();
var lang = require('./langOps').languagePack();
var settings = boot.getGeneralSettings();
var latestPostsCount = boot.latestPostCount();
var threadLimit = boot.maxThreads();
var bumpLimit = settings.autoSageLimit || 500;
var autoLockLimit = bumpLimit * 2;
var defaultAnonymousName = settings.defaultAnonymousName;
var verbose = settings.verbose;
var floodTimer = (settings.floodTimerSec || 10) * 1000;
var flood = db.flood();

if (!defaultAnonymousName) {
  defaultAnonymousName = lang.miscDefaultAnonymous;
}

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

var greenTextFunction = function(match) {
  return '<span class="greenText">' + match + '</span>';
};

var redTextFunction = function(match) {
  var content = match.substring(2, match.length - 2);

  return '<span class="redText">' + content + '</span>';
};

var italicFunction = function(match) {

  return '<em>' + match.substring(2, match.length - 2) + '</em>';
};

var boldFunction = function(match) {
  return '<strong>' + match.substring(3, match.length - 3) + '</strong>';
};

var underlineFunction = function(match) {
  return '<u>' + match.substring(2, match.length - 2) + '</u>';
};

var strikeFunction = function(match) {
  return '<s>' + match.substring(2, match.length - 2) + '</s>';
};

var spoilerFunction = function(match) {

  var content = match.substring(9, match.length - 10);

  return '<span class="spoiler">' + content + '</span>';
};

// Section 1: Shared functions {
function getSignedRole(userData, wishesToSign, board) {

  board.volunteers = board.volunteers || [];

  if (!userData || !wishesToSign) {
    return null;
  } else if (board.owner === userData.login) {
    return lang.miscBoardOwner;
  } else if (board.volunteers.indexOf(userData.login) > -1) {
    return lang.miscBoardVolunteer;
  } else if (userData.globalRole <= miscOps.getMaxStaffRole()) {
    return miscOps.getGlobalRoleLabel(userData.globalRole);
  } else {
    return null;
  }

}

function recordFlood(ip) {

  flood.insertOne({
    ip : ip,
    expiration : new Date(new Date().getTime() + floodTimer)
  }, function addedFloodRecord(error) {
    if (error) {
      if (verbose) {
        console.log(error);
      }
      if (debug) {
        throw error;
      }
    }
  });

}

// Section 1.1: Tripcode {
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

function processRegularTripcode(name, parameters, callback) {
  var roleSignatureRequestIndex = name.toLowerCase().indexOf('#rs');
  if (roleSignatureRequestIndex > -1) {

    parameters.name = name.substring(0, roleSignatureRequestIndex);
    callback(null, parameters);
    return;

  }

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
}

function checkForTripcode(parameters, callback) {

  var name = parameters.name;

  if (!name || name.indexOf('#') === -1) {

    callback(null, parameters);
    return;
  }

  var secure = name.indexOf('##') > -1;

  if (!secure) {

    processRegularTripcode(name, parameters, callback);

  } else {
    checkForSecureTripcode(name, parameters, callback);
  }

}
// } Section 1.1: Tripcode

function doesUserWishesToSign(userData, parameters) {

  var alwaysSigns = false;

  if (userData && userData.settings) {
    alwaysSigns = userData.settings.indexOf('alwaysSignRole') > -1;
  }

  var informedName = parameters.name || '';

  var askedToSign = informedName.toLowerCase().indexOf('#rs') > -1;

  return alwaysSigns || askedToSign;

}

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

function escapeRegExp(string) {
  return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
}

function applyFilters(filters, message) {

  if (!filters || !filters.length) {
    return message;
  }

  for (var i = 0; i < filters.length; i++) {

    var filter = filters[i];

    message = message.replace(
        new RegExp(escapeRegExp(filter.originalTerm), 'g'),
        filter.replacementTerm);

  }

  return message;

}

// Section 1.2: Markdown {
exports.replaceStyleMarkdown = function(message, replaceCode) {

  var split = message.split('\n');

  for (var i = 0; i < split.length; i++) {

    split[i] = split[i].replace(/^>[^\&].+/g, greenTextFunction);
    split[i] = split[i].replace(/\=\=.+\=\=/g, redTextFunction);
    split[i] = split[i].replace(/\'\'\'.+\'\'\'/g, boldFunction);
    split[i] = split[i].replace(/\'\'.+\'\'/g, italicFunction);
    split[i] = split[i].replace(/\_\_.+\_\_/g, underlineFunction);
    split[i] = split[i].replace(/\~\~.+\~\~/g, strikeFunction);
    split[i] = split[i].replace(/\[spoiler\].+\[\/spoiler\]/g, spoilerFunction);

    if (replaceCode) {
      split[i] = split[i].replace(/\[code\]/g, '<code>');
      split[i] = split[i].replace(/\[\/code\]/g, '</code>');
    }

  }

  message = split.join('<br>');
  return message;

};

function replaceMarkdown(message, posts, board, replaceCode, callback) {

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

  message = exports.replaceStyleMarkdown(message, replaceCode);

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

exports.markdownText = function(message, board, replaceCode, callback) {

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
    replaceMarkdown(message, [], board, replaceCode, callback);
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
    } ],
        function gotPosts(error, result) {

          if (error) {
            callback(error);
          } else if (!result.length) {
            replaceMarkdown(message, [], board, callback);
          } else {
            replaceMarkdown(message, result[0].posts, board, replaceCode,
                callback);
          }

        });
  }
};
// } Section 1.2: Markdown

function createId(salt, boardUri, ip) {

  if (ip) {
    return crypto.createHash('sha256').update(salt + ip + boardUri).digest(
        'hex').substring(0, 6);
  } else {
    return null;
  }
}

function getFlagUrl(flagId, boardUri, callback) {

  if (!flagId || !flagId.length) {
    callback();
    return;
  }

  try {
    flags.findOne({
      boardUri : boardUri,
      _id : new ObjectID(flagId)
    }, function gotFlagData(error, flag) {
      if (!flag) {
        callback();
      } else {
        callback('/' + boardUri + '/flags/' + flagId, flag.name);
      }
    });
  } catch (error) {
    callback();
  }

}

// } Section 1: Shared functions

// Section 2: Thread
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

function createThread(req, userData, parameters, board, threadId, wishesToSign,
    callback) {

  var salt = crypto.createHash('sha256').update(
      threadId + parameters.toString() + Math.random() + new Date()).digest(
      'hex');

  var hideId = board.settings.indexOf('disableIds') > -1;

  var ip = logger.ip(req);

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
    signedRole : getSignedRole(userData, wishesToSign, board),
    name : parameters.name || board.anonymousName || defaultAnonymousName,
    message : parameters.message,
    email : parameters.email
  };

  if (parameters.flag) {
    threadToAdd.flagName = parameters.flagName;
    threadToAdd.flag = parameters.flag;
  }

  if (parameters.password) {
    threadToAdd.password = parameters.password;
  }

  threads.insert(threadToAdd, function createdThread(error) {
    if (error && error.code === 11000) {
      createThread(req, userData, parameters, board, threadId + 1,
          wishesToSign, callback);
    } else if (error) {
      callback(error);
    } else {

      recordFlood(ip);

      var allowsArchive = false;

      if (board.settings) {
        allowsArchive = board.settings.indexOf('archive') > -1;
      }

      // style exception, too simple
      uploadHandler.saveUploads(parameters.boardUri, threadId, null,
          parameters.files, parameters.spoiler, allowsArchive,
          function savedUploads(error) {
            if (error) {
              if (verbose) {
                console.log(error);
              }

              if (debug) {
                throw error;
              }
            }

            updateBoardForThreadCreation(parameters.boardUri, threadId,
                callback, threadToAdd);

          });
      // style exception, too simple

    }
  });

}

function getNewThreadId(req, userData, parameters, board, wishesToSign,
    callback) {

  boards.findOneAndUpdate({
    boardUri : parameters.boardUri
  }, {
    $inc : {
      lastPostId : 1
    }
  }, {
    returnOriginal : false
  }, function gotLastIdInfo(error, lastIdData) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      getFlagUrl(parameters.flag, parameters.boardUri, function gotFlagUrl(
          flagUrl, flagName) {

        parameters.flagName = flagName;
        parameters.flag = flagUrl;

        createThread(req, userData, parameters, board,
            lastIdData.value.lastPostId, wishesToSign, callback);
      });
      // style exception, too simple

    }
  });

}

function checkMarkdownForThread(req, userData, parameters, board, callback) {

  exports.markdownText(parameters.message, parameters.boardUri, board.settings
      .indexOf('allowCode') > -1, function gotMarkdown(error, markdown) {
    if (error) {
      callback(error);
    } else {
      parameters.markdown = markdown;
      var wishesToSign = doesUserWishesToSign(userData, parameters);

      // style exception, too simple
      checkForTripcode(parameters, function setTripCode(error, parameters) {
        if (error) {
          callback(error);
        } else {
          getNewThreadId(req, userData, parameters, board, wishesToSign,
              callback);
        }
      });
      // style exception, too simple
    }
  });

}

exports.newThread = function(req, userData, parameters, captchaId, cb) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    owner : 1,
    volunteers : 1,
    filters : 1,
    anonymousName : 1,
    settings : 1
  }, function gotBoard(error, board) {
    if (error) {
      cb(error);
    } else if (!board) {
      cb(lang.errBoardNotFound);
    } else {

      if (board.settings.indexOf('forceAnonymity') > -1) {
        parameters.name = null;
      }

      miscOps.sanitizeStrings(parameters, postingParameters);

      parameters.message = applyFilters(board.filters, parameters.message);

      // style exception, too simple
      captchaOps.attemptCaptcha(captchaId, parameters.captcha, board,
          function solvedCaptcha(error) {
            if (error) {
              cb(error);
            } else {
              checkMarkdownForThread(req, userData, parameters, board, cb);
            }
          });
      // style exception, too simple

    }
  });

};
// } Section 2: Thread

// Section 3: Post {
function cleanPostFiles(files, postId, callback) {

  gsHandler.removeFiles(files, function removedFiles(error) {
    callback(error, postId);
  });

}

function updateThreadAfterCleanUp(boardUri, threadId, removedPosts, postId,
    removedFileCount, callback) {

  threads.updateOne({
    boardUri : boardUri,
    threadId : threadId
  }, {
    $inc : {
      postCount : -removedPosts.length,
      fileCount : -removedFileCount
    }
  }, function updatedThread(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      files.aggregate([ {
        $match : {
          'metadata.boardUri' : boardUri,
          'metadata.postId' : {
            $in : removedPosts
          }
        }
      }, {
        $group : {
          _id : 0,
          files : {
            $push : '$filename'
          }
        }
      } ], function gotFileNames(error, results) {
        if (error) {
          callback(error);
        } else if (!results.length) {
          callback(null, postId);
        } else {
          cleanPostFiles(results[0].files, postId, callback);
        }

      });
      // style exception, too simple

    }

  });

}

function cleanThreadPosts(boardUri, threadId, postId, callback) {

  posts.aggregate([ {
    $match : {
      boardUri : boardUri,
      threadId : threadId
    }
  }, {
    $sort : {
      creation : -1
    }
  }, {
    $skip : bumpLimit
  }, {
    $group : {
      _id : 0,
      posts : {
        $push : '$postId'
      },
      removedFileCount : {
        $sum : {
          $size : {
            $ifNull : [ '$files', [] ]
          }
        }
      }
    }
  } ], function gotPosts(error, results) {
    if (error) {
      callback(error);
    } else if (!results.length) {
      callback(null, postId);
    } else {
      var postsToDelete = results[0].posts;

      // style exception, too simple
      posts.deleteMany({
        boardUri : boardUri,
        postId : {
          $in : postsToDelete
        }
      }, function postsRemoved(error) {
        if (error) {
          callback(error);
        } else {
          updateThreadAfterCleanUp(boardUri, threadId, postsToDelete, postId,
              results[0].removedFileCount, callback);
        }
      });
      // style exception, too simple
    }

  });

}

function updateBoardForPostCreation(parameters, postId, thread, cleanPosts,
    callback) {

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

    if (cleanPosts) {
      cleanThreadPosts(parameters.boardUri, parameters.threadId, postId,
          callback);
    } else {
      callback(error, postId);
    }

  });

}

function getLatestPosts(thread, postId) {
  var latestPosts = thread.latestPosts || [];

  latestPosts.push(postId);

  latestPosts = latestPosts.sort(function compareNumbers(a, b) {
    return a - b;
  });

  if (latestPosts.length > latestPostsCount) {
    latestPosts.splice(0, latestPosts.length - latestPostsCount);
  }

  return latestPosts;

}

function updateThread(parameters, postId, thread, callback, post) {

  var updateBlock = {
    $set : {
      latestPosts : getLatestPosts(thread, postId)
    },
    $inc : {
      postCount : 1
    }
  };

  var cleanPosts = false;
  var saged = parameters.email === 'sage';
  var bump = false;

  if (!thread.autoSage) {

    if (thread.postCount >= bumpLimit) {

      if (thread.cyclic) {
        cleanPosts = true;
        bump = true;
      } else {
        updateBlock.$set.autoSage = true;
      }

    } else {
      bump = true;
    }

  }

  if (!saged && bump) {
    updateBlock.$set.lastBump = new Date();
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
          updateBoardForPostCreation(parameters, postId, thread, cleanPosts,
              callback);
        }
      }, post);

      // style exception, too simple
    }

  });

}

function createPost(req, parameters, userData, postId, thread, board,
    wishesToSign, cb) {

  var ip = logger.ip(req);

  var hideId = board.settings.indexOf('disableIds') > -1;

  var id = hideId ? null : createId(thread.salt, parameters.boardUri, ip);

  var postToAdd = {
    boardUri : parameters.boardUri,
    postId : postId,
    markdown : parameters.markdown,
    ip : ip,
    threadId : parameters.threadId,
    signedRole : getSignedRole(userData, wishesToSign, board),
    creation : new Date(),
    subject : parameters.subject,
    name : parameters.name || board.anonymousName || defaultAnonymousName,
    id : id,
    message : parameters.message,
    email : parameters.email
  };

  if (parameters.flag) {
    postToAdd.flagName = parameters.flagName;
    postToAdd.flag = parameters.flag;
  }

  if (parameters.password) {
    postToAdd.password = parameters.password;
  }

  posts.insert(postToAdd, function createdPost(error) {
    if (error) {
      cb(error);
    } else {

      recordFlood(ip);

      var allowsArchive = false;

      if (board.settings) {
        allowsArchive = board.settings.indexOf('archive') > -1;
      }

      // style exception, too simple
      uploadHandler.saveUploads(parameters.boardUri, parameters.threadId,
          postId, parameters.files, parameters.spoiler, allowsArchive,
          function savedFiles(error) {
            if (error) {
              if (verbose) {
                console.log(error);
              }

              if (debug) {
                throw error;
              }
            }
            updateThread(parameters, postId, thread, cb, postToAdd);

          });
      // style exception, too simple

    }
  });

}

function getPostFlag(req, parameters, userData, postId, thread, board,
    wishesToSign, cb) {

  getFlagUrl(parameters.flag, parameters.boardUri, function gotFlagUrl(flagUrl,
      flagName) {

    parameters.flagName = flagName;
    parameters.flag = flagUrl;

    createPost(req, parameters, userData, postId, thread, board, wishesToSign,
        cb);
  });

}

function getPostMarkdown(req, parameters, userData, thread, board, callback) {

  var wishesToSign = doesUserWishesToSign(userData, parameters);

  parameters.message = applyFilters(board.filters, parameters.message);

  exports.markdownText(parameters.message, parameters.boardUri, board.settings
      .indexOf('allowCode') > -1, function gotMarkdown(error, markdown) {

    if (error) {
      callback(error);
    } else {
      parameters.markdown = markdown;

      // style exception, too simple
      boards.findOneAndUpdate({
        boardUri : parameters.boardUri
      }, {
        $inc : {
          lastPostId : 1
        }
      }, {
        returnOriginal : false
      }, function gotNewId(error, lastIdData) {
        if (error) {
          callback(error);
        } else {
          getPostFlag(req, parameters, userData, lastIdData.value.lastPostId,
              thread, board, wishesToSign, callback);
        }
      });
      // style exception, too simple

    }

  });

}

function getThread(req, parameters, userData, board, callback) {

  threads.findOne({
    boardUri : parameters.boardUri,
    threadId : parameters.threadId
  }, {
    _id : 1,
    salt : 1,
    page : 1,
    cyclic : 1,
    locked : 1,
    autoSage : 1,
    postCount : 1,
    latestPosts : 1
  }, function gotThread(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback(lang.errThreadNotFound);
    } else if (thread.locked) {
      callback(lang.errThreadLocked);
    } else if (thread.postCount >= autoLockLimit) {
      callback(lang.errThreadAutoLocked);
    } else {

      if (board.settings.indexOf('forceAnonymity') > -1) {
        parameters.name = null;
      }

      miscOps.sanitizeStrings(parameters, postingParameters);

      // style exception, too simple
      checkForTripcode(parameters, function setTripCode(error, parameters) {
        if (error) {
          callback(error);
        } else {
          getPostMarkdown(req, parameters, userData, thread, board, callback);
        }
      });
      // style exception, too simple

    }
  });

}

exports.newPost = function(req, userData, parameters, captchaId, callback) {

  parameters.threadId = +parameters.threadId;

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    filters : 1,
    owner : 1,
    anonymousName : 1,
    settings : 1,
    volunteers : 1
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else {

      // style exception, too simple

      captchaOps.attemptCaptcha(captchaId, parameters.captcha, board,
          function solvedCaptcha(error) {

            if (error) {
              callback(error);
            } else {
              getThread(req, parameters, userData, board, callback);
            }

          });

      // style exception, too simple

    }
  });

};
// } Section 3: Post
