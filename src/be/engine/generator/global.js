'use strict';

// handles generation of pages not specific to any board

var fs = require('fs');
var logger = require('../../logger');
var db = require('../../db');
var logs = db.logs();
var aggregatedLogs = db.aggregatedLogs();
var overboardThreads = db.overboardThreads();
var threads = db.threads();
var posts = db.posts();
var rootModule;
var kernel = require('../../kernel');
var settingsHandler = require('../../settingsHandler');
var verbose;
var multiboardThreadCount;
var domManipulator;
var postProjection;
var threadProjection;
var jsonBuilder;
var gfsHandler;
var jsonBuilder;
var frontPage;
var miscOps;
var rssBuilder;
var overboard;
var latestPinned;
var sfwOverboard;
var fePath;
var altLanguages;
var overBoardThreadCount;

exports.loadSettings = function() {
  var settings = settingsHandler.getGeneralSettings();

  multiboardThreadCount = settings.multiboardThreadCount;
  verbose = settings.verbose || settings.verboseGenerator;
  latestPinned = settings.latestPostPinned;
  altLanguages = settings.useAlternativeLanguages;
  overboard = settings.overboard;
  fePath = settings.fePath;
  sfwOverboard = settings.sfwOverboard;
  overBoardThreadCount = settings.overBoardThreadCount;
};

exports.loadDependencies = function() {

  rootModule = require('.');
  exports.frontPage = rootModule.frontPage.frontPage;
  postProjection = rootModule.postProjection;
  threadProjection = rootModule.threadProjection;
  var rootDomManipulator = require('../domManipulator');
  domManipulator = rootDomManipulator.staticPages;
  gfsHandler = require('../gridFsHandler');
  miscOps = require('../miscOps');
  jsonBuilder = require('../jsonBuilder');
  rssBuilder = require('../rssBuilder');

};

exports.maintenance = function(callback, language) {

  if (verbose && !language) {
    console.log('Generating maintenance page');
  }

  domManipulator.maintenance(language,
      function generatedMaintenancePage(error) {
        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            callback();
            return;
          }

          // style exception, too simple
          rootModule.nextLanguage(language, function gotNextLanguage(error,
              language) {

            if (error) {
              callback(error);
            } else if (!language) {
              callback();
            } else {
              exports.maintenance(callback, language);
            }
          });
          // style exception, too simple

        }
      });

};

exports.login = function(callback, language) {
  if (verbose && !language) {
    console.log('Generating login page');
  }

  domManipulator.login(language, function generatedLogin(error) {

    if (error) {
      callback();
    } else {

      if (!altLanguages) {
        callback();
        return;
      }

      // style exception, too simple
      rootModule.nextLanguage(language, function gotNextLanguage(error,
          language) {

        if (error) {
          callback(error);
        } else if (!language) {
          callback();
        } else {
          exports.login(callback, language);
        }
      });
      // style exception, too simple

    }

  });

};

exports.audioThumb = function(callback, language) {

  if (verbose && !language) {
    console.log('Saving audio thumb image');
  }

  var filePath = (language ? language.frontEnd : fePath) + '/templates/';

  if (language) {
    var settingsPath = language.frontEnd + '/templateSettings.json';

    var settingsToUse = JSON.parse(fs.readFileSync(settingsPath));
  } else {
    settingsToUse = settingsHandler.getTemplateSettings();
  }

  filePath += settingsToUse.audioThumb;

  var path = kernel.genericAudioThumb();
  var meta = {};

  if (language) {
    meta.referenceFile = path;
    meta.languages = language.headerValues;
    path += language.headerValues.join('-');
  }

  gfsHandler.writeFile(filePath, path, logger.getMime(filePath), meta,
      function savedThumb(error) {

        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            callback();
            return;
          }

          // style exception, too simple
          rootModule.nextLanguage(language, function gotNextLanguage(error,
              language) {

            if (error) {
              callback(error);
            } else if (!language) {
              callback();
            } else {
              exports.audioThumb(callback, language);
            }
          });
          // style exception, too simple

        }

      });

};

exports.spoiler = function(callback, language) {

  if (verbose && !language) {
    console.log('Saving spoiler image');
  }

  var filePath = (language ? language.frontEnd : fePath) + '/templates/';

  if (language) {
    var settingsPath = language.frontEnd + '/templateSettings.json';

    var settingsToUse = JSON.parse(fs.readFileSync(settingsPath));
  } else {
    settingsToUse = settingsHandler.getTemplateSettings();
  }

  filePath += settingsToUse.spoiler;

  var path = kernel.spoilerImage();
  var meta = {};

  if (language) {
    meta.referenceFile = path;
    meta.languages = language.headerValues;
    path += language.headerValues.join('-');
  }

  gfsHandler.writeFile(filePath, path, logger.getMime(filePath), meta,
      function savedSpoiler(error) {

        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            callback();
            return;
          }

          // style exception, too simple
          rootModule.nextLanguage(language, function gotNextLanguage(error,
              language) {

            if (error) {
              callback(error);
            } else if (!language) {
              callback();
            } else {
              exports.spoiler(callback, language);
            }
          });
          // style exception, too simple

        }

      });

};

exports.defaultBanner = function(callback, language) {

  if (verbose && !language) {
    console.log('Saving default banner');
  }

  var filePath = (language ? language.frontEnd : fePath) + '/templates/';

  if (language) {
    var settingsPath = language.frontEnd + '/templateSettings.json';

    var settingsToUse = JSON.parse(fs.readFileSync(settingsPath));
  } else {
    settingsToUse = settingsHandler.getTemplateSettings();
  }

  filePath += settingsToUse.defaultBanner;

  var path = kernel.defaultBanner();
  var meta = {};

  if (language) {
    meta.referenceFile = path;
    meta.languages = language.headerValues;
    path += language.headerValues.join('-');
  }

  gfsHandler.writeFile(filePath, path, logger.getMime(filePath), meta,
      function savedBanner(error) {

        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            callback();
            return;
          }

          // style exception, too simple
          rootModule.nextLanguage(language, function gotNextLanguage(error,
              language) {

            if (error) {
              callback(error);
            } else if (!language) {
              callback();
            } else {
              exports.defaultBanner(callback, language);
            }
          });
          // style exception, too simple

        }

      });

};

exports.maintenanceImage = function(callback, language) {

  if (verbose && !language) {
    console.log('Saving maintenance image');
  }

  var filePath = (language ? language.frontEnd : fePath) + '/templates/';

  if (language) {
    var settingsPath = language.frontEnd + '/templateSettings.json';

    var settingsToUse = JSON.parse(fs.readFileSync(settingsPath));
  } else {
    settingsToUse = settingsHandler.getTemplateSettings();
  }

  filePath += settingsToUse.maintenanceImage;

  var path = kernel.maintenanceImage();
  var meta = {};

  if (language) {
    meta.referenceFile = path;
    meta.languages = language.headerValues;
    path += language.headerValues.join('-');
  }

  gfsHandler.writeFile(filePath, path, logger.getMime(filePath), meta,
      function savedMaintanceImage(error) {

        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            callback();
            return;
          }

          // style exception, too simple
          rootModule.nextLanguage(language, function gotNextLanguage(error,
              language) {

            if (error) {
              callback(error);
            } else if (!language) {
              callback();
            } else {
              exports.maintenanceImage(callback, language);
            }
          });
          // style exception, too simple

        }

      });

};

exports.thumb = function(callback, language) {

  if (verbose && !language) {
    console.log('Saving generic thumbnail');
  }

  var filePath = (language ? language.frontEnd : fePath) + '/templates/';

  if (language) {
    var settingsPath = language.frontEnd + '/templateSettings.json';

    var settingsToUse = JSON.parse(fs.readFileSync(settingsPath));
  } else {
    settingsToUse = settingsHandler.getTemplateSettings();
  }

  filePath += settingsToUse.thumb;

  var path = kernel.genericThumb();
  var meta = {};

  if (language) {
    meta.referenceFile = path;
    meta.languages = language.headerValues;
    path += language.headerValues.join('-');
  }

  gfsHandler.writeFile(filePath, path, logger.getMime(filePath), meta,
      function savedBanner(error) {

        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            callback();
            return;
          }

          // style exception, too simple
          rootModule.nextLanguage(language, function gotNextLanguage(error,
              language) {

            if (error) {
              callback(error);
            } else if (!language) {
              callback();
            } else {
              exports.thumb(callback, language);
            }
          });
          // style exception, too simple

        }

      });

};

exports.notFound = function(callback, language) {

  if (verbose && !language) {
    console.log('Generating 404 page');
  }

  domManipulator.notFound(language, function saved404Page(error) {

    if (error) {
      callback(error);
    } else {

      if (!altLanguages) {
        callback();
        return;
      }

      // style exception, too simple
      rootModule.nextLanguage(language, function gotNextLanguage(error,
          language) {

        if (error) {
          callback(error);
        } else if (!language) {
          callback();
        } else {
          exports.notFound(callback, language);
        }
      });
      // style exception, too simple

    }

  });

};

exports.getPreFetchPreviewRelation = function(foundThreads) {

  var previewRelation = {};

  for (var i = 0; i < foundThreads.length; i++) {

    var thread = foundThreads[i];

    var boardUri = thread.boardUri;

    var previewArray = previewRelation[boardUri] || [];

    var over = thread.latestPosts && thread.latestPosts.length > latestPinned;

    if (over && thread.pinned) {
      thread.latestPosts.splice(0, thread.latestPosts.length - latestPinned);
    }

    previewArray = previewArray.concat(thread.latestPosts);

    previewRelation[boardUri] = previewArray;
  }

  return previewRelation;

};

// Section 2: Overboard {
exports.buildJsonAndRssOverboard = function(foundThreads, previewRelation,
    callback, sfw) {

  jsonBuilder.overboard(foundThreads, previewRelation,
      function builtJsonOverboard(error) {

        if (error) {
          callback(error);
        } else {
          rssBuilder.board({
            boardUri : sfw ? sfwOverboard : overboard
          }, foundThreads, function rebuilt(error) {

            if (error) {
              callback(error);
            } else if (!sfw && sfwOverboard) {

              exports.overboard(callback, true);
            } else {
              callback();
            }

          });
        }

      }, null, sfw);

};

exports.buildHTMLOverboard = function(foundThreads, previewRelation, sfw,
    callback, language) {

  domManipulator.overboard(foundThreads, previewRelation, function rebuildHtml(
      error) {
    if (error) {
      callback(error);
    } else {

      if (altLanguages) {

        // style exception, too simple
        rootModule.nextLanguage(language, function gotNextLanguage(error,
            language) {

          if (error) {
            callback(error);
          } else if (!language) {
            exports.buildJsonAndRssOverboard(foundThreads, previewRelation,
                callback, sfw);
          } else {
            exports.buildHTMLOverboard(foundThreads, previewRelation, sfw,
                callback, language);
          }

        });
        // style exception, too simple

      } else {
        exports.buildJsonAndRssOverboard(foundThreads, previewRelation,
            callback, sfw);
      }

    }
  }, null, sfw, language);

};

exports.getOverboardPosts = function(foundThreads, callback, sfw) {

  var orArray = [];

  var previewRelation = exports.getPreFetchPreviewRelation(foundThreads);

  for ( var key in previewRelation) {

    orArray.push({
      boardUri : key,
      postId : {
        $in : previewRelation[key]
      }
    });
  }

  posts.find({
    $or : orArray
  }, {
    projection : postProjection
  }).sort({
    creation : 1
  }).toArray(function gotPosts(error, foundPosts) {
    if (error) {
      callback(error);
    } else {

      var previewRelation = {};

      for (var i = 0; i < foundPosts.length; i++) {

        var post = foundPosts[i];

        var boardElement = previewRelation[post.boardUri] || {};

        previewRelation[post.boardUri] = boardElement;

        var threadArray = boardElement[post.threadId] || [];

        threadArray.push(post);

        boardElement[post.threadId] = threadArray;

      }

      exports.buildHTMLOverboard(foundThreads, previewRelation, sfw, callback);

    }

  });

};

exports.getOverboardThreads = function(ids, callback, sfw) {

  threads.find({
    _id : {
      $in : ids
    }
  }, {
    projection : threadProjection
  }).sort({
    lastBump : -1
  }).limit(overBoardThreadCount).toArray(
      function gotThreads(error, foundThreads) {
        if (error) {
          callback(error);
        } else if (!foundThreads.length) {
          exports.buildHTMLOverboard([], {}, sfw, callback);
        } else {
          exports.getOverboardPosts(foundThreads, callback, sfw);
        }
      });

};

exports.overboard = function(callback, sfw) {

  if (!overboard && !sfw) {
    exports.overboard(callback, true);
    return;
  } else if (sfw && !sfwOverboard) {
    callback();
    return;
  }

  if (verbose) {
    console.log('Building overboard ' + (sfw ? 'SFW' : 'NSFW'));
  }

  overboardThreads.aggregate([ {
    $match : sfw ? {
      sfw : true
    } : {}
  }, {
    $group : {
      _id : 0,
      ids : {
        $push : '$thread'
      }
    }
  } ]).toArray(
      function gotOverBoardThreads(error, results) {

        if (error) {
          callback(error);
        } else {
          exports.getOverboardThreads(results.length ? results[0].ids : [],
              callback, sfw);
        }

      });

};
// } Section 2: Overboard

// Section 3: Logs {
exports.createLogPage = function(logData, foundLogs, callback, language) {

  domManipulator.log(language, logData, foundLogs, function createdPage(error) {

    if (error) {
      callback(error);
    } else {

      if (!altLanguages) {
        jsonBuilder.log(logData, foundLogs, callback);
        return;
      }

      // style exception, too simple
      rootModule.nextLanguage(language, function gotNextLanguage(error,
          language) {

        if (error) {
          callback(error);
        } else if (!language) {
          jsonBuilder.log(logData, foundLogs, callback);
        } else {
          exports.createLogPage(logData, foundLogs, callback, language);
        }

      });
      // style exception, too simple

    }

  });

};

exports.log = function(date, callback, logData) {

  if (!logData) {

    if (!date) {

      if (verbose) {
        console.log('Could not build log page, no data.');
      }

      callback();
      return;
    }

    aggregatedLogs.findOne({
      date : date
    }, function gotLogData(error, data) {

      if (error) {
        callback(error);
      } else if (!data) {

        if (verbose) {
          console.log('Could not find logs for ' + date);
        }

        callback();
      } else {
        exports.log(null, callback, data);
      }

    });

    return;
  }

  if (verbose) {
    console.log('Building log page for ' + logData.date);
  }

  var toFind = [];

  for (var i = 0; i < logData.logs.length; i++) {
    toFind.push(logData.logs[i]);
  }

  logs.find({
    _id : {
      $in : toFind
    }
  }, {
    projection : {
      type : 1,
      user : 1,
      cache : 1,
      alternativeCaches : 1,
      time : 1,
      boardUri : 1,
      description : 1,
      global : 1
    }
  }).sort({
    time : 1
  }).toArray(function gotLogs(error, foundLogs) {

    if (error) {
      callback(error);
    } else {
      exports.createLogPage(logData, foundLogs, callback);
    }

  });

};
// } Section 3: Logs

// Just a wraper so we can generate graphs on the terminal
exports.graphs = function(callback) {
  require('../../dbMigrations').generateGraphs(callback);
};

// Section 4: Multi-board {
exports.generateHTMLPage = function(boardList, previewRelation, foundThreads,
    callback, language) {

  domManipulator.overboard(foundThreads, previewRelation, function gotContent(
      error) {

    if (error) {
      callback(error);
    } else {

      if (!altLanguages) {
        jsonBuilder.overboard(foundThreads, previewRelation, callback,
            boardList);
        return;
      }

      rootModule.nextLanguage(language, function gotLanguage(error, language) {

        if (error) {
          callback(error);
        } else if (!language) {
          jsonBuilder.overboard(foundThreads, previewRelation, callback,
              boardList);
        } else {
          exports.generateHTMLPage(boardList, previewRelation, foundThreads,
              callback, language);
        }

      });

    }

  }, boardList, null, language);

};

exports.generatePage = function(boardList, foundPosts, foundThreads, callback) {

  var previewRelation = {};

  for (var i = 0; i < foundPosts.length; i++) {

    var post = foundPosts[i];

    var boardElement = previewRelation[post.boardUri] || {};

    previewRelation[post.boardUri] = boardElement;

    var threadArray = boardElement[post.threadId] || [];

    threadArray.push(post);

    boardElement[post.threadId] = threadArray;

  }

  exports.generateHTMLPage(boardList, previewRelation, foundThreads, callback);

};

exports.getPosts = function(boardList, foundThreads, callback) {

  var previewRelation = exports.getPreFetchPreviewRelation(foundThreads);

  var orArray = [];

  for ( var key in previewRelation) {

    orArray.push({
      boardUri : key,
      postId : {
        $in : previewRelation[key]
      }
    });
  }

  if (!orArray.length) {
    exports.generatePage(boardList, [], foundThreads, callback);
    return;
  }

  posts.find({
    $or : orArray
  }, {
    projection : postProjection
  }).sort({
    creation : 1
  }).toArray(function gotPosts(error, foundPosts) {
    if (error) {
      callback(error);
    } else {
      exports.generatePage(boardList, foundPosts, foundThreads, callback);
    }

  });

};

exports.multiboard = function(boardList, callback) {

  if (verbose) {
    console.log('Generating multiboard');
  }

  threads.find({
    boardUri : {
      $in : boardList
    }
  }, {
    projection : threadProjection
  }).sort({
    lastBump : -1
  }).limit(multiboardThreadCount).toArray(
      function gotThreads(error, foundThreads) {

        if (error) {
          callback(error);
        } else {
          exports.getPosts(boardList, foundThreads, callback);
        }
      });

};
// } Section 4: Multi-board
