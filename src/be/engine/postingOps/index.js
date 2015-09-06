'use strict';

exports.common = require('./common');
exports.post = require('./post');
exports.thread = require('./thread');

exports.loadDependencies = function() {

  exports.common.loadDependencies();
  exports.post.loadDependencies();
  exports.thread.loadDependencies();

};