'use strict';

var db = require('../db');
var users = db.users();
var requests = db.recoveryRequests();
var miscOps = require('./miscOps');
var bcrypt = require('bcrypt');
var domManipulator = require('./domManipulator');
var logger = require('../logger');
var crypto = require('crypto');
var mailer = require('nodemailer').createTransport();
var sender = require('../boot').getGeneralSettings().emailSender;

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

exports.setGlobalRole = function(operatorData, parameters, callback, override) {

  if (isNaN(parameters.role)) {
    callback('Invalid role');
    return;
  } else if (!override && operatorData.globalRole >= parameters.role) {
    callback('You are not allowed to grant this level of permission to users');
    return;
  } else if (!override && operatorData.login === parameters.login) {
    callback('You cannot change your own role.');
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
      callback('User not found');
    } else if (!override && user.globalRole <= operatorData.globalRole) {
      callback('You are not allowed to change this user\'s permission');
    } else {

      // style exception, too simple
      users.update({
        login : parameters.login
      }, {
        $set : {
          globalRole : +parameters.role
        }
      }, function roleSet(error) {
        callback(error);
      });
      // style exception, too simple

    }
  });

};

exports.registerUser = function(parameters, callback, role) {

  miscOps.sanitizeStrings(parameters, newAccountParameters);

  if (/\W/.test(parameters.login)) {
    callback('Invalid login');
    return;
  } else if (role !== undefined && isNaN(role)) {
    callback('Invalid role');
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
          callback('Login is already in use');
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
      callback('Login failed');
    } else {

      // style exception, too simple

      bcrypt.compare(parameters.password, user.password, function(error,
          matches) {

        if (error) {
          callback(error);
        } else if (!matches) {
          callback('Login failed');
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
    globalRole : 1,
    email : 1
  }, function foundUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback('Invalid account');
    } else {
      callback(null, {
        authStatus : 'ok'
      }, user);
    }
  });
};

// start of reset request
function emailUserOfRequest(login, email, hash, callback) {

  var recoveryLink = '/recoverAccount.js?hash=' + hash + '&login=' + login;

  var content = domManipulator.recoveryEmail(recoveryLink);

  mailer.sendMail({
    from : sender,
    to : email,
    subject : 'Password reset request',
    text : content
  }, function emailSent(error) {
    callback(error);
  });

}

function generateRequest(login, email, callback) {

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

      emailUserOfRequest(login, email, requestHash, callback);

    }

  });

}

function lookForUserEmailOfRequest(login, callback) {

  users.findOne({
    login : login
  }, {
    email : 1,
    _id : 0
  }, function gotUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback('Account not found');
    } else if (!user.email || !user.email.length) {
      callback('Account doesn\'t have an email associated to it.');
    } else {
      generateRequest(login, user.email, callback);
    }
  });

}

exports.requestRecovery = function(login, callback) {

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

      var message = 'Pending request to be expired at ';
      message += request.expiration.toString();
      callback(message);
    } else {
      lookForUserEmailOfRequest(login, callback);
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
    subject : 'Password reseted',
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
      callback('Invalid recovery request.');
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
      email : parameters.email
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

    callback('Confirmation does not match');
    return;
  }

  users.findOne({
    login : userData.login
  }, function gotUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback('User not found');
    } else {

      // style exception, too simple

      bcrypt.compare(parameters.password, user.password, function(error,
          matches) {

        if (error) {
          callback(error);
        } else if (!matches) {
          callback('Incorrect current password');
        } else {
          changePassword(userData, parameters, callback);
        }
      });

      // style exception, too simple

    }

  });

};

// end of password change
