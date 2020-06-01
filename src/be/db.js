'use strict';

var dbVersion = 15;

// takes care of the database.
// initializes and provides pointers to collections or the connection pool

var mongo = require('mongodb');
var cluster = require('cluster');
var kernel = require('./kernel');
var migrations;
var newerMigrations;
var settings = require('./settingsHandler').getGeneralSettings();
var verbose = settings.verbose;
var miscVerbose = settings.verboseMisc;
var noDaemon = kernel.noDaemon();

var indexesSet;

var cachedDb;
var cachedClient;

var maxIndexesSet = 18;

var cachedFilters;
var cachedRedirects;
var cachedLanguages;
var cachedConfirmationRequests;
var cachedUploadReferences;
var cachedLatestImages;
var cachedAggregatedLogs;
var cachedBypasses;
var cachedVersions;
var cachedPosts;
var cachedReports;
var cachedThreads;
var cachedBoards;
var cachedBans;
var cachedUsers;
var cachedCaptchas;
var cachedFiles;
var cachedChunks;
var cachedTripcodes;
var cachedLog;
var cachedLatestPosts;
var cachedRecoveryRequests;
var cachedStats;
var cachedHashBans;
var cachedFlags;
var cachedOverboard;
var cachedIpAggregation;
var cachedOffenseRecords;

var loading;

// start of version check
function registerLatestVersion(callback) {

  if (miscVerbose || verbose) {
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

      if (miscVerbose || verbose) {
        console.log('Registering current version as ' + dbVersion);
      }

      cachedVersions.insertOne({
        version : dbVersion,
        deploy : new Date(),
        active : true,
        upgraded : false
      }, callback);

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

  case 5:
    migrations.aggregateLogs(callback);
    break;

  case 6:
    migrations.createR9KHashes(callback);
    break;

  case 7:
    migrations.aggregateVolunteeredBoards(callback);
    break;

  case 8:
    console.log('Generating posting graphs for the first time.');
    console.log('This might take a while.');
    migrations.generateGraphs(callback);
    break;

  case 9:
    console.log('Deduplicating files, this might take a while.');
    migrations.deduplicateFiles(callback);
    break;

  case 10:
    newerMigrations.removeGhostReports(callback);
    break;

  case 11:
    newerMigrations.cleanCache(callback);
    break;

  case 12:
    newerMigrations.aggregateLogs(callback);
    break;

  case 13:
    newerMigrations.applySha256(callback);
    break;

  case 14:
    newerMigrations.runMissingSha256(callback);
    break;

  default:
    callback('Cannot upgrade from version ' + version);
  }

}

function iterateUpgrades(currentVersion, callback) {

  migrations = migrations || require('./dbMigrations');
  newerMigrations = newerMigrations || require('./newerMigrations');

  if (miscVerbose || verbose) {
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
          active : false,
          upgraded : true
        },
        $setOnInsert : {
          version : currentVersion
        }
      }, {
        upsert : true
      }, function confirmedUpgrade(error) {
        if (error) {
          callback(error);
        } else {
          iterateUpgrades(++currentVersion, callback);
        }
      });
      // style exception, too simple

    }
  });

}

function updateVersions(versions, callback) {

  var version = versions[0];

  if (dbVersion - version.version > 1) {

    var toInsert = [];

    for (var i = version.version + 1; i < dbVersion; i++) {
      toInsert.push({
        updateOne : {
          filter : {
            version : i
          },
          update : {
            $setOnInsert : {
              version : i
            },
            $set : {
              upgraded : false,
              active : false
            }
          },
          upsert : true
        }
      });
    }

    // style exception, too simple
    cachedVersions.bulkWrite(toInsert, function insertedVersions(error) {

      if (error) {
        callback(error);
      } else {
        iterateUpgrades(version.version, callback);
      }
    });
    // style exception, too simple

  } else {
    iterateUpgrades(version.version, callback);
  }

}

function getLowestVersion(callback) {

  cachedVersions.find({
    version : {
      $lt : dbVersion
    },
    upgraded : false
  }).sort({
    version : 1
  }).limit(1).toArray(function gotLatestVersion(error, versions) {

    if (error) {
      callback(error);
    } else if (!versions.length) {
      registerLatestVersion(callback);
    } else {
      updateVersions(versions, callback);
    }

  });

}

exports.checkVersion = function(callback) {

  cachedVersions = cachedDb.collection('witnessedReleases');

  cachedVersions.findOne({
    $or : [ {
      version : {
        $gt : dbVersion
      }
    }, {
      version : dbVersion,
      upgraded : true
    } ]
  }, function(error, result) {

    if (error) {
      callback(error);
    } else if (result) {
      error = 'Your database have been';
      error += ' upgraded past the current version';
      callback(error);
    } else {
      getLowestVersion(callback);
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
function initOffenseRecords(callback) {

  cachedOffenseRecords.createIndexes([ {
    key : {
      ip : 1
    }
  } ], function setIndex(error, index) {
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

function initUploadReferences(callback) {

  cachedUploadReferences.createIndexes([ {
    key : {
      references : 1
    }
  }, {
    key : {
      sha256 : 1
    }
  } ], function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });

  cachedUploadReferences.dropIndex('identifier_1', function dropped(error) {

    if (error && error.code !== 27) {
      console.log(error);
    }

  });

}

function initRedirects(callback) {

  cachedRedirects.createIndexes([ {
    key : {
      expiration : 1
    },
    expireAfterSeconds : 0
  }, {
    key : {
      source : 1
    }
  } ], function setIndex(error, index) {
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

function initCaptchas(callback) {

  cachedCaptchas.createIndexes([ {
    key : {
      expiration : 1
    },
    expireAfterSeconds : 0
  } ], function setIndex(error, index) {
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

  cachedFlags.createIndexes([ {
    key : {
      boardUri : 1,
      name : 1
    },
    unique : true
  } ], function setIndex(error, index) {
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

  cachedTripcodes.createIndexes([ {
    key : {
      tripcode : 1
    },
    unique : 1
  } ], function setIndex(error, index) {
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

  cachedHashBans.removeMany({
    sha256 : null
  }, function(error) {

    cachedHashBans.createIndexes([ {
      key : {
        sha256 : 1,
        boardUri : 1
      },
      unique : 1
    } ], function setIndex(error, index) {
      if (error) {

        if (loading) {
          loading = false;

          callback(error);
        }
      } else {
        indexSet(callback);
      }
    });

    cachedHashBans.dropIndex('md5_1_boardUri_1', function dropped(error) {

      if (error && error.code !== 27) {
        console.log(error);
      }

    });

  });
}

function initBans(callback) {

  cachedBans.createIndexes([ {
    key : {
      expiration : 1
    },
    expireAfterSeconds : 0
  } ], function setIndex(error, index) {
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

  cachedReports.createIndexes([ {
    key : {
      boardUri : 1,
      global : 1,
      threadId : 1,
      postId : 1
    },
    unique : true
  } ], function setIndex(error, index) {
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

  cachedPosts.createIndexes([ {
    key : {
      boardUri : 1,
      postId : 1
    },
    unique : true
  }, {
    key : {
      boardUri : 1,
      threadId : 1
    }
  }, {
    key : {
      creation : 1
    }
  }, {
    key : {
      'files.path' : 1
    }
  }, {
    key : {
      ip : 1
    }
  } ], function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });

  cachedPosts.dropIndex('files.md5_1', function dropped(error) {

    if (error && error.code !== 27) {
      console.log(error);
    }

  });

}

function initRecoveryRequests(callback) {

  cachedRecoveryRequests.createIndexes([ {
    key : {
      expiration : 1
    },
    expireAfterSeconds : 0
  } ], function setIndex(error, index) {
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

function initConfirmationRequests(callback) {

  cachedConfirmationRequests.createIndexes([ {
    key : {
      expiration : 1
    },
    expireAfterSeconds : 0
  } ], function setIndex(error, index) {
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

  cachedUsers.createIndexes([ {
    key : {
      login : 1
    },
    unique : true
  } ], function setIndex(error, index) {
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

  cachedThreads.createIndexes([ {
    key : {
      boardUri : 1,
      threadId : 1
    },
    unique : true
  }, {
    key : {
      pinned : 1,
      lastBump : 1
    }
  }, {
    key : {
      'files.path' : 1
    }
  }, {
    key : {
      archived : 1
    }
  }, {
    key : {
      ip : 1
    }
  } ], function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });

  cachedThreads.dropIndex('files.md5_1', function dropped(error) {

    if (error && error.code !== 27) {
      console.log(error);
    }

  });

}

function initBoards(callback) {

  cachedBoards.createIndexes([ {
    key : {
      boardUri : 1
    },
    unique : true
  } ], function setIndex(error, index) {
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

function initBypasses(callback) {

  cachedBypasses.createIndexes([ {
    key : {
      expiration : 1
    },
    expireAfterSeconds : 0
  } ], function setIndex(error, index) {
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

function initStats(callback) {

  cachedStats.createIndexes([ {
    key : {
      startingTime : 1
    }
  } ], function setIndex(error, index) {
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

function initFiles(callback) {

  cachedFiles.createIndexes([ {
    key : {
      'metadata.referenceFile' : 1
    }
  }, {
    key : {
      'metadata.type' : 1
    }
  }, {
    key : {
      'metadata.sha256' : 1
    }
  }, {
    key : {
      'filename' : 1
    }
  } ], function setIndex(error, index) {
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
exports.redirects = function() {
  return cachedRedirects;
};
exports.languages = function() {
  return cachedLanguages;
};

exports.filters = function() {
  return cachedFilters;
};

exports.chunks = function() {
  return cachedChunks;
};

exports.versions = function() {
  return cachedVersions;
};

exports.client = function() {
  return cachedClient;
};

exports.conn = function() {
  return cachedDb;
};

exports.uniqueIps = function() {
  return cachedIpAggregation;
};

exports.bypasses = function() {
  return cachedBypasses;
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

exports.offenseRecords = function() {
  return cachedOffenseRecords;
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

exports.latestImages = function() {
  return cachedLatestImages;
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

exports.flags = function() {
  return cachedFlags;
};

exports.aggregatedLogs = function() {
  return cachedAggregatedLogs;
};

exports.uploadReferences = function() {
  return cachedUploadReferences;
};

exports.confirmations = function() {
  return cachedConfirmationRequests;
};
// end of getters

function initGlobalIndexes(callback) {

  initBypasses(callback);

  initUsers(callback);

  initReports(callback);

  initBans(callback);

  initCaptchas(callback);

  initRecoveryRequests(callback);

  initConfirmationRequests(callback);

  initTripcodes(callback);

  initHashBans(callback);

  initUploadReferences(callback);

  initFiles(callback);

  initRedirects(callback);

  initOffenseRecords(callback);

}

function initBoardIndexes(callback) {

  initBoards(callback);

  initThreads(callback);

  initPosts(callback);

  initFlags(callback);

  initStats(callback);

  initGlobalIndexes(callback);
}

function preIndexSet(callback) {

  if (cluster.isMaster && !settings.master) {
    initBoardIndexes(callback);
  } else {
    callback();
  }

}

function initBoardIndexedCollections(callback) {

  cachedPosts = cachedDb.collection('posts');
  cachedBoards = cachedDb.collection('boards');
  cachedHashBans = cachedDb.collection('hashBans');
  cachedReports = cachedDb.collection('reports');
  cachedFlags = cachedDb.collection('flags');
  cachedBans = cachedDb.collection('bans');
  cachedThreads = cachedDb.collection('threads');
  cachedStats = cachedDb.collection('boardStats');

  preIndexSet(callback);

}

function initGlobalIndexedCollections(callback) {

  cachedBypasses = cachedDb.collection('blockBypasses');
  cachedTripcodes = cachedDb.collection('secureTripcodes');
  cachedCaptchas = cachedDb.collection('captchas');
  cachedRecoveryRequests = cachedDb.collection('recoveryRequests');
  cachedUsers = cachedDb.collection('users');
  cachedUploadReferences = cachedDb.collection('uploadReferences');
  cachedFiles = cachedDb.collection('fs.files');
  cachedOffenseRecords = cachedDb.collection('offenseRecords');
  cachedRedirects = cachedDb.collection('redirects');
  cachedConfirmationRequests = cachedDb.collection('confirmationRequests');

  initBoardIndexedCollections(callback);

}

function initCollections(callback) {

  cachedLatestImages = cachedDb.collection('latestImages');
  cachedIpAggregation = cachedDb.collection('uniqueIpAggregation');
  cachedAggregatedLogs = cachedDb.collection('aggregatedLogs');
  cachedOverboard = cachedDb.collection('overboardThreads');
  cachedLatestPosts = cachedDb.collection('latestPosts');
  cachedFilters = cachedDb.collection('filters');
  cachedChunks = cachedDb.collection('fs.chunks');
  cachedLanguages = cachedDb.collection('languages');
  cachedLog = cachedDb.collection('staffLogs');

  initGlobalIndexedCollections(callback);

}

function connect(connectString, dbToUse, callback, attempts) {

  attempts = attempts || 0;

  mongo.MongoClient.connect(connectString, {
    useNewUrlParser : true,
    useUnifiedTopology : true
  }, function connectedDb(error, client) {

    if (error) {

      if (attempts > 9) {
        callback(error);
      } else {

        console.log(error);
        console.log('Retrying in 10 seconds');

        setTimeout(function() {
          connect(connectString, dbToUse, callback, ++attempts);
        }, 10000);
      }

    } else {

      cachedClient = client;
      cachedDb = client.db(dbToUse);

      initCollections(callback);
    }

  });

}

exports.init = function(callback) {

  if (loading) {
    callback('Already booting db');
  }

  loading = true;

  indexesSet = 0;

  var dbSettings = require('./settingsHandler').getDbSettings();

  var connectString = 'mongodb://';

  if (dbSettings.user) {
    connectString += dbSettings.user + ':' + dbSettings.password + '@';
  }

  connectString += dbSettings.address + ':';
  connectString += dbSettings.port + '/' + dbSettings.db;

  if (dbSettings.ssl) {
    connectString += '?ssl=true';
  }

  connect(connectString, dbSettings.db, callback);

};
