'use strict';

exports.common = require('./common');
exports.dynamicPages = require('./dynamic');
exports.staticPages = require('./static');

exports.loadSettings = function() {

  exports.common.loadSettings();
  exports.staticPages.loadSettings();
  exports.dynamicPages.loadSettings();

};

exports.loadDependencies = function() {

  exports.common.loadDependencies();
  exports.dynamicPages.loadDependencies();
  exports.staticPages.loadDependencies();

};