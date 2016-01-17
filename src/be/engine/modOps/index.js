'use strict';

exports.common = require('./common');
exports.ipBan = require('./ipBanOps');
exports.hashBan = require('./hashBanOps');
exports.edit = require('./editOps');
exports.report = require('./reportOps');
exports.transfer = require('./transferOps');
exports.spoiler = require('./spoilerOps');

exports.loadSettings = function() {

  exports.common.loadSettings();
  exports.edit.loadSettings();
  exports.hashBan.loadSettings();
  exports.report.loadSettings();
  exports.ipBan.loadSettings();

};

exports.loadDependencies = function() {

  exports.common.loadDependencies();
  exports.ipBan.loadDependencies();
  exports.hashBan.loadDependencies();
  exports.edit.loadDependencies();
  exports.report.loadDependencies();
  exports.transfer.loadDependencies();
  exports.spoiler.loadDependencies();

};