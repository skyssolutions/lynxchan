//Loading add-on, at this point its safe to reference engine components

'use strict';

var settingsHandler = require('../settingsHandler');
var domManipulator = require('../engine/domManipulator');
var verbose;

var staticPages = domManipulator.staticPages;

// A warning will be displayed on verbose mode and a crash will happen in debug
// mode if this value doesn't match the current engine version
// You can omit parts of the version or omit it altogether.
// And addon with 1.5 as a version will be compatible with any 1.5.x version,
// like 1.5.1, 1.5.13
exports.engineVersion = '2.3';

exports.init = function() {

  // Initializing addon. At this point its safe to reference different addons

  var originalSetEngineInfo = staticPages.setEngineInfo;

  // pick an exposed function of the module and replace it
  staticPages.setEngineInfo = function(document) {

    if (verbose) {
      console.log('Example addon is running');
    }

    return originalSetEngineInfo(document.replace('__linkEngine_inner__',
        '__linkEngine_inner__ Example addon is working'));

  };

};

// If this function is declared, the engine will execute it every time settings
// change
exports.loadSettings = function() {

  verbose = settingsHandler.getGeneralSettings().verbose;

};

// called for requests to the api
exports.apiRequest = function(req, res) {

  res.end(JSON.stringify({
    msg : 'Example addon api response.'
  }, null, 2));

};

// called for form request
exports.formRequest = function(req, res) {

  res.end('Example addon form response.');

};
