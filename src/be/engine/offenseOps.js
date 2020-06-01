'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var logger = require('../logger');
var db = require('../db');
var latestOps;
var bans = db.bans();
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

exports.runReadQuery = function(ip, bypassId, callback) {

  var orList = [];

  if (ip) {
    orList.push({
      ip : ip
    });
  }

  if (bypassId) {
    orList.push({
      bypassId : bypassId
    });
  }

  offenseRecords.find({
    $or : orList
  }, {
    projection : {
      _id : 0,
      ip : 0,
      bypassId : 0
    }
  }).toArray(callback);

};

exports.fetchBan = function(userData, parameters, language, callback) {

  try {
    var banId = new ObjectID(parameters.banId);
  } catch (error) {
    return callback(null, []);
  }

  bans.findOne({
    _id : banId
  }, function(error, ban) {

    if (error) {
      callback(error);
    } else if (!latestOps.canSearchPerBan(ban, userData)) {
      callback(lang(language).errDeniedOffenseHistory);
    } else {
      exports.runReadQuery(ban.ip, ban.bypassId, callback);
    }
  });

};

exports.getOffenses = function(userData, parameters, language, callback) {

  if (parameters.ip && userData.globalRole <= clearIpMinRole) {
    return exports.runReadQuery(logger.convertIpToArray(parameters.ip), null,
        callback);
  }

  if (parameters.banId) {
    return exports.fetchBan(userData, parameters, language, callback);
  } else if (!latestOps.canSearchPerPost(parameters, userData)) {
    return callback(lang(language).errDeniedOffenseHistory);
  }

  var query = {
    boardUri : parameters.boardUri
  };

  var fieldToUse = parameters.threadId ? 'threadId' : 'postId';

  query[fieldToUse] = +(parameters.threadId || parameters.postId);

  (parameters.threadId ? threads : posts).findOne(query, {
    _id : 0,
    ip : 1,
    bypassId : 1
  }, function(error, posting) {

    if (error || !posting || (!posting.ip && !posting.bypassId)) {
      callback(error, []);
    } else {
      exports.runReadQuery(posting.ip, posting.bypassId, callback);
    }

  });

};