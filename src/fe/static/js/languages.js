var languages = {};

languages.init = function() {

  api.convertButton('addFormButton', languages.addLanguage, 'newLanguageField');

  languages.div = document.getElementById('languagesDiv');

  var cells = document.getElementsByClassName('languageCell');

  for (var i = 0; i < cells.length; i++) {
    languages.setLanguageCell(cells[i]);
  }

};

languages.setLanguageCell = function(cell) {

  var button = cell.getElementsByClassName('deleteFormButton')[0];

  api.convertButton(button, function() {

    api.formApiRequest('deleteLanguage', {
      languageId : cell.getElementsByClassName('languageIdentifier')[0].value
    }, function requestComplete(status, data) {

      if (status === 'ok') {
        cell.remove();
      } else {
        alert(status + ': ' + JSON.stringify(data));
      }
    });

  });

};

languages.showNewLanguage = function(data, id) {

  var form = document.createElement('form');
  form.method = 'post';
  form.enctype = 'multipart/form-data';
  form.action = '/deleteLanguage.js';
  form.className = 'languageCell';
  form.innerHTML = 'Header values: ';

  var headersLabel = document.createElement('span');
  headersLabel.className = 'headerValuesLabel';
  headersLabel.innerHTML = data.headerValues.join(', ');
  form.appendChild(headersLabel);

  form.appendChild(document.createElement('br'));

  form.appendChild(document.createTextNode('Front-end: '));

  var feLabel = document.createElement('span');
  feLabel.innerHTML = data.frontEnd;
  feLabel.className = 'frontEndLabel';
  form.appendChild(feLabel);

  form.appendChild(document.createElement('br'));

  form.appendChild(document.createTextNode('Language pack: '));

  var packLabel = document.createElement('span');
  packLabel.innerHTML = data.languagePack;
  packLabel.className = 'languagePackLabel';
  form.appendChild(packLabel);

  form.appendChild(document.createElement('br'));

  var identifier = document.createElement('input');
  identifier.type = 'hidden';
  identifier.name = 'languageId';
  identifier.value = id;
  identifier.className = 'languageIdentifier';
  form.appendChild(identifier);

  var button = document.createElement('button');
  button.type = 'submit';
  button.innerHTML = 'Delete language';
  button.className = 'deleteFormButton';
  form.appendChild(button);

  form.appendChild(document.createElement('hr'));

  languages.div.appendChild(form);

  languages.setLanguageCell(form);

};

languages.addLanguage = function() {

  var typedHeaderValues = document.getElementById('fieldHeaderValues').value
      .trim();

  var parsedHeaderValues = typedHeaderValues.split(',').map(function(value) {
    return value.trim()
  });

  var typedFrontEnd = document.getElementById('fieldFrontEnd').value.trim();

  var typedLanguagePack = document.getElementById('fieldLanguagePack').value
      .trim();

  var payload = {
    frontEnd : typedFrontEnd,
    languagePack : typedLanguagePack,
    headerValues : parsedHeaderValues
  };

  api.formApiRequest('addLanguage', {
    frontEnd : typedFrontEnd,
    languagePack : typedLanguagePack,
    headerValues : parsedHeaderValues
  }, function requestComplete(status, data) {

    if (status === 'ok') {

      document.getElementById('fieldFrontEnd').value = '';
      document.getElementById('fieldLanguagePack').value = '';
      document.getElementById('fieldHeaderValues').value = '';

      languages.showNewLanguage(payload, data);
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

languages.init();