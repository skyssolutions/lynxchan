'use strict';

// Creates an UCT formated date in 'yyyy-MM-dd' format
exports.formatedDate = function(time) {
  time = time || new Date();

  var monthString = time.getUTCMonth() + 1;

  if (monthString.toString().length < 2) {
    monthString = '0' + monthString;
  }

  var dayString = time.getUTCDate();

  if (dayString.toString().length < 2) {
    dayString = '0' + dayString;
  }

  return time.getUTCFullYear() + '-' + monthString + '-' + dayString;
};

// Creates an UCT formated time in 'HH:mm:ss' format
exports.formatedTime = function(time) {

  time = time || new Date();

  var hourString = time.getUTCHours().toString();

  if (hourString.length < 2) {
    hourString = '0' + hourString;
  }

  var minuteString = time.getUTCMinutes().toString();

  if (minuteString.length < 2) {
    minuteString = '0' + minuteString;
  }

  var secondString = time.getUTCSeconds().toString();

  if (secondString.length < 2) {
    secondString = '0' + secondString;
  }

  return hourString + ':' + minuteString + ':' + secondString;
};

// It just gets the formated date and put the formated time after it with an
// underscore in between
exports.timestamp = function(time) {
  return exports.formatedDate(time) + '_' + exports.formatedTime(time);
};
