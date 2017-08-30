'use strict';

var taskListener = require('../taskListener');
var lang;

exports.loadDependencies = function() {
  lang = require('./langOps').languagePack;
};

exports.restartSocket = function(userData, language, callback) {

  if (userData.globalRole !== 0) {
    callback(lang(language).errNotAllowedToManageSocket);
    return;
  }

  process.send({
    restartSocket : true,
  });

  callback();

};

exports.getSocketStatus = function(userData, language, callback) {

  if (userData.globalRole !== 0) {
    callback(lang(language).errNotAllowedToManageSocket);
    return;
  }

  callback(null, {
    status : taskListener.status || lang(language).miscSocketOk
  });

};
