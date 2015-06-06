'use strict';

var exec = require('child_process').exec;
var im = require('gm').subClass({
  imageMagick : true
});
var crypto = require('crypto');

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function getBaseDistorts(width, height) {
  var distorts = [];

  distorts.push({
    origin : {
      x : width / 2,
      y : 0
    },
    destiny : {
      x : width / 2,
      y : 0
    }
  });

  distorts.push({
    origin : {
      x : width / 2,
      y : height
    },
    destiny : {
      x : width / 2,
      y : height
    }
  });

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

function distortImage(path, distorts, callback) {

  var command = 'mogrify -virtual-pixel Black -distort Shepards \'';

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
    callback(error, path);
  });

}

exports.generateImage = function(callback) {

  var path = '/tmp/test.png';

  var text = crypto.createHash('sha256').update(Math.random() + new Date())
      .digest('hex').substring(0, 6);

  var font = '/usr/share/fonts/google-crosextra-caladea/Caladea-Italic.ttf';
  var bgColor = '#cccccc';
  var fontSize = 70;
  var fillColor = '#005f00';
  var height = 100;
  var width = 300;
  var distortLimiter = 30;

  var distorts = getBaseDistorts(width, height);

  for (var i = 0; i < getRandomInt(2, 5); i++) {
    var distortOrigin = {
      x : getRandomInt(0, width),
      y : getRandomInt(0, height)
    };

    var minWidthDestiny = distortOrigin.x - distortLimiter;
    var minHeightDestiny = distortOrigin.y - distortLimiter;

    var distortDestination = {
      x : getRandomInt(minWidthDestiny, distortOrigin.x + distortLimiter),
      y : getRandomInt(minHeightDestiny, distortOrigin.y + distortLimiter)
    };

    var distort = {
      origin : distortOrigin,
      destiny : distortDestination
    };

    distorts.push(distort);
  }

  // note: use full path of the font file
  im(width, height, bgColor).fill(fillColor).font(font).fontSize(fontSize)
      .drawText(0, 0, text, 'center').write(path, function wrote(error) {
        if (error) {
          callback(error);
        } else {

          distortImage(path, distorts, callback);

        }
      });

};
