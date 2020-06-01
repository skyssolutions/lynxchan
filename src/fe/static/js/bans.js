var bans = {};

bans.init = function() {

  bans.appealed = document.location.toString().indexOf('appealedBans.js') >= 0;

  var banCells = document.getElementsByClassName('banCell');

  for (var j = 0; j < banCells.length; j++) {
    bans.processBanCell(banCells[j]);
  }

};

bans.processBanCell = function(cell) {

  var liftButton = cell.getElementsByClassName('liftFormButton')[0];

  api.convertButton(liftButton, function() {
    bans.liftBan(cell);
  });

  if (cell.getElementsByClassName('denyForm')[0]) {

    var denyButton = cell.getElementsByClassName('denyFormButton')[0];

    api.convertButton(denyButton, function() {
      bans.denyAppeal(cell);
    });

  }

};

bans.denyAppeal = function(cell) {

  api.formApiRequest('denyAppeal', {
    banId : cell.getElementsByClassName('denyIdentifier')[0].value
  }, function requestComplete(status, data) {

    if (status === 'ok') {

      if (bans.appealed) {
        cell.remove();
      } else {
        cell.getElementsByClassName('denyFormButton')[0].remove();
      }

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

bans.liftBan = function(cell) {

  api.formApiRequest('liftBan', {
    banId : cell.getElementsByClassName('liftIdentifier')[0].value
  }, function requestComplete(status, data) {

    if (status === 'ok') {
      cell.remove();
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

bans.init();