'use strict';

// general operations for the form api
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var accountOps = require('./accountOps');
var debug = boot.debug;
var verbose = settings.verbose;
var multiParty = require('multiparty');
var parser = new multiParty.Form({
  uploadDir : settings.tempDirectory || '/tmp',
  autoFiles : true
});
var miscOps = require('./miscOps');
var jsdom = require('jsdom').jsdom;
var domManipulator = require('./domManipulator');
var uploadHandler = require('./uploadHandler');

function processParsedRequest(res, fields, files, callback, parsedCookies) {

  for ( var key in fields) {
    if (fields.hasOwnProperty(key)) {
      fields[key] = fields[key][0];
    }
  }

  fields.files = [];

  var filesToDelete = [];

  var endingCb = function() {

    for (var j = 0; j < filesToDelete.length; j++) {
      uploadHandler.removeFromDisk(filesToDelete[j]);
    }

  };

  res.on('close', endingCb);

  res.on('finish', endingCb);

  if (files.files) {

    for (var i = 0; i < files.files.length; i++) {
      var file = files.files[i];

      filesToDelete.push(file.path);

      if (file.size) {

        fields.files.push({
          title : file.originalFilename,
          pathInDisk : file.path,
          mime : file.headers['content-type']
        });
      }
    }
  }

  callback(parsedCookies, fields);

}

exports.getAuthenticatedPost = function(req, res, getParameters, callback) {

  if (getParameters) {

    exports.getPostData(req, res, function(auth, parameters) {

      accountOps.validate(auth, function validated(error, newAuth) {
        callback(error, newAuth, parameters);

      });
    });
  } else {
    var parsedCookies = {};

    if (req.headers && req.headers.cookie) {

      var cookies = req.headers.cookie.split(';');

      for (var i = 0; i < cookies.length; i++) {

        var cookie = cookies[i];

        var parts = cookie.split('=');
        parsedCookies[parts.shift().trim()] = decodeURI(parts.join('='));

      }

    }

    accountOps.validate(parsedCookies, function validated(error, newAuth) {
      callback(error, newAuth);

    });
  }

};

exports.getPostData = function(req, res, callback) {

  try {

    var parsedCookies = {};

    if (req.headers && req.headers.cookie) {

      var cookies = req.headers.cookie.split(';');

      for (var i = 0; i < cookies.length; i++) {

        var cookie = cookies[i];

        var parts = cookie.split('=');
        parsedCookies[parts.shift().trim()] = decodeURI(parts.join('='));

      }

    }

    parser.parse(req, function parsed(error, fields, files) {
      if (error) {
        throw error;
      } else {
        processParsedRequest(res, fields, files, callback, parsedCookies);

      }

    });
  } catch (error) {
    callback(error);
  }

};

exports.outputResponse = function(message, redirect, res, cookies) {

  if (verbose) {
    console.log(message);
  }

  var header = miscOps.corsHeader('text/html');

  if (cookies) {

    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i];

      header.push([ 'Set-Cookie', cookie.field + '=' + cookie.value ]);

    }

  }

  res.writeHead(200, header);

  res.end(domManipulator.message(message, redirect));

};

exports.outputError = function(error, code, res) {

  if (verbose) {
    console.log(error);
  }

  if (debug) {
    throw error;
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