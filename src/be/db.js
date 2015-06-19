'use strict';

var dbVersion = 1;

// takes care of the database.
// initializes and provides pointers to collections or the connection pool

var gridFsHandler;
var boot = require('./boot');
var settings = boot.getGeneralSettings();
var verbose = settings.verbose;
var debug = boot.debug();
var captchaExpiration = settings.captchaExpiration || 1;

var indexesSet;

var cachedDb;

var maxIndexesSet = 9;

var cachedVersions;
var cachedPosts;
var cachedReports;
var cachedThreads;
var cachedBoards;
var cachedBans;
var cachedUsers;
var cachedCaptchas;
var cachedFiles;
var cachedTripcodes;
var cachedRecoveryRequests;

var loading;

// start of captcha cleanup
exports.scheduleExpiredCaptchaCheck = function(immediate) {
  if (immediate) {
    gridFsHandler = require('./engine/gridFsHandler');
    checkExpiredCaptchas();
  } else {

    setTimeout(function() {

      checkExpiredCaptchas();
    }, captchaExpiration * 1000 * 60);

  }
};

function checkExpiredCaptchas() {
  cachedFiles.aggregate([ {
    $match : {
      'metadata.type' : 'captcha',
      'metadata.expiration' : {
        $lte : new Date()
      }
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function gotExpiredFiles(error, results) {
    if (error) {

      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }

    } else if (results.length) {

      var expiredFiles = results[0].files;

      if (verbose) {
        var message = 'deleting expired captchas: ';
        message += JSON.stringify(expiredFiles);
        console.log(message);
      }

      // style exception, too simple
      gridFsHandler.removeFiles(expiredFiles, function deletedFiles(error) {
        if (error) {
          if (verbose) {
            console.log(error);
          }

          if (debug) {
            throw error;
          }
        } else {
          exports.scheduleExpiredCaptchaCheck();
        }
      });

      // style exception, too simple

    } else {
      exports.scheduleExpiredCaptchaCheck();
    }
  });

}
// end of captcha cleanup

// start of version check

function registerLatestVersion(callback) {

  if (verbose) {
    console.log('Checking if latest version is ' + dbVersion);
  }

  cachedVersions.count({
    version : dbVersion,
    active : true
  }, function gotVersion(error, count) {
    if (error) {
      callback(error);
    } else if (count) {
      callback();
    } else {

      // style exception, too simple
      if (verbose) {
        console.log('Registering current version as ' + dbVersion);
      }

      cachedVersions.insert({
        version : dbVersion,
        deploy : new Date(),
        active : true,
        upgraded : false
      }, function addedVersion(error) {
        callback(error);

      });

      // style exception, too simple

    }
  });
}

// Implement upgrades here. The version is the current version.
function upgrade(version, callback) {

  switch (version) {
  default:
    callback('Cannot upgrade from version ' + version);
  }

}

function iterateUpgrades(currentVersion, callback) {

  if (verbose) {
    console.log('Iterating db version ' + currentVersion);
  }

  if (currentVersion === dbVersion) {
    registerLatestVersion(callback);
    return;
  }

  upgrade(currentVersion, function upgraded(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple

      cachedVersions.updateOne({
        version : currentVersion
      }, {
        $set : {
          version : currentVersion,
          active : false,
          upgraded : true
        }
      }, {
        upsert : true
      }, function confirmedUpgrade(error) {
        if (error) {
          callback(error);
        } else {
          iterateUpgrades(currentVersion + 1, callback);
        }
      });

      // style exception, too simple

    }
  });

}

exports.checkVersion = function(callback) {

  cachedVersions = cachedDb.collection('witnessedReleases');

  cachedVersions.findOne({
    version : {
      $lt : dbVersion
    },
    upgraded : false
  }, {
    sort : {
      version : -1
    }
  }, function gotLatestVersion(error, version) {
    if (error) {
      callback(error);
    } else if (!version) {
      registerLatestVersion(callback);
    } else {
      iterateUpgrades(version.version, callback);
    }

  });

};
// end of version check

function indexSet(callback) {

  indexesSet++;

  if (indexesSet === maxIndexesSet) {
    loading = false;

    callback();
  }
}

// start of index initialization
function initCaptchas(callback) {

  cachedCaptchas = cachedDb.collection('captchas');

  cachedCaptchas.ensureIndex({
    expiration : 1
  }, {
    expireAfterSeconds : 0
  }, function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });
}

function initTripcodes(callback) {

  cachedTripcodes = cachedDb.collection('secureTripcodes');

  cachedTripcodes.ensureIndex({
    tripcode : 1
  }, {
    unique : 1
  }, function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });
}

function initBans(callback) {

  cachedBans = cachedDb.collection('bans');

  cachedBans.ensureIndex({
    expiration : 1
  }, {
    expireAfterSeconds : 0
  }, function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });
}

function initReports(callback) {
  cachedReports = cachedDb.collection('reports');

  cachedReports.ensureIndex({
    boardUri : 1,
    global : 1,
    threadId : 1,
    postId : 1
  }, {
    unique : true
  }, function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });
}

function initPosts(callback) {
  cachedPosts = cachedDb.collection('posts');

  cachedPosts.ensureIndex({
    postId : 1,
    threadId : 1,
    boardUri : 1
  }, {
    unique : true
  }, function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });
}

function initRecoveryRequests(callback) {

  cachedRecoveryRequests = cachedDb.collection('recoveryRequests');

  cachedRecoveryRequests.ensureIndex({
    expiration : 1
  }, {
    expireAfterSeconds : 0
  }, function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });

}

function initUsers(callback) {

  cachedUsers = cachedDb.collection('users');

  cachedUsers.ensureIndex({
    login : 1
  }, {
    unique : true
  }, function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });

}

function initThreads(callback) {
  cachedThreads = cachedDb.collection('threads');

  cachedThreads.ensureIndex({
    threadId : 1,
    boardUri : 1
  }, {
    unique : true
  }, function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });
}

function initBoards(callback) {

  cachedBoards = cachedDb.collection('boards');

  cachedBoards.ensureIndex({
    boardUri : 1
  }, {
    unique : true
  }, function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });

}

// end of index initialization

// start of getters

exports.conn = function() {
  return cachedDb;
};

exports.recoveryRequests = function() {
  return cachedRecoveryRequests;
};

exports.files = function() {
  return cachedFiles;
};

exports.bans = function() {
  return cachedBans;
};

exports.posts = function() {
  return cachedPosts;
};

exports.boards = function() {
  return cachedBoards;
};

exports.users = function() {
  return cachedUsers;
};

exports.threads = function() {
  return cachedThreads;
};

exports.captchas = function() {
  return cachedCaptchas;
};

exports.reports = function() {
  return cachedReports;
};

exports.tripcodes = function() {
  return cachedTripcodes;
};

// end of getters

function checkCollections(db, callback) {

  cachedDb = db;

  initBoards(callback);

  initThreads(callback);

  initPosts(callback);

  initUsers(callback);

  initReports(callback);

  initBans(callback);

  initCaptchas(callback);

  initRecoveryRequests(callback);

  initTripcodes(callback);

  cachedFiles = db.collection('fs.files');

}

exports.init = function(callback) {

  if (loading) {
    callback('Already booting db');
  }

  loading = true;

  indexesSet = 0;

  var dbSettings = require('./boot').getDbSettings();

  var client = require('mongodb').MongoClient;

  var connectString = 'mongodb://';

  if (dbSettings.user) {
    connectString += dbSettings.user + ':' + dbSettings.password + '@';
  }

  connectString += dbSettings.address + ':';
  connectString += dbSettings.port + '/' + dbSettings.db;

  client.connect(connectString, function connectedDb(error, db) {

    if (error) {
      callback(error);
    } else {
      checkCollections(db, callback);
    }

  });

};
