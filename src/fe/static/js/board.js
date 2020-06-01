api.isBoard = true;

var board = {};

board.init = function() {

  api.mod = !!document.getElementById('divMod');
  api.hiddenCaptcha = !document.getElementById('captchaDiv');

  var identifierElement = document.getElementById('boardIdentifier');
  api.boardUri = identifierElement ? identifierElement.value : null;

  if (!api.boardUri) {

    var altIdentifierElement = document.getElementById('labelBoard');

    api.boardUri = altIdentifierElement ? altIdentifierElement.innerHTML
        .replace(/\//g, '') : null;

  }

  if (identifierElement) {

    board.messageLimit = +document.getElementById('labelMessageLength').innerHTML;

    board.postButton = document.getElementById('formButton');

    api.convertButton(board.postButton, board.postThread);

    board.postButton.disabled = false;

  }

  if (api.mod) {
    api.convertButton('inputBan', posting.banPosts, 'banField');
    api.convertButton('inputBanDelete', posting.banDeletePosts, 'banField');
    api.convertButton('inputIpDelete', posting.deleteFromIpOnBoard);
    api.convertButton('inputSpoil', posting.spoilFiles);
  }

};

board.postCallback = function(status, data) {

  if (status === 'ok') {

    postCommon.storeUsedPostingPassword(api.boardUri, data);

    window.location.pathname = '/' + api.boardUri + '/res/' + data + '.html';
  } else {
    alert(status + ': ' + JSON.stringify(data));
  }
};

board.postCallback.stop = function() {
  board.postButton.innerHTML = board.originalButtonText;
  board.postButton.disabled = false;
};

board.postCallback.progress = function(info) {

  if (info.lengthComputable) {
    var newText = 'Uploading ' + Math.floor((info.loaded / info.total) * 100)
        + '%';
    board.postButton.innerHTML = newText;
  }
};

board.sendThreadData = function(files, captchaId) {

  var hiddenFlags = !document.getElementById('flagsDiv');

  if (!hiddenFlags) {
    var combo = document.getElementById('flagCombobox');

    var selectedFlag = combo.options[combo.selectedIndex].value;

    postCommon.savedSelectedFlag(selectedFlag);
  }

  var forcedAnon = !document.getElementById('fieldName');

  if (!forcedAnon) {
    var typedName = document.getElementById('fieldName').value.trim();

    localStorage.setItem('name', typedName);

  }

  var typedEmail = document.getElementById('fieldEmail').value.trim();
  var typedMessage = document.getElementById('fieldMessage').value.trim();
  var typedSubject = document.getElementById('fieldSubject').value.trim();
  var typedPassword = document.getElementById('fieldPostingPassword').value
      .trim();

  if (!typedMessage.length) {
    alert('A message is mandatory.');
    return;
  } else if (!forcedAnon && typedName.length > 32) {
    alert('Name is too long, keep it under 32 characters.');
    return;
  } else if (typedMessage.length > board.messageLimit) {
    alert('Message is too long, keep it under ' + board.messageLimit
        + ' characters.');
    return;
  } else if (typedEmail.length > 64) {
    alert('Email is too long, keep it under 64 characters.');
    return;
  } else if (typedSubject.length > 128) {
    alert('Subject is too long, keep it under 128 characters.');
    return;
  } else if (typedPassword.length > 8) {
    alert('Password is too long, keep it under 8 characters.');
    return;
  }

  if (!typedPassword) {
    typedPassword = Math.random().toString(36).substring(2, 10);
  }

  localStorage.setItem('deletionPassword', typedPassword);

  board.originalButtonText = board.postButton.innerHTML;
  board.postButton.innerHTML = 'Uploading 0%';
  board.postButton.disabled = true;

  var spoilerCheckBox = document.getElementById('checkboxSpoiler');

  var noFlagCheckBox = document.getElementById('checkboxNoFlag');

  api.formApiRequest('newThread', {
    name : forcedAnon ? null : typedName,
    flag : hiddenFlags ? null : selectedFlag,
    captcha : captchaId,
    password : typedPassword,
    noFlag : noFlagCheckBox ? noFlagCheckBox.checked : false,
    spoiler : spoilerCheckBox ? spoilerCheckBox.checked : false,
    subject : typedSubject,
    message : typedMessage,
    email : typedEmail,
    files : files,
    boardUri : api.boardUri
  }, board.postCallback);

};

board.processFilesToPost = function(captchaId) {

  postCommon.newGetFilesToUpload(function gotFiles(files) {
    board.sendThreadData(files, captchaId);
  });

};

board.processThreadRequest = function() {

  if (api.hiddenCaptcha) {
    board.processFilesToPost();
  } else {
    var typedCaptcha = document.getElementById('fieldCaptcha').value.trim();

    if (typedCaptcha.length !== 6 && typedCaptcha.length !== 24) {
      alert('Captchas are exactly 6 (24 if no cookies) characters long.');
      return;
    } else if (/\W/.test(typedCaptcha)) {
      alert('Invalid captcha.');
      return;
    }

    if (typedCaptcha.length == 24) {
      board.processFilesToPost(typedCaptcha);
    } else {
      var parsedCookies = api.getCookies();

      api.formApiRequest('solveCaptcha', {
        captchaId : parsedCookies.captchaid,
        answer : typedCaptcha
      }, function solvedCaptcha(status, data) {

        if (status !== 'ok') {
          alert(status);
          return;
        }

        board.processFilesToPost(parsedCookies.captchaid);
      });
    }

  }

};

board.postThread = function() {

  api.formApiRequest('blockBypass', {},
      function checked(status, data) {

        if (status !== 'ok') {
          alert(data);
          return;
        }

        var alwaysUseBypass = document
            .getElementById('alwaysUseBypassCheckBox').checked;

        if (!data.valid
            && (data.mode == 2 || (data.mode == 1 && alwaysUseBypass))) {

          postCommon.displayBlockBypassPrompt(function() {
            board.processThreadRequest();
          });

        } else {
          board.processThreadRequest();
        }

      });

};

board.init();
