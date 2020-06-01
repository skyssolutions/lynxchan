var ruleManagement = {};

ruleManagement.init = function() {

  api.convertButton('addFormButton', ruleManagement.addRule,
      'ruleManagementField');

  api.boardUri = document.getElementById('boardIdentifier').value;

  var rules = document.getElementsByClassName('ruleManagementCell');

  for (var i = 0; i < rules.length; i++) {
    ruleManagement.processRuleCell(rules[i]);
  }

  ruleManagement.ruleDiv = document.getElementById('divRules');

};

ruleManagement.processRuleCell = function(cell) {

  var button = cell.getElementsByClassName('deleteFormButton')[0];

  api.convertButton(button, function() {

    var index = cell.getElementsByClassName('indexIdentifier')[0].value;

    api.formApiRequest('deleteRule', {
      boardUri : api.boardUri,
      ruleIndex : index,
    }, function requestComplete(status, data) {
      if (status === 'ok') {
        cell.remove();

        var identifiers = document.getElementsByClassName('indexIdentifier');

        for (var i = 0; i < identifiers.length; i++) {
          identifiers[i].value = i.toString();
        }

      } else {
        alert(status + ': ' + JSON.stringify(data));
      }
    });

  });

};

ruleManagement.showNewRule = function(typedRule) {

  var form = document.createElement('form');
  form.className = 'ruleManagementCell';
  form.action = '/deleteRule.js';
  form.method = 'post';
  form.enctype = 'multipart/form-data';
  ruleManagement.ruleDiv.appendChild(form);

  var rulePara = document.createElement('p');
  form.appendChild(rulePara);

  var ruleLabel = document.createElement('span');
  ruleLabel.className = 'textLabel';
  ruleLabel.innerHTML = typedRule;
  rulePara.appendChild(ruleLabel);

  var indexIdentifier = document.createElement('input');
  indexIdentifier.className = 'indexIdentifier';
  indexIdentifier.type = 'hidden';
  indexIdentifier.name = 'ruleIndex';
  indexIdentifier.value = document.getElementsByClassName('indexIdentifier').length;
  form.appendChild(indexIdentifier);

  var boardIdentifier = document.createElement('input');
  boardIdentifier.type = 'hidden';
  boardIdentifier.name = 'boardUri';
  boardIdentifier.className = 'boardIdentifier';
  boardIdentifier.value = api.boardUri;
  form.appendChild(boardIdentifier);

  var deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.innerHTML = 'Delete rule';
  deleteButton.className = 'deleteFormButton';
  form.appendChild(deleteButton);

  form.appendChild(document.createElement('hr'));

  ruleManagement.processRuleCell(form);

};

ruleManagement.addRule = function() {

  var typedRule = document.getElementById('fieldRule').value.trim();

  if (!typedRule.length) {
    alert('You can\'t inform a blank rule.');

  } else if (typedRule.length > 512) {
    alert('Rule too long, keep in under 512 characters.');
  } else {

    api.formApiRequest('createRule', {
      boardUri : api.boardUri,
      rule : typedRule,
    }, function requestComplete(status, data) {
      if (status === 'ok') {

        document.getElementById('fieldRule').value = '';
        ruleManagement.showNewRule(typedRule);

      } else {
        alert(status + ': ' + JSON.stringify(data));
      }
    });

  }

};

ruleManagement.init();