'use strict';

// takes care of the database.
// initializes and provides pointers to collections or the connection pool

var indexesSet = 0;

var cachedDb;

var maxIndexesSet = 3;

var cachedPosts;
var cachedThreads;
var cachedBoards;
var cachedFiles;

function indexSet(callback) {
  indexesSet++;

  if (indexesSet === maxIndexesSet) {
    callback(null);
  }
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
      callback(error);
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
      callback(error);
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
      callback(error);
    } else {
      indexSet(callback);
    }
  });

}

exports.conn = function() {
  return cachedDb;
};

exports.files = function() {
  return cachedFiles;
};

exports.posts = function() {
  return cachedPosts;
};

exports.boards = function() {
  return cachedBoards;
};

exports.threads = function() {
  return cachedThreads;
};

function checkCollections(db, callback) {

  cachedDb = db;

  initBoards(callback);

  initThreads(callback);

  initPosts(callback);

  cachedFiles = db.collection('fs.files');

}

exports.init = function(callback) {

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
