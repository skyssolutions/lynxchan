'use strict';

var exec = require('child_process').exec;
var url = require('url');
var formOps = require('../engine/formOps');

exports.process = function(req, res) {

  if (!req.fromSlave) {
    return req.connection.destroy();
  }

  var toRemove = url.parse(req.url, true).query.ids.split(',');

  var cmd = 'rm -f';

  for (var i = 0; i < toRemove.length; i++) {

    var idString = toRemove[i];

    cmd += ' ' + __dirname + '/../media/';
    cmd += idString.substring(idString.length - 3) + '/' + idString;
  }

  exec(cmd, function(error) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse('', '/', res);
    }

  });

};