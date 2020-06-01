var qr = {};

qr.init = function() {

  qr.setQr();

  var hash = window.location.hash.substring(1);

  if (hash.indexOf('q') === 0 && hash.length > 1) {

    hash = hash.substring(1);

    var post = document.getElementById(hash);

    if (post) {

      post.scrollIntoView();
      qr.showQr(hash);

      thread.markPost(hash);
    }

  } else if (hash.length > 0) {
    thread.markPost(hash);
  }

};

qr.removeQr = function() {
  qr.qrPanel.style.display = 'none';
};

qr.showQr = function(quote) {

  qr.qrPanel.style.display = 'block';

  if (qr.qrPanel.getBoundingClientRect().top < 0) {
    qr.qrPanel.style.top = '25px';
  }

  document.getElementById('qrbody').value += '>>' + quote + '\n';

  var selectedText = window.getSelection();
  if (selectedText != '') {
    document.getElementById('qrbody').value += '>' + selectedText + '\n';
  }

  document.getElementById('fieldMessage').value = document
      .getElementById('qrbody').value;

  postCommon.updateCurrentChar();

};

qr.registerSync = function(source, destination, field, event) {

  var sourceElement = document.getElementById(source);
  var destinationElement = document.getElementById(destination);

  destinationElement[field] = sourceElement[field];

  sourceElement.addEventListener(event, function() {
    if (destinationElement) {
      destinationElement[field] = sourceElement[field];
    }
  });

  destinationElement.addEventListener(event, function() {
    sourceElement[field] = destinationElement[field];
  });

};

qr.setQr = function() {

  var flags = document.getElementById('flagsDiv') ? true : false;

  var QRshowname = document.getElementById('fieldName') ? true : false;

  var textBoard = !document.getElementById('divUpload');

  var qrhtml = '<div id="quick-reply" style="right: 25px; top: 50px;">';
  qrhtml += '<div id="post-form-inner">';
  qrhtml += '<table class="post-table"><tbody> <tr><th colspan="2">';
  qrhtml += '<span class="handle">';
  qrhtml += '<a class="close-btn coloredIcon"';
  qrhtml += ' onclick=\'qr.removeQr();\'></a>';
  qrhtml += 'Quick Reply</span></th> </tr>';

  if (QRshowname) {
    qrhtml += '<tr><td colspan="2"><input id="qrname" type="text"';
    qrhtml += ' maxlength="35" autocomplete="off" placeholder="Name"></td> </tr>';
  }

  qrhtml += '<tr><td colspan="2">';
  qrhtml += '<input id="qrsubject" type="text" maxlength="100"';
  qrhtml += 'autocomplete="off" placeholder="Subject ">';
  qrhtml += '</td>';
  qrhtml += '</tr>';

  qrhtml += '<tr><td colspan="2"><textarea id="qrbody" rows="5" placeholder="Comment">';
  qrhtml += '</textarea></td></tr> ';

  if (!textBoard) {

    if (api.mobile) {
      qrhtml += '<tr id="qrFilesButton"><td class="small">Files</td></tr>';
      qrhtml += '</tbody><tbody class="hidden" id="filesBody">';
    }

    qrhtml += ' <tr><td colspan="2"><div class="dropzone" id="dropzoneQr">';
    qrhtml += 'Drag files to upload or<br> click here to select them</div>';
    qrhtml += '<div id="selectedDivQr"></div></td> </tr>';

    qrhtml += '<tr><td class="centered" colspan="2"><input type="checkbox" ';
    qrhtml += 'id="qrcheckboxSpoiler" class="postingCheckbox">';
    qrhtml += '<label for="qrcheckboxSpoiler" class="spoilerCheckbox">Spoiler</label></td> </tr>';

    if (api.mobile) {
      qrhtml += '</tbody><tbody>'
    }

  }

  if (!api.hiddenCaptcha) {

    if (api.mobile) {
      qrhtml += '<tr id="qrCaptchaButton"><td class="small">Captcha</td></tr>';
      qrhtml += '</tbody><tbody class="hidden" id="captchaBody">'
    }

    var parts = document.getElementById('captchaImage').src.split('/');

    var lastPart = '/' + parts[parts.length - 1];

    qrhtml += '<tr><td colspan="2"><img src="' + lastPart;
    qrhtml += '" class="captchaImage"/></td></tr>';

    qrhtml += '<tr><td colspan="2"><input type="button" onClick="captchaUtils.reloadCaptcha()"';
    qrhtml += ' value="Reload"> <span class="captchaTimer"></span></td></tr>';

    qrhtml += '<tr><td><input type="text" class="captchaField" ';
    qrhtml += 'id="QRfieldCaptcha" placeholder="Answer"></td>';
    qrhtml += '<td><a href="/noCookieCaptcha.js" target="_blank" class="small">No cookies?</a></td></tr>';

    if (api.mobile) {
      qrhtml += '</tbody><tbody>'
    }
  }

  qrhtml += '<tr id="qrFormMore"><td class="small">Extra</td></tr>';

  qrhtml += '</tbody><tbody class="hidden" id="qrExtra">';

  qrhtml += '<tr><td colspan="2">';
  qrhtml += '<input id="qremail" type="text" maxlength="40" ';
  qrhtml += 'autocomplete="off" placeholder="Email">';
  qrhtml += '</td> </tr> ';

  qrhtml += '<tr><td colspan="2">';
  qrhtml += '<input id="qrpassword" type="password" placeholder="Password"></td></tr>';

  if (flags) {
    qrhtml += '<tr><td colspan="2"><div id="qrFlagsDiv"></div></td></tr>';
  }

  var noFlagDiv = document.getElementById('noFlagDiv');

  if (noFlagDiv) {
    qrhtml += '<tr><td class="centered" colspan="2"><input type="checkbox" ';
    qrhtml += 'id="qrcheckboxNoFlag" class="postingCheckbox">';
    qrhtml += '<label for="qrcheckboxNoFlag" class="spoilerCheckbox">';
    qrhtml += 'Don\'t show location</label></td></tr>';
  }

  qrhtml += '<tr><td class="centered" colspan="2"><input type="checkbox" ';
  qrhtml += 'id="qralwaysUseBypassCheckBox" class="postingCheckbox">';
  qrhtml += '<label for="qralwaysUseBypassCheckBox" class="spoilerCheckbox">';
  qrhtml += 'Make sure I have a block bypass</label></td></tr>';

  qrhtml += '</tbody><tbody> <tr> <td colspan="2" class="centered">';
  qrhtml += '<button accesskey="s" id="qrbutton" type="button" onclick="thread.postReply()">Reply';
  qrhtml += '</td></tr>';

  qrhtml += '</tbody> </table></div></div>';

  qr.qrPanel = document.createElement('div');
  qr.qrPanel.innerHTML = qrhtml;
  qr.qrPanel = qr.qrPanel.children[0];

  draggable.setDraggable(qr.qrPanel, qr.qrPanel
      .getElementsByClassName('handle')[0]);

  document.body.appendChild(qr.qrPanel);

  var extra = document.getElementById('qrExtra');
  document.getElementById('qrFormMore').onclick = function() {
    extra.classList.toggle('hidden');
  };

  qr.registerSync('fieldEmail', 'qremail', 'value', 'input');
  qr.registerSync('fieldSubject', 'qrsubject', 'value', 'input');
  qr.registerSync('fieldMessage', 'qrbody', 'value', 'input');
  document.getElementById('qrbody').addEventListener('input',
      postCommon.updateCurrentChar);
  qr.registerSync('fieldPostingPassword', 'qrpassword', 'value', 'input');
  qr.registerSync('alwaysUseBypassCheckBox', 'qralwaysUseBypassCheckBox',
      'checked', 'change');

  if (noFlagDiv) {
    qr.registerSync('checkboxNoFlag', 'qrcheckboxNoFlag', 'checked', 'change');
  }

  if (!textBoard) {

    if (api.mobile) {
      var fileBodyBody = document.getElementById('filesBody');
      document.getElementById('qrFilesButton').onclick = function() {
        fileBodyBody.classList.toggle('hidden');
      };

    }

    qr
        .registerSync('checkboxSpoiler', 'qrcheckboxSpoiler', 'checked',
            'change');
    postCommon.setDragAndDrop(true);

    for (var i = 0; i < selectedDiv.childNodes.length; i++) {
      var originalCell = selectedDiv.childNodes[i];
      var clonedCell = originalCell.cloneNode(true);

      clonedCell.getElementsByClassName('removeButton')[0].onclick = originalCell
          .getElementsByClassName('removeButton')[0].onclick;

      selectedDivQr.appendChild(clonedCell);
    }
  }

  if (flags) {

    document.getElementById('qrFlagsDiv').innerHTML = document
        .getElementById('flagsDiv').innerHTML.replace('flagCombobox',
        'qrFlagCombobox');

    qrFlagCombo = document.getElementById('qrFlagCombobox');

    postCommon.setFlagPreviews(qrFlagCombo)

    qr.registerSync('flagCombobox', 'qrFlagCombobox', 'value', 'change');

  }

  if (QRshowname) {
    qr.registerSync('fieldName', 'qrname', 'value', 'input');
  }

  if (!api.hiddenCaptcha) {

    if (api.mobile) {
      var captchaBody = document.getElementById('captchaBody');
      document.getElementById('qrCaptchaButton').onclick = function() {
        captchaBody.classList.toggle('hidden');
      };
    }

    qr.registerSync('fieldCaptcha', 'QRfieldCaptcha', 'value', 'input');
  }

};

qr.setQRReplyText = function(text) {

  var qrReplyButton = document.getElementById('qrbutton');

  if (qrReplyButton) {
    qrReplyButton.innerHTML = text;
  }

};

qr.clearQRAfterPosting = function() {

  var qrMessageField = document.getElementById('qrbody');

  if (!qrMessageField) {
    return;
  }

  document.getElementById('qrsubject').value = '';
  qrMessageField.value = '';

};

qr.setQRReplyEnabled = function(enabled) {

  var qrReplyButton = document.getElementById('qrbutton');

  if (qrReplyButton) {
    qrReplyButton.disabled = !enabled;
  }

};

qr.init();