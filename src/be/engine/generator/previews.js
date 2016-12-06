'use strict';

var exec = require('child_process').exec;
var ObjectID = require('mongodb').ObjectID;
var kernel = require('../../kernel');
var db = require('../../db');
var posts = db.posts();
var threads = db.threads();
var settingsHandler = require('../../settingsHandler');
var domManipulator;
var altLanguages;
var jsonBuilder;
var postProjection;
var verbose;
var rootModule;

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();

  altLanguages = settings.useAlternativeLanguages;
  verbose = settings.verbose || settings.verboseGenerator;

};

exports.loadDependencies = function() {

  jsonBuilder = require('../jsonBuilder');
  rootModule = require('.');
  domManipulator = require('../domManipulator').staticPages;
  postProjection = rootModule.postProjection;

};

exports.buildPreviewHTML = function(postingData, callback, language) {

  domManipulator.preview(language, postingData, function savedHtml(error) {
    if (error) {
      callback(error);
    } else {

      if (!altLanguages) {
        jsonBuilder.preview(postingData, callback);
        return;
      }

      // style exception, too simple
      rootModule.nextLanguage(language, function gotLanguage(error, language) {

        if (error) {
          callback(error);
        } else if (!language) {
          jsonBuilder.preview(postingData, callback);
        } else {
          exports.buildPreviewHTML(postingData, callback, language);
        }

      });
      // style exception, too simple

    }

  });

};

exports.preview = function(boardUri, threadId, postId, callback, postingData) {

  if (!postingData) {

    var queryBlock = {
      boardUri : boardUri
    };

    var collection;

    if (postId) {
      collection = posts;
      queryBlock.postId = postId;
    } else {
      collection = threads;
      queryBlock.threadId = threadId;
    }

    collection.findOne(queryBlock, postProjection, function gotPosting(error,
        posting) {
      if (error) {
        callback(error);
      } else if (!posting) {
        callback('Posting could not be found');
      } else {
        exports.preview(boardUri, threadId, postId, callback, posting);
      }
    });

  } else {

    if (verbose) {

      var message = 'Generating preview for ' + postingData.boardUri + '/';
      message += (postingData.postId || postingData.threadId);

      console.log(message);
    }

    exports.buildPreviewHTML(postingData, callback);

  }
};

exports.iteratePostsForPreviews = function(callback, lastId, toSkip,
    startedSkipping) {

  var query = {};

  if (lastId) {
    query._id = {
      $lt : lastId
    };
  }

  var cursor = posts.find(query, postProjection).sort({
    _id : -1
  });

  if (toSkip && startedSkipping) {
    cursor.skip(toSkip);
  }

  cursor.limit(1).toArray(function gotThread(error, results) {

    if (error) {
      callback(error);
    } else if (results && results.length) {

      var post = results[0];

      // style exception, too simple
      exports.preview(null, null, null, function generatedPreview(error) {

        if (error) {
          callback(error);
        } else {
          exports.iteratePostsForPreviews(callback, post._id, toSkip, true);
        }

      }, post);
      // style exception, too simple

    } else {
      callback();
    }

  });

};

exports.iterateThreadsForPreviews = function(callback, lastId, lastPostId,
    toSkip, startedSkipping) {

  var query = {};

  if (lastId) {
    query._id = {
      $lt : lastId
    };
  }

  var cursor = threads.find(query, postProjection).sort({
    _id : -1
  });

  if (toSkip && startedSkipping) {
    cursor.skip(toSkip);
  }

  cursor.limit(1);

  cursor.toArray(function gotThread(error, results) {

    if (error) {
      callback(error);
    } else if (results && results.length) {

      var thread = results[0];

      // style exception, too simple
      exports.preview(null, null, null, function generatedPreview(error) {

        if (error) {
          callback(error);
        } else {
          exports.iterateThreadsForPreviews(callback, thread._id, lastPostId,
              toSkip, true);
        }

      }, thread);
      // style exception, too simple

    } else {
      exports.iteratePostsForPreviews(callback, lastPostId, toSkip);
    }

  });

};

exports.getFinalCommand = function(bootPath, startThreads, startPosts, i) {

  var pathToUse = bootPath;

  if (i) {
    if (i < startThreads.length) {
      pathToUse += ' -t ' + (startThreads[i - 1])._id;
    }

    if (i < startPosts.length) {
      pathToUse += ' -po ' + (startPosts[i - 1])._id;
    }

  }

  return pathToUse;

};

exports.startPreviewRebuildProcesses = function(startThreads, startPosts,
    callback) {

  var count = startThreads.length > startPosts.length ? startThreads.length
      : startPosts.length;

  var bootPath = __dirname + '/../../boot.js -nd -rp -nf';

  if (count > 1) {
    bootPath += ' -i ' + (count - 1);
  } else if (!count) {

    callback();

    return;
  }

  var running = true;

  var execCallback = function(error, stdout, stderr) {

    if (!running) {
      return;
    }

    var trimmed = stdout.trim();

    if (trimmed.length) {
      console.log(trimmed);
    }

    if (error) {
      running = false;
      callback(stderr);

    } else {

      count--;

      if (!count) {
        running = false;
        callback();
      }

    }

  };

  for (var i = 0; i < count; i++) {

    exec(exports.getFinalCommand(bootPath, startThreads, startPosts, i),
        execCallback);

  }

};

exports.previews = function(callback, lastId) {

  var informedArguments = kernel.informedArguments();

  if (informedArguments.noFork.informed) {

    exports.iterateThreadsForPreviews(callback, new ObjectID(
        informedArguments.thread.value), new ObjectID(
        informedArguments.post.value), +informedArguments.interval.value);

    return;
  }

  threads.find({}, {
    threadId : 1
  }).sort({
    _id : -1
  }).limit(require('os').cpus().length).toArray(
      function gotInitialThreads(error, initialThreads) {

        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          posts.find({}, {
            postId : 1
          }).sort({
            _id : -1
          }).limit(require('os').cpus().length).toArray(
              function gotInitialPosts(error, initialPosts) {

                if (error) {
                  callback(error);
                } else {
                  exports.startPreviewRebuildProcesses(initialThreads,
                      initialPosts, callback);
                }

              });
          // style exception, too simple

        }

      });

};