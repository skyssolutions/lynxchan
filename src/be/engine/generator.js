'use strict';

// handles generation of pages based on templates

var frontPageTemplate;
var threadTemplate;
var boardTemplate;
var gridFs = require('./gridFsHandler');
var fs = require('fs');
var boot = require('../boot');
var jsdom = require('jsdom').jsdom;

exports.loadTemplates = function() {

  var fePath = boot.getFePath() + '/templates/';
  var templateSettings = boot.getTemplateSettings();

  frontPageTemplate = fs.readFileSync(fePath + templateSettings.index);
  threadTemplate = fs.readFileSync(fePath + templateSettings.threadPage);
  boardTemplate = fs.readFileSync(fePath + templateSettings.boardPage);

};

exports.frontPage = function(callback) {

  console.log('generated front page');

  // TODO
  gridFs.writeData(frontPageTemplate, '/', 'text/html', {}, callback);

};