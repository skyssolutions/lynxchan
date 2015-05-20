'use strict';

// miscellaneous
var verbose = require('../boot').getGeneralSettings().verbose;
var formOps = require('./formOps');

// parameters must be an array of objects. each object must contain two keys:
// one with a string with the name of the parameter, the other with a number
// with its maximum length
exports.sanitizeStrings = function(object, parameters) {

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

// It uses the provided contentType and builds a header ready for CORS.
// Currently it just allows everything.
exports.corsHeader = function(contentType) {
  return {
    'Content-Type' : contentType,
    'access-control-allow-origin' : '*'
  };
};