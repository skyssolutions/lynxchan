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
    var md5s = [];

    for (var i = 0; i < parameters.files.length; i++) {

      var file = parameters.files[i];

      if (md5s.indexOf(file.md5) > -1) {
        callback(lang(language).errDuplicateFileBeingPosted);

        return;
      }

      md5s.push(file.md5);
    }

    query.$or.push({
      'files.md5' : {
        $in : md5s
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