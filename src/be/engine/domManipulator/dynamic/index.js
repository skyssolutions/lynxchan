'use strict';

exports.miscPages = require('./misc');
exports.managementPages = require('./management');
exports.moderationPages = require('./moderation');

exports.loadSettings = function() {

  exports.miscPages.loadSettings();
  exports.managementPages.loadSettings();

};

exports.loadDependencies = function() {

  exports.miscPages.loadDependencies();
  exports.managementPages.loadDependencies();
  exports.moderationPages.loadDependencies();

};