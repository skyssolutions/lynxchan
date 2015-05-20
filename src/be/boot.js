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

var debug = process.argv.toString().indexOf('-d') > -1;
debug = debug || process.argv.toString().indexOf('--debug') > -1;

var reload = process.argv.toString().indexOf('-r') > -1;
reload = reload || process.argv.toString().indexOf('--reload') > -1;

var noDaemon = process.argv.toString().indexOf('-nd') > -1;
noDaemon = noDaemon || process.argv.toString().indexOf('--no-daemon') > -1;

exports.debug = function() {
  return debug;
};

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

  var genQueue = require('./generationQueue');

  if (noDaemon) {
    db.conn().close();
    return;
  }

  for (var i = 0; i < require('os').cpus().length; i++) {
    cluster.fork();
  }

  cluster.on('fork', function(worker) {

    forkTime[worker.id] = new Date().getTime();

    worker.on('message', function receivedMessage(message) {
      genQueue.queue(message);
    });
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

function regenerateAll() {

  generator.all(function regeneratedAll(error) {
    if (error) {
      console.log(error);
    } else {
      bootWorkers();
    }
  });

}

function checkNotFound(files) {

  if (files.indexOf('/404.html') === -1) {

    generator.notFound(function generated(error) {
      if (error) {
        console.log(error);

      } else {
        bootWorkers();
      }

    });

  } else {
    bootWorkers();
  }

}

function checkFrontPage(files) {

  if (files.indexOf('/') === -1) {
    generator.frontPage(function generated(error) {
      if (error) {
        console.log(error);

      } else {
        checkNotFound(files);
      }

    });
  } else {
    checkNotFound(files);
  }

}

// we need to check if the default pages can be found
function checkForDefaultPages() {

  generator = require('./engine/generator');
  generator.loadTemplates();

  if (reload) {
    regenerateAll();
    return;
  }

  var files = db.files();

  files.aggregate({
    $match : {
      filename : {
        $in : [ '/', '/404.html' ]
      }
    }
  }, {
    $project : {
      filename : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 1,
      pages : {
        $push : '$filename'
      }
    }
  }, function gotFiles(error, files) {
    if (error) {
      console.log(error);
    } else if (files.length) {
      checkFrontPage(files[0].pages);
    } else {
      regenerateAll();
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
