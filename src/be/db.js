'use strict';

var dbVersion = 5;

// takes care of the database.
// initializes and provides pointers to collections or the connection pool

var archive = require('./archive');
var mongo = require('mongodb');
var boot = require('./boot');
var migrations;
var settings = require('./settingsHandler').getGeneralSettings();
var verbose = settings.verbose;
var noDaemon = boot.noDaemon();
var debug = boot.debug();
var initArchive = settings.serveArchive || settings.archiveLevel;

var indexesSet;

var cachedDb;

var maxIndexesSet = 13;

var cachedFlood;
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
var cachedLog;
var cachedLatestPosts;
var cachedRecoveryRequests;
var cachedStats;
var cachedHashBans;
var cachedTorIps;
var cachedFlags;
var cachedProxyBans;
var cachedOverboard;

var loading;

// start of version check
function registerLatestVersion(callback) {

  if (verbose) {
    console.log('Checking if latest version is ' + dbVersion);
  }

  cachedVersions.findOne({
    version : dbVersion,
    active : true
  }, function gotVersion(error, version) {
    if (error) {
      callback(error);
    } else if (version) {
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

function upgrade(version, callback) {

  switch (version) {
  case 1:
    migrations.setThreadsPreAggregatedFileMime(callback);
    break;

  case 2:
    migrations.setBoardIpSalt(callback);
    break;

  case 3:
    migrations.migrateThreadIps(callback);
    break;

  case 4:
    migrations.removeBannerStatus(callback);
    break;

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
      migrations = require('./dbMigrations');

      iterateUpgrades(version.version, callback);
    }

  });

};
// end of version check

function indexSet(callback) {

  indexesSet++;

  if (indexesSet === maxIndexesSet) {
    loading = false;

    if (initArchive && !noDaemon) {
      archive.init(callback);
    } else {
      callback();
    }
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

function initFlood(callback) {

  cachedFlood = cachedDb.collection('floodRecord');

  cachedFlood.ensureIndex({
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

function initFlags(callback) {

  cachedFlags = cachedDb.collection('flags');

  cachedFlags.ensureIndex({
    boardUri : 1,
    name : 1
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

function initTorIps(callback) {

  cachedTorIps = cachedDb.collection('torIps');

  cachedTorIps.ensureIndex({
    ip : 1
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

function initHashBans(callback) {

  cachedHashBans = cachedDb.collection('hashBans');

  cachedHashBans.ensureIndex({
    boardUri : 1,
    md5 : 1
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

exports.stats = function() {
  return cachedStats;
};

exports.latestPosts = function() {
  return cachedLatestPosts;
};

exports.logs = function() {
  return cachedLog;
};

exports.overboardThreads = function() {

  return cachedOverboard;

};

exports.hashBans = function() {
  return cachedHashBans;
};

exports.proxyBans = function() {
  return cachedProxyBans;
};

exports.torIps = function() {
  return cachedTorIps;
};

exports.flags = function() {
  return cachedFlags;
};

exports.flood = function() {
  return cachedFlood;
};
// end of getters

function initCollections(db, callback) {

  initBoards(callback);

  initThreads(callback);

  initPosts(callback);

  initUsers(callback);

  initReports(callback);

  initBans(callback);

  initCaptchas(callback);

  initRecoveryRequests(callback);

  initTripcodes(callback);

  initHashBans(callback);

  initTorIps(callback);

  initFlags(callback);

  initFlood(callback);

}

exports.init = function(callback) {

  if (loading) {
    callback('Already booting db');
  }

  loading = true;

  indexesSet = 0;

  var dbSettings = require('./settingsHandler').getDbSettings();

  var client = mongo.MongoClient;

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

      cachedDb = db;

      cachedProxyBans = db.collection('proxyBans');

      cachedOverboard = db.collection('overboardThreads');

      cachedLatestPosts = db.collection('latestPosts');

      cachedFiles = db.collection('fs.files');

      cachedLog = db.collection('staffLogs');

      cachedStats = db.collection('boardStats');

      initCollections(db, callback);
    }

  });

};
