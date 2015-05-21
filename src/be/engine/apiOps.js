'use strict';

// general operations for the json api
var verbose = require('../boot').getGeneralSettings().verbose;
var miscOps = require('./miscOps');

// TODO change to use settings
var REQUEST_LIMIT_SIZE = 1e6;

exports.checkBlankParameters = function(object, parameters, res) {

  function failCheck(parameter, reason) {

    if (verbose) {
      console.log('Blank reason: ' + reason);
    }

    if (res) {

      exports.outputResponse(null, parameter, 'blank', res);
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

exports.getAnonJsonData = function(req, res, callback) {

  var body = '';

  req.on('data', function dataReceived(data) {
    body += data;

    if (body.length > REQUEST_LIMIT_SIZE) {

      exports.outputResponse(null, null, 'tooLong', res);

      req.connection.destroy();
    }
  });

  req.on('end', function dataEnded() {

    if (verbose) {
      console.log('\napi input: ' + body);
    }

    try {
      var parsedData = JSON.parse(body);

      callback(parsedData.auth, parsedData.parameters, parsedData);

    } catch (error) {
      exports.outputMessage(null, error.toString(), 'parseError', res);
    }

  });

};

exports.outputError = function(error, res) {

  if (verbose) {
    console.log(error);
  }

  exports.outputResponse(null, error.toString(), 'error', res);

};

exports.outputResponse = function(auth, data, status, res) {
  if (!res) {
    console.log('Null res object ' + status);
    return;
  }

  var output = {
    auth : auth || null,
    status : status,
    data : data || null
  };

  res.writeHead(200, miscOps.corsHeader('application/json'));

  if (verbose) {
    console.log('\nApi output: ' + JSON.stringify(output));
  }

  res.end(JSON.stringify(output));
};