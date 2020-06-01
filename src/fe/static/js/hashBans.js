var hashBans = {};

hashBans.init = function() {

  var boardIdentifier = document.getElementById('boardIdentifier');

  if (boardIdentifier) {
    api.boardUri = boardIdentifier.value;
  }

  api.convertButton('createFormButton', hashBans.placeHashBan,
      'addHashBanField');

  var hashBansDiv = document.getElementById('hashBansDiv');

  for (var j = 0; j < hashBansDiv.childNodes.length; j++) {
    hashBans.processHashBanCell(hashBansDiv.childNodes[j]);
  }

  hashBans.div = hashBansDiv;

};

hashBans.processHashBanCell = function(cell) {

  var button = cell.getElementsByClassName('liftFormButton')[0];

  api.convertButton(button, function() {
    hashBans.liftHashBan(cell);
  });

};

hashBans.liftHashBan = function(cell) {

  api.formApiRequest('liftHashBan', {
    hashBanId : cell.getElementsByClassName('idIdentifier')[0].value
  }, function requestComplete(status, data) {

    if (status === 'ok') {
      cell.remove();
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }

  });

};

hashBans.showNewHashBan = function(typedHash, typedReason, id) {

  var form = document.createElement('form');
  form.method = 'post';
  form.enctype = 'multipart/form-data';
  form.action = '/liftHashBan.js';
  form.className = 'hashBanCell';

  form.appendChild(document.createElement('hr'));

  var hashPara = document.createElement('p');
  hashPara.innerHTML = 'SHA256: ';
  form.appendChild(hashPara);

  var hashLabel = document.createElement('span');
  hashLabel.className = 'hashLabel';
  hashLabel.innerHTML = typedHash;
  hashPara.appendChild(hashLabel);

  var reasonPara = document.createElement('p');
  reasonPara.innerHTML = 'Reason: ';
  form.appendChild(reasonPara);

  var reasonLabel = document.createElement('span');
  reasonLabel.className = 'reasonLabel';
  reasonLabel.innerHTML = typedReason;
  reasonPara.appendChild(reasonLabel);

  var userPara = document.createElement('p');
  userPara.innerHTML = 'User: ';
  form.appendChild(userPara);

  var userLabel = document.createElement('span');
  userLabel.className = 'userLabel';
  userLabel.innerHTML = api.getCookies().login;
  userPara.appendChild(userLabel);

  var datePara = document.createElement('p');
  datePara.innerHTML = 'Date: ';
  form.appendChild(datePara);

  var dateLabel = document.createElement('span');
  dateLabel.className = 'dateLabel';
  dateLabel.innerHTML = api.formatDateToDisplay(new Date());
  datePara.appendChild(dateLabel);

  var identifier = document.createElement('input');
  identifier.type = 'hidden';
  identifier.value = id;
  identifier.name = 'hashBanId';
  identifier.className = 'idIdentifier';
  form.appendChild(identifier);

  var submit = document.createElement('button');
  submit.type = 'submit';
  submit.innerHTML = 'Lift hash ban';
  submit.className = 'liftFormButton';
  form.appendChild(submit);

  hashBans.div.appendChild(form);

  hashBans.processHashBanCell(form);

};

hashBans.placeHashBan = function() {

  var typedHash = document.getElementById('hashField').value.trim();
  var typedReason = document.getElementById('reasonField').value.trim();

  api.formApiRequest('placeHashBan', {
    hash : typedHash,
    reason : typedReason,
    boardUri : api.boardUri
  }, function requestComplete(status, data) {

    if (status === 'ok') {
      document.getElementById('hashField').value = '';
      document.getElementById('reasonField').value = '';
      hashBans.showNewHashBan(typedHash, typedReason, data);
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }

  });

};

hashBans.init();