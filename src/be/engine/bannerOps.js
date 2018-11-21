'use strict';

// operations for banner management

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var boards = db.boards();
var files = db.files();
var gridFsHandler;
var lang;
var maxBannerSize;
var globalBoardModeration;

exports.loadSettings = function() {
  var settings = require('../settingsHandler').getGeneralSettings();

  maxBannerSize = settings.maxBannerSizeB;
  globalBoardModeration = settings.allowGlobalBoardModeration;

};

exports.loadDependencies = function() {

  gridFsHandler = require('./gridFsHandler');
  lang = require('./langOps').languagePack;

};

// Section 1: Banner deletion {
exports.removeBanner = function(banner, callback) {

  gridFsHandler.removeFiles(banner.filename, function removedFile(error) {
    callback(error, banner.metadata.boardUri);
  });

};

exports.deleteBanner = function(userData, parameters, language, callback) {

  var admin = userData.globalRole <= 1;

  try {
    parameters.bannerId = new ObjectID(parameters.bannerId);
  } catch (error) {
    callback(lang(language).errBannerNotFound);
    return;
  }

  files.findOne({
    _id : parameters.bannerId
  }, function gotBanner(error, banner) {
    if (error) {
      callback(error);
    } else if (!banner) {
      callback(lang(language).errBannerNotFound);
    } else {

      if (!banner.metadata.boardUri && !admin) {
        callback(lang(language).errDeniedGlobalBannerManagement);
      } else if (!banner.metadata.boardUri) {
        exports.removeBanner(banner, callback);
      } else {
        var globallyAllowed = admin && globalBoardModeration;

        // style exception, too simple
        boards.findOne({
          boardUri : banner.metadata.boardUri
        }, function gotBoard(error, board) {
          if (error) {
            callback(error);
          } else if (!board) {
            callback(lang(language).errBoardNotFound);
          } else if (board.owner !== userData.login && !globallyAllowed) {
            callback(lang(language).errDeniedChangeBoardSettings);
          } else {
            exports.removeBanner(banner, callback);
          }
        });
        // style exception, too simple

      }

    }

  });

};
// } Section 1: Banner deletion

// Section 2: Banner creation {
exports.writeNewBanner = function(parameters, callback) {

  var bannerPath = '/' + (parameters.boardUri || '.global') + '/banners/';
  bannerPath += new Date().getTime();

  var file = parameters.files[0];

  var metadata = {
    type : 'banner'
  };

  if (parameters.boardUri) {
    metadata.boardUri = parameters.boardUri;
  }

  gridFsHandler.writeFile(file.pathInDisk, bannerPath, file.mime, metadata,
      function(error, id) {
        callback(error, id, bannerPath);
      });

};

exports.addBanner = function(userData, parameters, language, callback) {

  if (!parameters.files.length) {
    callback(lang(language).errNoFiles);
    return;
  } else if (parameters.files[0].mime.indexOf('image/') === -1) {
    callback(lang(language).errNotAnImage);
    return;
  } else if (parameters.files[0].size > maxBannerSize) {
    callback(lang(language).errBannerTooLarge);
    return;
  }

  var admin = userData.globalRole <= 1;

  var globallyAllowed = admin && globalBoardModeration;

  if (!parameters.boardUri && !admin) {

    callback(lang(language).errDeniedGlobalBannerManagement);

  } else if (!parameters.boardUri) {
    exports.writeNewBanner(parameters, callback);
  } else {

    parameters.boardUri = parameters.boardUri.toString();

    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang(language).errBoardNotFound);
      } else if (board.owner !== userData.login && !globallyAllowed) {
        callback(lang(language).errDeniedChangeBoardSettings);
      } else {
        exports.writeNewBanner(parameters, callback);

      }
    });

  }

};
// }Section 2: Banner creation

// Section 3: Banner management {
exports.readBannerData = function(boardUri, callback) {

  files.find({
    'metadata.boardUri' : boardUri || {
      $exists : false
    },
    'metadata.type' : 'banner'
  }, {
    projection : {
      filename : 1
    }
  }).sort({
    uploadDate : 1
  }).toArray(function(error, banners) {
    callback(error, banners);
  });

};

exports.getBannerData = function(userData, boardUri, language, callback) {

  var admin = userData.globalRole <= 1;

  if (!admin && !boardUri) {
    callback(lang(language).errDeniedGlobalBannerManagement);
  } else if (!boardUri) {
    exports.readBannerData(null, callback);
  } else {

    var globallyAllowed = admin && globalBoardModeration;

    boards.findOne({
      boardUri : boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang(language).errBoardNotFound);
      } else if (board.owner !== userData.login && !globallyAllowed) {
        callback(lang(language).errDeniedChangeBoardSettings);
      } else {
        exports.readBannerData(boardUri, callback);
      }
    });
  }

};
// } Section 3: Banner management
