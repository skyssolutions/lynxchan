//Loading add-on, at this point its safe to reference engine components

'use strict';

var templateHandler = require('../engine/templateHandler');
var lang = require('../engine/langOps').languagePack();
var domManipulator = require('../engine/domManipulator');
var gridFs = require('../engine/gridFsHandler');
var settings = require('../settingsHandler').getGeneralSettings();
var siteTitle = settings.siteTitle || lang.titDefaultChanTitle;

var common = domManipulator.common;
var staticPages = domManipulator.staticPages;

// A warning will be displayed on verbose mode and a crash will happen in debug
// mode if this value doesn't match the current engine version
// You can omit parts of the version or omit it altogether.
// And addon with 1.5 as a version will be compatible with any 1.5.x version,
// like 1.5.1, 1.5.13
exports.engineVersion = '1.5';

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;

exports.init = function() {

  // Initializing addon. At this point its safe to reference different addons

  var originalLatestPosts = staticPages.setLatestPosts;

  // pick an exposed function of the module and replace it
  staticPages.setLatestPosts = function(latestPosts, latestPostsDiv, document) {

    var footer = document.createElement('footer');
    footer.innerHTML = 'Example addon is working';

    document.getElementsByTagName('body')[0].appendChild(footer);

    originalLatestPosts(latestPosts, latestPostsDiv, document);

  };

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
