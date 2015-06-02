'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');
var deleteOps = require('../engine/deletionOps');

function processReceivedPosting(threadsToDelete, postsToDelete, posting) {
  var boardObject;

  if (posting.post) {
    var testThreadObject = threadsToDelete[posting.board] || [];

    if (testThreadObject.indexOf(+posting.thread) === -1) {

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

function processParameters(userData, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, [ 'postings' ], res)) {
    return;
  }

  var postsToDelete = {};
  var threadsToDelete = {};

  for (var i = 0; i < parameters.postings.length; i++) {
    processReceivedPosting(threadsToDelete, postsToDelete,
        parameters.postings[i]);
  }

  deleteOps.posting(userData, parameters, threadsToDelete, postsToDelete,
      function deletedPostings(error) {

        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(null, null, 'ok', res);
        }

      });

}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

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
          apiOps.outputError(error, res);
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