//Enforces content uniqueness

'use strict';

var crypto = require('crypto');
var db = require('../db');
var threads = db.threads();
var posts = db.posts();
var lang;

exports.loadDependencies = function() {
  lang = require('./langOps').languagePack;
};

// Section 1: Checking for duplicates {
exports.getQuery = function(boardData, checkMessage, checkFiles, parameters,
    language, callback) {

  var query = {
    boardUri : boardData.boardUri,
    $or : []
  };

  if (checkMessage) {
    query.$or.push({
      hash : parameters.hash
    });
  }

  if (checkFiles) {
    var sha256s = [];

    for (var i = 0; i < parameters.files.length; i++) {

      var file = parameters.files[i];

      if (sha256s.indexOf(file.sha256) > -1) {
        callback(lang(language).errDuplicateFileBeingPosted);

        return;
      }

      sha256s.push(file.sha256);
    }

    query.$or.push({
      'files.sha256' : {
        $in : sha256s
      }
    });
  }

  return query;

};

exports.getPost = function(parameters, query, language, callback) {

  posts.findOne(query, {
    hash : 1
  }, function foundPost(error, post) {

    if (post) {

      var hashMathes = post.hash === parameters.hash;

      callback(hashMathes ? lang(language).errMessageAlreadyPosted
          : lang(language).errFileAlreadyPosted);
    } else {
      callback(error);
    }

  });

};

exports.check = function(parameters, boardData, language, callback) {

  var settings = boardData.settings;

  if (!settings || !settings.length) {
    callback();
    return;
  }

  var checkMessage = parameters.message && parameters.message.length;
  checkMessage = checkMessage && settings.indexOf('uniquePosts') > -1;

  var checkFiles = parameters.files.length;
  checkFiles = checkFiles && boardData.settings.indexOf('uniqueFiles') > -1;

  if (!checkMessage && !checkFiles) {
    callback();

    return;
  }

  var query = exports.getQuery(boardData, checkMessage, checkFiles, parameters,
      language, callback);

  if (!query) {
    return;
  }

  threads.findOne(query, {
    hash : 1
  }, function foundThread(error, thread) {

    if (error) {
      callback(error);
    } else if (thread) {
      var matches = thread.hash === parameters.hash;

      callback(matches ? lang(language).errMessageAlreadyPosted
          : lang(language).errFileAlreadyPosted);

    } else {
      exports.getPost(parameters, query, language, callback);
    }

  });

};
// } Section 1: Checking for duplicates

exports.getMessageHash = function(message) {

  if (!message || !message.toString().length) {
    return null;
  }

  message = message.toString().toLowerCase().replace(/[ \n\t]/g, '');

  return crypto.createHash('md5').update(message).digest('base64');

};