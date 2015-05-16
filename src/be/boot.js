#!/usr/bin/env iojs

//Starting point of the application.
//Holds the loaded settings.
//Controls the workers.

var cluster = require('cluster');
var fs = require('fs');

var MINIMUM_WORKER_UPTIME = 1000;
var forkTime = {};

var dbSettings;
var generalSettings;
var templateSettings;

exports.getDbSettings = function() {
  return dbSettings;
};

exports.getGeneralSettings = function() {
  return generalSettings;
};

exports.getTemplateSettings = function() {
  return templateSettings;
};

exports.loadSettings = function() {

  var dbSettingsPath = __dirname + '/settings/db.json';

  dbSettings = JSON.parse(fs.readFileSync(dbSettingsPath));

  var generalSettingsPath = __dirname + '/settings/general.json';

  generalSettings = JSON.parse(fs.readFileSync(generalSettingsPath));

  generalSettings.address = generalSettings.address || '127.0.0.1';
  generalSettings.port = generalSettings.port || 8080;

  var fePath = generalSettings.fePath || __dirname + '/../fe';

  var templateSettingsPath = fePath + '/templateSettings.json';

  templateSettings = JSON.parse(fs.readFileSync(templateSettingsPath));

  var mandatoryTemplates = [ 'index', 'boardPage', 'threadPage' ];

  for (var i = 0; i < mandatoryTemplates.length; i++) {

    var templateName = mandatoryTemplates[i];

    if (!templateSettings[templateName]) {

      throw 'Missing template setting ' + templateName;
    }

  }

};

try {
  exports.loadSettings();
} catch (error) {
  console.log(error);
  return;
}

if (cluster.isMaster) {

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

} else {

  require('./workerBoot').boot();
}
