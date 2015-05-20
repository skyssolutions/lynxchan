'use strict';

// general operations for the form api
var verbose = require('../boot').getGeneralSettings.verbose;
var miscOps = require('./miscOps');

exports.outputMessage = function(message, redirect, res) {

  if (verbose) {
    console.log(message);
  }

  // TODO add template
  res.writeHead(200, miscOps.corsHeader('text/html'));

  res.end(message);

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