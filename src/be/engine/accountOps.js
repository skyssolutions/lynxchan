'use strict';

var db = require('../db');
var users = db.users();
var requests = db.recoveryRequests();
var miscOps = require('./miscOps');
var bcrypt = require('bcrypt');
var domManipulator = require('./domManipulator');
var logger = require('../logger');
var logs = db.logs();
var crypto = require('crypto');
var mailer = require('nodemailer').createTransport();
var settings = require('../boot').getGeneralSettings();
var sender = settings.emailSender || 'noreply@mychan.com';
var creationDisabled = settings.disableAccountCreation;
var validAccountSettings = [ 'alwaysSignRole' ];
var lang = require('./langOps').languagePack();

var newAccountParameters = [ {
  field : 'login',
  length : 16
}, {
  field : 'email',
  length : 64
} ];

var changeSettingsParameters = [ {
  field : 'email',
  length : 64
} ];

exports.validAccountSettings = function() {
  return validAccountSettings;
};

// start of global role change
function logRoleChange(operatorData, parameters, callback) {

  var logMessage = '';

  if (operatorData) {
    logMessage += lang.logGlobalRoleChange.userPiece.replace('{$login}',
        operatorData.login);
  } else {
    logMessage += lang.logGlobalRoleChange.adminPiece;
  }

  logMessage += lang.logGlobalRoleChange.mainPiece.replace('{$login}',
      parameters.login).replace('{$role}',
      miscOps.getGlobalRoleLabel(parameters.role));

  logs.insert({
    user : operatorData ? operatorData.login : null,
    type : 'globalRoleChange',
    time : new Date(),
    description : logMessage,
    global : true
  }, function insertedLog(error) {
    if (error) {
      logger.printLogError(logMessage, error);
    }

    callback();
  });

}

exports.setGlobalRole = function(operatorData, parameters, callback, override) {

  if (isNaN(parameters.role)) {
    callback(lang.errInvalidRole);
    return;
  } else if (!override && operatorData.globalRole >= parameters.role) {
    callback(lang.errDeniedPermissionLevel);
    return;
  } else if (!override && operatorData.login === parameters.login) {
    callback(lang.errSelfRoleChange);
  }

  users.findOne({
    login : parameters.login
  }, {
    _id : 0,
    globalRole : 1
  }, function gotUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback(lang.errUserNotFound);
    } else if (!override && user.globalRole <= operatorData.globalRole) {
      callback(lang.errDeniedChangeUser);
    } else {

      // style exception, too simple
      users.update({
        login : parameters.login
      }, {
        $set : {
          globalRole : +parameters.role
        }
      }, function roleSet(error) {
        if (error) {
          callback(error);
        } else {
          logRoleChange(operatorData, parameters, callback);

        }
      });
      // style exception, too simple

    }
  });

};
// end of global role change

exports.registerUser = function(parameters, callback, role, override) {

  if (!override && creationDisabled) {
    callback(lang.errNoNewAccounts);
    return;
  }

  miscOps.sanitizeStrings(parameters, newAccountParameters);

  if (/\W/.test(parameters.login)) {
    callback(lang.errInvalidLogin);
    return;
  } else if (role !== undefined && isNaN(role)) {
    callback(lang.errInvalidRole);
    return;
  }

  bcrypt.hash(parameters.password, 8, function(error, hash) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      var newUser = {
        login : parameters.login,
        password : hash
      };

      if (role !== undefined) {
        newUser.globalRole = +role;
      }

      if (parameters.email) {
        newUser.email = parameters.email;
      }
      users.insert(newUser, function createdUser(error) {
        if (error && error.code !== 11000) {
          callback(error);
        } else if (error) {
          callback(lang.errLoginInUse);
        } else {
          exports.createSession(parameters.login, callback);
        }
      });

      // style exception, too simple

    }
  });

};

exports.createSession = function(login, callback) {

  var hash = crypto.createHash('sha256').update(
      login + Math.random() + logger.timestamp()).digest('hex');

  users.update({
    login : login
  }, {
    $set : {
      hash : hash
    }
  }, function updatedUser(error) {
    callback(error, hash);
  });

};

exports.login = function(parameters, callback) {

  users.findOne({
    login : parameters.login
  }, {
    _id : 0,
    password : 1
  }, function gotUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback(lang.errLoginFailed);
    } else {

      // style exception, too simple

      bcrypt.compare(parameters.password, user.password, function(error,
          matches) {

        if (error) {
          callback(error);
        } else if (!matches) {
          callback(lang.errLoginFailed);
        } else {
          exports.createSession(parameters.login, callback);
        }
      });

      // style exception, too simple
    }
  });

};

exports.validate = function(auth, callback) {

  users.findOne({
    login : auth.login,
    hash : auth.hash
  }, {
    _id : 0,
    login : 1,
    hash : 1,
    ownedBoards : 1,
    settings : 1,
    globalRole : 1,
    email : 1
  }, function foundUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback(lang.errInvalidAccount);
    } else {
      callback(null, {
        authStatus : 'ok'
      }, user);
    }
  });
};

// start of reset request
function emailUserOfRequest(domain, login, email, hash, callback) {

  var recoveryLink = domain + '/recoverAccount.js?hash=' + hash + '&login=';
  recoveryLink += login;

  var content = domManipulator.recoveryEmail(recoveryLink);

  mailer.sendMail({
    from : sender,
    to : email,
    subject : lang.subPasswordRequest,
    text : content
  }, function emailSent(error) {
    callback(error);
  });

}

function generateRequest(domain, login, email, callback) {

  var requestHash = crypto.createHash('sha256').update(
      login + Math.random() + logger.timestamp()).digest('hex');

  requests.insert({
    login : login,
    recoveryToken : requestHash,
    expiration : logger.addMinutes(new Date(), 24 * 60)
  }, function requestCreated(error) {
    if (error) {
      callback(error);
    } else {
      emailUserOfRequest(domain, login, email, requestHash, callback);
    }

  });

}

function lookForUserEmailOfRequest(domain, login, callback) {

  users.findOne({
    login : login
  }, {
    email : 1,
    _id : 0
  }, function gotUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback(lang.errAccountNotFound);
    } else if (!user.email || !user.email.length) {
      callback(lang.errNoEmailForAccount);
    } else {
      generateRequest(domain, login, user.email, callback);
    }
  });

}

exports.requestRecovery = function(domain, login, callback) {

  requests.findOne({
    login : login,
    expiration : {
      $gte : new Date()
    }
  }, {
    _id : 0,
    expiration : 1
  }, function gotRequest(error, request) {
    if (error) {
      callback(error);
    } else if (request) {

      callback(lang.errPendingRequest.replace('{$expiration}',
          request.expiration.toString()));
    } else {
      lookForUserEmailOfRequest(domain, login, callback);
    }
  });

};
// end of reset request

// start of password reset
function emailUserNewPassword(email, newPass, callback) {

  var content = domManipulator.resetEmail(newPass);

  mailer.sendMail({
    from : sender,
    to : email,
    subject : lang.subPasswordReset,
    text : content
  }, function emailSent(error) {
    callback(error);
  });

}

function generateNewPassword(login, callback) {

  var newPass = crypto.createHash('sha256').update(
      login + Math.random() + logger.timestamp()).digest('hex').substring(0, 6);

  bcrypt.hash(newPass, 8, function(error, hash) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple

      users.findOneAndUpdate({
        login : login
      }, {
        $set : {
          password : hash
        }
      }, {}, function updatedUser(error, user) {
        if (error) {
          callback(error);
        } else {
          emailUserNewPassword(user.value.email, newPass, callback);
        }
      });

      // style exception, too simple

    }

  });

}

exports.recoverAccount = function(parameters, callback) {

  requests.findOneAndDelete({
    login : parameters.login,
    recoveryToken : parameters.hash,
    expiration : {
      $gte : new Date()
    }
  }, {}, function gotRequest(error, request) {
    if (error) {
      callback(error);
    } else if (!request.value) {
      callback(lang.errInvalidRequest);
    } else {
      generateNewPassword(parameters.login, callback);
    }
  });
};

// end of password reset

exports.changeSettings = function(userData, parameters, callback) {

  miscOps.sanitizeStrings(parameters, changeSettingsParameters);

  users.updateOne({
    login : userData.login
  }, {
    $set : {
      email : parameters.email,
      settings : parameters.settings
    }
  }, function updatedSettings(error) {
    callback(error);
  });

};

// start of password change
function changePassword(userData, parameters, callback) {

  bcrypt.hash(parameters.newPassword, 8, function(error, hash) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      users.updateOne({
        login : userData.login
      }, {
        $set : {
          password : hash
        }
      }, function updatedPassword(error) {
        if (error) {
          callback(error);
        } else {
          exports.createSession(userData.login, callback);
        }
      });

      // style exception, too simple
    }
  });

}

exports.changePassword = function(userData, parameters, callback) {

  if (parameters.newPassword !== parameters.confirmation) {

    callback(lang.errPasswordMismatch);
    return;
  }

  users.findOne({
    login : userData.login
  }, function gotUser(error, user) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple

      bcrypt.compare(parameters.password, user.password, function(error,
          matches) {

        if (error) {
          callback(error);
        } else if (!matches) {
          callback(lang.errIncorrectPassword);
        } else {
          changePassword(userData, parameters, callback);
        }
      });

      // style exception, too simple

    }

  });

};

// end of password change
