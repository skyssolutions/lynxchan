var asnBans = {};

asnBans.init = function() {

  var boardIdentifier = document.getElementById('boardIdentifier');

  if (boardIdentifier) {
    api.boardUri = boardIdentifier.value;
  }

  api.convertButton('createFormButton', asnBans.placeAsnBan, 'asnBanField');

  var rangeBanCells = document.getElementsByClassName('asnBanCell');

  for (var j = 0; j < rangeBanCells.length; j++) {
    asnBans.processAsnBanCell(rangeBanCells[j]);
  }

  asnBans.bansDiv = document.getElementById('asnBansDiv');

};

asnBans.processAsnBanCell = function(cell) {

  var button = cell.getElementsByClassName('liftFormButton')[0];

  api.convertButton(button, function() {
    asnBans.liftBan(cell);
  });

};

asnBans.liftBan = function(cell) {

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

asnBans.showNewAsnBan = function(typedRange, typedReason, nonBypassable, id) {

  var form = document.createElement('form');
  form.className = 'asnBanCell';
  form.action = '/liftBan.js';
  form.method = 'post';
  form.enctype = 'multipart/form-data';
  asnBans.bansDiv.appendChild(form);

  form.appendChild(document.createElement('hr'));

  var asnPara = document.createElement('p');
  asnPara.innerHTML = 'Asn: ';
  form.appendChild(asnPara);

  var rangeLabel = document.createElement('span');
  rangeLabel.innerHTML = typedRange;
  rangeLabel.className = 'asnLabel';
  asnPara.appendChild(rangeLabel);

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

  asnBans.processAsnBanCell(form);

};

asnBans.placeAsnBan = function() {

  var typedAsn = document.getElementById('asnField').value.trim();
  var typedDuration = document.getElementById('durationField').value.trim();
  var typedReason = document.getElementById('reasonField').value.trim();
  var nonBypassable = document.getElementById('nonBypassableCheckbox').checked;

  var parameters = {
    asn : typedAsn,
    boardUri : api.boardUri,
    duration : typedDuration,
    reasonBan : typedReason,
    nonBypassable : nonBypassable
  };

  api.formApiRequest('placeAsnBan', parameters, function requestComplete(
      status, data) {

    if (status === 'ok') {

      document.getElementById('asnField').value = '';
      asnBans.showNewAsnBan(typedAsn, typedReason, nonBypassable, data);

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

asnBans.init();