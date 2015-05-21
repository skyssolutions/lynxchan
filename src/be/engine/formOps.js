'use strict';

// general operations for the form api
var verbose = require('../boot').getGeneralSettings.verbose;
var queryString = require('querystring');
var miscOps = require('./miscOps');
var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
var domManipulator = require('./domManipulator');

// TODO change to use settings
var REQUEST_LIMIT_SIZE = 1e6;

exports.getPostData = function(req, res, callback) {

  var body = '';

  req.on('data', function dataReceived(data) {
    body += data;

    if (body.length > REQUEST_LIMIT_SIZE) {

      exports.outputError('Request too long.', 411, res);

      req.connection.destroy();
    }
  });

  req.on('end', function dataEnded() {

    try {
      var parsedData = queryString.parse(body);

      var parsedCookies = {};

      if (req.headers && req.headers.cookie) {

        var cookies = req.headers.cookie.split(';');

        for (var i = 0; i < cookies.length; i++) {

          var cookie = cookies[i];

          var parts = cookie.split('=');
          parsedCookies[parts.shift().trim()] = decodeURI(parts.join('='));

        }

      }

      callback(parsedCookies, parsedData);

    } catch (error) {
      exports.outputError(error, 500, res);
    }

  });

};

exports.outputMessage = function(message, redirect, res) {

  if (verbose) {
    console.log(message);
  }

  res.writeHead(200, miscOps.corsHeader('text/html'));

  res.end(domManipulator.message(message, redirect));

};

exports.outputError = function(error, code, res) {

  if (verbose) {
    console.log(error);
  }

  // TODO add template
  res.writeHead(code, miscOps.corsHeader('text/html'));

  res.end('An error occourred:<br>Code ' + code + '<br>' + error.toString());

};

exports.checkBlankParameters = function(object, parameters, res) {

  function failCheck(parameter, reason) {

    if (verbose) {
      console.log('Blank reason: ' + reason);
    }

    if (res) {
      var message = 'blank parameter: ' + parameter;
      message += '<br>Reason: ' + reason;
      exports.outputError(message, 400, res);
    }

    return true;
  }

  if (!object) {

    failCheck();

    return true;

  }

  for (var i = 0; i < parameters.length; i++) {
    var parameter = parameters[i];

    if (!object.hasOwnProperty(parameter)) {
      return failCheck(parameter, 'no parameter');

    }

    if (object[parameter] === null) {
      return failCheck(parameter, 'null');
    }

    if (object[parameter] === undefined) {
      return failCheck(parameter, 'undefined');
    }

    if (!object[parameter].toString().trim().length) {
      return failCheck(parameter, 'length');
    }
  }

  return false;

};