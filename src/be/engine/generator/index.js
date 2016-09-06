'use strict';

// coordinates full reloads using the two parts of the module
// personally I don't like putting actual logic on index.js files, but this is
// just wrapping actual implementations

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
  fileCount : 1
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

var toGenerate;
var MAX_TO_GENERATE = 12;
var reloading;

var fullReloadCallback = function(error, callback) {

  if (!reloading) {
    return;
  }

  if (error) {
    reloading = false;
    console.log('An error occured during the full reload.');
    callback(error);
    return;
  }

  toGenerate--;

  var left = MAX_TO_GENERATE - toGenerate;
  var percentage = Math.floor(left * 100 / MAX_TO_GENERATE);

  console.log('Full rebuild progress: ' + percentage + '%');

  if (!toGenerate) {
    callback();
  }

};

exports.boardReloads = function(callback) {

  exports.board.boards(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.board.previews(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

};

exports.globalReloads = function(callback) {

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

exports.all = function(callback) {

  if (reloading) {
    return;
  }

  reloading = true;
  toGenerate = MAX_TO_GENERATE;

  exports.boardReloads(callback);

  exports.globalReloads(callback);

};