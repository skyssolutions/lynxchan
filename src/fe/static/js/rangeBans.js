var rangeBans = {};

rangeBans.init = function() {

  var boardIdentifier = document.getElementById('boardIdentifier');

  if (boardIdentifier) {
    api.boardUri = boardIdentifier.value;
  }

  api.convertButton('createFormButton', rangeBans.placeRangeBan,
      'rangeBanField');

  var rangeBanCells = document.getElementsByClassName('rangeBanCell');

  for (var j = 0; j < rangeBanCells.length; j++) {
    rangeBans.processRangeBanCell(rangeBanCells[j]);
  }

  rangeBans.bansDiv = document.getElementById('rangeBansDiv');

};

rangeBans.processRangeBanCell = function(cell) {

  var button = cell.getElementsByClassName('liftFormButton')[0];

  api.convertButton(button, function() {
    rangeBans.liftBan(cell);
  });

};

rangeBans.liftBan = function(cell) {

  api.formApiRequest('liftBan', {
    banId : cell.getElementsByClassName('idIdentifier')[0].value
  }, function requestComplete(status, data) {

    if (status === 'ok') {
      cell.remove();
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

rangeBans.showNewRangeBan = function(typedRange, typedReason, nonBypassable, id) {

  var form = document.createElement('form');
  form.className = 'rangeBanCell';
  form.action = '/liftBan.js';
  form.method = 'post';
  form.enctype = 'multipart/form-data';
  rangeBans.bansDiv.appendChild(form);

  form.appendChild(document.createElement('hr'));

  var rangePara = document.createElement('p');
  rangePara.innerHTML = 'Range: ';
  form.appendChild(rangePara);

  var rangeLabel = document.createElement('span');
  rangeLabel.innerHTML = typedRange;
  rangeLabel.className = 'rangeLabel';
  rangePara.appendChild(rangeLabel);

  var reasonPara = document.createElement('p');
  reasonPara.innerHTML = 'Reason: ';
  form.appendChild(reasonPara);

  var reasonLabel = document.createElement('span');
  reasonLabel.innerHTML = typedReason;
  reasonLabel.className = 'reasonLabel';
  reasonPara.appendChild(reasonLabel);

  if (nonBypassable) {
    var nonBypassablePara = document.createElement('p');
    nonBypassablePara.innerHTML = 'Non-bypassable';
    form.appendChild(nonBypassablePara);
  }

  var idIdentifier = document.createElement('input');
  idIdentifier.className = 'idIdentifier';
  idIdentifier.type = 'hidden';
  form.appendChild(idIdentifier);
  idIdentifier.value = id;

  var liftButton = document.createElement('button');
  liftButton.type = 'submit';
  liftButton.innerHTML = 'Lift ban';
  liftButton.className = 'liftFormButton';
  form.appendChild(liftButton);

  rangeBans.processRangeBanCell(form);

};

rangeBans.placeRangeBan = function() {

  var typedRange = document.getElementById('rangeField').value.trim();
  var typedDuration = document.getElementById('durationField').value.trim();
  var typedReason = document.getElementById('reasonField').value.trim();
  var nonBypassable = document.getElementById('nonBypassableCheckbox').checked;

  var parameters = {
    range : typedRange,
    boardUri : api.boardUri,
    duration : typedDuration,
    reasonBan : typedReason,
    nonBypassable : nonBypassable
  };

  api.formApiRequest('placeRangeBan', parameters, function requestComplete(
      status, data) {

    if (status === 'ok') {

      document.getElementById('rangeField').value = '';
      rangeBans.showNewRangeBan(typedRange, typedReason, nonBypassable, data);

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

rangeBans.init();