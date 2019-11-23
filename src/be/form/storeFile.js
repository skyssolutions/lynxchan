'use strict';

var exec = require('child_process').exec;
var formOps = require('../engine/formOps');

exports.process = function(req, res) {

  if (!req.fromSlave) {
    return req.connection.destroy();
  }

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    var file = parameters.files[0];

    var newPath = __dirname + '/../media/' + file.title;

    // style exception, too simple
    exec('cp ' + file.pathInDisk + ' ' + newPath, function(error) {

      if (error) {
        formOps.outputError(error, 500, res);
      } else {
        formOps.outputResponse('', '/', res);
      }

    });
    // style exception, too simple

  });

};