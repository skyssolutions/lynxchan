'use strict';

exports.miscPages = require('./misc');
exports.managementPages = require('./management');
exports.moderationPages = require('./moderation');

exports.loadDependencies = function() {

  exports.miscPages.loadDependencies();
  exports.managementPages.loadDependencies();
  exports.moderationPages.loadDependencies();

};