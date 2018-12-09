'use strict';

// handles operations common to user posting

var fs = require('fs');
var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var crypto = require('crypto');
var logger = require('../../logger');
var db = require('../../db');
var posts = db.posts();
var threads = db.threads();
var uniqueIps = db.uniqueIps();
var stats = db.stats();
var flags = db.flags();
var latestPosts = db.latestPosts();
var tripcodes = db.tripcodes();
var flood = db.flood();
var lang;
var locationOps;
var miscOps;
var verbose;
var maxGlobalLatestPosts;
var floodTimer;
var pageSize;
var globalMaxSizeMB;
var globalMaxFiles;

var dataPath = __dirname + '/../../locationData/data.json';

exports.fieldList = [ 'country', 'region', 'city' ];

exports.linkSanitizationRelation = {
  '_' : '&#95;',
  '=' : '&#61;',
  '\'' : '&#8216;',
  '~' : '&#126;',
  '*' : '&#42;'
};

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
  field : 'message'
}, {
  field : 'password',
  length : 8
} ];

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  exports.postingParameters[3].length = settings.messageLength;

  exports.defaultAnonymousName = settings.defaultAnonymousName;

  if (!exports.defaultAnonymousName) {
    exports.defaultAnonymousName = lang().miscDefaultAnonymous;
  }

  verbose = settings.verbose || settings.verboseMisc;
  maxGlobalLatestPosts = settings.globalLatestPosts;
  pageSize = settings.pageSize;
  floodTimer = settings.floodTimerSec * 1000;
  globalMaxSizeMB = settings.maxFileSizeMB;
  globalMaxFiles = settings.maxFiles;

};

exports.loadDependencies = function() {

  lang = require('../langOps').languagePack;
  miscOps = require('../miscOps');
  locationOps = require('../locationOps');

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

var altSpoilerFunction = function(match) {

  var content = match.substring(2, match.length - 2);

  return '<span class="spoiler">' + content + '</span>';
};

exports.getSignedRole = function(userData, wishesToSign, board) {

  board.volunteers = board.volunteers || [];

  if (!userData || !wishesToSign) {
    return null;
  } else if (board.owner === userData.login) {
    return lang().miscBoardOwner;
  } else if (board.volunteers.indexOf(userData.login) > -1) {
    return lang().miscBoardVolunteer;
  } else if (userData.globalRole <= miscOps.getMaxStaffRole()) {
    return miscOps.getGlobalRoleLabel(userData.globalRole);
  } else {
    return null;
  }

};

exports.recordFlood = function(req) {

  if (req.isTor) {
    return;
  }

  flood.insertOne({
    ip : logger.ip(req),
    expiration : new Date(new Date().getTime() + floodTimer)
  }, function addedFloodRecord(error) {
    if (error && verbose) {
      console.log(error);
    }
  });

};

// Section 1: Tripcode {
exports.generateSecureTripcode = function(name, password, parameters, cb) {

  var tripcode = crypto.createHash('sha256').update(password + Math.random())
      .digest('base64').substring(0, 6);

  tripcodes.insertOne({
    password : password,
    tripcode : tripcode
  }, function createdTripcode(error) {
    if (error && error.code === 11000) {
      exports.generateSecureTripcode(name, password, parameters, cb);
    } else {

      parameters.name = name + '##' + tripcode;
      cb(error, parameters);
    }
  });

};

exports.checkForSecureTripcode = function(name, parameters, callback) {

  var password = name.substring(name.indexOf('##') + 2);

  name = name.substring(0, name.indexOf('##'));

  tripcodes.findOne({
    password : password
  }, function gotTripcode(error, tripcode) {
    if (error) {
      callback(error);
    } else if (!tripcode) {
      exports.generateSecureTripcode(name, password, parameters, callback);
    } else {
      parameters.name = name + '##' + tripcode.tripcode;
      callback(null, parameters);
    }

  });

};

exports.processRegularTripcode = function(name, parameters, callback) {
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
};

exports.checkForTripcode = function(parameters, callback) {

  var name = parameters.name;

  if (!name || name.indexOf('#') === -1) {

    callback(null, parameters);
    return;
  }

  var secure = name.indexOf('##') > -1;

  if (!secure) {
    exports.processRegularTripcode(name, parameters, callback);
  } else {
    exports.checkForSecureTripcode(name, parameters, callback);
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

exports.addPostToStats = function(ip, boardUri, callback) {

  var statHour = new Date();

  statHour.setUTCMilliseconds(0);
  statHour.setUTCSeconds(0);
  statHour.setUTCMinutes(0);

  stats.updateOne({
    boardUri : boardUri,
    startingTime : statHour
  }, {
    $setOnInsert : {
      boardUri : boardUri,
      startingTime : statHour
    },
    $inc : {
      posts : 1
    }
  }, {
    upsert : true
  }, function updatedStats(error) {

    if (error) {
      callback(error);
    } else if (ip) {

      var hashedIp = crypto.createHash('md5').update(ip.toString()).digest(
          'base64');

      uniqueIps.updateOne({
        boardUri : boardUri
      }, {
        $setOnInsert : {
          boardUri : boardUri
        },
        $addToSet : {
          ips : hashedIp
        }
      }, {
        upsert : true
      }, callback);

    } else {
      callback();
    }

  });

};

exports.escapeRegExp = function(string) {
  return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
};

exports.applyFilters = function(filters, message) {

  if (!filters || !filters.length) {
    return message;
  }

  for (var i = 0; i < filters.length; i++) {

    var filter = filters[i];

    var parameters = 'g';

    if (filter.caseInsensitive) {
      parameters += 'i';
    }

    message = message
        .replace(new RegExp(exports.escapeRegExp(filter.originalTerm),
            parameters), filter.replacementTerm);

  }

  return message;

};

exports.checkBoardFileLimits = function(files, boardData, language) {

  if (!boardData) {
    return null;
  }

  var allowedMimes = boardData.acceptedMimes;

  var checkSize = boardData.maxFileSizeMB < globalMaxSizeMB;

  var maxSize = checkSize ? boardData.maxFileSizeMB * 1024 * 1024 : null;

  var checkMimes = allowedMimes && allowedMimes.length;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];

    if (checkMimes && allowedMimes.indexOf(file.mime) < 0) {
      return lang(language).errInvalidMimeForBoard;
    }

    if (maxSize && maxSize < file.size) {
      return lang(language).errFileTooLargeForBoard;
    }

  }

  if (boardData.maxFiles && boardData.maxFiles < globalMaxFiles) {
    files.splice(boardData.maxFiles, globalMaxFiles - boardData.maxFiles);
  }

};

// Section 2: Markdown {
exports.processLine = function(split, replaceCode) {

  split = split.replace(/^>[^\&].*/g, greenTextFunction);
  split = split.replace(/\=\=.+?\=\=/g, redTextFunction);
  split = split.replace(/\'\'\'.+?\'\'\'/g, boldFunction);
  split = split.replace(/\'\'.+?\'\'/g, italicFunction);
  split = split.replace(/\_\_.+?\_\_/g, underlineFunction);
  split = split.replace(/\~\~.+?\~\~/g, strikeFunction);
  split = split.replace(/\[spoiler\].+?\[\/spoiler\]/g, spoilerFunction);
  split = split.replace(/\*\*.+?\*\*/g, altSpoilerFunction);
  split = split.replace(/\[aa\]/g, '<span class="aa">');
  split = split.replace(/\[\/aa\]/g, '</span>');

  if (replaceCode) {
    split = split.replace(/\[code\]/g, '<code>');
    split = split.replace(/\[\/code\]/g, '</code>');
  }

  return split;

};

exports.replaceStyleMarkdown = function(message, replaceCode) {

  var split = message.split('\n');

  for (var i = 0; i < split.length; i++) {
    split[i] = exports.processLine(split[i], replaceCode);
  }

  message = split.join('<br>');
  return message;

};

exports.replaceMarkdown = function(message, posts, board, replaceCode, cb) {

  var postObject = {};

  message = message.replace(/(http|https)\:\/\/\S+/g, function links(match) {

    match = match.replace(/>/g, '&gt;').replace(/[_='~*]/g,
        function sanitization(innerMatch) {
          return exports.linkSanitizationRelation[innerMatch];
        });

    return '<a target="blank" href="' + match + '">' + match + '</a>';

  });

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

    var toReturn = '<a class="quoteLink" href="' + link + '">&gt;&gt;&gt;';
    toReturn += match.substring(3) + '</a>';

    return toReturn;

  });

  message = message.replace(/>>>\/\w+\//g, function board(match) {

    var quotedBoard = match.substring(3);

    return '<a href="' + quotedBoard + '">&gt;&gt;&gt;' + quotedBoard + '</a>';

  });

  message = message.replace(/>>\d+/g, function quote(match) {

    var quotedPost = match.substring(2);

    var boardPosts = postObject[board] || {};

    var quotedThread = boardPosts[quotedPost] || quotedPost;

    var link = '/' + board + '/res/';

    link += quotedThread + '.html#' + quotedPost;

    var toReturn = '<a class="quoteLink" href="' + link + '">&gt;&gt;';

    toReturn += quotedPost + '</a>';

    return toReturn;

  });

  message = exports.replaceStyleMarkdown(message, replaceCode);

  cb(null, message);

};

exports.getCrossQuotes = function(message, postsToFindObject) {

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

};

exports.getQuotes = function(message, board, postsToFindObject) {

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

};

exports.markdownText = function(message, board, replaceCode, callback) {

  message = message.replace(/&/g, '&amp;');

  message = message.replace(/</g, '&lt;');

  var postsToFindObject = {};

  exports.getCrossQuotes(message, postsToFindObject);

  exports.getQuotes(message, board, postsToFindObject);

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
    exports.replaceMarkdown(message, [], board, replaceCode, callback);
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
    } ]).toArray(
        function gotPosts(error, result) {

          if (error) {
            callback(error);
          } else if (!result.length) {
            exports.replaceMarkdown(message, [], board, replaceCode, callback);
          } else {
            exports.replaceMarkdown(message, result[0].posts, board,
                replaceCode, callback);
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

// Section 3: Global latest posts {
exports.cleanGlobalLatestPosts = function(callback) {

  latestPosts.aggregate([ {
    $sort : {
      creation : -1
    }
  }, {
    $skip : maxGlobalLatestPosts
  }, {
    $group : {
      _id : 0,
      ids : {
        $push : '$_id'
      }
    }
  } ]).toArray(function gotLatestPostsToClean(error, results) {
    if (error) {
      callback(error);
    } else if (!results.length) {
      process.send({
        frontPage : true
      });

      callback();
    } else {

      // style exception, too simple
      latestPosts.deleteMany({
        _id : {
          $in : results[0].ids
        }
      }, function cleanedLatestPosts(error) {
        if (error) {
          callback(error);
        } else {
          process.send({
            frontPage : true
          });

          callback();
        }
      });
      // style exception, too simple

    }
  });

};

exports.addPostToLatestPosts = function(posting, callback) {

  latestPosts.insertOne({
    boardUri : posting.boardUri,
    threadId : posting.threadId,
    creation : posting.creation,
    postId : posting.postId,
    previewText : posting.message.substring(0, 128).replace(/[<>]/g,
        function replace(match) {
          return miscOps.htmlReplaceTable[match];
        })
  }, function addedPost(error) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      latestPosts.countDocuments({}, function counted(error, count) {
        if (error) {
          callback(error);
        } else if (count > maxGlobalLatestPosts) {
          exports.cleanGlobalLatestPosts(callback);
        } else {
          process.send({
            frontPage : true
          });

          callback();
        }
      });
      // style exception, too simple

    }

  });

};
// } Section 3: Global latest posts

// Section 4: Flag selection {
exports.getCurrentObject = function(ipData, field, currentObject, flags,
    locationCode) {

  var location = ipData[field];

  if (location) {
    currentObject = currentObject ? currentObject[location] : flags[location];

    if (currentObject) {
      currentObject.code = (currentObject.code || '');
      currentObject.code += '-' + location.toLowerCase();
    }

  } else {
    currentObject = null;
  }

  return currentObject;

};

exports.searchLocation = function(data, ipData) {

  var index = 0;
  var selectedObject;
  var currentObject;
  var parentObject;

  while (!selectedObject && index < exports.fieldList.length) {

    var field = exports.fieldList[index];

    currentObject = exports.getCurrentObject(ipData, field, currentObject,
        data.relation);

    if (!currentObject) {
      selectedObject = parentObject;
      break;
    } else if (currentObject.relation) {

      parentObject = currentObject;
      currentObject = currentObject.relation;
      index++;

    } else {
      selectedObject = currentObject;
    }

  }

  return selectedObject || {
    flag : data.unknownFlag,
    name : data.unknownFlagName
  };

};

exports.readFlagData = function(locationData, callback) {

  fs.readFile(dataPath, function readBoards(error, content) {

    if (error) {
      if (verbose) {
        console.log(error);
      }

      callback();
    } else {

      var data;

      try {
        data = JSON.parse(content);
      } catch (error) {

        if (verbose) {
          console.log(error);
        }

        callback();
        return;
      }

      var flagData = exports.searchLocation(data, locationData);

      callback(data.flagsUrl + flagData.flag, flagData.name, flagData.code);

    }
  });

};

exports.getLocationFlagUrl = function(ip, boardData, noFlag, callback) {

  var locationFlagMode = boardData.locationFlagMode || 0;

  if (!ip || !locationFlagMode || (locationFlagMode === 1 && noFlag)) {
    callback();
    return;
  }

  locationOps.getLocationInfo(ip, function gotData(error, locationData) {

    if (!locationData) {

      if (error && verbose) {
        console.log(error);
      }

      callback();

    } else {

      exports.readFlagData(locationData, callback);
    }

  });

};

exports.getFlagUrl = function(flagId, ip, boardData, noFlag, callback) {

  if (!flagId) {
    exports.getLocationFlagUrl(ip, boardData, noFlag, callback);
    return;
  }

  try {
    flagId = new ObjectID(flagId);
  } catch (error) {
    exports.getLocationFlagUrl(ip, boardData, noFlag, callback);
    return;
  }

  flags.findOne({
    boardUri : boardData.boardUri,
    _id : flagId
  }, function gotFlagData(error, flag) {
    if (!flag) {
      exports.getLocationFlagUrl(ip, boardData, noFlag, callback);
    } else {
      callback('/' + boardData.boardUri + '/flags/' + flagId, flag.name);
    }
  });

};
// } Section 4: Flag selection

exports.setThreadsPage = function(boardUri, callback, page) {

  page = page || 1;

  threads.aggregate([ {
    $match : {
      boardUri : boardUri
    }
  }, {
    $sort : {
      pinned : -1,
      lastBump : -1
    }
  }, {
    $skip : (page - 1) * pageSize
  }, {
    $limit : pageSize
  }, {
    $group : {
      _id : 0,
      threads : {
        $push : '$_id'
      }
    }
  } ]).toArray(function gotThreads(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {

      // style exception, too simple
      threads.updateMany({
        _id : {
          $in : results[0].threads
        }
      }, {
        $set : {
          page : page
        }
      }, function updatePage(error) {

        if (error) {
          callback(error);
        } else {
          exports.setThreadsPage(boardUri, callback, ++page);
        }

      });
      // style exception, too simple

    }

  });

};
