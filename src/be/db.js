var indexesSet = 0;

var cachedDb;

var maxIndexesSet = 2;

var cachedPosts;
var cachedBoards;

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
    boardUrl : 1
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
    boardUrl : 1
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

exports.posts = function() {
  return cachedPosts;
};

exports.boards = function() {
  return cachedBoards;
};

function checkCollections(db, callback) {

  cachedDb = db;

  initBoards(callback);

  initPosts(callback);

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
