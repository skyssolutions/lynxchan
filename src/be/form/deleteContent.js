'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var deleteOps = require('../engine/deletionOps');

function processPost(board, thread, splitKey, threadsToDelete, postsToDelete) {
  var threadTestObject = threadsToDelete[board] || [];

  if (threadTestObject.indexOf(+thread) === -1) {

    var post = splitKey[2];

    var boardObject = postsToDelete[board] || [];

    postsToDelete[board] = boardObject;

    boardObject.push(+post);

  }
}

function processSplitKey(splitKey, threadsToDelete, postsToDelete) {

  var longEnough = splitKey.length > 1;

  if (longEnough && !/\W/.test(splitKey[0]) && !isNaN(splitKey[1])) {

    var board = splitKey[0];
    var thread = splitKey[1];

    if (splitKey.length > 2 && !isNaN(splitKey[2])) {

      processPost(board, thread, splitKey, threadsToDelete, postsToDelete);

    } else {
      var boardObject = threadsToDelete[board] || [];

      boardObject.push(+thread);

      threadsToDelete[board] = boardObject;

    }

  }
}

function processParameters(userData, parameters, res) {

  var threadsToDelete = {};
  var postsToDelete = {};

  for ( var key in parameters) {

    if (parameters.hasOwnProperty(key)) {
      var splitKey = key.split('-');

      processSplitKey(splitKey, threadsToDelete, postsToDelete);

    }
  }

  deleteOps.posting(userData, parameters, threadsToDelete, postsToDelete,
      function deletedPostings(error) {

        if (error) {
          formOps.outputError(error, res);
        } else {
          formOps.outputResponse('Content deleted', '/', res);
        }

      });

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    if (parameters.password) {
      parameters.password = parameters.password.trim();

      if (!parameters.password.length) {
        delete parameters.password;
      }
    }

    if (!parameters.password) {

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

};