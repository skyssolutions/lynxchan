'use strict';

// operations regarding user accounts

var db = require('../db');
var users = db.users();
var boards = db.boards();
var requests = db.recoveryRequests();
var confirmations = db.confirmations();
var crypto = require('crypto');
var sender;
var creationDisabled;
var logOps;
var miscOps;
var boardOps;
var captchaOps;
var domManipulator;
var lang;

var iterations = 4096;
var iterationsV2 = 16384;
var keyLength = 256;
var hashDigest = 'sha512';

exports.validAccountSettings = [ 'alwaysSignRole', 'reportNotify' ];

exports.newAccountParameters = [ {
  field : 'login',
  length : 16
}, {
  field : 'email',
  length : 64,
  removeHTML : true
} ];

exports.changeSettingsParameters = [ {
  field : 'email',
  length : 64,
  removeHTML : true
} ];

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  sender = settings.emailSender;
  creationDisabled = settings.disableAccountCreation;

};

exports.loadDependencies = function() {

  boardOps = require('./boardOps').meta;
  logOps = require('./logOps');
  miscOps = require('./miscOps');
  captchaOps = require('./captchaOps');
  domManipulator = require('./domManipulator').dynamicPages.miscPages;
  lang = require('./langOps').languagePack;

};

// Section 1: Global role change {
exports.logRoleChange = function(operatorData, parameters, callback) {

  var logMessage = '';

  if (operatorData) {
    logMessage += lang().logGlobalRoleChange.userPiece.replace('{$login}',
        operatorData.login);
  } else {
    logMessage += lang().logGlobalRoleChange.adminPiece;
  }

  logMessage += lang().logGlobalRoleChange.mainPiece.replace('{$login}',
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

exports.setGlobalRole = function(operatorData, parameters, language, callback,
    override) {

  if (isNaN(parameters.role)) {
    callback(lang(language).errInvalidRole);
    return;
  } else if (!override && operatorData.globalRole >= parameters.role) {
    callback(lang(language).errDeniedPermissionLevel);
    return;
  } else if (!override && operatorData.login === parameters.login) {
    callback(lang(language).errSelfRoleChange);
  }

  users.findOne({
    login : parameters.login
  }, {
    projection : {
      _id : 0,
      globalRole : 1
    }
  }, function gotUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback(lang(language).errUserNotFound);
    } else if (!override && user.globalRole <= operatorData.globalRole) {
      callback(lang(language).errDeniedChangeUser);
    } else {

      // style exception, too simple
      users.updateOne({
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
exports.createAccount = function(parameters, role, language, callback) {

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
      callback(lang(language).errLoginInUse);
    } else {

      // style exception, too simple
      exports.setUserPassword(parameters.login, parameters.password,
          function passwordSet(error, hash) {
            if (error) {
              callback(error);
            } else {
              exports.createSession(parameters.login, false, callback);
            }
          });
      // style exception, too simple

    }
  });

};

exports.registerUser = function(parameters, cb, role, override, captchaId,
    language) {

  if (!override && creationDisabled) {
    cb(lang(language).errNoNewAccounts);
    return;
  }

  miscOps.sanitizeStrings(parameters, exports.newAccountParameters);

  if (!parameters.login || /\W/.test(parameters.login)) {
    cb(lang(language).errInvalidLogin);
    return;
  } else if (!parameters.password) {
    cb(lang(language).errNoPassword);
    return;
  } else if (role !== undefined && role !== null && isNaN(role)) {
    cb(lang(language).errInvalidRole);
    return;
  }

  if (override) {
    exports.createAccount(parameters, role, language, cb);
  } else {
    captchaOps.attemptCaptcha(captchaId, parameters.captcha, null, language,
        function solvedCaptcha(error) {

          if (error) {
            cb(error);
          } else {
            exports.createAccount(parameters, role, language, cb);
          }

        });
  }

};
// } Section 2: Account creation

exports.createSession = function(login, remember, callback) {

  crypto.randomBytes(256, function gotHash(error, buffer) {

    if (error) {
      callback(error);
    } else {

      var hash = buffer.toString('base64');

      var renewAt = new Date();
      renewAt.setMinutes(renewAt.getMinutes() + 1);

      var logoutAt = new Date();

      if (remember) {
        logoutAt.setMonth(logoutAt.getMonth() + 1);
      } else {
        logoutAt.setHours(logoutAt.getHours() + 1);
      }

      // style exception, too simple
      users.updateOne({
        login : login
      }, {
        $set : {
          hash : hash,
          renewExpiration : renewAt,
          logoutExpiration : logoutAt,
          remember : remember
        }
      }, function updatedUser(error) {
        callback(error, hash, logoutAt);
      });
      // style exception, too simple

    }
  });

};

exports.login = function(parameters, language, callback) {

  users.findOne({
    login : parameters.login
  }, function gotUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback(lang(language).errLoginFailed);
    } else {

      // style exception, too simple
      exports.passwordMatches(user, parameters.password, function(error,
          matches) {

        if (error) {
          callback(error);
        } else if (!matches) {
          callback(lang(language).errLoginFailed);
        } else {
          exports.createSession(parameters.login, !!parameters.remember,
              callback);
        }
      });
      // style exception, too simple

    }
  });

};

// Section 3: Validate {
exports.checkExpiration = function(user, now, callback) {

  if (user.renewExpiration < now) {

    exports.createSession(user.login, user.remember, function createdSession(
        error, hash, expiration) {

      if (error) {
        callback(error);
      } else {

        callback(null, {
          authStatus : 'expired',
          newHash : hash,
          expiration : expiration
        }, user);

      }

    });

  } else {
    callback(null, {
      authStatus : 'ok'
    }, user);
  }

};

exports.validate = function(auth, language, callback) {

  if (!auth || !auth.hash || !auth.login) {
    callback(lang(language).errInvalidAccount);
    return;
  }

  var now = new Date();

  users.findOneAndUpdate({
    login : auth.login.toString(),
    hash : auth.hash.toString(),
    logoutExpiration : {
      $gt : now
    }
  }, {
    $set : {
      lastSeen : now,
      inactive : false
    }
  }, function foundUser(error, result) {
    if (error) {
      callback(error);
    } else if (!result.value) {
      callback(lang(language).errInvalidAccount);
    } else {

      var user = result.value;

      if (user.inactive && user.ownedBoards && user.ownedBoards.length) {

        // style exception, too simple
        boards.updateMany({
          owner : user.login
        }, {
          $set : {
            inactive : false
          }
        }, function updatedBoards(error) {

          if (error) {
            callback(error);
          } else {
            exports.checkExpiration(user, now, callback);
          }

        });
        // style exception, too simple

      } else {
        exports.checkExpiration(user, now, callback);
      }

    }
  });
};
// } Section 3: Validate

// Section 4: Reset request {
exports.generateRequest = function(domain, login, language, email, callback) {

  var requestHash = crypto.createHash('sha256').update(login + Math.random())
      .digest('hex');

  var expiration = new Date();
  expiration.setDate(expiration.getDate() + 1);

  requests.insertOne({
    login : login,
    recoveryToken : requestHash,
    expiration : expiration
  }, function requestCreated(error) {
    if (error) {
      callback(error);
    } else {

      var recoveryLink = domain + '/recoverAccount.js?hash=' + requestHash;
      recoveryLink += '&login=' + login;

      miscOps.sendMail(lang(language).subPasswordRequest, domManipulator
          .recoveryEmail(recoveryLink, login, language), email, callback);

    }

  });

};

exports.lookForUserEmailOfRequest = function(domain, login, language, cb) {

  users.findOne({
    login : login
  }, {
    projection : {
      email : 1,
      confirmed : 1,
      _id : 0
    }
  }, function gotUser(error, user) {
    if (error) {
      cb(error);
    } else if (!user) {
      cb(lang(language).errAccountNotFound);
    } else if (!user.email) {
      cb(lang(language).errNoEmailForAccount);
    } else if (!user.confirmed) {
      cb(lang(language).errNotConfirmed);
    } else {
      exports.generateRequest(domain, login, language, user.email, cb);
    }
  });

};

exports.requestRecovery = function(domain, language, parameters, captchaId,
    callback) {

  captchaOps.attemptCaptcha(captchaId, parameters.captcha, null, language,
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
            projection : {
              _id : 0,
              expiration : 1
            }
          }, function gotRequest(error, request) {
            if (error) {
              callback(error);
            } else if (request) {

              callback(lang(language).errPendingRequest.replace(
                  '{$expiration}', request.expiration.toUTCString()));
            } else {
              exports.lookForUserEmailOfRequest(domain, parameters.login,
                  language, callback);
            }
          });
          // style exception, too simple

        }

      });

};
// } Section 4: Reset request

// Section 5: Password reset {
exports.generateNewPassword = function(login, callback, language) {

  var newPass = crypto.createHash('sha256').update(login + Math.random())
      .digest('hex').substring(0, 6);

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

          miscOps.sendMail(lang(language).subPasswordReset, domManipulator
              .resetEmail(newPass, language), user.email, callback);

        }

      });
      // style exception, too simple

    }

  });

};

exports.recoverAccount = function(parameters, language, callback) {

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
      callback(lang(language).errInvalidRequest);
    } else {
      exports.generateNewPassword(parameters.login, callback, language);
    }
  });
};
// } Section 5: Reset request

exports.changeSettings = function(userData, parameters, callback) {

  miscOps.sanitizeStrings(parameters, exports.changeSettingsParameters);

  var confirmed = parameters.email !== userData.email ? false
      : userData.confirmed;

  users.updateOne({
    login : userData.login
  }, {
    $set : {
      email : parameters.email,
      settings : parameters.settings,
      confirmed : confirmed
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
          exports.createSession(userData.login, userData.remember, callback);
        }

      });

};

exports.changePassword = function(userData, parameters, language, callback,
    override) {

  if (parameters.newPassword !== parameters.confirmation) {

    callback(lang(language).errPasswordMismatch);
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
          callback(lang(language).errIncorrectPassword);
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
  case 'pbkdf2V2':
    crypto.pbkdf2(password, userData.passwordSalt, iterationsV2, keyLength,
        hashDigest, function hashed(error, hash) {

          if (error || !hash) {
            callback(error);
          } else {
            callback(null, userData.password === hash.toString('base64'));
          }

        });

    break;

  case 'pbkdf2':
    crypto.pbkdf2(password, userData.passwordSalt, iterations, keyLength,
        hashDigest, function hashed(error, hash) {

          if (hash && userData.password === hash.toString('base64')) {

            // style exception, too simple
            exports.setUserPassword(userData.login, password,
                function passwordSet(error) {
                  callback(error, true);
                });
            // style exception, too simple

          } else {
            callback(error);
          }

        });

    break;

  default:
    callback();
  }

};

exports.setUserPassword = function(login, password, callback) {

  crypto.randomBytes(64, function gotSalt(error, buffer) {

    if (error) {
      callback(error);
    } else {
      var salt = buffer.toString('base64');

      // style exception, too simple
      crypto.pbkdf2(password, salt, iterationsV2, keyLength, hashDigest,
          function hashed(error, hash) {

            if (error) {
              callback(error);
            } else {

              users.updateOne({
                login : login
              }, {
                $set : {
                  passwordMethod : 'pbkdf2V2',
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

exports.getAccounts = function(userData, language, callback) {

  var isAdmin = userData.globalRole < 2;

  if (!isAdmin) {
    callback(lang(language).errDeniedAccountManagement);
    return;
  }

  users.aggregate([ {
    $sort : {
      login : 1
    }
  }, {
    $group : {
      _id : 0,
      accounts : {
        $push : '$login'
      }
    }
  } ]).toArray(function gotAccounts(error, data) {

    if (error) {
      callback(error);
    } else {
      callback(null, data.length ? data[0].accounts : []);
    }

  });

};

exports.getAccountData = function(account, userData, language, callback) {

  var isAdmin = userData.globalRole < 2;

  if (!isAdmin) {
    callback(lang(language).errDeniedAccountManagement);
    return;
  }

  users.findOne({
    login : account
  }, {
    projection : {
      _id : 0,
      email : 1,
      lastSeen : 1,
      ownedBoards : 1,
      volunteeredBoards : 1,
      globalRole : 1
    }
  }, function gotAccount(error, accountData) {

    if (error) {
      callback(error);
    } else if (!accountData) {
      callback(lang(language).errAccountNotFound);
    } else {
      callback(null, {
        email : accountData.email || '',
        ownedBoards : accountData.ownedBoards || [],
        volunteeredBoards : accountData.volunteeredBoards || [],
        lastSeen : accountData.lastSeen,
        globalRole : isNaN(accountData.globalRole) ? 4 : accountData.globalRole
      });
    }

  });

};

exports.addAccount = function(userRole, parameters, language, callback) {

  var isAdmin = userRole < 2;

  miscOps.sanitizeStrings(parameters, exports.newAccountParameters);

  if (!isAdmin) {
    callback(lang(language).errDeniedAccountManagement);
    return;
  } else if (/\W/.test(parameters.login)) {
    callback(lang(language).errInvalidLogin);
    return;
  }

  exports.createAccount(parameters, null, language, callback);

};

// Section 7: Account deletion {
exports.finishAccountDeletion = function(account, callback) {

  boards.updateMany({
    volunteers : account.login
  }, {
    $pull : {
      volunteers : account.login
    }
  }, function removedVolunteer(error) {

    if (error) {
      callback(error);
    } else {
      users.deleteOne({
        login : account.login
      }, callback);
    }

  });

};

exports.transferBoards = function(userData, account, language, cb, index) {

  index = index || 0;

  var boardList = account.ownedBoards || [];

  if (index >= boardList.length) {
    exports.finishAccountDeletion(account, cb);
    return;
  }

  boardOps.transfer(userData, {
    boardUri : boardList[index],
    login : userData.login
  }, language, function transferredBoard(error) {

    if (error) {
      cb(error);
    } else {
      exports.transferBoards(userData, account, language, cb, ++index);
    }

  });

};

exports.deleteAccount = function(userData, parameters, language, callback) {

  var isAdmin = userData.globalRole < 2;

  if (!isAdmin) {
    callback(lang(language).errDeniedAccountManagement);
    return;
  } else if (!parameters.confirmation) {
    callback(lang(language).errNoAccountDeletionConfirmation);
    return;
  }

  users.findOne({
    login : parameters.account
  }, function gotAccount(error, account) {

    if (error) {
      callback(error);
    } else if (!account) {
      callback(lang(language).errAccountNotFound);
    } else if (account.globalRole <= userData.globalRole) {
      callback(lang(language).errNotAllowedToDeleteAccount);
    } else {
      exports.transferBoards(userData, account, language, callback);
    }

  });

};
// } Section 7: Account deletion

// Section 8: Confirmation request {
exports.generateRequestKey = function(domain, userData, language, callback) {

  var token = crypto.createHash('sha256')
      .update(userData.login + Math.random()).digest('hex');

  var expiration = new Date();

  expiration.setUTCDate(expiration.getUTCDate() + 1);

  confirmations.insertOne({
    login : userData.login,
    expiration : expiration,
    confirmationToken : token
  }, function addedConfirmationRequest(error) {

    if (error) {
      callback(error);
    } else {

      var confirmationLink = domain + '/confirmEmail.js?login=';
      confirmationLink += userData.login + '&hash=' + token;

      miscOps.sendMail(lang(language).subEmailConfirmation, domManipulator
          .confirmationEmail(confirmationLink, userData.login, language),
          userData.email, callback);

    }

  });

};

exports.requestConfirmation = function(domain, language, userData, callback) {

  if (!userData.email) {
    callback(lang(language).errNoEmailForAccount);
    return;
  }

  confirmations.findOne({
    login : userData.login,
    expiration : {
      $gte : new Date()
    }
  }, {
    projection : {
      _id : 0,
      expiration : 1
    }
  }, function gotRequest(error, confirmation) {
    if (error) {
      callback(error);
    } else if (confirmation) {

      callback(lang(language).errPendingConfirmation.replace('{$expiration}',
          confirmation.expiration.toUTCString()));

    } else {
      exports.generateRequestKey(domain, userData, language, callback);
    }
  });

};
// } Section 8: Confirmation request

exports.confirmEmail = function(parameters, language, callback) {

  confirmations.findOneAndDelete({
    expiration : {
      $gte : new Date()
    },
    login : parameters.login,
    confirmationToken : parameters.hash
  }, {}, function gotConfirmation(error, result) {

    if (error) {
      callback(error);
    } else if (!result.value) {
      callback(lang(language).errInvalidConfirmation);
    } else {

      users.updateOne({
        login : parameters.login
      }, {
        $set : {
          confirmed : true
        }
      }, callback);

    }

  });

};
