'use strict';

var apiOps = require('../engine/apiOps');
var boards = require('../db').boards();

exports.process = function(req, res) {

  boards.find({}, {
    _id : 0,
    boardName : 1,
    boardUri : 1
  }).sort({
    boardUri : 1
  }).toArray(function gotBoards(error, boards) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, boards, 'ok', res);
    }
  });

};