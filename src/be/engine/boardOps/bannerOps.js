'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var settings = require('../../boot').getGeneralSettings();
var maxBannerSize = settings.maxBannerSizeB;
var db = require('../../db');
var boards = db.boards();
var files = db.files();
var gridFsHandler;
var lang;

var globalBoardModeration = settings.allowGlobalBoardModeration;

exports.loadDependencies = function() {

  gridFsHandler = require('../gridFsHandler');
  lang = require('../langOps').languagePack();

};

exports.addBanner = function(userData, parameters, callback) {

  if (!parameters.files.length) {
    callback(lang.errNoFiles);
    return;
  } else if (parameters.files[0].mime.indexOf('image/') === -1) {
    callback(lang.errNotAnImage);
    return;
  } else if (parameters.files[0].size > maxBannerSize) {
    callback(lang.errBannerTooLarge);
  }

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.errDeniedChangeBoardSettings);
    } else {
      var bannerPath = '/' + parameters.boardUri + '/banners/';
      bannerPath += new Date().getTime();

      var file = parameters.files[0];

      gridFsHandler.writeFile(file.pathInDisk, bannerPath, file.mime, {
        boardUri : parameters.boardUri,
        status : 200,
        type : 'banner'
      }, callback);
    }
  });

};

// Section 1: Banner deletion {
function removeBanner(banner, callback) {
  gridFsHandler.removeFiles(banner.filename, function removedFile(error) {
    callback(error, banner.metadata.boardUri);
  });

}

exports.deleteBanner = function(userData, parameters, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  try {

    files.findOne({
      _id : new ObjectID(parameters.bannerId)
    }, function gotBanner(error, banner) {
      if (error) {
        callback(error);
      } else if (!banner) {
        callback(lang.errBannerNotFound);
      } else {

        // style exception, too simple
        boards.findOne({
          boardUri : banner.metadata.boardUri
        }, function gotBoard(error, board) {
          if (error) {
            callback(error);
          } else if (!board) {
            callback(lang.errBoardNotFound);
          } else if (board.owner !== userData.login && !globallyAllowed) {
            callback(lang.errDeniedChangeBoardSettings);
          } else {
            removeBanner(banner, callback);
          }
        });
        // style exception, too simple

      }

    });
  } catch (error) {
    callback(error);
  }
};
// } Section 1: Banner deletion

exports.getBannerData = function(userData, boardUri, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.errDeniedChangeBoardSettings);
    } else {

      // style exception, too simple
      files.find({
        'metadata.boardUri' : boardUri,
        'metadata.type' : 'banner'
      }, {
        filename : 1
      }).sort({
        uploadDate : 1
      }).toArray(function(error, banners) {
        callback(error, banners);
      });
      // style exception, too simple

    }
  });

};
