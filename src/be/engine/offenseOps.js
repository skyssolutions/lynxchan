'use strict';

var logger = require('../logger');
var db = require('../db');
var latestOps;
var offenseRecords = db.offenseRecords();
var threads = db.threads();
var posts = db.posts();
var lang;
var clearIpMinRole;

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();
  clearIpMinRole = settings.clearIpMinRole;

};

exports.loadDependencies = function() {

  lang = require('./langOps').languagePack;
  latestOps = require('./boardOps').latest;

};

exports.runReadQuery = function(ip, callback) {

  offenseRecords.find({
    ip : ip
  }, {
    projection : {
      _id : 0,
      ip : 0
    }
  }).toArray(callback);

};

exports.getOffenses = function(userData, parameters, language, callback) {

  if (parameters.ip && userData.globalRole <= clearIpMinRole) {
    return exports.runReadQuery(logger.convertIpToArray(parameters.ip),
        callback);
  }

  if (!latestOps.canSearchPerPost(parameters, userData)) {
    return callback(lang(language).errDeniedOffenseHistory);
  }

  var query = {
    boardUri : parameters.boardUri
  };

  var fieldToUse = parameters.threadId ? 'threadId' : 'postId';

  query[fieldToUse] = +(parameters.threadId || parameters.postId);

  (parameters.threadId ? threads : posts).findOne(query, {
    _id : 0,
    ip : 1
  }, function(error, posting) {

    if (error || !posting || !posting.ip) {
      callback(error, []);
    } else {
      exports.runReadQuery(posting.ip, callback);
    }

  });

};