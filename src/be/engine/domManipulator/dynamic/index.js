'use strict';

exports.miscPages = require('./misc');
exports.managementPages = require('./management');
exports.broadManagement = require('./broadManagement');
exports.moderationPages = require('./moderation');

exports.loadSettings = function() {

  exports.broadManagement.loadSettings();
  exports.miscPages.loadSettings();
  exports.managementPages.loadSettings();
  exports.moderationPages.loadSettings();

};

exports.loadDependencies = function() {

  exports.broadManagement.loadDependencies();
  exports.miscPages.loadDependencies();
  exports.managementPages.loadDependencies();
  exports.moderationPages.loadDependencies();

};