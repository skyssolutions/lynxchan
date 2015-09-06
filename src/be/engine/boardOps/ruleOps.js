'use strict';

var db = require('../../db');
var boards = db.boards();
var settings = require('../../boot').getGeneralSettings();
var maxRulesCount = settings.maxBoardRules;
var lang;
var miscOps;

exports.loadDependencies = function() {

  miscOps = require('../miscOps');
  lang = require('../langOps').languagePack();

};

exports.addBoardRule = function(parameters, userData, callback) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (userData.login !== board.owner) {
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

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errNoBoardFound);
    } else if (board.owner !== userData.login) {
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
    } else if (userData && userData.login !== board.owner) {
      callback(lang.errDeniedRuleManagement);
    } else {
      callback(null, board.rules || []);
    }
  });
};