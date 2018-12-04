'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;

exports.process = function(req, res) {

  var json = formOps.json(req);

  formOps.outputResponse(json ? 'ok' : lang(req.language).msgLogout,
      json ? null : '/login.html', res, [ {
        field : 'login',
        value : 'invadlid login'
      }, {
        field : 'hash',
        value : 'invalid hash'
      } ], null, req.language, json);

};
