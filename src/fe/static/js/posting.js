var posting = {};

posting.init = function() {

  posting.idsRelation = {};
  posting.highLightedIds = [];

  posting.postCellTemplate = '<div class="innerPost"><h3 class="labelBoard"></h3><div class="postInfo title">'
      + '<input type="checkbox" class="deletionCheckBox"> <span class="labelSubject">'
      + '</span> <a class="linkName"></a> <img class="imgFlag"> <span class="labelRole">'
      + '</span> <span class="labelCreated"></span> <span class="spanId"> Id:<span '
      + 'class="labelId"></span></span> <a '
      + 'class="linkSelf">No.</a> <a class="linkQuote"></a> <a class="linkEdit">[Edit]</a> '
      + '<a class="linkHistory">[History]</a> <a class="linkFileHistory">[File history]</a>'
      + ' <a class="linkOffenseRecord">[Offense record]</a>'
      + ' <span class="panelBacklinks"></span></div>'
      + '<div class="panelASN">ASN: <span class="labelASN"></span> </div>'
      + '<div class="panelBypassId"> Bypass Id: <span class="labelBypassId"></span> </div>'
      + '<div>'
      + '<span class="panelIp"> <span class="panelRange">Broad'
      + 'range(1/2 octets): <span class="labelBroadRange"> </span> <br>'
      + 'Narrow range(3/4 octets): <span class="labelNarrowRange"> </span> <br>'
      + '</span> Ip: <span class="labelIp"></span></span>'
      + '</div>'
      + '<div class="panelUploads"></div><div class="divMessage"></div>'
      + '<div class="divBanMessage"></div><div class="labelLastEdit"></div></div>';

  posting.uploadCell = '<div class="uploadDetails"><a class="nameLink" target="blank">'
      + '</a> <span class="hideMobile">(</span><span class="sizeLabel"></span> '
      + '<span class="dimensionLabel"></span> <a class="originalNameLink"></a><span '
      + 'class="hideMobile">)</span></div><div class="divHash"><span>SHA256: <span '
      + 'class="labelHash"></span></span></div>'
      + '<div> <a class="unlinkLink">[Unlink]</a>'
      + ' <a class="unlinkAndDeleteLink">[Unlink and delete]</a></div>'
      + '<a class="imgLink" target="blank"></a>';

  posting.sizeOrders = [ 'B', 'KB', 'MB', 'GB', 'TB' ];

  posting.guiEditInfo = 'Edited last time by {$login} on {$date}.';

  posting.reverseHTMLReplaceTable = {};

  for ( var key in api.htmlReplaceTable) {
    posting.reverseHTMLReplaceTable[api.htmlReplaceTable[key]] = key;
  }

  if (document.getElementById('deleteFormButton')) {

    api.convertButton('reportFormButton', posting.reportPosts, 'reportField');
    api.convertButton('deleteFormButton', posting.deletePosts, 'deletionField');

  }

  if (localStorage.localTime && JSON.parse(localStorage.localTime)) {

    var times = document.getElementsByClassName('labelCreated');

    for (var i = 0; i < times.length; i++) {
      posting.setLocalTime(times[i]);
    }

    posting.localTimes = true;
  }

  if (localStorage.relativeTime && JSON.parse(localStorage.relativeTime)) {
    posting.updateAllRelativeTimes();
    setInterval(posting.updateAllRelativeTimes, 1000 * 60 * 5);
  }

  if (typeof (thread) !== 'undefined') {
    return;
  }

  var ids = document.getElementsByClassName('labelId');

  for (i = 0; i < ids.length; i++) {
    posting.processIdLabel(ids[i]);
  }

};

posting.setLocalTime = function(time) {

  time.innerHTML = api.formatDateToDisplay(new Date(time.innerHTML + ' UTC'),
      true);

};

posting.applyBans = function(captcha, banDelete) {

  var typedReason = document.getElementById('fieldBanReason').value.trim();
  var typedDuration = document.getElementById('fieldDuration').value.trim();
  var typedMessage = document.getElementById('fieldbanMessage').value.trim();
  var banType = document.getElementById('comboBoxBanTypes').selectedIndex;

  var params = {
    action : banDelete ? 'ban-delete' : 'ban',
    reasonBan : typedReason,
    captcha : captcha,
    banType : banType,
    duration : typedDuration,
    banMessage : typedMessage,
    nonBypassable : document.getElementById('checkBoxNonBypassable').checked,
    globalBan : document.getElementById('checkboxGlobalBan').checked
  };

  posting.newGetSelectedContent(params);

  api.formApiRequest('contentActions', params, function requestComplete(status,
      data) {

    if (status === 'ok') {
      alert('Bans applied');
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }

  });
};

posting.banDeletePosts = function() {
  posting.banPosts(true);
};

posting.banPosts = function(banDelete) {

  if (!document.getElementsByClassName('panelRange').length) {
    posting.applyBans();
    return;
  }

  var typedCaptcha = document.getElementById('fieldCaptchaReport').value.trim();

  if (typedCaptcha && /\W/.test(typedCaptcha)) {
    alert('Invalid captcha.');
    return;
  }

  if (typedCaptcha.length == 24 || !typedCaptcha) {
    thread.applyBans(typedCaptcha);
  } else {
    var parsedCookies = api.getCookies();

    api.formaApiRequest('solveCaptcha', {
      captchaId : parsedCookies.captchaid,
      answer : typedCaptcha
    }, function solvedCaptcha(status, data) {

      if (status !== 'ok') {
        alert(status);
        return;
      }

      posting.applyBans(parsedCookies.captchaid, banDelete);
    });
  }

};

posting.deleteFromIpOnBoard = function() {

  var checkBoxes = document.getElementsByClassName('deletionCheckBox');

  for (var i = 0; i < checkBoxes.length; i++) {
    var checkBox = checkBoxes[i];

    if (checkBox.checked) {
      var splitName = checkBox.name.split('-')[0];
      break;
    }

  }

  if (!splitName) {
    return;
  }

  var redirect = '/' + splitName + '/';

  var confirmationBox = document
      .getElementById('ipDeletionConfirmationCheckbox');

  var param = {
    action : 'ip-deletion',
    confirmation : confirmationBox.checked
  };

  posting.newGetSelectedContent(param);

  api.formApiRequest('contentActions', param, function requestComplete(status,
      data) {

    if (status === 'ok') {
      window.location.pathname = redirect;
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

posting.processIdLabel = function(label) {

  var id = label.innerHTML;

  var array = posting.idsRelation[id] || [];
  posting.idsRelation[id] = array;

  var cell = label.parentNode.parentNode.parentNode;

  array.push(cell);

  label.onmouseover = function() {
    label.innerHTML = id + ' (' + array.length + ')';
  }

  label.onmouseout = function() {
    label.innerHTML = id;
  }

  label.onclick = function() {

    var index = posting.highLightedIds.indexOf(id);

    if (index > -1) {
      posting.highLightedIds.splice(index, 1);
    } else {
      posting.highLightedIds.push(id);
    }

    for (var i = 0; i < array.length; i++) {
      var cellToChange = array[i];

      if (cellToChange.className === 'innerOP') {
        continue;
      }

      cellToChange.className = index > -1 ? 'innerPost' : 'markedPost';
    }

  };

};

posting.updateAllRelativeTimes = function() {

  var times = document.getElementsByClassName('labelCreated');

  for (var i = 0; i < times.length; i++) {
    posting.addRelativeTime(times[i]);
  }

};

posting.addRelativeTime = function(time) {

  var timeObject = new Date(time.innerHTML + (posting.localTimes ? '' : ' UTC'));

  if (time.nextSibling.nextSibling.className !== 'relativeTime') {

    var newRelativeLabel = document.createElement('span');

    newRelativeLabel.className = 'relativeTime';

    time.parentNode.insertBefore(newRelativeLabel, time.nextSibling);
    time.parentNode
        .insertBefore(document.createTextNode(' '), time.nextSibling);

  }

  var now = new Date();

  var content;

  var delta = now - timeObject;

  var second = 1000;
  var minute = second * 60;
  var hour = minute * 60;
  var day = hour * 24;
  var month = day * 30.5;
  var year = day * 365.25;

  if (delta > 2 * year) {
    content = Math.ceil(delta / year) + ' years ago';
  } else if (delta > 2 * month) {
    content = Math.ceil(delta / month) + ' months ago';
  } else if (delta > 2 * day) {
    content = Math.ceil(delta / day) + ' days ago';
  } else if (delta > 2 * hour) {
    content = Math.ceil(delta / hour) + ' hours ago';
  } else if (delta > 2 * minute) {
    content = Math.ceil(delta / minute) + ' minutes ago';
  } else {
    content = 'Just now'
  }

  time.nextSibling.nextSibling.innerHTML = '(' + content + ')';

};

posting.spoilFiles = function() {

  var posts = {
    action : 'spoil'
  };

  posting.newGetSelectedContent(posts);

  api.formApiRequest('contentActions', posts, function requestComplete(status,
      data) {

    if (status === 'ok') {

      alert('Files spoiled');

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

posting.newGetSelectedContent = function(object) {

  var checkBoxes = document.getElementsByClassName('deletionCheckBox');

  for (var i = 0; i < checkBoxes.length; i++) {
    var checkBox = checkBoxes[i];

    if (checkBox.checked) {
      object[checkBox.name] = true;
    }
  }

};

posting.reportPosts = function() {

  var typedReason = document.getElementById('reportFieldReason').value.trim();
  var typedCaptcha = document.getElementById('fieldCaptchaReport').value.trim();

  if (typedCaptcha.length !== 6 && typedCaptcha.length !== 24) {
    alert('Captchas are exactly 6 (24 if no cookies) characters long.');
    return;
  } else if (/\W/.test(typedCaptcha)) {
    alert('Invalid captcha.');
    return;
  }

  var params = {
    action : 'report',
    reasonReport : typedReason,
    captcha : typedCaptcha,
    globalReport : document.getElementById('checkboxGlobalReport').checked,
  };

  posting.newGetSelectedContent(params);

  api.formApiRequest('contentActions', params, function reported(status, data) {

    if (status === 'ok') {

      alert('Content reported');

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }

  });

};

posting.deletePosts = function() {

  var typedPassword = document.getElementById('deletionFieldPassword').value
      .trim();

  var params = {
    password : typedPassword,
    deleteMedia : document.getElementById('checkboxMediaDeletion').checked,
    deleteUploads : document.getElementById('checkboxOnlyFiles').checked,
    action : 'delete'
  };

  posting.newGetSelectedContent(params);

  api.formApiRequest('contentActions', params, function requestComplete(status,
      data) {

    if (status === 'ok') {

      alert(data.removedThreads + ' threads and ' + data.removedPosts
          + ' posts were successfully deleted.');

      if (typeof latestPostings !== 'undefined') {

        var checkBoxes = document.getElementsByClassName('deletionCheckBox');

        for (var i = checkBoxes.length - 1; i >= 0; i--) {
          var checkBox = checkBoxes[i];

          if (checkBox.checked) {
            checkBox.parentNode.parentNode.parentNode.remove();
          }

        }

      } else if (!api.isBoard && !data.removedThreads && data.removedPosts) {
        thread.refreshPosts(true, true);
      } else if (data.removedThreads || data.removedPosts) {
        window.location.pathname = '/';
      }

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

posting.formatFileSize = function(size) {

  var orderIndex = 0;

  while (orderIndex < posting.sizeOrders.length - 1 && size > 1024) {

    orderIndex++;
    size /= 1024;

  }

  return size.toFixed(2) + ' ' + posting.sizeOrders[orderIndex];

};

posting.setLastEditedLabel = function(post, cell) {

  var editedLabel = cell.getElementsByClassName('labelLastEdit')[0];

  if (post.lastEditTime) {

    var formatedDate = api.formatDateToDisplay(new Date(post.lastEditTime));

    editedLabel.innerHTML = posting.guiEditInfo
        .replace('{$date}', formatedDate).replace('{$login}',
            post.lastEditLogin);

  } else {
    editedLabel.remove();
  }

};

posting.setUploadLinks = function(cell, file, noExtras) {

  var thumbLink = cell.getElementsByClassName('imgLink')[0];
  thumbLink.href = file.path;

  thumbLink.setAttribute('data-filemime', file.mime);

  if (file.mime.indexOf('image/') > -1 && !noExtras
      && (typeof gallery !== 'undefined') && !api.mobile) {
    gallery.addGalleryFile(file.path);
  }

  var img = document.createElement('img');
  img.src = file.thumb;

  thumbLink.appendChild(img);

  var nameLink = cell.getElementsByClassName('nameLink')[0];
  nameLink.href = file.path;

  var originalLink = cell.getElementsByClassName('originalNameLink')[0];
  originalLink.innerHTML = file.originalName;
  originalLink.href = file.path;
  originalLink.setAttribute('download', file.originalName);

};

posting.getUploadCellBase = function() {

  var cell = document.createElement('figure');
  cell.innerHTML = posting.uploadCell;
  cell.className = 'uploadCell';

  return cell;

}

posting.setUploadCell = function(node, post, boardUri, noExtras) {

  if (!post.files) {
    return;
  }

  var files = post.files;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];

    var cell = posting.getUploadCellBase();

    posting.setUploadLinks(cell, file, noExtras);

    var sizeString = posting.formatFileSize(file.size);
    cell.getElementsByClassName('sizeLabel')[0].innerHTML = sizeString;

    var dimensionLabel = cell.getElementsByClassName('dimensionLabel')[0];

    if (file.width) {
      dimensionLabel.innerHTML = file.width + 'x' + file.height;
    } else {
      dimensionLabel.remove();
    }

    var unlinkCell = cell.getElementsByClassName('unlinkLink')[0];
    var deleteCell = cell.getElementsByClassName('unlinkAndDeleteLink')[0];

    if (!api.mod) {
      unlinkCell.remove();
      deleteCell.remove();
    } else {
      var urlToUse = '/unlinkSingle.js?boardUri=' + boardUri;

      if (post.postId) {
        urlToUse += '&postId=' + post.postId;
      } else {
        urlToUse += '&threadId=' + post.threadId;
      }

      urlToUse += '&index=' + i;

      unlinkCell.href = urlToUse;
      deleteCell.href = urlToUse + '&delete=1';

    }

    if (file.sha256) {
      cell.getElementsByClassName('labelHash')[0].innerHTML = file.sha256;
    } else {
      cell.getElementsByClassName('divHash')[0].remove();
    }

    node.appendChild(cell);
  }

};

posting.setPostHideableElements = function(postCell, post, noExtras) {

  var subjectLabel = postCell.getElementsByClassName('labelSubject')[0];

  if (post.subject) {
    subjectLabel.innerHTML = post.subject;
  } else {
    subjectLabel.remove();
  }

  if (post.id) {
    var labelId = postCell.getElementsByClassName('labelId')[0];
    labelId.setAttribute('style', 'background-color: #' + post.id);
    labelId.innerHTML = post.id;

    if (!noExtras) {
      posting.processIdLabel(labelId);
    }

  } else {
    var spanId = postCell.getElementsByClassName('spanId')[0];
    spanId.remove();
  }

  var banMessageLabel = postCell.getElementsByClassName('divBanMessage')[0];

  if (!post.banMessage) {
    banMessageLabel.parentNode.removeChild(banMessageLabel);
  } else {
    banMessageLabel.innerHTML = post.banMessage;
  }

  posting.setLastEditedLabel(post, postCell);

  var imgFlag = postCell.getElementsByClassName('imgFlag')[0];

  if (post.flag) {
    imgFlag.src = post.flag;
    imgFlag.title = post.flagName.replace(/&(l|g)t;/g, function replace(match) {
      return posting.reverseHTMLReplaceTable[match];
    });

    if (post.flagCode) {
      imgFlag.className += ' flag' + post.flagCode;
    }
  } else {
    imgFlag.remove();
  }

  if (!post.asn) {
    postCell.getElementsByClassName('panelASN')[0].remove();
  } else {
    postCell.getElementsByClassName('labelASN')[0].innerHTML = post.asn;
  }

  if (!post.bypassId) {
    postCell.getElementsByClassName('panelBypassId')[0].remove();
  } else {
    postCell.getElementsByClassName('labelBypassId')[0].innerHTML = post.bypassId;
  }

  if (!post.ip) {
    postCell.getElementsByClassName('panelIp')[0].remove();
  } else {

    postCell.getElementsByClassName('labelIp')[0].innerHTML = post.ip;

    if (!post.broadRange) {
      postCell.getElementsByClassName('panelRange')[0].remove();
    } else {

      postCell.getElementsByClassName('labelBroadRange')[0].innerHTML = post.broadRange;
      postCell.getElementsByClassName('labelNarrowRange')[0].innerHTML = post.narrowRange;

    }

  }

};

posting.setPostLinks = function(postCell, post, boardUri, link, threadId,
    linkQuote, deletionCheckbox, preview) {

  var postingId = post.postId || threadId;

  var linkStart = (preview ? '/' + boardUri + '/res/' + threadId + '.html' : '')
      + '#';

  linkQuote.href = linkStart;
  link.href = linkStart;

  link.href += postingId;
  linkQuote.href += 'q' + postingId;

  var linkEdit = postCell.getElementsByClassName('linkEdit')[0];
  var linkHistory = postCell.getElementsByClassName('linkHistory')[0];
  var linkFileHistory = postCell.getElementsByClassName('linkFileHistory')[0];
  var linkOffenseHistory = postCell.getElementsByClassName('linkOffenseRecord')[0];

  var complement = (post.postId ? 'postId' : 'threadId') + '=' + postingId;

  if (api.mod) {
    linkEdit.href = '/edit.js?boardUri=' + boardUri + '&';
    linkEdit.href += complement;
  } else if (linkEdit) {
    linkEdit.remove();
  }

  if (api.mod && (post.ip || post.bypassId)) {
    linkFileHistory.href = '/mediaManagement.js?boardUri=' + boardUri + '&';
    linkFileHistory.href += complement;

    linkHistory.href = '/latestPostings.js?boardUri=' + boardUri + '&';
    linkHistory.href += complement;

    linkOffenseHistory.href = '/offenseRecord.js?boardUri=' + boardUri + '&';
    linkOffenseHistory.href += complement;

  } else if (linkHistory) {
    linkHistory.remove();
    linkFileHistory.remove();
    linkOffenseHistory.remove();
  }

  var checkboxName = boardUri + '-' + threadId;

  if (post.postId) {
    checkboxName += '-' + post.postId;
  }

  deletionCheckbox.setAttribute('name', checkboxName);

};

posting.setRoleSignature = function(postingCell, posting) {

  var labelRole = postingCell.getElementsByClassName('labelRole')[0];

  if (posting.signedRole) {
    labelRole.innerHTML = posting.signedRole;
  } else {
    labelRole.parentNode.removeChild(labelRole);
  }

};

posting.setPostComplexElements = function(postCell, post, boardUri, threadId,
    noExtras, preview) {

  posting.setRoleSignature(postCell, post);

  var link = postCell.getElementsByClassName('linkSelf')[0];

  var linkQuote = postCell.getElementsByClassName('linkQuote')[0];
  linkQuote.innerHTML = post.postId || threadId;

  var deletionCheckbox = postCell.getElementsByClassName('deletionCheckBox')[0];

  posting.setPostLinks(postCell, post, boardUri, link, threadId, linkQuote,
      deletionCheckbox, preview);

  var panelUploads = postCell.getElementsByClassName('panelUploads')[0];

  if (!post.files || !post.files.length) {
    panelUploads.remove();
  } else {

    if (post.files.length > 1) {
      panelUploads.className += ' multipleUploads';
    }

    posting.setUploadCell(panelUploads, post, boardUri, noExtras);
  }

};

posting.setPostInnerElements = function(boardUri, threadId, post, postCell,
    noExtras, preview) {

  var linkName = postCell.getElementsByClassName('linkName')[0];

  linkName.innerHTML = post.name;

  if (post.email) {
    linkName.href = 'mailto:' + post.email;
  } else {
    linkName.className += ' noEmailName';
  }

  var labelCreated = postCell.getElementsByClassName('labelCreated')[0];

  labelCreated.innerHTML = api.formatDateToDisplay(new Date(post.creation));

  if (posting.localTimes) {
    posting.setLocalTime(labelCreated);
  }

  if (localStorage.relativeTime && JSON.parse(localStorage.relativeTime)) {
    posting.addRelativeTime(labelCreated);
  }

  postCell.getElementsByClassName('divMessage')[0].innerHTML = post.markdown;

  posting.setPostHideableElements(postCell, post, noExtras);

  posting.setPostComplexElements(postCell, post, boardUri, threadId, noExtras,
      preview);

  var messageLinks = postCell.getElementsByClassName('divMessage')[0]
      .getElementsByTagName('a');

  for (var i = 0; i < messageLinks.length; i++) {
    embed.processLinkForEmbed(messageLinks[i]);
  }

  var links = postCell.getElementsByClassName('imgLink');

  var temporaryImageLinks = [];

  for (i = 0; i < links.length; i++) {
    temporaryImageLinks.push(links[i]);
  }

  for (i = 0; i < temporaryImageLinks.length; i++) {
    thumbs.processImageLink(temporaryImageLinks[i]);
  }

  var shownFiles = postCell.getElementsByClassName('uploadCell');

  for (var i = 0; i < shownFiles.length; i++) {
    mediaHiding.processFileForHiding(shownFiles[i]);
  }

  var hiddenMedia = mediaHiding.getHiddenMedia();

  for (i = 0; i < hiddenMedia.length; i++) {
    mediaHiding.updateHiddenFiles(hiddenMedia[i], true);
  }

  postCell.setAttribute('data-boarduri', boardUri);

  if (noExtras) {
    return;
  }

  tooltips.addToKnownPostsForBackLinks(postCell);

  var quotes = postCell.getElementsByClassName('quoteLink');

  for (i = 0; i < quotes.length; i++) {
    tooltips.processQuote(quotes[i]);
  }

  var linkSelf = postCell.getElementsByClassName('linkSelf')[0];
  hiding.setHideMenu(linkSelf);
  postingMenu.setExtraMenu(linkSelf)

  if (api.threadId) {
    thread.processPostingQuote(postCell.getElementsByClassName('linkQuote')[0]);
  }

};

posting.addPost = function(post, boardUri, threadId, noExtra, preview) {

  var postCell = document.createElement('div');
  postCell.innerHTML = posting.postCellTemplate;

  postCell.id = post.postId;
  postCell.setAttribute('class', 'postCell');

  postCell.setAttribute('data-boarduri', boardUri);

  var labelBoard = postCell.getElementsByClassName('labelBoard')[0];

  if (preview) {
    labelBoard.innerHTML = '/' + boardUri + '/';
  } else {
    labelBoard.remove();
  }

  posting.setPostInnerElements(boardUri, threadId, post, postCell, noExtra,
      preview);

  return postCell;

};

posting.init();
