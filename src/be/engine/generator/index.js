'use strict';

// coordinates full reloads using the two parts of the module
// personally I don't like putting actual logic on index.js files, but this is
// just wrapping actual implementations

var settingsHandler = require('../../settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var verbose = settings.verbose;

exports.postProjection = {
  _id : 0,
  subject : 1,
  creation : 1,
  threadId : 1,
  boardUri : 1,
  postId : 1,
  name : 1,
  flag : 1,
  flagName : 1,
  files : 1,
  banMessage : 1,
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
  banMessage : 1,
  flagName : 1,
  cyclic : 1,
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
  fileCount : 1
};

exports.board = require('./board');
exports.global = require('./global');

exports.loadDependencies = function() {

  exports.board.loadDependencies();
  exports.global.loadDependencies();

};

var toGenerate;
var MAX_TO_GENERATE = 11;
var reloading;

var fullReloadCallback = function(error, callback) {

  if (!reloading) {
    return;
  }

  if (error) {
    reloading = false;
    callback(error);
  }

  toGenerate--;

  if (!toGenerate) {

    if (verbose) {
      console.log('Finished generating all pages');
    }

    callback();
  }

};

exports.all = function(callback) {

  if (reloading) {
    return;
  }

  reloading = true;
  toGenerate = MAX_TO_GENERATE;

  exports.global.frontPage(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.global.spoiler(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.global.defaultBanner(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.global.notFound(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.board.boards(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.global.thumb(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.global.login(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.global.maintenance(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.global.audioThumb(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.global.overboard(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.global.logs(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

};