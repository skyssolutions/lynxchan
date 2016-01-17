'use strict';

var boards = require('../db').boards();
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');
var jsonBuilder = require('../engine/jsonBuilder');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var settingsHandler = require('../settingsHandler');
var url = require('url');

function getQueryBlock(parameters) {

  var queryBlock = {};

  if (parameters.boardUri && parameters.boardUri.length) {
    queryBlock.boardUri = {
      $regex : parameters.boardUri
    };
  } else {
    delete parameters.boardUri;
  }

  if (parameters.tags && parameters.tags.length) {

    var tags = [];

    var rawTags = parameters.tags.split(',');

    for (var i = 0; i < rawTags.length; i++) {
      var tag = rawTags[i].trim();

      if (tag.length) {
        tags.push(tag);
      }
    }

    queryBlock.tags = {
      $all : tags
    };

  } else {
    delete parameters.tags;
  }

  return queryBlock;

}

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  var page = parameters.page || 1;

  var queryBlock = getQueryBlock(parameters);

  var pageSize = settingsHandler.getGeneralSettings().boardsPerPage;

  boards.count(queryBlock, function(error, count) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var pageCount = Math.floor(count / pageSize);
      pageCount += (count % pageSize ? 1 : 0);

      pageCount = pageCount || 1;

      var toSkip = (parameters.page - 1) * pageSize;

      queryBlock.settings = {
        $not : {
          $elemMatch : {
            $in : [ 'unindex' ]
          }
        }
      };

      // style exception, too simple
      boards.find(queryBlock, {
        _id : 0,
        boardName : 1,
        boardUri : 1,
        uniqueIps : 1,
        tags : 1,
        boardDescription : 1,
        postsPerHour : 1,
        lastPostId : 1
      }).sort({
        uniqueIps : -1,
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
                res.end(domManipulator.boards(parameters, foundBoards,
                    pageCount));
              }

            }
          });
      // style exception, too simple

    }
  });
};