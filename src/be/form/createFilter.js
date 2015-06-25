'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var boardOps = require('../engine/boardOps');
var mandatoryParameters = [ 'boardUri', 'originalTerm', 'replacementTerm' ];

function createFilter(parameters, userData, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.createFilter(userData.login, parameters, function filterCreated(
      error, filters) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirect = '/filterManagement.js?boardUri=' + parameters.boardUri;
      formOps.outputResponse('Filter created.', redirect, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    createFilter(parameters, userData, res);

  });

};