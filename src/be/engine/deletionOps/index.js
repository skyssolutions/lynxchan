'use strict';

exports.miscDeletions = require('./miscDelOps');
exports.postingDeletions = require('./postingDelOps');

exports.loadDependencies = function() {

  exports.miscDeletions.loadDependencies();
  exports.postingDeletions.loadDependencies();

};