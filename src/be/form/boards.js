'use strict';

var boards = require('../db').boards();
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');
var domManipulator = require('../engine/domManipulator');
var settings = require('../boot').getGeneralSettings();
var pageSize = settings.boardsPerPage || 50;
var url = require('url');

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  var page = parameters.page || 1;

  boards.count(function(error, count) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      var pageCount = Math.floor(count / pageSize);
      pageCount += (count % pageSize ? 1 : 0);

      pageCount = pageCount || 1;

      var toSkip = (parameters.page - 1) * pageSize;

      // style exception, too simple
      boards.find({}, {
        _id : 0,
        boardName : 1,
        boardUri : 1,
        boardDescription : 1,
        postsPerHour : 1,
        lastPostId : 1
      }).sort({
        postsPerHour : -1,
        lastPostId : -1,
        boardUri : 1
      }).skip(toSkip).limit(pageSize).toArray(function(error, foundBoards) {
        if (error) {
          formOps.outpuError(error, 500, res);
        } else {
          res.writeHead(200, miscOps.corsHeader('text/html'));

          res.end(domManipulator.boards(foundBoards, pageCount));
        }
      });
      // style exception, too simple
    }

  });

};