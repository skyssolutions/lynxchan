'use strict';

// Handles the language package and alternative languages

var fs = require('fs');
var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var dbLanguages = require('../db').languages();
var verbose;
var languagePackPath;
var languagePack;
var alternativeLanguages = {};

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  if (languagePackPath !== settings.languagePackPath) {
    exports.init();
  }

  verbose = settings.verbose || settings.verboseMisc;
};

exports.getAlternativeLanguagePack = function(language) {

  var toReturn = alternativeLanguages[language._id];

  if (!toReturn) {

    try {

      exports.init(language);

      toReturn = alternativeLanguages[language._id];
    } catch (error) {
      if (verbose) {
        console.log(error);
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

    var nextKey = currentKey + '.' + i;

    if (Array.isArray(defaultObject[i])) {
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

    var next = (currentKey ? currentKey + '.' : '') + key;

    if (!chosenObject[key]) {
      missingKeys.push(next);
      chosenObject[key] = defaultObject[key];
    } else if (Array.isArray(defaultObject[key])) {
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

  }

  return chosenPack;
};

exports.init = function(language) {

  var defaultLanguagePath = __dirname + '/../data/defaultLanguagePack.json';

  var defaultPack = require(defaultLanguagePath);

  if (language) {

    if (verbose) {
      console
          .log('Loading alternative language pack: ' + language.headerValues);
    }

    alternativeLanguages[language._id] = exports.loadLanguagePack(defaultPack,
        language.languagePack);

  } else {

    var settings = require('../settingsHandler').getGeneralSettings();

    languagePackPath = settings.languagePackPath;

    if (languagePackPath) {
      languagePack = exports.loadLanguagePack(defaultPack, languagePackPath);
    } else {
      languagePack = defaultPack;
    }
  }

};

exports.getLanguagesData = function(userRole, language, callback) {

  var admin = userRole <= 1;

  if (!admin) {
    callback(exports.languagePack(language).errDeniedLanguageManagement);
    return;
  }

  dbLanguages.find({}).toArray(callback);

};

exports.addLanguage = function(userRole, parameters, language, callback) {

  var admin = userRole <= 1;

  if (!admin) {
    callback(exports.languagePack(language).errDeniedLanguageManagement);
    return;
  }

  var newLanguage = {
    frontEnd : parameters.frontEnd.trim(),
    languagePack : parameters.languagePack.trim(),
    headerValues : parameters.headerValues
  };

  dbLanguages.insertOne(newLanguage, function(error) {
    callback(error, newLanguage._id);
  });

};

exports.deleteLanguage = function(userRole, languageId, language, callback) {

  var admin = userRole <= 1;

  if (!admin) {
    callback(exports.languagePack(language).errDeniedLanguageManagement);
    return;
  }

  try {
    languageId = new ObjectID(languageId);
  } catch (error) {
    callback();
    return;
  }

  dbLanguages.deleteOne({
    _id : languageId
  }, callback);

};

exports.dropCache = function() {

  languagePack = null;
  alternativeLanguages = {};

};