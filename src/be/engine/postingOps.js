'use strict';

// any operation regarding posting
var db = require('../db');
var posts = db.posts;
var boards = db.boards();

exports.newThread = function(req, parameters, callback) {
  callback('construction');
};