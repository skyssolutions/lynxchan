'use strict';

// handles generation of pages based on templates

var frontPageTemplate;
var threadTemplate;
var boardTemplate;
var notFoundTemplate;

var db = require('../db');
var boards = db.boards();
var gridFs = require('./gridFsHandler');
var fs = require('fs');
var boot = require('../boot');
var verbose = boot.getGeneralSettings().verbose;
var serializer = require('jsdom').serializeDocument;
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

function generateFrontPage(boardsToList, callback) {

  if (verbose) {
    console.log('Got boards\n' + JSON.stringify(boardsToList));

  }

  var document = jsdom(frontPageTemplate);

  var boardsDiv = document.getElementById('divBoards');

  if (!boardsDiv) {
    callback('No board div on front-end template');
    return;
  }

  for (var i = 0; i < boardsToList.length; i++) {

    var board = boardsToList[i];

    var block = '<a href="' + board.boardUri + '">';
    block += '/' + board.boardUri + '/ - ' + board.boardName + '</a>';

    if (i) {
      block = '<br>' + block;
    }

    boardsDiv.innerHTML += block;

  }

  gridFs.writeData(serializer(document), '/', 'text/html', {}, callback);
}

exports.frontPage = function(callback) {

  if (verbose) {
    console.log('Generating front-page');
  }

  boards.find({}, {
    _id : 0,
    boardUri : 1,
    boardName : 1
  }).sort({
    boardUri : 1
  }).toArray(function gotResults(error, results) {
    if (error) {
      callback(error);
    } else {
      generateFrontPage(results, callback);
    }
  });

};