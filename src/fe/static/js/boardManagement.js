var boardManagement = {};

boardManagement.init = function() {

  var volunteerCellTemplate = '<span class="userLabel"></span> ';
  volunteerCellTemplate += '<input ';
  volunteerCellTemplate += 'type="hidden" ';
  volunteerCellTemplate += 'class="userIdentifier" ';
  volunteerCellTemplate += 'name="login">';
  volunteerCellTemplate += '<input ';
  volunteerCellTemplate += 'type="hidden" ';
  volunteerCellTemplate += 'class="boardIdentifier" ';
  volunteerCellTemplate += 'name="boardUri">';
  volunteerCellTemplate += '<input ';
  volunteerCellTemplate += 'type="hidden" ';
  volunteerCellTemplate += 'name="add" ';
  volunteerCellTemplate += 'value=false>';
  volunteerCellTemplate += '<button ';
  volunteerCellTemplate += 'type="submit" ';
  volunteerCellTemplate += 'class="removeFormButton" ';
  volunteerCellTemplate += '>Remove Volunteer</button';

  var messageLenghtLabel = document.getElementById('messageLengthLabel');

  if (messageLenghtLabel) {
    boardManagement.messageLimit = +messageLenghtLabel.innerHTML;
  }

  boardManagement.volunteerCellTemplate = volunteerCellTemplate;

  var resetLockButton = document.getElementById('resetLockButton');

  if (resetLockButton) {
    resetLockButton.type = 'button';
    resetLockButton.onclick = boardManagement.resetLock;
  }

  if (document.getElementById('ownerControlDiv')) {

    api.convertButton('spoilerFormButton', boardManagement.setSpoiler);
    api.convertButton('cssFormButton', boardManagement.setCss);
    api.convertButton('deleteBoardFormButton', boardManagement.deleteBoard,
        'deleteBoardField');
    api.convertButton('addVolunteerFormButton', boardManagement.addVolunteer,
        'addVolunteerField');
    api.convertButton('transferBoardFormButton', boardManagement.transferBoard,
        'transferBoardField');

    if (document.getElementById('customJsForm')) {
      api.convertButton('jsFormButton', boardManagement.setJs);
    }

    var volunteerDiv = document.getElementById('volunteersDiv');

    for (var i = 0; i < volunteerDiv.childNodes.length; i++) {
      boardManagement.processVolunteerCell(volunteerDiv.childNodes[i]);
    }
  }

  var settingsIdentifier = document.getElementById('boardSettingsIdentifier');

  if (!settingsIdentifier) {
    return;
  }

  api.boardUri = settingsIdentifier.value;

  api.convertButton('saveSettingsFormButton', boardManagement.saveSettings,
      'boardSettingsField');

};

boardManagement.resetLock = function() {

  api.formApiRequest('resetBoardLock', {
    boardUri : api.boardUri,
  }, function requestComplete(status, data) {

    if (status === 'ok') {
      document.getElementById('resetBoardLockForm').remove();
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

boardManagement.setJs = function() {

  var file = document.getElementById('JsFiles').files[0];

  api.formApiRequest('setCustomJs', {
    files : [ {
      content : file
    } ],
    boardUri : api.boardUri,
  }, function requestComplete(status, data) {

    document.getElementById('JsFiles').type = 'text';
    document.getElementById('JsFiles').type = 'file';

    if (status === 'ok') {

      if (file) {
        alert('New javascript set.');
      } else {
        alert('Javascript deleted.');
      }

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

boardManagement.setIndicatorForRequest = function(obtainedSpoiler) {

  var spoilerIndicator = document.getElementById('customSpoilerIndicator');

  var haveSpoiler = spoilerIndicator ? true : false;

  if (haveSpoiler !== obtainedSpoiler) {

    if (obtainedSpoiler) {

      var marker = document.getElementById('indicatorMarker');

      var indicator = document.createElement('div');
      indicator.id = 'customSpoilerIndicator';
      marker.parentNode.insertBefore(indicator, marker);

      var indicatorText = document.createElement('p');
      indicatorText.innerHTML = 'There is a custom spoiler saved for this board';
      indicator.appendChild(indicatorText);

    } else {
      spoilerIndicator.remove();
    }

  } else if (obtainedSpoiler) {
    alert('New spoiler uploaded.');
  }

};

boardManagement.setSpoiler = function() {

  var file = document.getElementById('filesSpoiler').files[0];

  api.formApiRequest('setCustomSpoiler', {
    files : [ {
      content : file
    } ],
    boardUri : api.boardUri,
  }, function requestComplete(status, data) {

    if (status === 'ok') {
      boardManagement.setIndicatorForRequest(!!file);
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }

    document.getElementById('filesSpoiler').type = 'text';
    document.getElementById('filesSpoiler').type = 'file';

  });

};

boardManagement.setCss = function() {

  var file = document.getElementById('files').files[0];

  api.formApiRequest('setCustomCss', {
    files : [ {
      content : file
    } ],
    boardUri : api.boardUri,
  }, function requestComplete(status, data) {

    document.getElementById('files').type = 'text';
    document.getElementById('files').type = 'file';

    if (status === 'ok') {

      if (file) {
        alert('New CSS set.');
      } else {
        alert('CSS deleted.');
      }

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

boardManagement.saveSettings = function() {

  var typedAutoFullCaptcha = document
      .getElementById('autoFullCaptchaThresholdField').value.trim();
  var typedName = document.getElementById('boardNameField').value.trim();
  var typedDescription = document.getElementById('boardDescriptionField').value
      .trim();
  var typedMessage = document.getElementById('boardMessageField').value.trim();
  var typedAnonymousName = document.getElementById('anonymousNameField').value
      .trim();
  var typedHourlyLimit = document.getElementById('hourlyThreadLimitField').value
      .trim();
  var typedAutoCaptcha = document.getElementById('autoCaptchaThresholdField').value
      .trim();
  var typedMaxBumpAge = document.getElementById('maxBumpAgeField').value.trim();
  var typedAutoSage = document.getElementById('autoSageLimitField').value
      .trim();
  var typedFileLimit = document.getElementById('maxFilesField').value.trim();
  var typedFileSize = document.getElementById('maxFileSizeField').value.trim();
  var typedTypedMimes = document.getElementById('validMimesField').value
      .split(',');
  var typedThreadLimit = document.getElementById('maxThreadsField').value
      .trim();

  if (typedHourlyLimit.length && isNaN(typedHourlyLimit)) {
    alert('Invalid hourly limit.');
    return;
  } else if (typedMaxBumpAge.length && isNaN(typedMaxBumpAge)) {
    alert('Invalid maximum age for bumping.');
    return;
  } else if (typedAutoCaptcha.length && isNaN(typedAutoCaptcha)) {
    alert('Invalid auto captcha treshold.');
    return;
  } else if (typedAutoFullCaptcha.length && isNaN(typedAutoFullCaptcha)) {
    alert('Invalid auto full captcha treshold.');
    return;
  } else if (!typedName) {
    alert('Name is mandatory.');
    return;
  } else if (typedMessage.length > boardManagement.messageLimit) {
    alert('Message too long, keep it under ' + boardManagement.messageLimit
        + ' characters.');
    return;
  }

  var typedTags = document.getElementById('tagsField').value.split(',');

  var combo = document.getElementById('captchaModeComboBox');

  var locationCombo = document.getElementById('locationComboBox');

  var langCombo = document.getElementById('languageCombobox');

  var parameters = {
    boardName : typedName,
    preferredLanguage : langCombo[langCombo.selectedIndex].value,
    captchaMode : combo.options[combo.selectedIndex].value,
    boardMessage : typedMessage,
    autoFullCaptchaLimit : typedAutoFullCaptcha,
    autoCaptchaLimit : typedAutoCaptcha,
    locationFlagMode : locationCombo.options[locationCombo.selectedIndex].value,
    hourlyThreadLimit : typedHourlyLimit,
    tags : typedTags,
    anonymousName : typedAnonymousName,
    boardDescription : typedDescription,
    boardUri : api.boardUri,
    autoSageLimit : typedAutoSage,
    maxThreadCount : typedThreadLimit,
    maxFileSizeMB : typedFileSize,
    acceptedMimes : typedTypedMimes,
    maxFiles : typedFileLimit,
    maxBumpAge : typedMaxBumpAge
  };

  parameters.blockDeletion = document.getElementById('blockDeletionCheckbox').checked;
  parameters.disableIds = document.getElementById('disableIdsCheckbox').checked;
  parameters.requireThreadFile = document.getElementById('requireFileCheckbox').checked;
  parameters.allowCode = document.getElementById('allowCodeCheckbox').checked;
  parameters.early404 = document.getElementById('early404Checkbox').checked;
  parameters.uniquePosts = document.getElementById('uniquePostsCheckbox').checked;
  parameters.uniqueFiles = document.getElementById('uniqueFilesCheckbox').checked;
  parameters.unindex = document.getElementById('unindexCheckbox').checked;
  parameters.forceAnonymity = document.getElementById('forceAnonymityCheckbox').checked;
  parameters.textBoard = document.getElementById('textBoardCheckbox').checked;

  api.formApiRequest('setBoardSettings', parameters, function requestComplete(
      status, data) {

    if (status === 'ok') {
      alert('Settings saved.');
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }

  });

};

boardManagement.processVolunteerCell = function(cell) {

  var button = cell.getElementsByClassName('removeFormButton')[0];

  api.convertButton(button, function() {
    boardManagement.setVolunteer(
        cell.getElementsByClassName('userIdentifier')[0].value, false);
  });

};

boardManagement.addVolunteer = function() {

  boardManagement.setVolunteer(document
      .getElementById('addVolunteerFieldLogin').value.trim(), true, function(
      error) {

    if (error) {
      alert(error);
    } else {
      document.getElementById('addVolunteerFieldLogin').value = '';
    }

  });

};

boardManagement.setVolunteersDiv = function(volunteers) {

  var volunteersDiv = document.getElementById('volunteersDiv');

  while (volunteersDiv.firstChild) {
    volunteersDiv.removeChild(volunteersDiv.firstChild);
  }

  for (var i = 0; i < volunteers.length; i++) {

    var cell = document.createElement('form');
    cell.innerHTML = boardManagement.volunteerCellTemplate;

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        volunteers[i]);

    cell.getElementsByClassName('userLabel')[0].innerHTML = volunteers[i];

    cell.getElementsByClassName('boardIdentifier')[0].setAttribute('value',
        api.boardUri);

    boardManagement.processVolunteerCell(cell);

    volunteersDiv.appendChild(cell);
  }

};

boardManagement.refreshVolunteers = function() {

  api.formApiRequest('boardManagement', {}, function gotData(status, data) {

    if (status !== 'ok') {
      return;
    }

    boardManagement.setVolunteersDiv(data.volunteers);

  }, false, {
    boardUri : api.boardUri
  });

};

boardManagement.setVolunteer = function(user, add, callback) {

  api.formApiRequest('setVolunteer', {
    login : user,
    add : add,
    boardUri : api.boardUri
  }, function requestComplete(status, data) {

    if (status === 'ok') {

      if (callback) {
        callback();
      }

      boardManagement.refreshVolunteers();

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

boardManagement.transferBoard = function() {

  api.formApiRequest('transferBoardOwnership', {
    login : document.getElementById('transferBoardFieldLogin').value.trim(),
    boardUri : api.boardUri
  }, function requestComplete(status, data) {

    if (status === 'ok') {
      window.location.pathname = '/' + api.boardUri + '/';
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

boardManagement.deleteBoard = function() {

  if (!document.getElementById('confirmDelCheckbox').checked) {
    alert('You must confirm that you wish to delete this board.')
    return;
  }

  api.formApiRequest('deleteBoard', {
    boardUri : api.boardUri,
    confirmDeletion : true
  }, function requestComplete(status, data) {

    if (status === 'ok') {
      window.location.pathname = '/';
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

boardManagement.init();