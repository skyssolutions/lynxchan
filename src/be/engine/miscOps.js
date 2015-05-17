'use strict';

// miscellaneous

// It uses the provided contentType and builds a header ready for CORS.
// Currently it just allows everything.
exports.corsHeader = function(contentType) {
  return {
    'Content-Type' : contentType,
    'access-control-allow-origin' : '*'
  };
};