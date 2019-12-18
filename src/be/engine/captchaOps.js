'use strict';

// operations for captcha generation and solving

var url = require('url');
var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var exec = require('child_process').exec;
var captchas = require('../db').captchas();
var crypto = require('crypto');
var taskListener = require('../taskListener');
var logger = require('../logger');
var verbose;
var captchaLimit;
var spamOps;
var forceCaptcha;
var captchaExpiration;
var miscOps;
var imageFont;
var lang;
var uploadHandler;
var formOps;
var gridFsHandler;
var captchaControl = {};

var poolIndex = -1;

// captcha settings
var height = 100;
var width = 300;

// used so distortion doesn't pull points too hard
var distortLimiter = 30;

// used to control how many points are pulled
var minDistorts = 3;
var maxDistorts = 5;

// used to control how many circles are turned negative
var minCircles = 5;
var maxCircles = 10;

// used to control how large the circles can be
var minCircleSize = 15;
var maxCircleSize = 30;

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  imageFont = settings.imageFont;
  captchaLimit = settings.captchaLimit;
  verbose = settings.verbose || settings.verboseMisc;
  forceCaptcha = settings.forceCaptcha;
  captchaExpiration = settings.captchaExpiration;

};

exports.loadDependencies = function() {

  spamOps = require('./spamOps');
  miscOps = require('./miscOps');
  lang = require('./langOps').languagePack;
  uploadHandler = require('./uploadHandler');
  formOps = require('./formOps');
  gridFsHandler = require('./gridFsHandler');

};

// Section 1: Captcha generation {
exports.getBaseDistorts = function() {
  var distorts = [];

  distorts.push({
    origin : {
      x : 0,
      y : 0
    },
    destiny : {
      x : 0,
      y : 0
    }
  });

  distorts.push({
    origin : {
      x : 0,
      y : height
    },
    destiny : {
      x : 0,
      y : height
    }
  });

  distorts.push({
    origin : {
      x : width,
      y : 0
    },
    destiny : {
      x : width,
      y : 0
    }
  });

  distorts.push({
    origin : {
      x : width,
      y : height
    },
    destiny : {
      x : width,
      y : height
    }
  });

  return distorts;
};

exports.getDistorts = function() {

  var distorts = exports.getBaseDistorts(width, height);

  var amountOfDistorts = miscOps.getRandomInt(minDistorts, maxDistorts);
  var portionSize = width / amountOfDistorts;

  for (var i = 0; i < amountOfDistorts; i++) {
    var distortOrigin = {
      x : miscOps.getRandomInt(portionSize * i, portionSize * (1 + i)),
      y : miscOps.getRandomInt(0, height)
    };

    var minWidthDestiny = distortOrigin.x - distortLimiter;
    var minHeightDestiny = distortOrigin.y - distortLimiter;

    var distortLimitX = distortOrigin.x + distortLimiter;
    var distortLimitY = distortOrigin.y + distortLimiter;

    var distortDestination = {
      x : miscOps.getRandomInt(minWidthDestiny, distortLimitX),
      y : miscOps.getRandomInt(minHeightDestiny, distortLimitY)
    };

    var distort = {
      origin : distortOrigin,
      destiny : distortDestination
    };

    distorts.push(distort);
  }

  return distorts;

};

exports.distortImage = function() {

  var distorts = exports.getDistorts();

  var command = '-distort Shepards \'';

  for (var i = 0; i < distorts.length; i++) {

    var distort = distorts[i];

    if (i) {
      command += '  ';
    }

    command += distort.origin.x + ',' + distort.origin.y + ' ';
    command += distort.destiny.x + ',' + distort.destiny.y;

  }

  return command + '\' ';

};

exports.transferToGfs = function(result, id, callback) {

  var expiration = new Date();
  expiration.setUTCMinutes(expiration.getUTCMinutes() + captchaExpiration);

  var finalPath = '/.global/captchas/' + id;

  gridFsHandler.writeData(Buffer.from(result, 'binary'), finalPath,
      'image/jpeg', {
        type : 'captcha',
        expiration : expiration
      }, callback);

};

exports.createMask = function(text) {

  var command = 'convert -size 300x100 xc: -draw \"';

  for (var i = 0; i < miscOps.getRandomInt(minCircles, maxCircles); i++) {

    var start = {
      x : miscOps.getRandomInt(width * 0.1, width * 0.9),
      y : miscOps.getRandomInt(height * 0.1, height * 0.9)
    };

    var size = miscOps.getRandomInt(minCircleSize, maxCircleSize);

    var end = {
      x : miscOps.getRandomInt(start.x, start.x + size),
      y : miscOps.getRandomInt(start.y, start.y + size),
    };

    if (i) {
      command += ' ';
    }

    command += 'circle ' + start.x + ',' + start.y + ' ' + end.x + ',' + end.y;

  }

  command += '\" -write mpr:mask +delete ';

  return command;

};

exports.generateImage = function(text, captchaData, callback) {

  var command = exports.createMask();

  command += 'xc: -pointsize 70 -gravity center -font ' + imageFont + ' -draw ';
  command += '\"text 0,0 \'' + text + '\'\" -write mpr:original +delete ';

  command += 'mpr:original -negate -write mpr:negated +delete';

  command += ' mpr:negated mpr:original mpr:mask -composite ';
  command += exports.distortImage() + ' -blur 0x1 jpg:-';

  exec(command, {
    encoding : 'binary',
    maxBuffer : Infinity
  }, function generatedImage(error, result) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      exports.transferToGfs(result, captchaData._id, function saved(error) {
        callback(error, captchaData);
      });
      // style exception, too simple

    }

  });

};

exports.createCaptcha = function(callback, pool) {

  var text = crypto.createHash('sha256').update(Math.random() + new Date())
      .digest('hex').substring(0, 6);

  var expiration = new Date();
  expiration.setUTCMinutes(expiration.getUTCMinutes() + captchaExpiration);

  var toInsert = {
    answer : text,
    expiration : expiration,
    pool : pool
  };

  captchas.insertOne(toInsert, function(error) {

    if (error) {
      callback(error);
    } else {
      exports.generateImage(text, toInsert, callback);
    }
  });

};

exports.checkFlood = function(req, callback) {

  taskListener.openSocket(function opened(error, socket) {

    if (error) {
      callback(error);
      return;
    }

    socket.onData = function receivedData(data) {

      if (data.exceeded) {
        callback(lang(req.language).errCaptchaLimitExceeded);
      } else {
        exports.createCaptcha(callback);
      }

      taskListener.freeSocket(socket);
    };

    taskListener.sendToSocket(socket, {
      type : 'checkCaptchaLimit',
      ip : logger.getRawIp(req)
    });

  });

};

exports.getFromPool = function(callback) {

  poolIndex++;

  if (poolIndex > captchaLimit) {
    poolIndex = 0;
  }

  captchas.find({
    pool : true,
    expiration : {
      $gt : new Date()
    },
    answer : {
      $ne : null
    }
  }).skip(poolIndex).limit(1).toArray(function(error, captcha) {

    if (error) {
      callback(error);
    } else if (!captcha.length) {
      exports.checkPool(callback);
    } else {
      callback(null, captcha[0]);
    }

  });

};

exports.checkPool = function(callback) {

  captchas.countDocuments({
    pool : true,
    expiration : {
      $gt : new Date()
    },
    answer : {
      $ne : null
    }
  }, function(error, amount) {

    if (error) {
      callback(error);
    } else if (amount < captchaLimit) {
      exports.createCaptcha(callback, true);
    } else {
      exports.getFromPool(callback);
    }

  });

};

exports.generateCaptcha = function(req, callback) {

  if (req.isOnion) {
    return exports.checkPool(callback);
  } else if (req.isTor) {
    return exports.checkFlood(req, callback);
  }

  spamOps.checkDnsbl(logger.ip(req), function checked(error, spammer) {

    if (error) {
      callback(error);
    } else if (spammer) {
      exports.checkPool(callback);
    } else {
      exports.checkFlood(req, callback);
    }

  });

};
// } Section 1: Captcha generation

exports.checkCaptchaLimit = function(ip, socket) {

  var now = new Date();

  var expiration = new Date();
  expiration.setUTCMinutes(expiration.getUTCMinutes() + 1);

  var newData = {
    count : 0,
    expiration : expiration
  };

  var data = captchaControl[ip] || newData;

  captchaControl[ip] = data;

  if (data.count < captchaLimit || data.expiration < now) {
    data.count++;

    if (data.expiration < now) {
      captchaControl[ip] = newData;
    }

    taskListener.sendToSocket(socket, {
      exceeded : false
    });

  } else {

    taskListener.sendToSocket(socket, {
      exceeded : true
    });

  }

};

exports.cleanCaptchaControl = function() {

  var now = new Date();

  var keys = Object.keys(captchaControl);

  for (var i = 0; i < keys.length; i++) {

    var key = keys[i];

    if (captchaControl[key].expiration < now) {
      delete captchaControl[key];
    }

  }

};

exports.checkForCaptcha = function(req, callback) {

  var cookies = formOps.getCookies(req);

  if (!cookies.captchaid) {
    callback();
    return;
  }

  try {
    cookies.captchaid = new ObjectID(cookies.captchaid);
  } catch (error) {
    callback(error);
    return;
  }

  captchas.findOne({
    _id : cookies.captchaid,
    expiration : {
      $gt : new Date()
    }
  }, callback);

};

// Section 2: Captcha consumption {
// solves and invalidates a captcha
exports.isCaptchaSolved = function(captcha, input) {

  if (captcha.value) {
    return !captcha.value.answer || captcha.value.answer === input;
  }

};

exports.dispensesCaptcha = function(board, thread) {

  if (!board || forceCaptcha) {
    return;
  }

  var captchaMode = board.captchaMode || 0;

  if (captchaMode < 1 || (captchaMode < 2 && thread)) {

    if (verbose) {
      console.log('Captcha disabled');
    }

    return true;
  }

};

exports.attemptCaptcha = function(id, input, board, language, cb, thread) {

  if (exports.dispensesCaptcha(board, thread)) {
    cb();
    return;
  }

  input = (input || '').toString().trim().toLowerCase();

  if (input.length === 24) {
    id = input;
    if (verbose) {
      console.log('Using pre-solved captcha ' + id);
    }
  } else {
    if (verbose) {
      console
          .log('Attempting to solve captcha ' + id + ' with answer ' + input);
    }
  }

  try {
    id = new ObjectID(id);
  } catch (error) {
    cb(lang(language).errExpiredCaptcha);
    return;
  }

  captchas.findOneAndDelete({
    _id : id,
    expiration : {
      $gt : new Date()
    }
  }, function gotCaptcha(error, captcha) {

    if (error) {
      cb(error);
    } else if (exports.isCaptchaSolved(captcha, input)) {
      cb();
    } else if (!captcha.value) {
      cb(lang(language).errExpiredCaptcha);
    } else {
      cb(lang(language).errWrongCaptcha);
    }

  });

};
// } Section 2: Captcha consumption

// solves a captcha without invalidating it
exports.solveCaptcha = function(parameters, language, callback) {

  try {
    parameters.captchaId = new ObjectID(parameters.captchaId);
  } catch (error) {
    callback(lang(language).errExpiredOrWrongCaptcha);
    return;
  }

  captchas.findOneAndUpdate({
    _id : parameters.captchaId,
    answer : (parameters.answer || '').toString().trim().toLowerCase(),
    expiration : {
      $gt : new Date()
    }
  }, {
    $unset : {
      answer : true
    },
    $set : {
      expiration : new Date(new Date().getTime() + 1000 * 60 * 60)
    }
  }, function gotCaptcha(error, captcha) {

    if (error) {
      callback(error);
    } else if (!captcha.value) {
      callback(lang(language).errExpiredOrWrongCaptcha);
    } else {
      callback();
    }

  });

};