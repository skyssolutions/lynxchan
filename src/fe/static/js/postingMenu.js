var postingMenu = {};

postingMenu.init = function() {

  postingMenu.banLabels = [ 'IP/Bypass ban', 'Range ban (1/2 octects)',
      'Range ban (3/4 octects)', 'ASN ban', 'IP/Bypass warning' ];
  postingMenu.deletionOptions = [ 'Do not delete', 'Delete post',
      'Delete post and media', 'Delete by ip/bypass' ];
  postingMenu.threadSettingsList = [ {
    label : 'Toggle Lock',
    field : 'locked',
    parameter : 'lock'
  }, {
    label : 'Toggle Pin',
    field : 'pinned',
    parameter : 'pin'
  }, {
    label : 'Toggle Cyclic',
    field : 'cyclic',
    parameter : 'cyclic'
  } ];

  document.body.addEventListener('click', function clicked() {

    if (postingMenu.shownPostingMenu) {
      postingMenu.shownPostingMenu.remove();
      delete postingMenu.shownPostingMenu;
    }

  }, true);

  api.formApiRequest('account', {}, function gotLoginData(status, data) {

    if (status !== 'ok') {
      return;
    }

    postingMenu.loggedIn = true;

    postingMenu.globalRole = data.globalRole;

    postingMenu.moddedBoards = [];

    for (var i = 0; i < data.ownedBoards.length; i++) {
      postingMenu.moddedBoards.push(data.ownedBoards[i]);
    }

    for (i = 0; i < data.volunteeredBoards.length; i++) {
      postingMenu.moddedBoards.push(data.volunteeredBoards[i]);
    }

  }, {}, true);

  var links = document.getElementsByClassName('linkSelf');

  for (var i = 0; i < links.length; i++) {
    postingMenu.setExtraMenu(links[i]);
  }

};

postingMenu.showReport = function(board, thread, post, global) {

  var outerPanel = captchaModal.getCaptchaModal(global ? 'Global report'
      : 'Report');

  var reasonField = document.createElement('input');
  reasonField.type = 'text';

  var okButton = outerPanel.getElementsByClassName('modalOkButton')[0];

  okButton.onclick = function() {

    var typedCaptcha = outerPanel.getElementsByClassName('modalAnswer')[0].value
        .trim();

    if (typedCaptcha.length !== 6 && typedCaptcha.length !== 24) {
      alert('Captchas are exactly 6 (24 if no cookies) characters long.');
      return;
    } else if (/\W/.test(typedCaptcha)) {
      alert('Invalid captcha.');
      return;
    }

    var params = {
      captcha : typedCaptcha,
      reasonReport : reasonField.value.trim(),
      globalReport : global,
      action : 'report'
    };

    var key = board + '-' + thread;

    if (post) {
      key += '-' + post;
    }

    params[key] = true;

    api.formApiRequest('contentActions', params, function requestComplete(
        status, data) {

      if (status === 'ok') {
        outerPanel.remove();
      } else {
        alert(status + ': ' + JSON.stringify(data));
      }

    });

  };

  captchaModal.addModalRow('Reason', reasonField, okButton.onclick);

};

postingMenu.deleteSinglePost = function(boardUri, threadId, post, fromIp,
    unlinkFiles, wipeMedia, innerPart, forcedPassword) {

  var key = boardUri + '/' + threadId

  if (post) {
    key += '/' + post;
  }

  var storedData = JSON.parse(localStorage.postingPasswords || '{}');

  var password = forcedPassword || storedData[key]
      || localStorage.deletionPassword
      || document.getElementById('deletionFieldPassword').value.trim()
      || Math.random().toString(36).substring(2, 10);

  var params = {
    confirmation : true,
    password : password,
    deleteUploads : unlinkFiles,
    deleteMedia : wipeMedia,
    action : fromIp ? 'ip-deletion' : 'delete'
  };

  var key = boardUri + '-' + threadId;

  if (post) {
    key += '-' + post;
  }

  params[key] = true;

  var deletionCb = function requestComplete(status, data) {

    if (status !== 'ok') {
      alert(status + ': ' + JSON.stringify(data));
      return;
    }

    var data = data || {};

    var removed = data.removedThreads || data.removedPosts;

    if (unlinkFiles && removed) {
      innerPart.getElementsByClassName('panelUploads')[0].remove();
    } else if (fromIp) {

      if (api.isBoard || !api.boardUri) {
        location.reload(true);
      } else {
        window.location.pathname = '/' + boardUri + '/';
      }

    } else if (api.threadId && data.removedThreads) {
      window.location.pathname = '/' + boardUri + '/';
    } else if (removed) {
      innerPart.parentNode.remove();
    } else if (!removed) {

      var newPass = prompt('Could not delete. Would you like to try another password?');

      if (newPass) {
        postingMenu.deleteSinglePost(boardUri, threadId, post, fromIp,
            unlinkFiles, wipeMedia, innerPart, newPass);
      }

    }

  };

  api.formApiRequest('contentActions', params, deletionCb);

};

postingMenu.applySingleBan = function(typedMessage, deletionOption,
    typedReason, typedCaptcha, banType, typedDuration, global, nonBypassable,
    boardUri, thread, post, innerPart, outerPanel) {

  localStorage.setItem('autoDeletionOption', deletionOption);

  var params = {
    action : 'ban',
    nonBypassable : nonBypassable,
    reasonBan : typedReason,
    captcha : typedCaptcha,
    banType : banType,
    duration : typedDuration,
    banMessage : typedMessage,
    globalBan : global
  };

  var key = boardUri + '-' + thread;

  if (post) {
    key += '-' + post;
  }

  params[key] = true;

  api.formApiRequest('contentActions', params, function requestComplete(status,
      data) {

    if (status === 'ok') {

      var banMessageDiv = innerPart.getElementsByClassName('divBanMessage')[0];

      if (!banMessageDiv) {
        banMessageDiv = document.createElement('div');
        banMessageDiv.className = 'divBanMessage';
        innerPart.appendChild(banMessageDiv);
      }

      banMessageDiv.innerHTML = typedMessage
          || '(USER WAS BANNED FOR THIS POST)';

      outerPanel.remove();

      if (deletionOption) {
        postingMenu.deleteSinglePost(boardUri, thread, post,
            deletionOption === 3, false, deletionOption === 2, innerPart);
      }

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

postingMenu.banSinglePost = function(innerPart, boardUri, thread, post, global) {

  var outerPanel = captchaModal.getCaptchaModal(global ? 'Global ban' : 'Ban');

  var decorationPanel = outerPanel
      .getElementsByClassName('modalDecorationPanel')[0];

  var okButton = outerPanel.getElementsByClassName('modalOkButton')[0];

  var reasonField = document.createElement('input');
  reasonField.type = 'text';

  var durationField = document.createElement('input');
  durationField.type = 'text';

  var messageField = document.createElement('input');
  messageField.type = 'text';

  var typeCombo = document.createElement('select');

  for (var i = 0; i < postingMenu.banLabels.length; i++) {

    var option = document.createElement('option');
    option.innerHTML = postingMenu.banLabels[i];
    typeCombo.appendChild(option);

  }

  var deletionCombo = document.createElement('select');

  for (var i = 0; i < postingMenu.deletionOptions.length; i++) {

    var option = document.createElement('option');
    option.innerHTML = postingMenu.deletionOptions[i];
    deletionCombo.appendChild(option);

  }

  deletionCombo.selectedIndex = +localStorage.autoDeletionOption;

  var captchaField = outerPanel.getElementsByClassName('modalAnswer')[0];
  captchaField.setAttribute('placeholder', 'only for board staff)');

  var nonBypassableCheckbox = document.createElement('input');
  nonBypassableCheckbox.type = 'checkbox';

  okButton.onclick = function() {
    postingMenu.applySingleBan(messageField.value.trim(),
        deletionCombo.selectedIndex, reasonField.value.trim(),
        captchaField.value.trim(), typeCombo.selectedIndex, durationField.value
            .trim(), global, nonBypassableCheckbox.checked, boardUri, thread,
        post, innerPart, outerPanel);
  };

  captchaModal.addModalRow('Reason', reasonField, okButton.onclick);
  captchaModal.addModalRow('Duration', durationField, okButton.onclick);
  captchaModal.addModalRow('Message', messageField, okButton.onclick);
  captchaModal.addModalRow('Type', typeCombo);
  captchaModal.addModalRow('Deletion action', deletionCombo);
  captchaModal.addModalRow('Non-bypassable', nonBypassableCheckbox);

};

postingMenu.spoilSinglePost = function(innerPart, boardUri, thread, post) {

  var params = {
    action : 'spoil'
  };

  var key = boardUri + '-' + thread;

  if (post) {
    key += '-' + post;
  }

  params[key] = true;

  api.formApiRequest('contentActions', params, function requestComplete(status,
      data) {

    // style exception, too simple
    api.localRequest('/' + boardUri + '/res/' + thread + '.json', function(
        error, data) {

      if (error) {
        return;
      }

      var thumbs = innerPart.getElementsByClassName('imgLink');

      for (var i = 0; i < thumbs.length; i++) {
        var thumb = thumbs[i].childNodes[0].src = '/spoiler.png';
      }

    });
    // style exception, too simple

  });

};

postingMenu.mergeThread = function(board, thread) {

  var destination = prompt('Merge with which thread?', 'Thread id');

  if (!destination) {
    return;
  }

  destination = destination.trim();

  api.formApiRequest('mergeThread', {
    boardUri : board,
    threadSource : thread,
    threadDestination : destination
  }, function transferred(status, data) {

    if (status === 'ok') {
      window.location.pathname = '/' + board + '/res/' + destination + '.html';
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

postingMenu.transferThread = function(boardUri, thread) {

  var destination = prompt('Transfer to which board?',
      'Board uri without slashes');

  if (!destination) {
    return;
  }

  destination = destination.trim();

  api.formApiRequest('transferThread', {
    boardUri : boardUri,
    threadId : thread,
    boardUriDestination : destination
  }, function transferred(status, data) {

    if (status === 'ok') {
      window.location.pathname = '/' + destination + '/res/' + data + '.html';
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

postingMenu.updateEditedPosting = function(board, thread, post, innerPart, data) {

  innerPart.getElementsByClassName('divMessage')[0].innerHTML = data.markdown;

  var subjectLabel = innerPart.getElementsByClassName('labelSubject')[0];

  if (!subjectLabel && data.subject) {

    var pivot = innerPart.getElementsByClassName('linkName')[0];

    subjectLabel = document.createElement('span');
    subjectLabel.className = 'labelSubject';
    pivot.parentNode.insertBefore(subjectLabel, pivot);

    pivot.parentNode.insertBefore(document.createTextNode(' '), pivot);

  } else if (subjectLabel && !data.subject) {
    subjectLabel.remove();
  }

  if (data.subject) {
    subjectLabel.innerHTML = data.subject;
  }

};

postingMenu.getNewEditData = function(board, thread, post, innerPart) {

  api.localRequest('/' + board + '/res/' + thread + '.json', function(error,
      data) {

    if (error) {
      return;
    }

    data = JSON.parse(data);

    if (post) {

      for (var i = 0; i < data.posts.length; i++) {
        if (data.posts[i].postId === +post) {
          data = data.posts[i];
          break;
        }
      }

    }

    postingMenu.updateEditedPosting(board, thread, post, innerPart, data);

  });

};

postingMenu.editPost = function(board, thread, post, innerPart) {

  var parameters = {
    boardUri : board,
    threadId : thread
  };

  if (post) {
    parameters.postId = post;
  }

  api.formApiRequest('edit', {}, function gotData(status, data) {

    if (status !== 'ok') {
      alert(status);
      return;
    }

    var outerPanel = captchaModal.getCaptchaModal('Edit', true);

    var okButton = outerPanel.getElementsByClassName('modalOkButton')[0];

    var subjectField = document.createElement('input');
    subjectField.type = 'text';
    subjectField.value = data.subject || '';

    var messageArea = document.createElement('textarea');
    messageArea.setAttribute('rows', '5');
    messageArea.setAttribute('cols', '35');
    messageArea.setAttribute('placeholder', 'message');
    messageArea.defaultValue = data.message || '';

    okButton.onclick = function() {

      var typedSubject = subjectField.value.trim();
      var typedMessage = messageArea.value.trim();

      if (typedSubject.length > 128) {
        alert('Subject too long, keep it under 128 characters.');
      } else if (!typedMessage.length) {
        alert('A message is mandatory.');
      } else {

        var parameters = {
          boardUri : board,
          message : typedMessage,
          subject : typedSubject
        };

        if (post) {
          parameters.postId = post;
        } else {
          parameters.threadId = thread;
        }

        // style exception, too simple
        api.formApiRequest('saveEdit', parameters, function requestComplete(
            status, data) {

          if (status === 'ok') {
            outerPanel.remove();
            postingMenu.getNewEditData(board, thread, post, innerPart);
          } else {
            alert(status + ': ' + JSON.stringify(data));
          }
        });
        // style exception, too simple

      }

    };

    captchaModal.addModalRow('Subject', subjectField, okButton.onclick);
    captchaModal.addModalRow('Message', messageArea);

  }, false, parameters);

};

postingMenu.toggleThreadSetting = function(boardUri, thread, settingIndex,
    innerPart) {

  api.localRequest('/' + boardUri + '/res/' + thread + '.json',
      function gotData(error, data) {

        if (error) {
          alert(error);
          return;
        }

        var data = JSON.parse(data);

        var parameters = {
          boardUri : boardUri,
          threadId : thread
        };

        for (var i = 0; i < postingMenu.threadSettingsList.length; i++) {

          var field = postingMenu.threadSettingsList[i];

          parameters[field.parameter] = settingIndex === i ? !data[field.field]
              : data[field.field];

        }

        api.formApiRequest('changeThreadSettings', parameters,
            function requestComplete(status, data) {

              if (status === 'ok') {
                api.resetIndicators({
                  locked : parameters.lock,
                  pinned : parameters.pin,
                  cyclic : parameters.cyclic,
                  archived : innerPart
                      .getElementsByClassName('archiveIndicator').length
                }, innerPart);
              } else {
                alert(status + ': ' + JSON.stringify(data));
              }
            });

      });

};

postingMenu.addToggleSettingButton = function(extraMenu, board, thread, index,
    innerPart) {

  extraMenu.appendChild(document.createElement('hr'));

  var toggleButton = document.createElement('div');
  toggleButton.innerHTML = postingMenu.threadSettingsList[index].label;
  toggleButton.onclick = function() {
    postingMenu.toggleThreadSetting(board, thread, index, innerPart);
  };

  extraMenu.appendChild(toggleButton);

};

postingMenu.sendArchiveRequest = function(board, thread, innerPart) {

  api.formApiRequest('archiveThread', {
    confirmation : true,
    boardUri : board,
    threadId : thread
  }, function(status, data) {

    if (status === 'ok') {

      if (!api.threadId) {
        innerPart.parentNode.remove();
        return;
      }

      var lock = innerPart.getElementsByClassName('lockIndicator').length;
      var pin = innerPart.getElementsByClassName('pinIndicator').length;
      var cyclic = innerPart.getElementsByClassName('cyclicIndicator').length;

      api.resetIndicators({
        locked : lock,
        pinned : pin,
        cyclic : cyclic,
        archived : true
      }, innerPart);

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }

  });

};

postingMenu.setExtraMenuThread = function(extraMenu, board, thread, innerPart) {

  if (postingMenu.globalRole <= 1) {

    extraMenu.appendChild(document.createElement('hr'));

    var transferButton = document.createElement('div');
    transferButton.innerHTML = 'Transfer Thread';
    transferButton.onclick = function() {
      postingMenu.transferThread(board, thread);
    };
    extraMenu.appendChild(transferButton);

  }

  for (var i = 0; i < postingMenu.threadSettingsList.length; i++) {
    postingMenu.addToggleSettingButton(extraMenu, board, thread, i, innerPart);
  }

  if (innerPart.getElementsByClassName('archiveIndicator').length) {
    return;
  }

  extraMenu.appendChild(document.createElement('hr'));

  var archiveButton = document.createElement('div');
  archiveButton.innerHTML = 'Archive';
  archiveButton.onclick = function() {

    if (confirm("Are you sure you wish to lock and archive this thread?")) {
      postingMenu.sendArchiveRequest(board, thread, innerPart);
    }

  };
  extraMenu.appendChild(archiveButton);

  extraMenu.appendChild(document.createElement('hr'));

  var mergeButton = document.createElement('div');
  archiveButton.innerHTML = 'Merge';
  archiveButton.onclick = function() {
    postingMenu.mergeThread(board, thread);
  };
  extraMenu.appendChild(mergeButton);

};

postingMenu.setModFileOptions = function(extraMenu, innerPart, board, thread,
    post) {

  extraMenu.appendChild(document.createElement('hr'));

  var spoilButton = document.createElement('div');
  spoilButton.innerHTML = 'Spoil Files';
  spoilButton.onclick = function() {
    postingMenu.spoilSinglePost(innerPart, board, thread, post);
  };
  extraMenu.appendChild(spoilButton);

  if (postingMenu.globalRole > 3) {
    return;
  }

  extraMenu.appendChild(document.createElement('hr'));

  var deleteMediaButton = document.createElement('div');
  deleteMediaButton.innerHTML = 'Delete Post And Media';
  extraMenu.appendChild(deleteMediaButton);
  deleteMediaButton.onclick = function() {
    postingMenu.deleteSinglePost(board, thread, post, false, false, true,
        innerPart);
  };

};

postingMenu.setExtraMenuMod = function(innerPart, extraMenu, board, thread,
    post, hasFiles) {

  if (hasFiles) {
    postingMenu.setModFileOptions(extraMenu, innerPart, board, thread, post);
  }

  extraMenu.appendChild(document.createElement('hr'));

  var deleteByIpButton = document.createElement('div');
  deleteByIpButton.innerHTML = 'Delete By Ip/bypass';
  deleteByIpButton.onclick = function() {

    if (confirm("Are you sure you wish to delete all posts on this board made by this ip/bypass?")) {
      postingMenu.deleteSinglePost(board, thread, post, true, null, null,
          innerPart);
    }

  };
  extraMenu.appendChild(deleteByIpButton);

  extraMenu.appendChild(document.createElement('hr'));

  var banButton = document.createElement('div');
  banButton.innerHTML = 'Ban';
  banButton.onclick = function() {
    postingMenu.banSinglePost(innerPart, board, thread, post);
  };
  extraMenu.appendChild(banButton);

  if (postingMenu.globalRole <= 2) {

    extraMenu.appendChild(document.createElement('hr'));

    var globalBanButton = document.createElement('div');
    globalBanButton.innerHTML = 'Global Ban';
    globalBanButton.onclick = function() {
      postingMenu.banSinglePost(innerPart, board, thread, post, true);
    };
    extraMenu.appendChild(globalBanButton);

  }

  extraMenu.appendChild(document.createElement('hr'));

  var editButton = document.createElement('div');
  editButton.innerHTML = 'Edit';
  editButton.onclick = function() {
    postingMenu.editPost(board, thread, post, innerPart);
  };
  extraMenu.appendChild(editButton);

  if (!post) {
    postingMenu.setExtraMenuThread(extraMenu, board, thread, innerPart);
  }

};

postingMenu.buildMenu = function(linkSelf, extraMenu) {

  var innerPart = linkSelf.parentNode.parentNode;

  var href = linkSelf.href;

  if (href.indexOf('mod.js') < 0) {

    var parts = href.split('/');

    var board = parts[3];

    var finalParts = parts[5].split('.');

    var thread = finalParts[0];

  } else {

    var urlParams = new URLSearchParams(href.split('?')[1]);

    board = urlParams.get('boardUri');
    thread = urlParams.get('threadId').split('#')[0];

  }

  var post = href.split('#')[1];

  if (post === thread) {
    post = undefined;
  }

  var reportButton = document.createElement('div');
  reportButton.innerHTML = 'Report';
  reportButton.onclick = function() {
    postingMenu.showReport(board, thread, post);
  };
  extraMenu.appendChild(reportButton);

  extraMenu.appendChild(document.createElement('hr'));

  var globalReportButton = document.createElement('div');
  globalReportButton.innerHTML = 'Global Report';
  globalReportButton.onclick = function() {
    postingMenu.showReport(board, thread, post, true);
  };
  extraMenu.appendChild(globalReportButton);

  extraMenu.appendChild(document.createElement('hr'));

  var deleteButton = document.createElement('div');
  deleteButton.innerHTML = 'Delete Post';
  extraMenu.appendChild(deleteButton);
  deleteButton.onclick = function() {
    postingMenu.deleteSinglePost(board, thread, post, null, null, null,
        innerPart);
  };

  var hasFiles = linkSelf.parentNode.parentNode
      .getElementsByClassName('panelUploads')[0];

  hasFiles = hasFiles && hasFiles.children.length > 0;

  if (hasFiles) {

    extraMenu.appendChild(document.createElement('hr'));

    var unlinkButton = document.createElement('div');
    unlinkButton.innerHTML = 'Unlink Files';
    extraMenu.appendChild(unlinkButton);
    unlinkButton.onclick = function() {
      postingMenu.deleteSinglePost(board, thread, post, false, true, null,
          innerPart);
    };

  }

  if (postingMenu.loggedIn
      && (postingMenu.globalRole < 4 || postingMenu.moddedBoards.indexOf(board) >= 0)) {
    postingMenu.setExtraMenuMod(innerPart, extraMenu, board, thread, post,
        hasFiles);
  }

};

postingMenu.setExtraMenu = function(linkSelf) {

  var extraMenuButton = document.createElement('span');
  extraMenuButton.className = 'extraMenuButton glowOnHover coloredIcon';
  extraMenuButton.title = 'Post Menu';

  var parentNode = linkSelf.parentNode;

  var checkbox = parentNode.getElementsByClassName('deletionCheckBox')[0];

  parentNode.insertBefore(extraMenuButton, checkbox ? checkbox.nextSibling
      : parentNode.childNodes[0]);

  extraMenuButton.onclick = function() {

    var extraMenu = document.createElement('div');
    extraMenu.className = 'floatingMenu extraMenu';

    extraMenuButton.appendChild(extraMenu);

    postingMenu.shownPostingMenu = extraMenu;

    postingMenu.buildMenu(linkSelf, extraMenu);

  };

};

postingMenu.init();