'use strict';

var ipv6 = require('ip-address');

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

exports.convertIpToArray = function(ip) {

  if (!ip) {
    return null;
  }

  if (ip.match(/\d+.\d+.\d+.\d+/)) {
    return ipv6.Address6.fromAddress4(ip).toUnsignedByteArray().slice(-4);
  } else {
    return new ipv6.Address6(ip).toUnsignedByteArray();
  }
};

exports.ip = function(req) {

  if (req.isTor) {
    return null;
  } else if (req.cachedIp) {
    return req.cachedIp;
  } else {
    req.cachedIp = exports.convertIpToArray(exports.getRawIp(req));

    return req.cachedIp;
  }

};

exports.getRawIp = function(req) {

  var remote = req.connection.remoteAddress;

  // TODO check if remote is the master
  if (req.headers && req.headers['x-forwarded-for'] && remote === '127.0.0.1') {
    return req.headers['x-forwarded-for'];
  }

  return remote;

};
