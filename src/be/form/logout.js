'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;

exports.process = function(req, res) {

  formOps.outputResponse(lang(req.language).msgLogout, '/login.html', res, [ {
    field : 'login',
    value : 'invadlid login'
  }, {
    field : 'hash',
    value : 'invalid hash'
  } ], null, req.language);

};
