'use strict';

// miscellaneous
// TODO change to use settings
var REQUEST_LIMIT_SIZE = 1e6;
var verbose = require('../boot').getGeneralSettings().verbose;
var queryString = require('querystring');
var formOps = require('./formOps');

exports.sanitizeOptionalStrings = function(object, parameters) {

  console.log(JSON.stringify(object));

  for (var i = 0; i < parameters.length; i++) {
    var parameter = parameters[i];

    if (object.hasOwnProperty(parameter.field)) {

      object[parameter.field] = object[parameter.field].toString().trim();

      if (!object[parameter.field].length) {

        delete object[parameter.field];

      } else {
        object[parameter.field] = object[parameter.field].substring(0,
            parameter.length);
      }

    }
  }

};

exports.getPostData = function(req, res, callback) {

  var body = '';

  req.on('data', function dataReceived(data) {
    body += data;

    if (body.length > REQUEST_LIMIT_SIZE) {

      formOps.outputError('Request too long.', 411, res);

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
      formOps.outputError(error, 500, res);
    }

  });

};

// It uses the provided contentType and builds a header ready for CORS.
// Currently it just allows everything.
exports.corsHeader = function(contentType) {
  return {
    'Content-Type' : contentType,
    'access-control-allow-origin' : '*'
  };
};