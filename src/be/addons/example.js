var msgLoading = 'Loading add-on, at this point its safe';
msgLoading += ' to reference engine components.';

console.log(msgLoading);

var templateHandler = require('../engine/templateHandler');
var lang = require('../engine/langOps').languagePack();
var domManipulator = require('../engine/domManipulator');
var boot = require('../boot');
var gridFs = require('../engine/gridFsHandler');
var settings = boot.getGeneralSettings();
var siteTitle = settings.siteTitle || lang.titDefaultChanTitle;

var common = domManipulator.common;
var static = domManipulator.staticPages;

// A warning will be displayed on verbose mode and a crash will happen in debug
// mode if this value doesn't match the current engine version
exports.engineVersion = '1.2.0';

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;

function setTopBoards(document, boards, boardsDiv) {

  for (var i = 0; i < boards.length; i++) {

    var board = boards[i];

    var link = document.createElement('a');

    link.href = '/' + board.boardUri + '/';
    link.innerHTML = '/' + board.boardUri + '/ - ' + board.boardName;

    if (i) {
      boardsDiv.appendChild(document.createElement('br'));
    }

    boardsDiv.appendChild(link);

  }

}

exports.init = function() {

  var msgInit = 'Initializing addon. At this point its safe';
  msgInit += ' to reference different addons.';

  console.log(msgInit);

  static.frontPage = function(boards, callback) {

    try {

      var document = jsdom(templateHandler.index);

      var footer = document.createElement('footer');
      footer.innerHTML = 'Example addon is working';

      document.getElementsByTagName('body')[0].appendChild(footer);

      document.title = siteTitle;

      var boardsDiv = document.getElementById('divBoards');

      if (!boards) {
        common.removeElement(boardsDiv);
      } else {
        setTopBoards(document, boards, boardsDiv);
      }

      gridFs.writeData(serializer(document), '/', 'text/html', {}, callback);
    } catch (error) {
      callback(error);
    }
  };

};