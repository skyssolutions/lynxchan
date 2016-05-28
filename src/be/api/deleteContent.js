'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');
var deleteOps = require('../engine/deletionOps').postingDeletions;

function processReceivedPosting(threadsToDelete, postsToDelete, posting,
    onlyFiles) {
  var boardObject;

  if (!posting.board || !posting.thread) {
    return;
  }

  posting.board = posting.board.toString();

  if (posting.post) {
    var testThreadObject = threadsToDelete[posting.board] || [];

    if (testThreadObject.indexOf(+posting.thread) === -1 || onlyFiles) {

      boardObject = postsToDelete[posting.board] || [];

      boardObject.push(+posting.post);

      postsToDelete[posting.board] = boardObject;
    }
  } else {

    boardObject = threadsToDelete[posting.board] || [];

    boardObject.push(+posting.thread);

    threadsToDelete[posting.board] = boardObject;
  }
}

function processParameters(userData, parameters, res, auth) {

  if (apiOps.checkBlankParameters(parameters, [ 'postings' ], res)) {
    return;
  }

  var postsToDelete = {};
  var threadsToDelete = {};

  for (var i = 0; i < parameters.postings.length && i < 1000; i++) {
    processReceivedPosting(threadsToDelete, postsToDelete,
        parameters.postings[i], parameters.deleteUploads);
  }

  deleteOps.posting(userData, parameters, threadsToDelete, postsToDelete,
      function deletedPostings(error, removedThreads, removedPosts) {

        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(auth, {
            removedThreads : removedThreads,
            removedPosts : removedPosts
          }, 'ok', res);
        }
      });
}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    if (parameters.password) {
      parameters.password = parameters.password.toString().trim();

      if (!parameters.password.length) {
        delete parameters.password;
      }
    }

    parameters.postings = parameters.postings || [];

    if (!parameters.password) {

      // style exception,too simple
      accountOps.validate(auth, function validated(error, auth, userData) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          processParameters(userData, parameters, res, auth);
        }
      });
      // style exception,too simple

    } else {
      processParameters(null, parameters, res);
    }
  });
};