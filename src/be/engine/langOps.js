'use strict';

// Handles language
var fs = require('fs');
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var verbose = settings.verbose;
var debug = boot.debug();

var languagePack = {};

exports.loadDependencies = function() {
};

exports.languagePack = function() {

  if (!languagePack) {
    exports.init();
  }

  return languagePack;
};

function processArray(defaultObject, chosenObject, missingKeys, currentKey) {

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
      processArray(defaultObject[i], chosenObject[i], missingKeys, nextKey);
    } else if (typeof (defaultObject[i]) === 'object') {
      processObject(defaultObject[i], chosenObject[i], missingKeys, nextKey);
    }
  }

}

function processObject(defaultObject, chosenObject, missingKeys, currentKey) {
  for ( var key in defaultObject) {

    var isArray = Object.prototype.toString.call(defaultObject[key]);
    isArray = isArray === '[object Array]';
    // Because fuck people being able to tell an object from an array, right?

    var next = (currentKey ? currentKey + '.' : '') + key;

    if (!chosenObject[key]) {
      missingKeys.push(next);
      chosenObject[key] = defaultObject[key];
    } else if (isArray) {
      processArray(defaultObject[key], chosenObject[key], missingKeys, next);
    } else if (typeof (defaultObject[key]) === 'object') {
      processObject(defaultObject[key], chosenObject[key], missingKeys, next);
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