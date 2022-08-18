'use strict';

var crypto = require('crypto');
var mongo = require('mongodb');
var ObjectID = mongo.ObjectId;
var db = require('../db');
var lang;
var bypasses = db.bypasses();
var expirationToAdd;
var captchaOps;
var floodDisabled;
var floodExpiration;
var bypassMaxPosts;
var bypassMode;
var hourlyLimit;
var validationRange;
var versatileOps;

exports.loadSettings = function() {
  var settings = require('../settingsHandler').getGeneralSettings();

  floodExpiration = settings.floodTimerSec;
  hourlyLimit = 600 / floodExpiration;
  bypassMaxPosts = settings.bypassMaxPosts;
  bypassMode = settings.bypassMode;
  floodDisabled = settings.disableFloodCheck;
  validationRange = settings.bypassValidationRange;
  expirationToAdd = settings.bypassDurationHours;
};

exports.loadDependencies = function() {

  captchaOps = require('./captchaOps');
  lang = require('./langOps').languagePack;
  versatileOps = require('./modOps').ipBan.versatile;

};

// Section 1: Renew bypass {
exports.createBypassDoc = function(session, validationCode, validationResult,
    callback) {

  var expiration = new Date();
  expiration.setUTCHours(expiration.getUTCHours() + expirationToAdd);

  var toInsert = {
    session : session,
    creation : new Date(),
    unused : true,
    validationCode : validationCode,
    validationHash : validationResult,
    usesLeft : bypassMaxPosts,
    expiration : expiration
  };

  // style exception, too simple
  bypasses.insertOne(toInsert, function inserted(error, results) {
    callback(error, toInsert, session, validationResult);
  });
  // style exception, too simple

};

exports.getValidationResult = function(session, callback) {

  var validationCode = crypto.randomInt(validationRange).toString();

  crypto.pbkdf2(session, validationCode, 16384, 256, 'SHA512', function(error,
      result) {

    if (error) {
      callback(error);
    } else {
      exports.createBypassDoc(session, validationCode, result
          .toString('base64'), callback);
    }

  });

};

exports.renewBypass = function(captchaId, captchaInput, language, callback) {

  if (!bypassMode) {
    return callback(lang(language).errDisabledBypass);
  }

  captchaOps.attemptCaptcha(captchaId, captchaInput, null, language,
      function solved(error) {

        if (error) {
          return callback(error);
        }

        crypto.randomBytes(256, function gotHash(error, buffer) {

          if (error) {
            return callback(error);
          }

          buffer = buffer.toString('base64');

          if (validationRange) {
            exports.getValidationResult(buffer, callback);
          } else {
            exports.createBypassDoc(buffer, null, null, callback);
          }

        });

      });

};
// } Section 1: Renew bypass

// Section 2: Validate bypass
exports.commitBypassValidation = function(bypass, callback) {

  bypasses.updateOne({
    _id : bypass._id
  }, {
    $set : {
      validated : true
    }
  }, function(error) {
    callback(error, bypass);
  });

};

exports.validateBypass = function(bypassId, code, language, callback) {

  if (!bypassId) {
    return callback(lang(language).errBypassNotFound);
  }

  var session = bypassId.substr(24, 344);
  bypassId = bypassId.substr(0, 24);

  try {
    bypassId = new ObjectID(bypassId);
  } catch (error) {
    return callback(lang(language).errBypassNotFound);
  }

  bypasses.findOne({
    _id : bypassId,
    session : session,
  }, function(error, bypass) {

    if (error) {
      return callback(error);
    } else if (!bypass || bypass.validated) {
      return callback(lang(language).errBypassNotFound);
    }

    if (bypass.validationCode === code) {

      exports.commitBypassValidation(bypass, callback);

    } else {

      bypasses.deleteOne({
        _id : bypassId
      }, function() {
        callback(lang(language).errBypassNotFound);
      });

    }

  });

};
// } Section 2: Validate bypass

exports.checkBypass = function(bypassId, callback) {

  if (!bypassId || !bypassMode) {
    return callback();
  }

  var session = bypassId.substr(24, 344);
  bypassId = bypassId.substr(0, 24);

  try {
    bypassId = new ObjectID(bypassId);
  } catch (error) {
    return callback();
  }

  bypasses.findOne({
    _id : bypassId,
    session : session,
    usesLeft : {
      $gt : 0
    },
    expiration : {
      $gt : new Date()
    }
  }, callback);

};

exports.updateHourlyUsage = function(bypass, rate) {

  var block;

  if (!bypass.hourlyLimitEnd || bypass.hourlyLimitEnd < new Date()) {

    var newEnd = new Date();
    newEnd.setUTCHours(newEnd.getUTCHours() + 1);

    block = {
      $set : {
        hourlyLimitEnd : newEnd,
        hourlyLimitCount : rate
      }
    };

  } else {

    block = {
      $inc : {
        hourlyLimitCount : rate
      }
    };

  }

  bypasses.updateOne({
    _id : bypass._id
  }, block, function(error) {

    if (error) {
      console.log(error);
    }

  });

};

exports.getMissingTime = function(result, usageField, now, req) {

  var left = Math
      .ceil((result.value[usageField].getTime() - now.getTime()) / 1000);

  var setBlock = {};

  setBlock[usageField] = result.value[usageField];

  bypasses.updateOne({
    _id : result.value._id
  }, {
    $inc : {
      usesLeft : 1
    },
    $set : setBlock
  }, function(error, data) {
    if (error) {
      console.log(error);
    }

  });

  return lang(req.language).errFlood.replace('{$time}', left);

};

exports.useBypass = function(bypassId, req, callback, thread) {

  if (!bypassMode || !bypassId) {
    return callback();
  }

  var session = bypassId.substr(24, 344);
  bypassId = bypassId.substr(0, 24);

  try {
    bypassId = new ObjectID(bypassId);
  } catch (error) {
    return callback(null, req);
  }

  var nextUse = new Date();

  var usageField = thread ? 'nextThreadUsage' : 'nextUsage';

  var setBlock = {
    unused : false
  };
  setBlock[usageField] = nextUse;

  var multiplierToUse = thread ? versatileOps.threadFloodMultiplier : 1;
  var toAdd = multiplierToUse * floodExpiration;
  nextUse.setUTCSeconds(nextUse.getUTCSeconds() + toAdd);

  bypasses.findOneAndUpdate({
    _id : bypassId,
    session : session,
    $or : [ {
      validated : true
    }, {
      validationCode : null
    } ],
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
    $set : setBlock
  }, function updatedPass(error, result) {

    var errorToReturn;

    var value = result.value || {};

    if (value.hourlyLimitEnd && value.hourlyLimitEnd > new Date()) {
      var limitCheck = value.hourlyLimitCount >= hourlyLimit;
    }

    var now = new Date();

    if (error) {
      errorToReturn = error;
    } else if (!result.value) {
      return callback(null, req);
    } else if (!floodDisabled && result.value[usageField] > now) {

      errorToReturn = exports.getMissingTime(result, usageField, now, req);

    } else if (!floodDisabled && limitCheck) {
      errorToReturn = lang(req.language).errHourlyLimit;
    } else {
      req.bypassed = true;
      req.bypassId = bypassId;

      exports.updateHourlyUsage(result.value, thread ? 10 : 1);

    }

    callback(errorToReturn, req);

  });

};

exports.purgeBypasses = function(userData, parameters, language, callback) {

  var admin = userData.globalRole < 2;

  if (!admin) {
    return callback(lang(language).errDeniedBypassPurge);
  }

  var matchBlock = {};

  if (parameters.unused) {
    matchBlock.unused = true;
  }

  if (parameters.timeLimit) {
    var limit = new Date();

    limit.setUTCHours(limit.getUTCHours() - +parameters.timeLimit);

    matchBlock.creation = {
      $gt : limit
    };
  }

  if (!parameters.confirmation) {

    return bypasses.countDocuments(matchBlock, function(error, count) {

      if (error) {
        callback(error);
      } else {
        callback(lang(language).errBypassPurgeConfirmation.replace('{$count}',
            count));
      }

    });

  }

  bypasses.deleteMany(matchBlock, callback);

};
