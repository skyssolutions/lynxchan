'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var kernel = require('../kernel');
var posts = db.posts();
var threads = db.threads();
var miscOps;
var thumbs = db.thumbs();
var gridFsHandler;
var lang;

exports.loadDependencies = function() {
  lang = require('./langOps').languagePack;
  gridFsHandler = require('./gridFsHandler');
  miscOps = require('./miscOps');
};

exports.getData = function(userData, language, callback) {

  var global = userData.globalRole < 2;

  if (!global) {
    return callback(lang(language).errDeniedThumbManagement);
  }

  thumbs.find().toArray(callback);

};

// Section 1: Thumb creation {
exports.updatePosts = function(newUri, toInsert, callback) {

  var ops = [ {
    updateMany : {
      filter : {
        'files.mime' : toInsert.mime
      },
      update : {
        $set : {
          'files.$[file].thumb' : newUri
        },
        $unset : miscOps.individualCaches
      },
      arrayFilters : [ {
        'file.thumb' : kernel.genericThumb()
      } ]
    }
  } ];

  posts.bulkWrite(ops, function(error) {

    threads.bulkWrite(ops, function(error) {

      if (!error) {

        process.send({
          allBoards : true
        });

      }

      callback(null, toInsert._id);
    });

  });

};

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

      exports.updatePosts(newUrl, toInsert, callback);

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

// Section 2: Thumb creation {
exports.cleanThumbs = function(path, removed, callback) {

  if (!removed) {
    return callback();
  }

  var ops = [ {
    updateMany : {
      filter : {
        'files.mime' : removed
      },
      update : {
        $set : {
          'files.$[file].thumb' : kernel.genericThumb()
        },
        $unset : miscOps.individualCaches
      },
      arrayFilters : [ {
        'file.thumb' : path
      } ]
    }
  } ];

  posts.bulkWrite(ops, function(error) {

    if (error) {
      return callback(error);
    }

    threads.bulkWrite(ops, function(error) {

      if (!error) {

        process.send({
          allBoards : true
        });

      }

      callback(error);
    });

  });

};

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

  var thumbPath = '/.global/mimeThumbs/' + params.thumbId;
  gridFsHandler.removeFiles('/.global/mimeThumbs/' + params.thumbId,
      function removedFlagFile(error) {

        if (error) {
          return callback(error);
        }

        // style exception, too simple
        thumbs.findOneAndDelete({
          _id : parsedId
        }, function(error, removed) {
          if (error) {
            callback(error);
          } else {
            exports.cleanThumbs(thumbPath, removed.value ? removed.value.mime
                : null, callback);
          }
        });
        // style exception, too simple

      });

};
// } Section 2: Thumb creation
