'use strict';

exports.flags = require('./flagOps');
exports.filters = require('./filterOps');
exports.rules = require('./ruleOps');
exports.meta = require('./metaOps');
exports.custom = require('./customOps');
exports.latest = require('./latestOps');

exports.loadSettings = function() {

  exports.latest.loadSettings();
  exports.custom.loadSettings();
  exports.filters.loadSettings();
  exports.flags.loadSettings();
  exports.meta.loadSettings();
  exports.rules.loadSettings();

};

exports.loadDependencies = function() {

  exports.latest.loadDependencies();
  exports.custom.loadDependencies();
  exports.flags.loadDependencies();
  exports.filters.loadDependencies();
  exports.rules.loadDependencies();
  exports.meta.loadDependencies();

};