'use strict';

// handle board filter operations

var maxFiltersCount;
var db = require('../../db');
var filters = db.filters();
var boards = db.boards();
var miscOps;
var lang;
var globalBoardModeration;

var filterParameters = [ {
  field : 'originalTerm',
}, {
  field : 'replacementTerm',
  removeHTML : true
} ];

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();
  maxFiltersCount = settings.maxFilters;
  globalBoardModeration = settings.allowGlobalBoardModeration;

  for (var i = 0; i < filterParameters.length; i++) {
    filterParameters[i].length = settings.maxFilterLength;
  }

};

exports.loadDependencies = function() {

  miscOps = require('../miscOps');
  lang = require('../langOps').languagePack;

};

// Section 1: Filter creation {
exports.setFilter = function(board, callback, parameters) {
  var existingFilters = board.filters || [];

  var found = false;

  for (var i = 0; i < existingFilters.length; i++) {
    var filter = existingFilters[i];

    if (filter.originalTerm === parameters.originalTerm) {
      found = true;

      filter.caseInsensitive = !!parameters.caseInsensitive;
      filter.replacementTerm = parameters.replacementTerm;

      break;
    }
  }

  if (!found) {

    existingFilters.push({
      originalTerm : parameters.originalTerm,
      replacementTerm : parameters.replacementTerm,
      caseInsensitive : !!parameters.caseInsensitive
    });

  }

  boards.updateOne({
    boardUri : parameters.boardUri
  }, {
    $set : {
      filters : existingFilters
    }
  }, function updatedFilters(error) {
    callback(error);
  });

};

exports.createFilter = function(userData, parameters, language, callback) {

  miscOps.sanitizeStrings(parameters, filterParameters);

  var admin = userData.globalRole <= 1;

  if (!parameters.boardUri) {

    if (!admin) {
      return callback(lang(language).errDeniedGlobalManagement);
    }

    return filters.updateOne({
      originalTerm : parameters.originalTerm
    }, {
      $set : {
        replacementTerm : parameters.replacementTerm,
        caseInsensitive : !!parameters.caseInsensitive
      }
    }, {
      upsert : 1
    }, callback);

  }

  var globallyAllowed = admin && globalBoardModeration;

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedChangeBoardSettings);
    } else if (board.filters && board.filters.length >= maxFiltersCount) {
      callback(lang(language).errMaxFiltersReached);
    } else {
      exports.setFilter(board, callback, parameters);
    }
  });

};
// } Section 1: Filter creation

exports.deleteFilter = function(userData, parameters, language, callback) {

  var admin = userData.globalRole <= 1;

  if (!parameters.boardUri) {

    if (!admin) {
      return callback(lang(language).errDeniedGlobalManagement);
    }

    return filters.removeOne({
      originalTerm : parameters.filterIdentifier
    }, callback);

  }

  var globallyAllowed = admin && globalBoardModeration;

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedChangeBoardSettings);
    } else {

      var existingFilters = board.filters || [];

      for (var i = 0; i < existingFilters.length; i++) {
        var filter = existingFilters[i];
        if (filter.originalTerm === parameters.filterIdentifier) {

          existingFilters.splice(i, 1);

          break;
        }

      }

      // style exception, too simple
      boards.updateOne({
        boardUri : parameters.boardUri
      }, {
        $set : {
          filters : existingFilters
        }
      }, function updatedFilters(error) {
        callback(error);
      });
      // style exception, too simple

    }
  });

};

exports.getFilterData = function(userData, boardUri, language, callback) {

  var admin = userData.globalRole <= 1;

  if (!boardUri) {

    if (!admin) {
      return callback(lang(language).errDeniedGlobalManagement);
    } else {
      return filters.find({}).toArray(callback);
    }

  }

  var globallyAllowed = admin && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (userData.login !== board.owner && !globallyAllowed) {
      callback(lang(language).errDeniedChangeBoardSettings);
    } else {
      callback(null, board.filters || []);
    }
  });

};