'use strict';

exports.board = require('./board');
exports.global = require('./global');

exports.loadSettings = function() {
  exports.global.loadSettings();
  exports.board.loadSettings();
};

exports.loadDependencies = function() {

  exports.board.loadDependencies();
  exports.global.loadDependencies();

};

var toDegenerate;
var MAX_TO_DEGENERATE = 12;
var reloading;

var fullReloadCallback = function(error, callback) {

  if (!reloading) {
    return;
  }

  if (error) {
    reloading = false;
    console.log('An error occured during the full cache deletion.');
    callback(error);
    return;
  }

  toDegenerate--;

  var left = MAX_TO_DEGENERATE - toDegenerate;
  var percentage = Math.floor(left * 100 / MAX_TO_DEGENERATE);

  console.log('Full deletion progress: ' + percentage + '%');

  if (!toDegenerate) {
    callback();
  }

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

  exports.global.maintenanceImage(function reloaded(error) {
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
  toDegenerate = MAX_TO_DEGENERATE;

  exports.board.boards(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.globalReloads(callback);

};