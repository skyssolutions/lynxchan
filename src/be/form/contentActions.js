'use strict';

var settingHandler = require('../settingsHandler');
var logger = require('../logger');
var taskListener = require('../taskListener');
var lang = require('../engine/langOps').languagePack;
var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var modOps = require('../engine/modOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var lang = require('../engine/langOps').languagePack;
var miscOps = require('../engine/miscOps');
var deleteOps = require('../engine/deletionOps');
var mandatoryAuth = [ 'spoil', 'ban', 'ip-deletion' ];

exports.processPostForDeletion = function(board, splitKey, postsToDelete) {

  var post = splitKey[2];

  var boardObject = postsToDelete[board] || [];

  postsToDelete[board] = boardObject;

  boardObject.push(+post);

};

exports.processSplitKeyForDeletion = function(splitKey, threadsToDelete,
    postsToDelete) {

  var board = splitKey[0];
  var thread = splitKey[1];

  if (splitKey.length > 2 && !isNaN(splitKey[2])) {

    exports.processPostForDeletion(board, splitKey, postsToDelete);

  } else {
    var boardObject = threadsToDelete[board] || [];

    boardObject.push(+thread);

    threadsToDelete[board] = boardObject;

  }

};

exports.processSplitKeyForGeneralUse = function(splitKey, reportedObjects) {

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

};

exports.decideProcessing = function(parameters, split, threads, posts,
    reportedObjects) {

  if (parameters.action === 'delete') {
    exports.processSplitKeyForDeletion(split, threads, posts);
  } else {
    exports.processSplitKeyForGeneralUse(split, reportedObjects);
  }

};

exports.getProcessedObjects = function(parameters, threads, posts,
    reportedObjects) {

  var redirectBoard;
  var i = 0;

  for ( var key in parameters) {
    if (parameters.hasOwnProperty(key)) {

      var split = key.split('-');

      if (!redirectBoard && split.length > 1) {
        redirectBoard = split[0];
      }

      if (split.length === 1 || /\W/.test(split[0]) || isNaN(split[1])) {
        continue;
      }

      exports.decideProcessing(parameters, split, threads, posts,
          reportedObjects);

      if (i < 1000) {
        i++;
      } else {
        break;
      }
    }

  }

  return redirectBoard ? '/' + redirectBoard + '/' : '/';

};

exports.processParameters = function(req, userData, parameters, res, captchaId,
    auth) {

  var reportedObjects = [];
  var threads = {};
  var posts = {};
  var redirectBoard = exports.getProcessedObjects(parameters, threads, posts,
      reportedObjects);

  var json = formOps.json(req);

  switch (parameters.action) {
  case 'spoil': {

    modOps.spoiler.spoiler(userData, reportedObjects, req.language, function(
        error) {
      if (error) {
        formOps.outputError(error, 500, res, req.language, json, auth);
      } else {
        formOps.outputResponse(json ? 'ok'
            : lang(req.language).msgContentSpoilered, json ? null
            : redirectBoard, res, null, auth, req.language, json);
      }
    });

    break;
  }

  case 'report': {

    modOps.report.report(req, reportedObjects, parameters, captchaId,
        function createdReports(error, ban) {
          if (error) {
            formOps.outputError(error, 500, res, req.language, json, auth);
          } else if (ban) {
            formOps.outputBan(ban, null, req, res, json, null, auth);
          } else {

            formOps.outputResponse(json ? 'ok'
                : lang(req.language).msgContentReported, json ? null
                : redirectBoard, res, null, auth, req.language, json);

          }

        });

    break;
  }

  case 'ban':
  case 'ban-delete': {

    modOps.ipBan.specific.ban(userData, reportedObjects, parameters, captchaId,
        req.language, function(error) {
          if (error) {
            formOps.outputError(error, 500, res, req.language, json, auth);
          } else if (parameters.action === 'ban-delete') {
            parameters.action = 'delete';
            exports.processParameters(req, userData, parameters, res,
                captchaId, auth);
          } else {
            formOps.outputResponse(json ? 'ok'
                : lang(req.language).msgUsersBanned, json ? null
                : redirectBoard, res, null, auth, req.language, json);
          }
        });

    break;
  }

  case 'thread-ip-deletion':
  case 'ip-deletion': {

    deleteOps.deleteFromIpOnBoard(parameters.action === 'thread-ip-deletion',
        parameters.confirmation, reportedObjects, userData, req.language,
        function deleted(error) {

          if (error) {
            formOps.outputError(error, 500, res, req.language, json, auth);
          } else {
            formOps.outputResponse(json ? 'ok'
                : lang(req.language).msgDeletedFromIp, json ? null
                : redirectBoard, res, null, auth, req.language, json);
          }

        });

    break;
  }

  default: {
    exports.testDeletionFlood(userData, parameters, threads, posts, req, res,
        json, auth, redirectBoard);
  }

  }

};

exports.testDeletionFlood = function(userData, parameters, threads, posts, req,
    res, json, auth, redirectBoard) {

  if (userData || settingHandler.getGeneralSettings().disableFloodCheck) {
    return exports.runDeletion(userData, parameters, threads, posts,
        req.language, res, json, auth, redirectBoard);
  }

  var ip = logger.convertIpToArray(logger.getRawIp(req));

  taskListener.openSocket(function opened(error, socket) {

    if (error) {
      formOps.outputError(error, 500, res, req.language, json, auth);
      return;
    }

    socket.onData = function receivedData(data) {

      if (data.flood) {

        formOps.outputError(lang(req.language).errFlood.replace('{$time}',
            data.left), 500, res, req.language, json);

      } else {
        exports.runDeletion(userData, parameters, threads, posts, req.language,
            res, json, auth, redirectBoard);
      }

      taskListener.freeSocket(socket);

    };

    taskListener.sendToSocket(socket, {
      type : 'floodCheck',
      ip : ip,
      record : true
    });

  });

};

exports.runDeletion = function(userData, parameters, threads, posts, language,
    res, json, auth, redirectBoard) {

  deleteOps.postingDeletions.posting(userData, parameters, threads, posts,
      language, function deletedPostings(error, removedThreads, removedPosts) {

        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          formOps.outputResponse(json ? 'ok' : lang(language).msgContentDeleted
              .replace('{$threads}', removedThreads).replace('{$posts}',
                  removedPosts), json ? {
            removedThreads : removedThreads,
            removedPosts : removedPosts
          } : redirectBoard, res, null, auth, language, json);
        }

      });

};

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

    if (mandatoryAuth.indexOf(parameters.action) > -1 && !userData) {
      formOps.redirectToLogin(res);
      return;
    }

    var cookies = formOps.getCookies(req);

    exports.processParameters(req, userData, parameters, res,
        cookies.captchaid, newAuth);

  }, true);

};