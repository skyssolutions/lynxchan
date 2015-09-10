'use strict';

exports.flags = require('./flagOps');
exports.filters = require('./filterOps');
exports.rules = require('./ruleOps');
exports.meta = require('./metaOps');

exports.loadDependencies = function() {

  exports.flags.loadDependencies();
  exports.filters.loadDependencies();
  exports.rules.loadDependencies();
  exports.meta.loadDependencies();

};