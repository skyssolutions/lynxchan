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
exports.engineVersion = '1.4.0';

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;

exports.setLatestPosts = function(document, latestPosts) {

  var latestPostsDiv = document.getElementById('divLatestPosts');

  if (!latestPosts) {
    common.removeElement(latestPostsDiv);
  } else {
    staticPages.setLatestPost(latestPosts, latestPostsDiv, document);
  }

};

exports.init = function() {

  // Initializing addon. At this point its safe to reference different addons

  // pick an exposed function of the module and replace it
  staticPages.frontPage = function(boards, latestPosts, callback) {

    try {

      var document = jsdom(templateHandler.index);

      var footer = document.createElement('footer');
      footer.innerHTML = 'Example addon is working';

      document.getElementsByTagName('body')[0].appendChild(footer);

      document.title = siteTitle;

      var boardsDiv = document.getElementById('divBoards');

      if (!boards) {
        common.removeElement(boardsDiv);
      } else {
        // you don't have to overwrite every thing, you can adapt the reference
        // and keep using the module function, un this case, setTopBoards
        staticPages.setTopBoards(document, boards, boardsDiv);
      }

      exports.setLatestPosts(document, latestPosts);

      gridFs.writeData(serializer(document), '/', 'text/html', {}, callback);
    } catch (error) {
      callback(error);
    }
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
