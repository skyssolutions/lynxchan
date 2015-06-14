'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps');

function deleteBanner(parameters, userData, res) {

  boardOps.deleteBanner(userData.login, parameters, function deletedBanner(
      error, board) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse('Banner deleted.',
          '/bannerManagement.js?boardUri=' + board, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteBanner(parameters, userData, res);

  });

};