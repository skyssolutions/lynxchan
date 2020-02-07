'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var db = require('../db');
var references = db.uploadReferences();
var miscOps = require('../engine/miscOps');

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  references.findOne({
    sha256 : parameters.identifier
  }, {
    projection : {
      sha256 : 1,
      _id : 0
    }
  }, function foundReference(error, reference) {
    formOps.outputResponse('ok', !!reference, res, null, null, null, true);
  });

};