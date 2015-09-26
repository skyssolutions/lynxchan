'use strict';

// operations for captcha generation and solving

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var settings = require('../settingsHandler').getGeneralSettings();
var verbose = settings.verbose;
var forceCaptcha = settings.forceCaptcha;
var logger = require('../logger');
var exec = require('child_process').exec;
var im = require('gm').subClass({
  imageMagick : true
});
var captchas = require('../db').captchas();
var crypto = require('crypto');
var boot = require('../boot');
var captchaExpiration = settings.captchaExpiration;
var tempDirectory = settings.tempDirectory;
var url = require('url');
var miscOps;
var lang;
var uploadHandler;
var formOps;
var gridFsHandler;

// captcha settings
var fonts = settings.captchaFonts || [];
var bgColor = '#ffffff';
var fontSize = 70;

// color range so they are not too clear in the white background
var minColor = 125;
var maxColor = 175;

var height = 100;
var width = 300;

// used so lines will always run across the captcha
var minLineX = width / 4;
var maxLineX = width - minLineX;

// used so distortion doesn't pull points too hard
var distortLimiter = 30;

// used to control how many points are pulled
var minDistorts = 3;
var maxDistorts = 5;

// used to control how many circles are draw on the background
var minCircles = 10;
var maxCircles = 15;

// used to control how large the circles can be
var minCircleSize = 25;
var maxCircleSize = 50;

var minLines = 1;
var maxLines = 3;
var lineWidth = 2;
var noise = 'multiplicative';

exports.loadDependencies = function() {

  miscOps = require('./miscOps');
  lang = require('./langOps').languagePack();
  uploadHandler = require('./uploadHandler');
  formOps = require('./formOps');
  gridFsHandler = require('./gridFsHandler');

};

exports.getRandomColor = function() {
  var red = miscOps.getRandomInt(minColor, maxColor).toString(16);
  var green = miscOps.getRandomInt(minColor, maxColor).toString(16);
  var blue = miscOps.getRandomInt(minColor, maxColor).toString(16);

  if (red.length === 1) {
    red = '0' + red;
  }

  if (green.length === 1) {
    green = '0' + green;
  }

  if (blue.length === 1) {
    blue = '0' + blue;
  }

  return '#' + red + green + blue;

};

// start of generation
exports.addLines = function(path, id, callback) {

  var image = im(path).stroke(exports.getRandomColor(), lineWidth);

  for (var i = 0; i < miscOps.getRandomInt(minLines, maxLines); i++) {

    image.drawLine(miscOps.getRandomInt(0, minLineX), miscOps.getRandomInt(0,
        height), miscOps.getRandomInt(maxLineX, width), miscOps.getRandomInt(0,
        height));

  }

  image.write(path, function wrote(error) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      gridFsHandler.writeFile(path, id + '.jpg', 'image/jpeg', {
        type : 'captcha',
        expiration : logger.addMinutes(new Date(), captchaExpiration)
      }, function wroteToGfs(error) {
        callback(error);

      });
      // style exception, too simple
    }

  });

};

exports.distortImage = function(path, id, distorts, callback) {

  var command = 'mogrify -distort Shepards \'';

  for (var i = 0; i < distorts.length; i++) {

    var distort = distorts[i];

    if (i) {
      command += '  ';
    }

    command += distort.origin.x + ',' + distort.origin.y + ' ';
    command += distort.destiny.x + ',' + distort.destiny.y;

  }

  command += '\' ' + path;

  exec(command, function distorted(error) {

    if (error) {
      callback(error);
    } else {
      exports.addLines(path, id, callback);
    }

  });

};

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

exports.generateImage = function(text, id, callback) {

  var path = tempDirectory + '/' + id + '.jpg';

  var image = im(width, height, bgColor).stroke('black').fill('transparent');

  for (var i = 0; i < miscOps.getRandomInt(minCircles, maxCircles); i++) {

    var start = {
      x : miscOps.getRandomInt(0, width),
      y : miscOps.getRandomInt(0, height)
    };

    var size = miscOps.getRandomInt(minCircleSize, maxCircleSize);

    var end = {
      x : miscOps.getRandomInt(start.x, start.x + size),
      y : miscOps.getRandomInt(start.y, start.y + size),
    };

    image.drawCircle(start.x, start.y, end.x, end.y);
  }

  if (fonts.length) {
    var font = fonts[miscOps.getRandomInt(0, fonts.length - 1)];
    image.font(font);

  }

  image.stroke('transparent').fill(exports.getRandomColor()).fontSize(fontSize)
      .drawText(0, 0, text, 'center');

  if (noise) {
    image.noise(noise);
  }

  image.write(path, function wrote(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      exports.distortImage(path, id, exports.getDistorts(width, height),
          function distoredImage(error) {

            uploadHandler.removeFromDisk(path);

            callback(error, id);

          });
      // style exception, too simple

    }
  });

};

exports.generateCaptcha = function(callback) {

  var text = crypto.createHash('sha256').update(Math.random() + new Date())
      .digest('hex').substring(0, 6);

  var toInsert = {
    answer : text,
    expiration : logger.addMinutes(new Date(), captchaExpiration)
  };

  captchas.insert(toInsert, function(error) {

    if (error) {
      callback(error);
    } else {
      exports.generateImage(text, toInsert._id, callback);
    }
  });

};
// end of generation

exports.checkForCaptcha = function(req, callback) {

  var cookies = formOps.getCookies(req);

  var parameters = url.parse(req.url, true).query;

  if (parameters.captchaId) {
    cookies.captchaid = parameters.captchaId;
  }

  if (!cookies.captchaid || !cookies.captchaid.length) {
    callback();
    return;
  }

  try {

    captchas.findOne({
      _id : new ObjectID(cookies.captchaid),
      expiration : {
        $gt : new Date()
      }
    }, function foundCaptcha(error, captcha) {
      callback(error, captcha ? captcha._id : null);
    });
  } catch (error) {
    callback(error);
  }
};

// solves and invalidates a captcha
// start of captcha attempt
exports.isCaptchaSolved = function(captcha, input) {

  if (captcha.value) {
    return !captcha.value.answer || captcha.value.answer === input;
  }

};

exports.attemptCaptcha = function(id, input, board, callback) {

  if (board && board.settings.indexOf('disableCaptcha') > -1 && !forceCaptcha) {
    if (verbose) {
      console.log('Captcha disabled');
    }

    callback();
    return;
  }

  input = input || '';

  input = input.trim();

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
    captchas.findOneAndDelete({
      _id : new ObjectID(id),
      expiration : {
        $gt : new Date()
      }
    }, function gotCaptcha(error, captcha) {

      if (error) {
        callback(error);
      } else if (exports.isCaptchaSolved(captcha, input)) {
        callback();
      } else if (!captcha.value) {
        callback(lang.errExpiredCaptcha);
      } else {
        callback(lang.errWrongCaptcha);
      }

    });
  } catch (error) {
    callback(error);
  }

};
// end of captcha attempt

// solves a captcha without invalidating it
exports.solveCaptcha = function(parameters, callback) {

  try {

    captchas.findOneAndUpdate({
      _id : new ObjectID(parameters.captchaId),
      answer : parameters.answer,
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
        callback(lang.errExpiredOrWrongCaptcha);
      } else {
        callback();
      }

    });
  } catch (error) {
    callback(error);
  }

};