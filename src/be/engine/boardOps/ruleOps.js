'use strict';

// handles operations on board rules

var db = require('../../db');
var boards = db.boards();
var lang;
var miscOps;
var maxRulesCount;
var globalBoardModeration;

var newRuleParameters = [ {
  field : 'rule',
  length : 512,
  removeHTML : true
} ];

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  maxRulesCount = settings.maxBoardRules;
  globalBoardModeration = settings.allowGlobalBoardModeration;

};

exports.loadDependencies = function() {

  miscOps = require('../miscOps');
  lang = require('../langOps').languagePack;

};

exports.addBoardRule = function(parameters, userData, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      return callback(error);
    } else if (!board) {
      return callback(lang(language).errBoardNotFound);
    } else if (userData.login !== board.owner && !globallyAllowed) {
      return callback(!lang(language).errDeniedRuleManagement);
    }

    if (board.rules && board.rules.length >= maxRulesCount) {
      return callback(lang(language).errRuleLimitReached);
    }

    miscOps.sanitizeStrings(parameters, newRuleParameters);

    // style exception, too simple
    boards.updateOne({
      boardUri : parameters.boardUri
    }, {
      $push : {
        rules : parameters.rule
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

  });
};

exports.deleteRule = function(parameters, userData, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      return callback(error);
    } else if (!board) {
      return callback(lang(language).errNoBoardFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      return callback(lang(language).errDeniedRuleManagement);
    }

    if (isNaN(parameters.ruleIndex)) {
      return callback(lang(language).errInvalidIndex);
    }

    var index = +parameters.ruleIndex;

    if (!board.rules || board.rules.length <= index) {
      return callback();
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

  });
};

exports.boardRules = function(boardUri, userData, language, callback) {

  var globallyAllowed;

  if (userData) {
    globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;
  }

  boards.findOne({
    boardUri : boardUri
  }, {
    projection : {
      rules : 1,
      owner : 1,
      _id : 0
    }
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (userData && userData.login !== board.owner && !globallyAllowed) {
      callback(lang(language).errDeniedRuleManagement);
    } else {
      callback(null, board.rules || []);
    }
  });
};

exports.editRule = function(parameters, userData, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      return callback(error);
    } else if (!board) {
      return callback(lang(language).errNoBoardFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      return callback(lang(language).errDeniedRuleManagement);
    }

    if (isNaN(parameters.ruleIndex)) {
      return callback(lang(language).errInvalidIndex);
    }

    miscOps.sanitizeStrings(parameters, newRuleParameters);

    var index = +parameters.ruleIndex;

    if (!parameters.rule || !board.rules || board.rules.length <= index) {
      return callback();
    }

    board.rules[index] = parameters.rule;

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

  });

};