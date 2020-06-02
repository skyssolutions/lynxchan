'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var modOps = require('../engine/modOps').ipBan.specific;

exports.denyAppeal = function(userData, parameters, res, auth, language, json) {

  modOps.denyAppeal(userData, parameters.banId, language,
      function appealDenied(error, banType, board) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          var redirect = '/';

          switch (banType) {

          case 'range': {
            redirect += 'rangeBans.js';
            break;
          }

          case 'asn': {
            redirect += 'asnBans.js';
            break;
          }

          default: {
            redirect += 'bans.js';
            break;
          }

          }

          if (board) {
            redirect += '?boardUri=' + board;
          }

          formOps.outputResponse(json ? 'ok' : lang(language).msgAppealDenied,
              json ? null : redirect, res, null, auth, language, json);
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.denyAppeal(userData, parameters, res, auth, req.language, formOps
        .json(req));
  });

};