'use strict';

var boards = require('../db').boards();
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');
var jsonBuilder = require('../engine/jsonBuilder');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var settingsHandler = require('../settingsHandler');
var url = require('url');

exports.getTags = function(parameters) {

  var tags = [];

  var rawTags = parameters.tags.split(',');

  for (var i = 0; i < rawTags.length; i++) {
    var tag = rawTags[i].trim().toLowerCase();

    if (tag.length) {
      tags.push(tag);
    }
  }

  return tags;

};

exports.getQueryBlock = function(parameters) {

  var queryBlock = {};

  if (parameters.boardUri && parameters.boardUri.length) {
    queryBlock.boardUri = {
      $regex : parameters.boardUri
    };
  } else {
    delete parameters.boardUri;
  }

  if (parameters.sfw) {
    queryBlock.specialSettings = 'sfw';
  }

  if (parameters.inactive) {
    queryBlock.inactive = true;
  }

  if (parameters.tags && parameters.tags.length) {

    queryBlock.tags = {
      $all : exports.getTags(parameters)
    };

  } else {
    delete parameters.tags;
  }

  queryBlock.settings = parameters.unindexed ? 'unindex' : {
    $not : {
      $elemMatch : {
        $in : [ 'unindex' ]
      }
    }
  };

  return queryBlock;

};

exports.getSortBlock = function(parameters) {

  switch (parameters.sorting) {

  case '1':
    return {
      uniqueIps : 1,
      postsPerHour : 1,
      lastPostId : 1
    };

  case '2':
    return {
      lastPostId : -1
    };

  case '3':
    return {
      lastPostId : 1
    };

  case '4':
    return {
      postsPerHour : -1
    };

  case '5':
    return {
      postsPerHour : 1
    };

  case '6':
    return {
      boardUri : 1
    };

  case '7':
    return {
      boardUri : -1
    };

  default:
    return {
      uniqueIps : -1,
      postsPerHour : -1,
      lastPostId : -1
    };
  }
};

exports.countDocuments = function(userData, auth, parameters, req, res) {

  var page = parameters.page || 1;
  var queryBlock = exports.getQueryBlock(parameters);
  var pageSize = settingsHandler.getGeneralSettings().boardsPerPage;
  var json = parameters.json;

  boards.countDocuments(queryBlock, function(error, count) {
    if (error) {
      formOps.outputError(error, 500, res, req.language, json);
    } else {
      var pageCount = Math.ceil(count / pageSize);

      pageCount = pageCount || 1;

      var toSkip = (parameters.page - 1) * pageSize;

      // style exception, too simple
      boards.find(queryBlock, {
        projection : {
          _id : 0,
          boardName : 1,
          boardUri : 1,
          inactive : 1,
          specialSettings : 1,
          uniqueIps : 1,
          tags : 1,
          boardDescription : 1,
          postsPerHour : 1,
          lastPostId : 1
        }
      }).sort(exports.getSortBlock(parameters)).skip(toSkip).limit(pageSize)
          .toArray(
              function(error, foundBoards) {
                if (error) {
                  formOps
                      .outputError(error, 500, res, req.language, json, auth);
                } else {

                  if (json) {
                    formOps.outputResponse('ok', jsonBuilder.boards(pageCount,
                        foundBoards), res, null, auth, null, true);
                  } else {

                    return formOps
                        .dynamicPage(res, domManipulator.boards(parameters,
                            foundBoards, pageCount, req.language), auth);

                  }

                }
              });
      // style exception, too simple

    }
  });

};

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  if (!parameters.unindexed) {
    return exports.countDocuments(null, null, parameters, req, res);
  }

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        if (!userData) {
          delete parameters.unindexed;
          return exports.countDocuments(null, null, parameters, req, res);
        }

        var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

        if (!globalStaff) {
          delete parameters.unindexed;
        }

        exports.countDocuments(auth, userData, parameters, req, res);
      }, true, true);

};