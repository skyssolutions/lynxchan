'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var gridFsHandler = require('../gridFsHandler');
var lang = require('../langOps').languagePack();
var settings = require('../../boot').getGeneralSettings();
var maxBannerSize = settings.maxBannerSizeB;
var db = require('../../db');
var boards = db.boards();
var files = db.files();

exports.addBanner = function(user, parameters, callback) {

  if (!parameters.files.length) {
    callback(lang.errNoFiles);
    return;
  } else if (parameters.files[0].mime.indexOf('image/') === -1) {
    callback(lang.errNotAnImage);
    return;
  } else if (parameters.files[0].size > maxBannerSize) {
    callback(lang.errBannerTooLarge);
  }

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== user) {
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

exports.deleteBanner = function(login, parameters, callback) {

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
          } else if (board.owner !== login) {
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

exports.getBannerData = function(user, boardUri, callback) {

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== user) {
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
