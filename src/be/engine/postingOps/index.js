'use strict';

exports.common = require('./common');
exports.post = require('./post');
exports.thread = require('./thread');

exports.loadSettings = function() {

  exports.common.loadSettings();
  exports.post.loadSettings();
  exports.thread.loadSettings();

};

exports.loadDependencies = function() {

  exports.common.loadDependencies();
  exports.post.loadDependencies();
  exports.thread.loadDependencies();

};