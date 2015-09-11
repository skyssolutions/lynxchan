'use strict';

exports.flags = require('./flagOps');
exports.filters = require('./filterOps');
exports.rules = require('./ruleOps');
exports.meta = require('./metaOps');
exports.custom = require('./customOps');

exports.loadDependencies = function() {

  exports.custom.loadDependencies();
  exports.flags.loadDependencies();
  exports.filters.loadDependencies();
  exports.rules.loadDependencies();
  exports.meta.loadDependencies();

};