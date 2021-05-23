'use strict';

var db = require('../db');
var thumbs = db.thumbs();
var lang;

exports.loadDependencies = function() {
  lang = require('./langOps').languagePack;
};

exports.getData = function(userData, language, callback) {

  var global = userData.globalRole < 2;

  if (!global) {
    return callback(lang(language).errDeniedThumbManagement);
  }

  thumbs.find().toArray(callback);

};