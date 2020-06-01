'use strict';

exports.common = require('./common');
exports.postingContent = require('./postingContent');
exports.dynamicPages = require('./dynamic');
exports.staticPages = require('./static');

exports.loadSettings = function() {

  exports.postingContent.loadSettings();
  exports.common.loadSettings();
  exports.staticPages.loadSettings();
  exports.dynamicPages.loadSettings();

};

exports.loadDependencies = function() {

  exports.postingContent.loadDependencies();
  exports.common.loadDependencies();
  exports.dynamicPages.loadDependencies();
  exports.staticPages.loadDependencies();

};