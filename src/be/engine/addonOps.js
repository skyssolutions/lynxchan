'use strict';

var fs = require('fs');
var settings = require('../settingsHandler').getGeneralSettings();
var verbose = settings.verbose;
var debug = require('../boot').debug();

exports.loadDependencies = function() {
};

exports.testVersion = function(addonName, addonVersion, engineVersion) {

  if (addonVersion !== engineVersion) {

    var msg = 'Engine version mismatch for addon ' + addonName;
    msg += '\nAddon engine version: ' + addonVersion + '\nEngine version: ';
    msg += engineVersion;

    if (verbose) {
      console.log(msg);
    }

    if (debug) {
      throw msg;
    }

  }

};

exports.startAddons = function() {

  var engineInfo = JSON.parse(fs.readFileSync(__dirname + '/../package.json'));

  if (!settings.addons || !settings.addons.length) {
    return;
  }

  var addons = settings.addons;

  for (var i = 0; i < addons.length; i++) {

    var addon = addons[i];

    try {

      var loadedAddon = require('../addons/' + addon);

      if (verbose || debug) {

        exports.testVersion(addon, loadedAddon.engineVersion,
            engineInfo.version);
      }

    } catch (error) {

      console.log('Could not load addon ' + addon);

      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }

    }

  }

  for (i = 0; i < addons.length; i++) {

    addon = addons[i];

    try {

      require('../addons/' + addon).init();
    } catch (error) {

      console.log('Could not initialize addon ' + addon);

      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }

    }

  }

};