'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var bypasses = db.bypasses();
var settings = require('../settingsHandler').getGeneralSettings();
var expirationToAdd = 1000 * 60 * 60 * settings.bypassDurationHours;
var captchaOps;

exports.loadDependencies = function() {

  captchaOps = require('./captchaOps');

};

exports.renewBypass = function(captchaId, captchaInput, callback) {

  captchaOps.attemptCaptcha(captchaId, captchaInput, null, function solved(
      error) {

    if (error) {
      callback(error);
    } else {

      var newBypass = {
        usesLeft : settings.bypassMaxPosts,
        expiration : new Date(new Date().getTime() + expirationToAdd)
      };

      // style exception, too simple
      bypasses.insert(newBypass, function inserted(error) {
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

  if (!settings.bypassMode) {
    callback();
    return;
  }

  if (!bypassId || !bypassId.length) {
    callback();
    return;
  }

  try {

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
      }
    }, function updatedPass(error, result) {

      if (error) {
        callback(error);
      } else {

        if (result.value) {
          req.bypassed = true;
        }

        callback(null, req);

      }

    });

  } catch (error) {
    callback(error);
  }

};