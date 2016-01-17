'use strict';

// handles operations on board rules

var db = require('../../db');
var boards = db.boards();
var lang;
var miscOps;
var maxRulesCount;
var globalBoardModeration;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  maxRulesCount = settings.maxBoardRules;
  globalBoardModeration = settings.allowGlobalBoardModeration;

};

exports.loadDependencies = function() {

  miscOps = require('../miscOps');
  lang = require('../langOps').languagePack();

};

exports.addBoardRule = function(parameters, userData, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (userData.login !== board.owner && !globallyAllowed) {
      callback(!lang.errDeniedRuleManagement);
    } else {
      if (board.rules && board.rules.length >= maxRulesCount) {
        callback(lang.errRuleLimitReached);

        return;
      }

      var rule = parameters.rule.substring(0, 512).replace(/[<>]/g,
          function replace(match) {
            return miscOps.htmlReplaceTable[match];
          });

      // style exception, too simple
      boards.updateOne({
        boardUri : parameters.boardUri
      }, {
        $push : {
          rules : rule
        }
      }, function updatedRules(error) {
        if (error) {
          callback(error);
        } else {
          process.send({
            board : board.boardUri,
            rules : true
          });
          callback();
        }
      });
      // style exception, too simple

    }
  });
};

exports.deleteRule = function(parameters, userData, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errNoBoardFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.errDeniedRuleManagement);
    } else {

      if (isNaN(parameters.ruleIndex)) {
        callback(lang.errInvalidIndex);
        return;
      }

      var index = +parameters.ruleIndex;

      if (!board.rules || board.rules.length <= index) {
        callback();
        return;
      }

      board.rules.splice(index, 1);

      // style exception, too simple
      boards.updateOne({
        boardUri : parameters.boardUri
      }, {
        $set : {
          rules : board.rules
        }
      }, function updatedRules(error) {
        if (error) {
          callback(error);
        } else {
          process.send({
            board : board.boardUri,
            rules : true
          });
          callback();
        }
      });
      // style exception, too simple

    }
  });
};

exports.boardRules = function(boardUri, userData, callback) {

  var globallyAllowed;

  if (userData) {
    globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;
  }

  boards.findOne({
    boardUri : boardUri
  }, {
    rules : 1,
    owner : 1,
    _id : 0
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (userData && userData.login !== board.owner && !globallyAllowed) {
      callback(lang.errDeniedRuleManagement);
    } else {
      callback(null, board.rules || []);
    }
  });
};