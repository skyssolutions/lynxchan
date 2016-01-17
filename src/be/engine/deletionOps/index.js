'use strict';

exports.miscDeletions = require('./miscDelOps');
exports.postingDeletions = require('./postingDelOps');

exports.loadSettings = function() {

  exports.miscDeletions.loadSettings();
  exports.postingDeletions.loadSettings();

};

exports.loadDependencies = function() {

  exports.miscDeletions.loadDependencies();
  exports.postingDeletions.loadDependencies();

};