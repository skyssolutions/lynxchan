'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var modOps = require('../engine/modOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var lang = require('../engine/langOps').languagePack;
var miscOps = require('../engine/miscOps');
var deleteOps = require('../engine/deletionOps');
var mandatoryAuth = [ 'spoil', 'ban', 'ip-deletion' ];

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

      if (parameters.action === 'delete') {
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

  return redirectBoard ? '/' + redirectBoard + '/' : '/';

}

function processParameters(req, userData, parameters, res, captchaId, auth) {

  var reportedObjects = [];
  var threads = {};
  var posts = {};
  var redirectBoard = getProcessedObjects(parameters, threads, posts,
      reportedObjects);

  switch (parameters.action) {
  case 'spoil': {

    modOps.spoiler.spoiler(userData, reportedObjects, req.language, function(
        error) {
      if (error) {
        formOps.outputError(error, 500, res, req.language);
      } else {
        formOps.outputResponse(lang(req.language).msgContentSpoilered,
            redirectBoard, res, null, auth, req.language);
      }
    });

    break;
  }

  case 'report': {

    modOps.report.report(req, reportedObjects, parameters, captchaId,
        function createdReports(error, ban) {
          if (error) {
            formOps.outputError(error, 500, res, req.language);
          } else if (ban) {
            res.writeHead(200, miscOps.corsHeader('text/html'));

            var board = ban.boardUri ? '/' + ban.boardUri + '/'
                : lang(req.language).miscAllBoards.toLowerCase();

            res.end(domManipulator.ban(ban, board));
          } else {
            formOps.outputResponse(lang(req.language).msgContentReported,
                redirectBoard, res, null, auth, req.language);
          }

        });

    break;
  }

  case 'ban': {

    parameters.banType = +parameters.banType;

    modOps.ipBan.specific.ban(userData, reportedObjects, parameters, captchaId,
        req.language, function(error) {
          if (error) {
            formOps.outputError(error, 500, res, req.language);
          } else {
            formOps.outputResponse(lang(req.language).msgUsersBanned,
                redirectBoard, res, null, auth, req.language);
          }
        });

    break;
  }

  case 'ip-deletion': {

    deleteOps.deleteFromIpOnBoard(reportedObjects, userData, req.language,
        function deleted(error) {

          if (error) {
            formOps.outputError(error, 500, res, req.language);
          } else {
            formOps.outputResponse(lang(req.language).msgDeletedFromIp,
                redirectBoard, res, null, auth, req.language);
          }

        });

    break;
  }

  default: {

    deleteOps.postingDeletions
        .posting(userData, parameters, threads, posts, req.language,
            function deletedPostings(error, removedThreads, removedPosts) {

              if (error) {
                formOps.outputError(error, 500, res, req.language);
              } else {

                formOps.outputResponse(lang(req.language).msgContentDeleted
                    .replace('{$threads}', removedThreads).replace('{$posts}',
                        removedPosts), redirectBoard, res, null, auth,
                    req.language);
              }

            });

  }

  }

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(newAuth,
      userData, parameters) {

    if (parameters.password) {
      parameters.password = parameters.password.trim();

      if (!parameters.password.length) {
        delete parameters.password;
      }
    }

    parameters.action = (parameters.action || '').toLowerCase();

    parameters.global = parameters.hasOwnProperty('global');

    if (mandatoryAuth.indexOf(parameters.action) > -1 && !userData) {
      formOps.redirectToLogin(res);
      return;
    }

    var cookies = formOps.getCookies(req);

    processParameters(req, userData, parameters, res, cookies.captchaid,
        newAuth);

  }, true);

};