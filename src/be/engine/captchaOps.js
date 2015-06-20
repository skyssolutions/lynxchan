'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var verbose = settings.verbose;
var logger = require('../logger');
var exec = require('child_process').exec;
var im = require('gm').subClass({
  imageMagick : true
});
var captchas = require('../db').captchas();
var crypto = require('crypto');
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var captchaExpiration = boot.captchaExpiration();
var uploadHandler = require('./uploadHandler');
var formOps = require('./formOps');
var gridFsHandler = require('./gridFsHandler');
var tempDirectory = boot.tempDir();
var miscOps = require('./miscOps');

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

// used to distortion doesn't pull point too hard
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

function getRandomColor() {
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

}

// start of generation
function addLines(path, id, callback) {

  var image = im(path).stroke(getRandomColor(), lineWidth);

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
      gridFsHandler.writeFile(path, id + '.png', 'image/png', {
        type : 'captcha',
        expiration : logger.addMinutes(new Date(), captchaExpiration)
      }, function wroteToGfs(error) {
        callback(error);

      });
      // style exception, too simple
    }

  });

}

function distortImage(path, id, distorts, callback) {

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
      addLines(path, id, callback);
    }

  });

}

function getBaseDistorts() {
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
}

function getDistorts() {

  var distorts = getBaseDistorts(width, height);

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

}

function generateImage(text, id, callback) {

  var path = tempDirectory + '/' + id + '.png';

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

  image.stroke('transparent').fill(getRandomColor()).fontSize(fontSize)
      .drawText(0, 0, text, 'center');

  if (noise) {
    image.noise(noise);
  }

  image.write(path, function wrote(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      distortImage(path, id, getDistorts(width, height),
          function distoredImage(error) {

            uploadHandler.removeFromDisk(path);

            callback(error, id);

          });
      // style exception, too simple

    }
  });

}

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
      generateImage(text, toInsert._id, callback);
    }
  });

};
// end of generation

exports.checkForCaptcha = function(req, callback) {

  var cookies = formOps.getCookies(req);

  captchas.findOne({
    _id : new ObjectID(cookies.captchaId),
    expiration : {
      $gt : new Date()
    }
  }, function foundCaptcha(error, captcha) {
    callback(error, captcha ? captcha._id : null);
  });

};

exports.attemptCaptcha = function(id, input, board, callback) {

  if (board.settings.indexOf('disableCaptcha') > -1) {
    if (verbose) {
      console.log('Captcha disabled');
    }

    callback();
    return;
  }

  if (verbose) {
    console.log('Attempting to solve captcha ' + id + ' with answer ' + input);
  }

  captchas.findOneAndDelete({
    _id : new ObjectID(id),
    expiration : {
      $gt : new Date()
    }
  }, function gotCaptcha(error, captcha) {

    if (error) {
      callback(error);
    } else if (captcha.value && captcha.value.answer === input) {
      callback();
    } else if (!captcha.value) {
      callback('Expired captcha.');
    } else {
      callback('Incorrect captcha');
    }

  });

};
