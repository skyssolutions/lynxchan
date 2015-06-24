'use strict';

var logs = require('../db').logs();
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');
var domManipulator = require('../engine/domManipulator');
var optionalParameters = [ 'type', 'before', 'after', 'user', 'boardUri' ];
var settings = require('../boot').getGeneralSettings();
var pageSize = settings.logPageSize || 50;
var url = require('url');

function getParameters(req) {

  var parameters = url.parse(req.url, true).query;

  for (var i = 0; i < optionalParameters.length; i++) {
    var parameter = optionalParameters[i];

    var foundParameter = parameters[parameter];

    if (foundParameter && !foundParameter.length) {
      delete parameters[parameter];
    }
  }

  return parameters;
}

function processDates(queryBlock, parameters) {

  var before = Date.parse(parameters.before || '');

  if (isNaN(before)) {
    delete parameters.before;
  } else {
    queryBlock.time = {
      $lt : new Date(before)
    };
  }

  var after = Date.parse(parameters.after || '');

  if (isNaN(after)) {
    delete parameters.after;
  } else {
    queryBlock.time = {
      $gt : new Date(after)
    };
  }
}

exports.process = function(req, res) {

  var parameters = getParameters(req);

  var queryBlock = {};

  if (parameters.excludeGlobals) {
    queryBlock.global = false;
  }

  if (parameters.user) {
    queryBlock.user = parameters.user;
  }

  if (parameters.type) {
    queryBlock.type = parameters.type;
  }

  if (parameters.boardUri) {
    queryBlock.boardUri = parameters.boardUri;
  }

  processDates(queryBlock, parameters);

  parameters.page = parameters.page || 1;

  logs.count(queryBlock, function counted(error, count) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      var pageCount = Math.floor(count / pageSize);
      pageCount += (count % pageSize ? 1 : 0);

      pageCount = pageCount || 1;

      var toSkip = (parameters.page - 1) * pageSize;

      // style exception, too simple

      logs.find(queryBlock).sort({
        time : -1
      }).skip(toSkip).limit(pageSize).toArray(function gotLogs(error, logs) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          res.writeHead(200, miscOps.corsHeader('text/html'));

          res.end(domManipulator.logs(logs, pageCount, parameters));
        }

      });

      // style exception, too simple
    }

  });

};