'use strict';

exports.common = require('./common');
exports.dynamicPages = require('./dynamic');
exports.staticPages = require('./static');

exports.loadDependencies = function() {

  exports.common.loadDependencies();
  exports.dynamicPages.loadDependencies();
  exports.staticPages.loadDependencies();

};