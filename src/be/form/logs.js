'use strict';

var url = require('url');
var aggregatedLogs = require('../db').aggregatedLogs();
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var formOps = require('../engine/formOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;

exports.process = function(req, res) {

  aggregatedLogs.aggregate([ {
    $sort : {
      date : -1
    }
  }, {
    $group : {
      _id : 0,
      dates : {
        $push : '$date'
      }
    }
  } ], function gotDates(error, results) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var json = url.parse(req.url, true).query.json;

      var dates = results.length ? results[0].dates : [];

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html'));

      if (json) {
        res.end(jsonBuilder.logs(dates));
      } else {
        res.end(domManipulator.logs(dates));
      }
    }

  });

};