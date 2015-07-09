'use strict';

// Handles language
var fs = require('fs');
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var verbose = settings.verbose;
var debug = boot.debug();

var languagePack = {};

exports.languagePack = function() {

  if (!languagePack) {
    exports.init();
  }

  return languagePack;
};

function processObject(defaultObject, chosenObject, missingKeys) {
  for ( var key in defaultObject) {
    if (!chosenObject[key]) {
      missingKeys.push(key);
      chosenObject[key] = defaultObject[key];
    } else if (typeof (defaultObject[key]) === 'object') {
      processObject(defaultObject[key], chosenObject[key], missingKeys);
    }
  }
}

function loadLanguagePack(defaultPack) {

  var chosenPack = JSON.parse(fs.readFileSync(settings.languagePackPath));

  var missingKeys = [];

  processObject(defaultPack, chosenPack, missingKeys);

  if (missingKeys.length) {
    console.log('There are missing keys from the chosen language pack.');

    if (verbose) {
      for (var i = 0; i < missingKeys.length; i++) {
        console.log(missingKeys[i]);
      }
    }

    if (debug) {
      throw 'Add these keys or run without debug mode.';
    }

  }

  languagePack = chosenPack;
}

exports.init = function() {

  var defaultLanguagePath = __dirname + '/../defaultLanguagePack.json';

  var defaultPack = JSON.parse(fs.readFileSync(defaultLanguagePath));

  if (settings.languagePackPath) {
    loadLanguagePack(defaultPack);
  } else {
    languagePack = defaultPack;
  }

};