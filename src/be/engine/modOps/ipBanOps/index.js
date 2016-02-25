'use strict';

exports.specific = require('./specificOps');
exports.general = require('./generalOps');
exports.versatile = require('./versatileOps');

exports.loadSettings = function() {

  exports.specific.loadSettings();
  exports.versatile.loadSettings();
  exports.general.loadSettings();

};

exports.loadDependencies = function() {

  exports.specific.loadDependencies();
  exports.general.loadDependencies();
  exports.versatile.loadDependencies();

};