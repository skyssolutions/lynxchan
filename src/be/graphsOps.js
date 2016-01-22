'use strict';

// Handles graph generation
var mongo = require('mongodb');
var exec = require('child_process').exec;
var db = require('./db');
var logger = require('./logger');
var conn = db.conn();
var stats = db.stats();
var verbose = require('./settingsHandler').getGeneralSettings().verbose;

// Duplicated code, since we can't make a core module depend on an engine module
function writeData(data, dest, mime, meta, callback) {

  meta.lastModified = new Date();

  var gs = mongo.GridStore(conn, dest, 'w', {
    'content_type' : mime,
    metadata : meta
  });

  gs.open(function openedGs(error, gs) {

    if (error) {
      callback(error);
    } else {
      gs.write(data, true, callback);
    }

  });

}

// Section 1: Vertical markers {
function getPPHScaleMarker(startY, startX, maxPPH, endX, stepSize, i) {

  var toRet = '';

  var lineHeight = startY + (stepSize * i);

  toRet += ' line ' + startX + ',' + lineHeight + ' ' + endX + ',' + lineHeight;

  toRet += ' text ' + (startX - 45) + ',' + (lineHeight + 5) + ' \'';
  toRet += (maxPPH - i) + '\'';

  return toRet;

}

function getNextIterator(i, ratio, maxPPH) {

  if (i + (2 * ratio) > maxPPH && i < maxPPH) {
    return maxPPH;
  } else {
    return i + ratio;
  }

}

function getPPHScale(startY, endY, startX, endX, maxPPH) {

  var toRet = '';

  var deltaY = endY - startY;

  var stepSize = deltaY / maxPPH;

  var nextIterator = 0;
  var minGap = 20;

  var i = 0;

  var ratio = stepSize < minGap ? Math.round(minGap / stepSize) : null;

  while (i <= maxPPH) {

    toRet += getPPHScaleMarker(startY, startX, maxPPH, endX, stepSize, i);

    if (ratio) {
      i = getNextIterator(i, ratio, maxPPH);
    } else {
      i++;
    }

  }

  return toRet;

}
// } Section 1: Vertical markers

// Section 2: Bars {
function getValue(results, i, date) {

  if (!results.length) {
    return;
  }

  var currentDate = new Date(date);
  currentDate.setUTCHours(currentDate.getUTCHours() + i);

  if (results[0]._id.getTime() === currentDate.getTime()) {
    var toRet = results.shift();
    return toRet.posts;
  }

}

function getTimeScale(startX, endY, endX, startY, maxPPH, date, results) {

  var toRet = '';
  var pad = 2;

  var gap = endX - startX;
  gap /= 24;

  var scale = (endY - startY) / maxPPH;

  for (var i = 0; i < 24; i++) {

    var leftMargin = (startX + (i * gap));

    toRet += ' text ' + (gap / 2 + leftMargin - 8) + ',' + (endY + 20) + ' \'';
    toRet += i + '\'';

    var value = getValue(results, i, date);

    if (value) {

      toRet += ' rectangle ' + (pad + leftMargin) + ',' + endY + ' ';
      toRet += (gap - pad + leftMargin) + ',' + (endY - (value * scale));

    }
  }

  return toRet;

}
// } Section 2: Bars

function getCommandStart(date, startX, startY, endX, endY) {

  var toRet = 'convert -size 1024x768 xc:';

  var formatedDate = date.getUTCDate() + '/' + (date.getUTCMonth() + 1) + '/';
  formatedDate += date.getUTCFullYear();

  // Drawing title
  toRet += ' -pointsize 20 -draw \"';
  toRet += 'text 400,37 \'Daily stats for ' + formatedDate + '\'';

  // Drawing labels
  toRet += '\" -pointsize 15 -draw \"text ' + (startX - 15) + ',';
  toRet += (startY - 10) + ' \'PPH\'';
  toRet += ' text ' + (endX + 10) + ',' + (endY + 5) + ' \'Time\'';

  // Drawing external lines
  toRet += ' line ' + startX + ',' + endY + ' ' + endX + ',' + endY;

  return toRet;

}

function getMaxPPH(results) {

  var maxPPH = 0;

  for (var i = 0; i < results.length; i++) {
    var currentResult = results[i];

    if (currentResult.posts > maxPPH) {
      maxPPH = currentResult.posts;
    }

    currentResult._id = new Date(currentResult._id);

  }

  return maxPPH;

}

function getCommand(date, results) {

  var startX = 52;
  var endX = 970;

  var startY = 100;
  var endY = 730;

  var barWidth = (endX - startX) / 24;

  var maxPPH = getMaxPPH(results);

  var toRet = getCommandStart(date, startX, startY, endX, endY);

  // Drawing scale
  toRet += getPPHScale(startY, endY, startX, endX, maxPPH);

  // Drawing bars and labels for time
  toRet += getTimeScale(startX, endY, endX, startY, maxPPH, date, results);

  toRet += '\" png:-';

  return toRet;

}

function plot(date, results, callback) {

  exec(getCommand(date, results), {
    encoding : 'binary',
    maxBuffer : Infinity
  }, function generated(error, result) {

    if (error) {
      callback(error);
    } else {
      var path = '/.global/graphs/' + logger.formatedDate(date) + '.png';
      writeData(new Buffer(result, 'binary'), path, 'image/png', {
        type : 'graph',
        date : date
      }, callback);
    }

  });

}

exports.generate = function(date, callback) {

  var maxDate = new Date(date);
  maxDate.setUTCDate(maxDate.getUTCDate() + 1);

  stats.aggregate([ {
    $match : {
      startingTime : {
        $gte : date,
        $lt : maxDate
      }
    }
  }, {
    $group : {
      _id : '$startingTime',
      posts : {
        $sum : '$posts'
      }
    }
  }, {
    $sort : {
      _id : 1
    }
  } ], function gotDailyStats(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {

      if (verbose) {
        console.log('Generating graph for ' + date.toUTCString());
      }

      plot(date, results, callback);
    }

  });

};