'use strict';

var url = require('url');
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var files = require('../db').files();

exports.getMinDate = function(informedYear) {

  var date = new Date();

  date.setUTCHours(0);
  date.setUTCMinutes(0);
  date.setUTCSeconds(0);
  date.setUTCDate(1);
  date.setUTCMilliseconds(0);
  date.setUTCMonth(0);

  if (informedYear) {

    var parsedYear = +informedYear;

    if (parsedYear) {
      date.setUTCFullYear(parsedYear);
    }
  }

  return date;

};

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  var date = exports.getMinDate(parameters.year);

  var maxDate = new Date(date);

  maxDate.setUTCFullYear(maxDate.getUTCFullYear() + 1);

  var json = parameters.json;

  files.aggregate([ {
    $match : {
      'metadata.date' : {
        $gte : date,
        $lt : maxDate
      },
      'metadata.type' : 'graph'
    }
  }, {
    $sort : {
      'metadata.date' : -1
    }
  }, {
    $group : {
      _id : 0,
      dates : {
        $push : '$metadata.date'
      }
    }
  } ]).toArray(function gotDates(error, results) {

    if (error) {
      formOps.outputError(error, 500, res, req.language, json);
    } else {

      var dates = results.length ? results[0].dates : [];

      if (json) {
        formOps.outputResponse('ok', dates, res, null, null, null, true);
      } else {

        formOps.dynamicPage(res, domManipulator.graphs(dates, req.language));

      }

    }

  });

};