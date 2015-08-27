'use strict';

var boards = require('../db').boards();
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');
var jsonBuilder = require('../engine/jsonBuilder');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
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
      boards.find({
        settings : {
          $not : {
            $elemMatch : {
              $in : [ 'unindex' ]
            }
          }
        }
      }, {
        _id : 0,
        boardName : 1,
        boardUri : 1,
        tags : 1,
        boardDescription : 1,
        postsPerHour : 1,
        lastPostId : 1
      }).sort({
        postsPerHour : -1,
        lastPostId : -1,
        boardUri : 1
      }).skip(toSkip).limit(pageSize).toArray(
          function(error, foundBoards) {
            if (error) {
              formOps.outputError(error, 500, res);
            } else {
              var json = parameters.json;

              res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
                  : 'text/html'));

              if (json) {
                res.end(jsonBuilder.boards(pageCount, foundBoards));
              } else {
                res.end(domManipulator.boards(foundBoards, pageCount));
              }

            }
          });
      // style exception, too simple

    }
  });
};