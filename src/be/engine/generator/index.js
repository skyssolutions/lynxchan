'use strict';

var languages = require('../../db').languages();

exports.postProjection = {
  subject : 1,
  creation : 1,
  threadId : 1,
  boardUri : 1,
  postId : 1,
  name : 1,
  flag : 1,
  flagName : 1,
  files : 1,
  flagCode : 1,
  banMessage : 1,
  innerCache : 1,
  outerCache : 1,
  alternativeCaches : 1,
  previewCache : 1,
  message : 1,
  email : 1,
  lastEditTime : 1,
  lastEditLogin : 1,
  id : 1,
  signedRole : 1,
  markdown : 1
};

exports.threadProjection = {
  _id : 0,
  id : 1,
  subject : 1,
  signedRole : 1,
  innerCache : 1,
  outerCache : 1,
  previewCache : 1,
  alternativeCaches : 1,
  flagCode : 1,
  banMessage : 1,
  flagName : 1,
  cyclic : 1,
  autoSage : 1,
  lastEditTime : 1,
  boardUri : 1,
  lastEditLogin : 1,
  threadId : 1,
  creation : 1,
  flag : 1,
  name : 1,
  page : 1,
  files : 1,
  locked : 1,
  pinned : 1,
  email : 1,
  markdown : 1,
  lastBump : 1,
  latestPosts : 1,
  postCount : 1,
  message : 1,
  fileCount : 1,
  archived : 1
};

exports.board = require('./board');
exports.global = require('./global');

exports.loadSettings = function() {

  exports.board.loadSettings();
  exports.global.loadSettings();

};

exports.loadDependencies = function() {

  exports.board.loadDependencies();
  exports.global.loadDependencies();

};

exports.nextLanguage = function(language, callback) {

  var matchBlock = {};

  if (language) {
    matchBlock._id = {
      $gt : language._id
    };
  }

  languages.find(matchBlock).sort({
    _id : 1
  }).limit(1).toArray(function gotLanguages(error, results) {

    if (error) {
      callback(error);
    } else {
      callback(null, results.length ? results[0] : null);
    }

  });

};
