'use strict';

var overboardSize;
var sfwOverboard;
var overboard;
var db = require('../db');
var overboardThreads = db.overboardThreads();
var threads = db.threads();
var boards = db.boards();
var reaggregating;
var omit;

exports.loadSettings = function() {
  var settings = require('../settingsHandler').getGeneralSettings();

  omit = settings.omitUnindexedContent;
  overboard = settings.overboard;
  sfwOverboard = settings.sfwOverboard;
  overboardSize = settings.overBoardThreadCount;
};

// Section 1: Overboard insertion {

// Section 1.1: Overboard pruning {
function getThreadsToRemove(toRemove, ids, message) {

  threads.aggregate([ {
    $match : {
      _id : {
        $in : ids
      }
    }
  }, {
    $project : {
      lastBump : 1
    }
  }, {
    $sort : {
      lastBump : 1
    }
  }, {
    $limit : toRemove
  }, {
    $group : {
      _id : 0,
      ids : {
        $push : '$_id'
      }
    }
  } ]).toArray(function(error, results) {

    if (error) {
      console.log(error);
    } else if (!results.length) {
      process.send(message);
    } else {

      // style exception, too simple
      overboardThreads.deleteMany({
        thread : {
          $in : results[0].ids
        }
      }, function removed(error) {
        if (error) {
          console.log(error);
        } else {
          process.send(message);
        }
      });
      // style exception, too simple

    }
  });
}

function checkAmount(message) {

  var queryBlock = {
    sfw : message.sfw ? true : {
      $ne : true
    }
  };

  overboardThreads.countDocuments(queryBlock, function gotCount(error, count) {

    if (error) {
      console.log(error);
    } else if (count > overboardSize) {

      // style exception, too simple
      overboardThreads.aggregate([ {
        $match : queryBlock
      }, {
        $group : {
          _id : 0,
          ids : {
            $push : '$thread'
          }
        }
      } ]).toArray(
          function gotThreads(error, foundThreads) {

            if (error) {
              console.log(error);
            } else if (!foundThreads.length) {
              // will probably never fall into this condition
              process.send(message);

            } else {
              getThreadsToRemove(count - overboardSize, foundThreads[0].ids,
                  message);
            }

          });
      // style exception, too simple

    } else {
      process.send(message);
    }

  });

}
// } Section 1.1: Overboard pruning

function addThread(message) {

  overboardThreads.insertOne({
    thread : message._id,
    sfw : message.sfw
  }, function(error) {

    if (error) {
      console.log(error);
    } else {
      checkAmount(message);
    }

  });

}
// } Section 1: Overboard insertion

function checkForExistance(message) {

  overboardThreads.findOne({
    thread : message._id
  }, function gotThread(error, thread) {
    if (error) {
      console.log(error);
    } else if (thread) {
      process.send(message);
    } else if (message.bump) {
      addThread(message);
    }

  });

}

function finishFullAggregation(message, results) {

  if (!results.length) {
    reaggregating = false;
    return;
  }

  var operations = [];

  operations.push({
    deleteMany : {
      filter : {}
    }
  });

  var ids = [];

  for (var i = 0; i < results.length; i++) {

    var result = results[i];
    ids.push(result._id);

    operations.push({
      updateOne : {
        filter : {
          thread : result._id
        },
        update : {
          $setOnInsert : {
            thread : result._id,
            sfw : result.sfw
          }
        },
        upsert : true
      }
    });

  }

  overboardThreads.bulkWrite(operations, function reaggregated(error) {
    reaggregating = false;
    if (error) {
      console.log(error);
    } else {
      process.send(message);
    }

  });

}

function reaggregateSfw(message, nsfwIds, boardsToUse) {

  var matchBlock = {
    sfw : true
  };

  if (boardsToUse) {
    matchBlock.boardUri = {
      $in : boardsToUse
    };
  }

  threads.find(matchBlock, {
    projection : {
      lastBump : 1,
      sfw : 1
    }
  }).sort({
    lastBump : -1
  }).limit(overboardSize).toArray(function gotThreads(error, results) {

    if (error) {
      reaggregating = false;
      console.log(error);
    } else {
      finishFullAggregation(message, nsfwIds.concat(results));
    }

  });

}

function fullReaggregate(message, boardsToUse) {

  if (reaggregating) {
    return;
  }

  if ((message.omit || omit) && !boardsToUse) {

    boards.aggregate([ {
      $match : {
        settings : {
          $ne : 'unindex'
        }
      }
    }, {
      $group : {
        _id : 0,
        boards : {
          $push : '$boardUri'
        }
      }
    } ]).toArray(function gotBoards(error, boards) {

      if (error) {
        console.log(error);
      } else {

        fullReaggregate(message, boards.length ? boards[0].boards : []);
      }

    });

    return;
  }

  reaggregating = true;

  var matchBlock = {
    sfw : {
      $ne : true
    }
  };

  if (boardsToUse) {

    matchBlock.boardUri = {
      $in : boardsToUse
    };

  }

  threads.find(matchBlock, {
    projection : {
      lastBump : 1,
    }
  }).sort({
    lastBump : -1
  }).limit(overboardSize).toArray(function gotThreads(error, results) {

    if (error) {
      reaggregating = false;
      console.log(error);
    } else {
      reaggregateSfw(message, results, boardsToUse);
    }

  });

}

exports.reaggregate = function(message) {

  if (message.reaggregate) {
    fullReaggregate(message);
  } else if (!message._id) {
    process.send(message);
  } else if (!message.post) {
    addThread(message);
  } else {
    checkForExistance(message);
  }

};