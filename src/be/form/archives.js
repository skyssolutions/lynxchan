'use strict';

var archiveOps = require('../engine/archiveOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.miscPages;
var formOps = require('../engine/formOps');

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  var json = parameters.json;

  archiveOps.getArchives(parameters, function gotArchiveData(error, threads,
      pageCount) {
    if (error) {
      formOps.outputError(error, 500, res, req.language, json);
    } else {

      if (json) {

        formOps.outputResponse('ok', {
          threads : threads,
          pages : pageCount
        }, res, null, null, null, true);

      } else {

        return formOps.dynamicPage(res, dom.archives(threads, parameters,
            pageCount, req.language));

      }

    }
  });

};