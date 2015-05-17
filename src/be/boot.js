#!/usr/bin/env iojs

'use strict';

// Starting point of the application.
// Holds the loaded settings.
// Controls the workers.

var cluster = require('cluster');
var db = require('./db');
var fs = require('fs');
var generator;

var MINIMUM_WORKER_UPTIME = 1000;
var forkTime = {};

var dbSettings;
var generalSettings;
var templateSettings;
var fePath;

exports.getDbSettings = function() {

  return dbSettings;
};

exports.getGeneralSettings = function() {
  return generalSettings;
};

exports.getTemplateSettings = function() {
  return templateSettings;
};

exports.getFePath = function() {
  return fePath;
};

exports.loadSettings = function() {

  var dbSettingsPath = __dirname + '/settings/db.json';

  dbSettings = JSON.parse(fs.readFileSync(dbSettingsPath));

  var generalSettingsPath = __dirname + '/settings/general.json';

  generalSettings = JSON.parse(fs.readFileSync(generalSettingsPath));

  generalSettings.address = generalSettings.address || '127.0.0.1';
  generalSettings.port = generalSettings.port || 8080;

  fePath = generalSettings.fePath || __dirname + '/../fe';

  var templateSettingsPath = fePath + '/templateSettings.json';

  templateSettings = JSON.parse(fs.readFileSync(templateSettingsPath));

};

// after everything is all right, call this function to start the workers
function bootWorkers() {

  for (var i = 0; i < require('os').cpus().length; i++) {
    cluster.fork();
  }

  cluster.on('fork', function(worker) {

    forkTime[worker.id] = new Date().getTime();

  });

  cluster.on('exit', function(worker, code, signal) {
    console.log('Server worker ' + worker.id + ' crashed.');

    if (new Date().getTime() - forkTime[worker.id] < MINIMUM_WORKER_UPTIME) {
      console.log('Crash on boot, not restarting it.');
    } else {
      cluster.fork();
    }

    delete forkTime[worker.id];
  });
}

function generateFrontPage() {

  generator.frontPage(function generated(error) {
    if (error) {
      console.log(error);
    } else {
      bootWorkers();
    }
  });

}

// we need to check if the default pages can be found
function checkForDefaultPages() {

  var files = db.files();
  generator = require('./engine/generator');
  generator.loadTemplates();

  // TODO update when more default pages are defined
  files.findOne({
    filename : '/'
  }, {
    uploadDate : 1,
    _id : 0
  }, function gotFile(error, file) {
    if (error) {
      console.log(error);
    } else if (!file) {
      generateFrontPage();
    } else {
      bootWorkers();
    }
  });

}

try {
  exports.loadSettings();
} catch (error) {
  console.log(error);
  return;
}

if (cluster.isMaster) {

  db.init(function bootedDb(error) {

    if (error) {
      console.log(error);
    } else {
      checkForDefaultPages();
    }

  });

} else {

  require('./workerBoot').boot();
}
