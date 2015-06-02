'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var modOps = require('../engine/modOps');
var miscOps = require('../engine/miscOps');
var deleteOps = require('../engine/deletionOps');

var reportFields = [ {
  field : 'reason',
  length : 256
} ];

function processPostForDeletion(board, thread, splitKey, threadsToDelete,
    postsToDelete) {
  var threadTestObject = threadsToDelete[board] || [];

  if (threadTestObject.indexOf(+thread) === -1) {

    var post = splitKey[2];

    var boardObject = postsToDelete[board] || [];

    postsToDelete[board] = boardObject;

    boardObject.push(+post);

  }
}

function processSplitKeyForDeletion(splitKey, threadsToDelete, postsToDelete) {

  var longEnough = splitKey.length > 1;

  if (longEnough && !/\W/.test(splitKey[0]) && !isNaN(splitKey[1])) {

    var board = splitKey[0];
    var thread = splitKey[1];

    if (splitKey.length > 2 && !isNaN(splitKey[2])) {

      processPostForDeletion(board, thread, splitKey, threadsToDelete,
          postsToDelete);

    } else {
      var boardObject = threadsToDelete[board] || [];

      boardObject.push(+thread);

      threadsToDelete[board] = boardObject;

    }

  }
}

function processSplitKeyForReporting(splitKey, reportedObjects) {
  var longEnough = splitKey.length > 1;

  if (longEnough && !/\W/.test(splitKey[0]) && !isNaN(splitKey[1])) {

    var board = splitKey[0];
    var thread = splitKey[1];

    var report = {
      board : board,
      thread : thread
    };

    if (splitKey.length > 2 && !isNaN(splitKey[2])) {

      report.post = splitKey[2];
    }

    reportedObjects.push(report);
  }
}

function processParameters(userData, parameters, res) {

  var reportedObjects = [];
  var threads = {};
  var posts = {};

  for ( var key in parameters) {
    if (parameters.hasOwnProperty(key)) {

      var splitKey = key.split('-');

      if (parameters.action.toLowerCase() === 'report') {
        processSplitKeyForReporting(splitKey, reportedObjects);
      } else {
        processSplitKeyForDeletion(splitKey, threads, posts);
      }
    }
  }

  if (parameters.action.toLowerCase() === 'report') {

    miscOps.sanitizeStrings(parameters, reportFields);

    parameters.global = parameters.hasOwnProperty('global');

    modOps.report(reportedObjects, parameters, function createdReports(error) {
      if (error) {
        formOps.outputError(error, 500, res);
      } else {
        formOps.outputResponse('Content reported', '/', res);
      }

    });
  } else {

    deleteOps.posting(userData, parameters, threads, posts,
        function deletedPostings(error) {

          if (error) {
            formOps.outputError(error, res);
          } else {
            formOps.outputResponse('Content deleted', '/', res);
          }

        });
  }

}

exports.process = function(req, res) {

  try {

    formOps.getPostData(req, res, function gotData(auth, parameters) {

      if (parameters.password) {
        parameters.password = parameters.password.trim();

        if (!parameters.password.length) {
          delete parameters.password;
        }
      }

      var deleting = parameters.action.toLowerCase() === 'delete';
      var authenticate = !parameters.password && deleting;

      if (authenticate) {

        // style exception,too simple
        accountOps.validate(auth, function validated(error, auth, userData) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else {
            processParameters(userData, parameters, res);
          }
        });
        // style exception,too simple

      } else {
        processParameters(null, parameters, res);
      }

    });
  } catch (error) {
    formOps.outputError(error, res);
  }

};