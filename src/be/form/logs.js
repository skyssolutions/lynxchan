'use strict';

var logs = require('../db').logs();
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var formOps = require('../engine/formOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var optionalParameters = [ 'type', 'before', 'after', 'user', 'boardUri' ];
var settings = require('../settingsHandler').getGeneralSettings();
var pageSize = settings.logPageSize;
var url = require('url');
var waitingList = [];

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

function getQueryBlock(parameters) {

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

  return queryBlock;

}

function clearIp(ip) {

  waitingList.splice(waitingList.indexOf(ip, 1));

}

function getLogs(req, res, parameters, queryBlock, count) {

  var pageCount = Math.floor(count / pageSize);
  pageCount += (count % pageSize ? 1 : 0);

  pageCount = pageCount || 1;

  var toSkip = (parameters.page - 1) * pageSize;

  logs.find(queryBlock, {
    user : 1,
    _id : 0,
    type : 1,
    time : 1,
    boardUri : 1,
    description : 1,
    global : 1
  }).sort({
    time : -1
  }).skip(toSkip).limit(pageSize).toArray(
      function gotLogs(error, logs) {

        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          var json = parameters.json;

          res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
              : 'text/html'));

          if (json) {
            res.end(jsonBuilder.logs(logs, pageCount));
          } else {
            res.end(domManipulator.logs(logs, pageCount, parameters));
          }

        }
      });

}

function getCount(req, res) {

  var parameters = getParameters(req);

  parameters.page = parameters.page || 1;

  var queryBlock = getQueryBlock(parameters);

  logs.count(queryBlock, function counted(error, count) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      getLogs(req, res, parameters, queryBlock, count);
    }
  });
}

exports.process = function(req, res) {

  var rawIp = req.connection.remoteAddress;

  if (waitingList.indexOf(rawIp) > -1) {
    req.connection.destroy();
  } else {
    waitingList.push(rawIp);

    res.on('close', function() {
      clearIp(rawIp);
    });

    res.on('finish', function() {
      clearIp(rawIp);
    });

    getCount(req, res);
  }

};