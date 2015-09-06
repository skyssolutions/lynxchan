'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var crypto = require('crypto');
var db = require('../../db');
var posts = db.posts();
var stats = db.stats();
var flags = db.flags();
var tripcodes = db.tripcodes();
var flood = db.flood();
var boot = require('../../boot');
var debug = boot.debug();
var settings = boot.getGeneralSettings();
var verbose = settings.verbose;
var lang;
var miscOps;

var floodTimer = settings.floodTimerSec * 1000;

exports.postingParameters = [ {
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

exports.defaultAnonymousName = settings.defaultAnonymousName;

exports.loadDependencies = function() {

  lang = require('../langOps').languagePack();
  miscOps = require('../miscOps');

  if (!exports.defaultAnonymousName) {
    exports.defaultAnonymousName = lang.miscDefaultAnonymous;
  }

};

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

exports.getSignedRole = function(userData, wishesToSign, board) {

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

};

exports.recordFlood = function(ip) {

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

};

// Section 1: Tripcode {
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

exports.checkForTripcode = function(parameters, callback) {

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

};
// } Section 1: Tripcode

exports.doesUserWishesToSign = function(userData, parameters) {

  var alwaysSigns = false;

  if (userData && userData.settings) {
    alwaysSigns = userData.settings.indexOf('alwaysSignRole') > -1;
  }

  var informedName = parameters.name || '';

  var askedToSign = informedName.toLowerCase().indexOf('#rs') > -1;

  return alwaysSigns || askedToSign;

};

exports.addPostToStats = function(boardUri, callback) {

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

};

function escapeRegExp(string) {
  return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
}

exports.applyFilters = function(filters, message) {

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

};

// Section 2: Markdown {
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
            replaceMarkdown(message, [], board, replaceCode, callback);
          } else {
            replaceMarkdown(message, result[0].posts, board, replaceCode,
                callback);
          }

        });
  }
};
// } Section 2: Markdown

exports.createId = function(salt, boardUri, ip) {

  if (ip) {
    return crypto.createHash('sha256').update(salt + ip + boardUri).digest(
        'hex').substring(0, 6);
  } else {
    return null;
  }
};

exports.getFlagUrl = function(flagId, boardUri, callback) {

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

};