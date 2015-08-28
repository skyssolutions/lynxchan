'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').report;
var lang = require('../engine/langOps').languagePack();

function reportContent(req, parameters, res, captchaId) {

  parameters.global = parameters.global ? true : false;

  modOps.report(req, parameters.postings || [], parameters, captchaId,
      function createdReports(error, ban) {
        if (error) {
          apiOps.outputError(error, res);
        } else if (ban) {
          apiOps.outputResponse(null, {
            reason : ban.reason,
            range : ban.range,
            banId : ban._id,
            expiration : ban.expiration,
            board : ban.boardUri ? '/' + ban.boardUri + '/'
                : lang.miscAllBoards.toLowerCase()
          }, 'banned', res);
        } else {
          apiOps.outputResponse(null, null, 'ok', res);
        }
      });
}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res,
      function gotData(auth, parameters, captchaId) {
        reportContent(req, parameters, res, captchaId);
      });
};