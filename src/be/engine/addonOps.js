'use strict';

// operations regarding addons

var fs = require('fs');
var engineInfo = require('../package.json');
var addons;
var verbose;
var loaded = [];
exports.aliases = {};

exports.getEngineInfo = function() {
  return engineInfo;
};

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;
  addons = settings.addons;

  exports.loadAddonSettings();

};

exports.loadAddonSettings = function() {

  for (var i = 0; i < loaded.length; i++) {

    try {

      var addon = require('../addons/' + loaded[i]);

      if (addon.hasOwnProperty('loadSettings')) {
        addon.loadSettings();
      }

    } catch (error) {

      console.log('Could not load settings for addon ' + loaded[i]);

      if (verbose) {
        console.log(error);
      }

    }

  }

};

exports.versionsMatch = function(addonVersion, engineVersion) {

  addonVersion = addonVersion.split('.');
  engineVersion = engineVersion.split('.');

  for (var i = 0; i < addonVersion.length; i++) {
    if (addonVersion[i] !== engineVersion[i]) {
      return false;
    }
  }

  return true;
};

exports.testVersion = function(addonName, addonVersion, engineVersion) {

  if (!exports.versionsMatch(addonVersion, engineVersion)) {

    var msg = 'Engine version mismatch for addon ' + addonName;
    msg += '\nAddon engine version: ' + addonVersion + '\nEngine version: ';
    msg += engineVersion;

    if (verbose) {
      console.log(msg);
    }

  }

};

exports.initAddons = function() {

  for (var i = 0; i < loaded.length; i++) {

    var addon = loaded[i];

    try {
      require('../addons/' + addon).init();
    } catch (error) {

      console.log('Could not initialize addon ' + addon);

      if (verbose) {
        console.log(error);
      }

    }

  }

};

exports.testAddons = function(addons) {

  loaded = [];

  for (var i = 0; i < addons.length; i++) {

    var addon = addons[i];

    try {

      var loadedAddon = require('../addons/' + addon);

      if (loadedAddon.requestAlias) {
        exports.aliases[loadedAddon.requestAlias] = addon;
      }

      if (verbose) {

        exports.testVersion(addon, loadedAddon.engineVersion,
            engineInfo.version);
      }

      loaded.push(addon);

    } catch (error) {

      console.log('Could not load addon ' + addon);

      if (verbose) {
        console.log(error);
      }

    }

  }

};

exports.startAddons = function() {

  if (!addons || !addons.length) {
    return;
  }

  exports.testAddons(addons);

  exports.initAddons();

  exports.loadAddonSettings();

};