var globalManagement = {};

globalManagement.roles = [ 'Admin', 'Global volunteer', 'Global janitor',
    'User' ];

globalManagement.init = function() {

  if (document.getElementById('addStaffForm')) {

    api
        .convertButton('addFormButton', globalManagement.addUser,
            'addUserField');
    api.convertButton('massBanFormButton', globalManagement.massBan,
        'massBanField');

  }

  globalManagement.divStaff = document.getElementById('divStaff');

  var staffCells = document.getElementsByClassName('staffCell');

  for (var i = 0; i < staffCells.length; i++) {
    globalManagement.processCell(staffCells[i]);
  }

};

globalManagement.processCell = function(cell) {

  var button = cell.getElementsByClassName('saveFormButton')[0];

  var comboBox = cell.getElementsByClassName('roleCombo')[0];
  var user = cell.getElementsByClassName('userIdentifier')[0].value;

  api.convertButton(button, function() {
    globalManagement.setUser(user,
        comboBox.options[comboBox.selectedIndex].value, cell);
  });

};

globalManagement.addUser = function() {

  var combo = document.getElementById('newStaffCombo');

  globalManagement.setUser(document.getElementById('fieldLogin').value.trim(),
      combo.options[combo.selectedIndex].value);

};

globalManagement.showNewUser = function(login, role) {

  var form = document.createElement('form');
  form.method = 'post';
  form.enctype = 'multipart/form-data';
  form.action = '/setGlobalRole.js';
  form.className = 'staffCell';

  var nameLabel = document.createElement('span');
  nameLabel.innerHTML = login;
  nameLabel.className = 'userLabel';
  form.appendChild(nameLabel);

  form.appendChild(document.createTextNode(' '));

  var combo = document.createElement('select');
  combo.name = 'role';
  combo.className = 'roleCombo';
  form.appendChild(combo);

  for (var i = document.getElementById('globalSettingsLink') ? 0 : 1; i < globalManagement.roles.length; i++) {

    var option = document.createElement('option');
    option.innerHTML = globalManagement.roles[i];
    option.value = (i + 1).toString();

    if (i === role - 1) {
      option.setAttribute('selected', 'selected');
    }

    combo.appendChild(option);

  }

  var identifier = document.createElement('input');
  identifier.className = 'userIdentifier';
  identifier.type = 'hidden';
  identifier.value = login;
  form.appendChild(identifier);

  var wrapper = document.createElement('label');
  form.appendChild(wrapper);

  var button = document.createElement('button');
  button.type = 'submit';
  button.className = 'saveFormButton';
  button.innerHTML = 'Save role';
  wrapper.appendChild(button);

  globalManagement.divStaff.appendChild(form);

  globalManagement.processCell(form);

};

globalManagement.setUser = function(login, role, cell) {

  role = +role;

  api.formApiRequest('setGlobalRole', {
    login : login,
    role : role
  }, function requestComplete(status, data) {

    if (status === 'ok') {

      if (role <= 3 && cell) {
        alert('Role changed.');
      } else if (cell) {
        cell.remove();
      } else {
        globalManagement.showNewUser(login, role);
      }

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

globalManagement.massBan = function() {

  var ipField = document.getElementById('fieldIps');
  var reasonField = document.getElementById('fieldReason');
  var durationField = document.getElementById('fieldDuration');

  var typedIps = ipField.value.trim();

  var ipArray = typedIps.split(',');

  var finalIpArray = [];

  for (var i = 0; i < ipArray.length; i++) {

    var ip = ipArray[i].trim();

    if (ip.length) {
      finalIpArray.push(ip);
    }

  }

  if (!finalIpArray.length) {
    alert('No ips informed');
    return;
  }

  var typedReason = reasonField.value;
  var typedDuration = durationField.value;

  api.formApiRequest('massBan', {
    ips : finalIpArray,
    reason : typedReason,
    duration : typedDuration
  }, function requestCompleted(status, data) {

    if (status === 'ok') {

      ipField.value = '';
      reasonField.value = '';
      durationField.value = '';

      alert('Mass ban applied.');

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

globalManagement.init();