'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var lang;
var bypasses = db.bypasses();
var expirationToAdd;
var captchaOps;
var floodDisabled;
var floodExpiration;
var bypassMaxPosts;
var bypassMode;

exports.loadSettings = function() {
  var settings = require('../settingsHandler').getGeneralSettings();

  floodExpiration = settings.floodTimerSec;
  bypassMaxPosts = settings.bypassMaxPosts;
  bypassMode = settings.bypassMode;
  floodDisabled = settings.disableFloodCheck;
  expirationToAdd = 1000 * 60 * 60 * settings.bypassDurationHours;
};

exports.loadDependencies = function() {

  captchaOps = require('./captchaOps');
  lang = require('./langOps').languagePack;

};

exports.renewBypass = function(captchaId, captchaInput, language, callback) {

  captchaOps.attemptCaptcha(captchaId, captchaInput, null, language,
      function solved(error) {

        if (error) {
          callback(error);
        } else {

          var newBypass = {
            usesLeft : bypassMaxPosts,
            expiration : new Date(new Date().getTime() + expirationToAdd)
          };

          // style exception, too simple
          bypasses.insertOne(newBypass, function inserted(error) {
            if (error) {
              callback(error);
            } else {
              callback(null, newBypass._id);
            }
          });
          // style exception, too simple

        }

      });

};

exports.checkBypass = function(bypassId, callback) {

  if (!bypassId || !bypassId.length) {
    callback();
    return;
  }

  try {

    bypasses.findOne({
      _id : new ObjectID(bypassId),
      usesLeft : {
        $gt : 0
      },
      expiration : {
        $gt : new Date()
      }
    }, callback);

  } catch (error) {
    callback(error);
  }
};

exports.useBypass = function(bypassId, req, callback) {

  if (!bypassMode) {
    callback();
    return;
  }

  if (!bypassId || !bypassId.length) {
    callback();
    return;
  }

  try {

    var nextUse = new Date();

    nextUse.setUTCSeconds(nextUse.getUTCSeconds() + floodExpiration);

    bypasses.findOneAndUpdate({
      _id : new ObjectID(bypassId),
      usesLeft : {
        $gt : 0
      },
      expiration : {
        $gt : new Date()
      }
    }, {
      $inc : {
        usesLeft : -1
      },
      $set : {
        nextUsage : nextUse
      }
    }, function updatedPass(error, result) {

      var errorToReturn;

      if (error) {
        errorToReturn = error;
      } else if (!result.value) {
        callback(null, req);
        return;
      } else if (!floodDisabled && result.value.nextUsage > new Date()) {
        errorToReturn = lang(req.language).errFlood;
      } else {
        req.bypassed = true;
      }

      callback(errorToReturn, req);

    });

  } catch (error) {
    callback(error);
  }

};