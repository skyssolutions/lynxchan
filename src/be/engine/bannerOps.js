'use strict';

// operations for banner management

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var boards = db.boards();
var files = db.files();
var gridFsHandler;
var maxBoardBanners;
var lang;
var maxBannerSize;
var globalBoardModeration;

exports.loadSettings = function() {
  var settings = require('../settingsHandler').getGeneralSettings();

  maxBoardBanners = settings.maxBoardBanners;
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
exports.writeNewBanner = function(parameters, file, callback) {

  var bannerPath = '/' + (parameters.boardUri || '.global') + '/banners/';
  bannerPath += new Date().getTime();

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

exports.processBanners = function(parameters, language, ids, callback, index) {

  index = index || 0;

  //TODO
  
  if (index >= parameters.files.length) {
    return callback();
  }

  var file = parameters.files[index];

  if (file.mime.indexOf('image/') === -1) {
    return callback(lang(language).errNotAnImage);
  } else if (file.size > maxBannerSize) {
    return callback(lang(language).errBannerTooLarge);
  }

  var tempCb = function(error, id, bannerPath) {

    if (error) {
      callback(error);
    } else {

      ids.push({
        id : id,
        path : bannerPath
      });

      exports.processBanners(parameters, language, ids, callback, ++index);
    }

  };

  if (!parameters.boardUri) {
    return exports.writeNewBanner(parameters, parameters.files[index], tempCb);
  }

  files.countDocuments({
    'metadata.boardUri' : parameters.boardUri,
    'metadata.type' : 'banner'
  }, function(error, count) {

    if (error) {
      callback(error);
    } else if (count >= maxBoardBanners) {
      callback(lang(language).errBoardBannerLimit);
    } else {
      exports.writeNewBanner(parameters, parameters.files[index], tempCb);
    }

  });

};

exports.addBanners = function(userData, parameters, ids, language, callback) {

  if (!parameters.files.length) {
    return callback(lang(language).errNoFiles);
  }

  var admin = userData.globalRole <= 1;

  if (!parameters.boardUri && !admin) {
    return callback(lang(language).errDeniedGlobalBannerManagement);
  } else if (!parameters.boardUri) {
    return exports.processBanners(parameters, language, ids, callback);
  }

  var globallyAllowed = admin && globalBoardModeration;

  boards.findOne({
    boardUri : parameters.boardUri.trim()
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedChangeBoardSettings);
    } else {
      exports.processBanners(parameters, language, ids, callback);
    }
  });

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
