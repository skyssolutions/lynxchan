'use strict';

// handles generation of pages based on templates

var frontPageTemplate;
var threadTemplate;
var boardTemplate;
var notFoundTemplate;

var gridFs = require('./gridFsHandler');
var fs = require('fs');
var boot = require('../boot');
var verbose = boot.getGeneralSettings().verbose;
var jsdom = require('jsdom').jsdom;

exports.loadTemplates = function() {

  var fePath = boot.getFePath() + '/templates/';
  var templateSettings = boot.getTemplateSettings();

  frontPageTemplate = fs.readFileSync(fePath + templateSettings.index);
  threadTemplate = fs.readFileSync(fePath + templateSettings.threadPage);
  boardTemplate = fs.readFileSync(fePath + templateSettings.boardPage);
  notFoundTemplate = fs.readFileSync(fePath + templateSettings.notFoundPage);

};

var toGenerate;
var MAX_TO_GENERATE = 2;
var reloading;

var fullReloadCallback = function(error, callback) {

  if (!reloading) {
    return;
  }

  if (error) {
    reloading = false;
    callback(error);
  }

  toGenerate--;

  if (!toGenerate) {
    callback();
  }

};

exports.all = function(callback) {

  if (reloading) {
    return;
  }

  reloading = true;
  toGenerate = MAX_TO_GENERATE;

  // TODO call other generations
  exports.frontPage(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.notFound(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

};

exports.notFound = function(callback) {

  if (verbose) {
    console.log('Generating 404 page');
  }

  // TODO
  gridFs.writeData(notFoundTemplate, '/404.html/', 'text/html', {
    status : 404
  }, callback);
};

exports.frontPage = function(callback) {

  if (verbose) {
    console.log('Generating front-page');
  }

  // TODO
  gridFs.writeData(frontPageTemplate, '/', 'text/html', {}, callback);

};