'use strict';

// operations regarding user accounts

var db = require('../db');
var users = db.users();
var requests = db.recoveryRequests();
var bcrypt = require('bcrypt');
var logger = require('../logger');
var crypto = require('crypto');
var mailer = require('nodemailer').createTransport();
var settings = require('../settingsHandler').getGeneralSettings();
var sender = settings.emailSender;
var creationDisabled = settings.disableAccountCreation;
var logOps;
var miscOps;
var captchaOps;
var domManipulator;
var lang;

var iterations = 4096;
var keyLength = 256;
var hashDigest = 'sha512';

var validAccountSettings = [ 'alwaysSignRole' ];

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

exports.loadDependencies = function() {

  logOps = require('./logOps');
  miscOps = require('./miscOps');
  captchaOps = require('./captchaOps');
  domManipulator = require('./domManipulator').dynamicPages.miscPages;
  lang = require('./langOps').languagePack();

};

exports.validAccountSettings = function() {
  return validAccountSettings;
};

// Section 1: Global role change {
exports.logRoleChange = function(operatorData, parameters, callback) {

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

  logOps.insertLog({
    user : operatorData ? operatorData.login : null,
    type : 'globalRoleChange',
    time : new Date(),
    description : logMessage,
    global : true
  }, callback);

};

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
          exports.logRoleChange(operatorData, parameters, callback);

        }
      });
      // style exception, too simple

    }
  });

};
// } Section 1: Global role change

// Section 2: Account creation {
exports.createAccount = function(parameters, role, callback) {

  var newUser = {
    login : parameters.login
  };

  if (role !== undefined && role !== null) {
    newUser.globalRole = +role;
  }

  if (parameters.email) {
    newUser.email = parameters.email;
  }

  users.insertOne(newUser, function createdUser(error) {
    if (error && error.code !== 11000) {
      callback(error);
    } else if (error) {
      callback(lang.errLoginInUse);
    } else {

      // style exception, too simple
      exports.setUserPassword(parameters.login, parameters.password,
          function passwordSet(error, hash) {
            if (error) {
              callback(error);
            } else {
              exports.createSession(parameters.login, callback);
            }
          });
      // style exception, too simple

    }
  });

};

exports.registerUser = function(parameters, cb, role, override, captchaId) {

  if (!override && creationDisabled) {
    cb(lang.errNoNewAccounts);
    return;
  }

  miscOps.sanitizeStrings(parameters, newAccountParameters);

  if (!parameters.login || /\W/.test(parameters.login)) {
    cb(lang.errInvalidLogin);
    return;
  } else if (!parameters.password) {
    cb(lang.errNoPassword);
    return;
  } else if (role !== undefined && role !== null && isNaN(role)) {
    cb(lang.errInvalidRole);
    return;
  }

  if (override) {
    exports.createAccount(parameters, role, cb);
  } else {
    captchaOps.attemptCaptcha(captchaId, parameters.captcha, null,
        function solvedCaptcha(error) {

          if (error) {
            cb(error);
          } else {
            exports.createAccount(parameters, role, cb);
          }

        });
  }

};
// } Section 2: Account creation

exports.createSession = function(login, callback) {

  crypto.randomBytes(64, function gotHash(error, buffer) {

    if (error) {
      callback(error);
    } else {

      var hash = buffer.toString('base64');

      // style exception, too simple
      users.update({
        login : login
      }, {
        $set : {
          hash : hash
        }
      }, function updatedUser(error) {
        callback(error, hash);
      });
      // style exception, too simple

    }
  });

};

// Section 3: Login {
exports.login = function(domain, parameters, callback) {

  users.findOne({
    login : parameters.login
  }, function gotUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback(lang.errLoginFailed);
    } else {

      // style exception, too simple
      exports.passwordMatches(user, parameters.password, function(error,
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
// } Section 3: Login

exports.validate = function(auth, callback) {

  if (!auth || !auth.hash || !auth.login) {
    callback(lang.errInvalidAccount);
    return;
  }

  users.findOneAndUpdate({
    login : auth.login,
    hash : auth.hash.toString()
  }, {
    $set : {
      lastSeen : new Date()
    }
  }, function foundUser(error, result) {
    if (error) {
      callback(error);
    } else if (!result.value) {
      callback(lang.errInvalidAccount);
    } else {
      callback(null, {
        authStatus : 'ok'
      }, result.value);
    }
  });
};

// Section 4: Reset request {
exports.emailUserOfRequest = function(domain, login, email, hash, callback) {

  var recoveryLink = domain + '/recoverAccount.js?hash=' + hash + '&login=';
  recoveryLink += login;

  var content = domManipulator.recoveryEmail(recoveryLink);

  mailer.sendMail({
    from : sender,
    to : email,
    subject : lang.subPasswordRequest,
    html : content
  }, function emailSent(error) {
    callback(error);
  });

};

exports.generateRequest = function(domain, login, email, callback) {

  var requestHash = crypto.createHash('sha256').update(
      login + Math.random() + logger.timestamp()).digest('hex');

  requests.insertOne({
    login : login,
    recoveryToken : requestHash,
    expiration : logger.addMinutes(new Date(), 24 * 60)
  }, function requestCreated(error) {
    if (error) {
      callback(error);
    } else {
      exports.emailUserOfRequest(domain, login, email, requestHash, callback);
    }

  });

};

exports.lookForUserEmailOfRequest = function(domain, login, callback) {

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
      exports.generateRequest(domain, login, user.email, callback);
    }
  });

};

exports.requestRecovery = function(domain, parameters, captchaId, callback) {

  captchaOps.attemptCaptcha(captchaId, parameters.captcha, null,
      function solvedCaptcha(error) {

        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          requests.findOne({
            login : parameters.login,
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
              exports.lookForUserEmailOfRequest(domain, parameters.login,
                  callback);
            }
          });
          // style exception, too simple

        }

      });

};
// } Section 5: Reset request

// Section 5: Password reset {
exports.emailUserNewPassword = function(email, newPass, callback) {

  var content = domManipulator.resetEmail(newPass);

  mailer.sendMail({
    from : sender,
    to : email,
    subject : lang.subPasswordReset,
    html : content
  }, function emailSent(error) {
    callback(error);
  });

};

exports.generateNewPassword = function(login, callback) {

  var newPass = crypto.createHash('sha256').update(
      login + Math.random() + logger.timestamp()).digest('hex').substring(0, 6);

  exports.setUserPassword(login, newPass, function passwordSet(error) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      users.findOne({
        login : login
      }, function gotUser(error, user) {

        if (error) {
          callback(error);
        } else {
          exports.emailUserNewPassword(user.email, newPass, callback);
        }

      });
      // style exception, too simple

    }

  });

};

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
      exports.generateNewPassword(parameters.login, callback);
    }
  });
};
// } Section 5: Reset request

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

// Section 6: Password change {
exports.updatePassword = function(userData, parameters, callback) {

  exports.setUserPassword(userData.login, parameters.newPassword,
      function passwordSet(error) {

        if (error) {
          callback(error);
        } else {
          exports.createSession(userData.login, callback);
        }

      });

};

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
      exports.passwordMatches(user, parameters.password, function(error,
          matches) {

        if (error) {
          callback(error);
        } else if (!matches) {
          callback(lang.errIncorrectPassword);
        } else {
          exports.updatePassword(userData, parameters, callback);
        }
      });
      // style exception, too simple

    }

  });

};
// } Section 6: Password change

exports.passwordMatches = function(userData, password, callback) {

  switch (userData.passwordMethod) {
  case 'pbkdf2':
    crypto.pbkdf2(password, userData.passwordSalt, iterations, keyLength,
        hashDigest, function hashed(error, hash) {

          if (error || !hash) {
            callback(error);
          } else {
            callback(null, userData.password === hash.toString('base64'));
          }

        });

    break;

  default:
    bcrypt.compare(password, userData.password, function compared(error,
        matches) {

      if (matches) {

        // style exception, too simple
        exports.setUserPassword(userData.login, password, function passwordSet(
            error) {
          callback(error, true);
        });
        // style exception, too simple

      } else {
        callback(error);
      }

    });
  }

};

exports.setUserPassword = function(login, password, callback) {

  crypto.randomBytes(64, function gotSalt(error, buffer) {

    if (error) {
      callback(error);
    } else {
      var salt = buffer.toString('base64');

      // style exception, too simple
      crypto.pbkdf2(password, salt, iterations, keyLength, hashDigest,
          function hashed(error, hash) {

            if (error) {
              callback(error);
            } else {

              users.updateOne({
                login : login
              }, {
                $set : {
                  passwordMethod : 'pbkdf2',
                  passwordSalt : salt,
                  password : hash.toString('base64')
                }
              }, callback);
            }

          });
      // style exception, too simple

    }
  });

};