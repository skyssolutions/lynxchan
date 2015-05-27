'use strict';

var users = require('../db').users();
var miscOps = require('./miscOps');
var bcrypt = require('bcrypt');
var logger = require('../logger');
var crypto = require('crypto');

var newAccountParameters = [ {
  field : 'login',
  length : 16
}, {
  field : 'email',
  length : 64
} ];

exports.registerUser = function(parameters, callback) {

  miscOps.sanitizeStrings(parameters, newAccountParameters);

  if (/\W/.test(parameters.login)) {
    callback('Invalid login');
    return;
  }

  bcrypt.hash(parameters.password, 8, function(error, hash) {
    if (error) {
      callback(error);
    } else {

      var newUser = {
        login : parameters.login,
        password : hash
      };

      // style exception, too simple
      if (parameters.email) {
        newUser.email = parameters.email;
      }
      users.insert(newUser, function createdUser(error) {
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

exports.validate = function(auth, callback) {

  users.findOne({
    login : auth.login,
    hash : auth.hash
  }, {
    _id : 0,
    login : 1,
    hash : 1
  }, function foundUser(error, user) {
    if (error) {
      callback(error);
    } else if (!user) {
      callback('Not found');
    } else {
      callback(null, {
        status : 'ok',
        login : user.login,
        hash : user.hash
      });
    }
  });
};