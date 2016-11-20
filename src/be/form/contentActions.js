'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var modOps = require('../engine/modOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var lang = require('../engine/langOps').languagePack();
var lang = require('../engine/langOps').languagePack();
var miscOps = require('../engine/miscOps');
var deleteOps = require('../engine/deletionOps');

function processPostForDeletion(board, thread, splitKey, threadsToDelete,
    postsToDelete, onlyFiles) {
  var threadTestObject = threadsToDelete[board] || [];

  if (threadTestObject.indexOf(+thread) === -1 || onlyFiles) {

    var post = splitKey[2];

    var boardObject = postsToDelete[board] || [];

    postsToDelete[board] = boardObject;

    boardObject.push(+post);

  }
}

function processSplitKeyForDeletion(splitKey, threadsToDelete, postsToDelete,
    onlyFiles) {

  var longEnough = splitKey.length > 1;

  if (longEnough && !/\W/.test(splitKey[0]) && !isNaN(splitKey[1])) {

    var board = splitKey[0];
    var thread = splitKey[1];

    if (splitKey.length > 2 && !isNaN(splitKey[2])) {

      processPostForDeletion(board, thread, splitKey, threadsToDelete,
          postsToDelete, onlyFiles);

    } else {
      var boardObject = threadsToDelete[board] || [];

      boardObject.push(+thread);

      threadsToDelete[board] = boardObject;

    }

  }
}

function processSplitKeyForGeneralUse(splitKey, reportedObjects) {
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

function getProcessedObjects(parameters, threads, posts, reportedObjects) {

  var redirectBoard;
  var i = 0;

  for ( var key in parameters) {
    if (parameters.hasOwnProperty(key)) {

      var splitKey = key.split('-');

      if (!redirectBoard) {
        redirectBoard = splitKey[0];
      }

      if (parameters.action.toLowerCase() === 'delete') {
        processSplitKeyForDeletion(splitKey, threads, posts,
            parameters.deleteUploads);
      } else {
        processSplitKeyForGeneralUse(splitKey, reportedObjects);
      }

      if (i < 1000) {
        i++;
      } else {
        break;
      }
    }

  }

  return redirectBoard;

}

function processParameters(req, userData, parameters, res, captchaId, auth) {

  var reportedObjects = [];
  var threads = {};
  var posts = {};
  var redirectBoard = getProcessedObjects(parameters, threads, posts,
      reportedObjects);

  redirectBoard = redirectBoard ? '/' + redirectBoard + '/' : '/';

  parameters.global = parameters.hasOwnProperty('global');

  if (parameters.action.toLowerCase() === 'spoil') {

    modOps.spoiler.spoiler(userData, reportedObjects, function(error) {
      if (error) {
        formOps.outputError(error, 500, res);
      } else {
        formOps.outputResponse(lang.msgContentSpoilered, redirectBoard, res,
            null, auth, req.language);
      }
    });

  } else if (parameters.action.toLowerCase() === 'report') {

    modOps.report.report(req, reportedObjects, parameters, captchaId,
        function createdReports(error, ban) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else if (ban) {
            res.writeHead(200, miscOps.corsHeader('text/html'));

            var board = ban.boardUri ? '/' + ban.boardUri + '/'
                : lang.miscAllBoards.toLowerCase();

            res.end(domManipulator.ban(ban, board));
          } else {
            formOps.outputResponse(lang.msgContentReported, redirectBoard, res,
                null, auth, req.language);
          }

        });
  } else if (parameters.action.toLowerCase() === 'ban') {

    parameters.banType = +parameters.banType;

    modOps.ipBan.specific.ban(userData, reportedObjects, parameters, captchaId,
        function(error) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else {
            formOps.outputResponse(lang.msgUsersBanned, redirectBoard, res,
                null, auth, req.language);
          }
        });

  } else if (parameters.action.toLowerCase() === 'ip-deletion') {

    deleteOps.deleteFromIpOnBoard(reportedObjects, userData, function deleted(
        error) {

      if (error) {
        formOps.outputError(error, 500, res);
      } else {
        formOps.outputResponse(lang.msgDeletedFromIp, redirectBoard, res, null,
            auth, req.language);
      }

    });

  } else {

    deleteOps.postingDeletions.posting(userData, parameters, threads, posts,
        function deletedPostings(error, removedThreads, removedPosts) {

          if (error) {
            formOps.outputError(error, 500, res);
          } else {

            formOps.outputResponse(lang.msgContentDeleted.replace('{$threads}',
                removedThreads).replace('{$posts}', removedPosts),
                redirectBoard, res, null, auth, req.language);
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

      parameters.action = parameters.action || '';

      var action = parameters.action.toLowerCase();

      var deleting = action === 'delete';
      var banning = action === 'ban';
      var ipDeleting = action === 'ip-deletion';
      var spoiling = action === 'spoil';
      var authenticate = banning || (!parameters.password && deleting);
      authenticate = authenticate || spoiling || ipDeleting;

      if (authenticate) {

        // style exception,too simple
        accountOps.validate(auth, function validated(error, newAuth, userData) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else {
            processParameters(req, userData, parameters, res, auth.captchaid,
                newAuth);
          }
        });
        // style exception,too simple

      } else {
        processParameters(req, null, parameters, res, auth.captchaid);
      }

    });
  } catch (error) {
    formOps.outputError(error, 500, res);
  }

};