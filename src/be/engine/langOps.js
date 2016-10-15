'use strict';

// Handles the language package

var fs = require('fs');
var debug = require('../kernel').debug();
var verbose;

var languagePack = {};

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  verbose = settings.verbose;
};

exports.languagePack = function() {

  if (!languagePack) {
    exports.init();
  }

  return languagePack;
};

exports.processArray = function(defaultObject, chosenObject, missingKeys,
    currentKey) {

  var missingElementsCount = defaultObject.length - chosenObject.length;

  if (missingElementsCount) {
    missingKeys.push(missingElementsCount + ' elements on ' + currentKey);

    for (var i = chosenObject.length; i < defaultObject.length; i++) {
      chosenObject.push(defaultObject.length[i]);
    }
  }

  for (i = 0; i < defaultObject.length; i++) {

    var isArray = Object.prototype.toString.call(defaultObject[i]);
    isArray = isArray === '[object Array]';
    // Because fuck people being able to tell an object from an array, right?

    var nextKey = currentKey + '.' + i;

    if (isArray) {
      exports.processArray(defaultObject[i], chosenObject[i], missingKeys,
          nextKey);
    } else if (typeof (defaultObject[i]) === 'object') {
      exports.processObject(defaultObject[i], chosenObject[i], missingKeys,
          nextKey);
    }
  }

};

exports.processObject = function(defaultObject, chosenObject, missingKeys,
    currentKey) {
  for ( var key in defaultObject) {

    var isArray = Object.prototype.toString.call(defaultObject[key]);
    isArray = isArray === '[object Array]';
    // Because fuck people being able to tell an object from an array, right?

    var next = (currentKey ? currentKey + '.' : '') + key;

    if (!chosenObject[key]) {
      missingKeys.push(next);
      chosenObject[key] = defaultObject[key];
    } else if (isArray) {
      exports.processArray(defaultObject[key], chosenObject[key], missingKeys,
          next);
    } else if (typeof (defaultObject[key]) === 'object') {
      exports.processObject(defaultObject[key], chosenObject[key], missingKeys,
          next);
    }
  }
};

exports.loadLanguagePack = function(defaultPack, languagePackPath) {

  var chosenPack = JSON.parse(fs.readFileSync(languagePackPath));

  var missingKeys = [];

  exports.processObject(defaultPack, chosenPack, missingKeys);

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
};

exports.init = function() {

  var defaultLanguagePath = __dirname + '/../defaultLanguagePack.json';

  var defaultPack = JSON.parse(fs.readFileSync(defaultLanguagePath));

  var settings = require('../settingsHandler').getGeneralSettings();

  var languagePackPath = settings.languagePackPath;

  if (languagePackPath) {
    exports.loadLanguagePack(defaultPack, languagePackPath);
  } else {
    languagePack = defaultPack;
  }

};