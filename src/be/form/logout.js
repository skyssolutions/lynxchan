'use strict';

var formOps = require('../engine/formOps');

exports.process = function(req, res) {

  formOps.outputResponse('You have been logged out.', '/login.html', res, [ {
    field : 'login',
    value : 'invadlid login'
  }, {
    field : 'hash',
    value : 'invalid hash'
  } ]);

};
