'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var thumbs = db.thumbs();
var gridFsHandler;
var lang;

exports.loadDependencies = function() {
  lang = require('./langOps').languagePack;
  gridFsHandler = require('./gridFsHandler');
};

exports.getData = function(userData, language, callback) {

  var global = userData.globalRole < 2;

  if (!global) {
    return callback(lang(language).errDeniedThumbManagement);
  }

  thumbs.find().toArray(callback);

};

// Section 1: Thumb creation {
exports.processThumbFile = function(toInsert, file, callback) {

  var newUrl = '/.global/mimeThumbs/' + toInsert._id;

  gridFsHandler.writeFile(file.pathInDisk, newUrl, file.mime, {
    type : 'mimeThumb'
  }, function addedThumbFile(error) {
    if (error) {

      // style exception, too simple
      thumbs.removeOne({
        _id : toInsert._id
      }, function removedThumb(deletionError) {
        callback(deletionError || error);
      });
      // style exception, too simple

    } else {

      callback(null, toInsert._id);
    }
  });

};

exports.addThumb = function(userData, params, language, callback) {

  var global = userData.globalRole < 2;

  if (!global) {
    return callback(lang(language).errDeniedThumbManagement);
  } else if (!params.files.length) {
    return callback(lang(language).errNoFiles);
  } else if (params.files[0].mime.indexOf('image/') === -1) {
    return callback(lang(language).errNotAnImage);
  }

  var toInsert = {
    mime : params.mime
  };

  thumbs.insertOne(toInsert, function(error, document) {

    if (error) {
      return callback(error);
    }

    exports.processThumbFile(toInsert, params.files[0], callback);

  });

};
// } Section 1: Thumb creation

exports.deleteThumb = function(userData, params, language, callback) {

  var global = userData.globalRole < 2;

  if (!global) {
    return callback(lang(language).errDeniedThumbManagement);
  }

  var parsedId;

  try {
    parsedId = new ObjectID(params.thumbId);
  } catch (error) {
    return callback(lang(language).errMimeThumbNotFound);
  }

  gridFsHandler.removeFiles('/.global/mimeThumbs/' + params.thumbId,
      function removedFlagFile(error) {

        if (error) {
          return callback(error);
        }

        thumbs.removeOne({
          _id : parsedId
        }, callback);

      });

};
