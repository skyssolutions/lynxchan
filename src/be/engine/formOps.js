'use strict';

// general operations for the form api
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var bans = require('../db').bans();
var accountOps = require('./accountOps');
var uploadHandler = require('./uploadHandler');
var debug = boot.debug();
var verbose = settings.verbose;
var multiParty = require('multiparty');
var parser = new multiParty.Form({
  uploadDir : settings.tempDirectory || '/tmp',
  autoFiles : true
});
var miscOps = require('./miscOps');
var jsdom = require('jsdom').jsdom;
var domManipulator = require('./domManipulator');
var uploadHandler = require('./uploadHandler');

exports.getCookies = function(req) {
  var parsedCookies = {};

  if (req.headers && req.headers.cookie) {

    var cookies = req.headers.cookie.split(';');

    for (var i = 0; i < cookies.length; i++) {

      var cookie = cookies[i];

      var parts = cookie.split('=');
      parsedCookies[parts.shift().trim()] = decodeURI(parts.join('='));

    }

  }

  return parsedCookies;
};

function getUploadDimensions(toPush, filesToDelete, files, fields,
    parsedCookies, callback) {

  uploadHandler.getImageBounds(toPush.pathInDisk, function gotBounds(error,
      width, height) {
    if (!error) {
      toPush.width = width;
      toPush.height = height;

      fields.files.push(toPush);
    }

    transferFileInformation(filesToDelete, files, fields, parsedCookies,
        callback);
  });

}

function transferFileInformation(filesToDelete, files, fields, parsedCookies,
    callback) {

  if (files.files.length) {

    var file = files.files.shift();

    filesToDelete.push(file.path);

    if (file.size) {
      var toPush = {
        size : file.size,
        title : file.originalFilename,
        pathInDisk : file.path,
        mime : file.headers['content-type']
      };

      if (toPush.mime.indexOf('image/') > -1) {

        getUploadDimensions(toPush, filesToDelete, files, fields,
            parsedCookies, callback);

      } else {
        fields.files.push(toPush);

        transferFileInformation(filesToDelete, files, fields, parsedCookies,
            callback);
      }

    } else {
      transferFileInformation(filesToDelete, files, fields, parsedCookies,
          callback);
    }

  } else {
    callback(parsedCookies, fields);
  }

}

function processParsedRequest(res, fields, files, callback, parsedCookies) {

  for ( var key in fields) {
    if (fields.hasOwnProperty(key)) {
      fields[key] = fields[key][0];
    }
  }

  fields.files = [];

  var filesToDelete = [];

  var endingCb = function() {

    for (var j = 0; j < filesToDelete.length; j++) {
      uploadHandler.removeFromDisk(filesToDelete[j]);
    }

  };

  res.on('close', endingCb);

  res.on('finish', endingCb);

  if (verbose) {
    console.log('Form input: ' + JSON.stringify(fields));
  }
  if (files.files) {

    transferFileInformation(filesToDelete, files, fields, parsedCookies,
        callback);

  } else {
    callback(parsedCookies, fields);
  }

}

function redirectToLogin(res) {

  var header = [ [ 'Location', '/login.html' ] ];

  res.writeHead(302, header);

  res.end();
}

exports.getAuthenticatedPost = function(req, res, getParameters, callback) {

  if (getParameters) {

    exports.getPostData(req, res, function(auth, parameters) {

      accountOps.validate(auth, function validated(error, newAuth, userData) {
        if (error) {
          redirectToLogin(res);
        } else {
          callback(newAuth, userData, parameters);
        }

      });
    });
  } else {

    accountOps.validate(exports.getCookies(req), function validated(error,
        newAuth, userData) {

      if (error) {
        redirectToLogin(res);
      } else {
        callback(newAuth, userData);
      }
    });
  }

};

exports.getPostData = function(req, res, callback) {

  try {

    parser.parse(req, function parsed(error, fields, files) {
      if (error) {
        throw error;
      } else {
        processParsedRequest(res, fields, files, callback, exports
            .getCookies(req));

      }

    });
  } catch (error) {
    callback(error);
  }

};

exports.outputResponse = function(message, redirect, res, cookies, authBlock) {

  if (verbose) {
    console.log(message);
  }

  var header = miscOps.corsHeader('text/html');

  if (authBlock && authBlock.authStatus === 'expired') {
    header.push([ 'Set-Cookie', 'hash=' + authBlock.newHash ]);
  }

  if (cookies) {

    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i];

      var toPush = [ 'Set-Cookie', cookie.field + '=' + cookie.value ];

      if (cookie.expiration) {
        toPush[1] += '; expires=' + cookie.expiration.toString();
      }

      header.push(toPush);

    }

  }

  res.writeHead(200, header);

  res.end(domManipulator.message(message, redirect));

};

exports.outputError = function(error, code, res) {

  if (verbose) {
    console.log(error);
  }

  if (debug) {
    throw error;
  }

  res.writeHead(code, miscOps.corsHeader('text/html'));

  res.end(domManipulator.error(code, error.toString()));

};

exports.checkBlankParameters = function(object, parameters, res) {

  function failCheck(parameter, reason) {

    if (verbose) {
      console.log('Blank reason: ' + reason);
    }

    if (res) {
      var message = 'blank parameter: ' + parameter;
      message += '<br>Reason: ' + reason;
      exports.outputError(message, 400, res);
    }

    return true;
  }

  if (!object) {

    failCheck();

    return true;

  }

  for (var i = 0; i < parameters.length; i++) {
    var parameter = parameters[i];

    if (!object.hasOwnProperty(parameter)) {
      return failCheck(parameter, 'no parameter');

    }

    if (object[parameter] === null) {
      return failCheck(parameter, 'null');
    }

    if (object[parameter] === undefined) {
      return failCheck(parameter, 'undefined');
    }

    if (!object[parameter].toString().trim().length) {
      return failCheck(parameter, 'length');
    }
  }

  return false;

};

function outputBanMessage(ban, res) {

  res.writeHead(200, miscOps.corsHeader('text/html'));
  // add template

  var response = 'You have been banned from ';

  if (ban.boardUri) {
    response += '/' + ban.boardUri + '/';
  } else {
    response += 'all boards';
  }

  response += ' until ' + ban.expiration + ' by ' + ban.appliedBy + '.<br>';

  response += 'Reason: ' + ban.reason;

  res.end(response);

}

exports.checkForBan = function(req, boardUri, res, callback) {

  var ip = req.connection.remoteAddress;

  bans.findOne({
    ip : ip,
    expiration : {
      $gt : new Date()
    },
    $or : [ {
      boardUri : boardUri
    }, {
      boardUri : {
        $exists : false
      }
    } ]
  }, function gotBan(error, ban) {
    if (error) {
      callback(error);
    } else if (ban) {
      outputBanMessage(ban, res);
    } else {
      callback();
    }
  });

};