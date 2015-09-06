'use strict';

exports.flags = require('./flagOps');
exports.banners = require('./bannerOps');
exports.filters = require('./filterOps');
exports.rules = require('./ruleOps');
exports.meta = require('./metaOps');

exports.loadDependencies = function() {

  exports.flags.loadDependencies();
  exports.banners.loadDependencies();
  exports.filters.loadDependencies();
  exports.rules.loadDependencies();
  exports.meta.loadDependencies();

};