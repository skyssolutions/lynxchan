'use strict';

// Handles the language package and alternative languages

var fs = require('fs');
var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var debug = require('../kernel').debug();
var dbLanguages = require('../db').languages();
var verbose;

var languagePack;
var alternativeLanguages = {};

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  verbose = settings.verbose || settings.verboseMisc;
};

exports.getAlternativeLanguagePack = function(language) {

  var toReturn = alternativeLanguages[language._id];

  if (!toReturn) {

    try {

      exports.init(language);

      toReturn = alternativeLanguages[language._id];
    } catch (error) {
      if (debug) {
        throw error;
      }
    }
  }

  return toReturn;

};

exports.languagePack = function(language) {

  if (language) {

    var toReturn = exports.getAlternativeLanguagePack(language);

  }

  if (!toReturn) {

    if (!languagePack) {
      exports.init();
    }

    toReturn = languagePack;
  }

  return toReturn;
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

  return chosenPack;
};

exports.init = function(language) {

  var defaultLanguagePath = __dirname + '/../defaultLanguagePack.json';

  var defaultPack = JSON.parse(fs.readFileSync(defaultLanguagePath));

  if (language) {

    if (verbose) {
      console
          .log('Loading alternative language pack: ' + language.headerValues);
    }

    alternativeLanguages[language._id] = exports.loadLanguagePack(defaultPack,
        language.languagePack);

  } else {

    var settings = require('../settingsHandler').getGeneralSettings();

    var languagePackPath = settings.languagePackPath;

    if (languagePackPath) {
      languagePack = exports.loadLanguagePack(defaultPack, languagePackPath);
    } else {
      languagePack = defaultPack;
    }
  }

};

exports.getLanguagesData = function(userRole, callback) {

  var admin = userRole <= 1;

  if (!admin) {
    callback(languagePack.errDeniedLanguageManagement);
    return;
  }

  dbLanguages.find({}).toArray(callback);

};

exports.addLanguage = function(userRole, parameters, callback) {

  var admin = userRole <= 1;

  if (!admin) {
    callback(languagePack.errDeniedLanguageManagement);
    return;
  }

  dbLanguages.insertOne({
    frontEnd : parameters.frontEnd.trim(),
    languagePack : parameters.languagePack.trim(),
    headerValues : parameters.headerValues
  }, callback);

};

exports.deleteLanguage = function(userRole, languageId, callback) {

  var admin = userRole <= 1;

  if (!admin) {
    callback(languagePack.errDeniedLanguageManagement);
    return;
  }

  try {

    dbLanguages.deleteOne({
      _id : new ObjectID(languageId)
    }, callback);

  } catch (error) {
    callback(error);
  }

};

exports.dropCache = function() {

  languagePack = null;
  alternativeLanguages = {};

};