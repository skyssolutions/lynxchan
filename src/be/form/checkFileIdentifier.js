'use strict';

var url = require('url');
var db = require('../db');
var references = db.uploadReferences();
var miscOps = require('../engine/miscOps');

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  references.findOne({
    identifier : parameters.identifier
  }, {
    identifier : 1,
    _id : 0
  }, function foundReference(error, reference) {

    res.writeHead(200, miscOps.getHeader('application/json'));

    res.end(reference ? 'true' : 'false');

  });

};