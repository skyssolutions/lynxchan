'use strict';

var db = require('./db');
var taskQueue = db.tasks();
var settingsHandler = require('./settingsHandler');

function processTask(task) {

  switch (task.type) {
  case 'maintenance':
    settingsHandler.changeMaintenanceMode(task.value);
    break;
  }

}

exports.start = function() {

  var limitDate = new Date();

  var stream = taskQueue.find({}, {
    tailable : true,
    noCursorTimeout : true,
    awaitdata : true
  }).stream();

  stream.on('data', function(document) {
    if (document.creation > limitDate) {
      processTask(document);
    }

  });

  stream.on('end', function() {
    exports.start();
  });

};
