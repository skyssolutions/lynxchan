var sideCatalog = {};

sideCatalog.init = function() {

  sideCatalog.sideCatalogBody = document.getElementById('sideCatalogBody');

  sideCatalog.sideCatalogDiv = document.getElementById('sideCatalogDiv');

  if (!localStorage.hideSideCatalog) {
    sideCatalog.sideCatalogDiv.style.display = 'block';
  }

  sideCatalog.refreshSideCatalog();

  document.getElementById('closeSideCatalogButton').onclick = function() {
    sideCatalog.sideCatalogDiv.style.display = 'none';
    localStorage.setItem('hideSideCatalog', true);
  }

  var catalogButton = document.getElementById('navCatalog');

  var sideCatalogButton = document.createElement('a');
  sideCatalogButton.className = 'coloredIcon';
  sideCatalogButton.id = 'navSideCatalog';
  sideCatalogButton.onclick = function() {
    sideCatalog.sideCatalogDiv.style.display = 'block';
    localStorage.removeItem('hideSideCatalog');
  };

  catalogButton.parentNode.insertBefore(sideCatalogButton,
      catalogButton.nextSibling);

  catalogButton.parentNode.insertBefore(document.createTextNode(' '),
      catalogButton.nextSibling);

  var divider = document.createElement('span');
  divider.innerHTML = '/';
  catalogButton.parentNode.insertBefore(divider, catalogButton.nextSibling);

  catalogButton.parentNode.insertBefore(document.createTextNode(' '),
      catalogButton.nextSibling);

};

sideCatalog.removeAllFromClass = function(className) {

  var elements = document.getElementsByClassName(className);

  while (elements.length) {
    elements[0].remove();
  }

};

sideCatalog.handleReceivedData = function(data, cell, threadData) {

  sideCatalog.loadingThread = false;

  if (thread.autoRefresh) {
    thread.currentRefresh = 5;
  }

  sideCatalog.transitionThread(cell, threadData, data);

  tooltips.cacheData(data);

};

sideCatalog.loadThread = function(cell, threadData) {

  sideCatalog.loadingThread = true;

  if (api.mod) {

    api.formApiRequest('mod', {}, function(status, data) {

      if (status !== 'ok') {
        return;
      }

      sideCatalog.handleReceivedData(data, cell, threadData);

    }, false, {
      boardUri : api.boardUri,
      threadId : threadData.threadId
    });

  } else {

    api.localRequest('/' + api.boardUri + '/res/' + threadData.threadId
        + '.json', function(error, data) {

      if (error) {
        alert(error);
      }

      sideCatalog.handleReceivedData(JSON.parse(data), cell, threadData);

    });
  }

};

sideCatalog.getRangePanel = function() {

  var rangePanel = document.createElement('span');
  rangePanel.className = 'panelRange';
  rangePanel.innerHTML = 'Broad range(1/2 octets): '

  var broadRangeLabel = document.createElement('span');
  broadRangeLabel.className = 'labelBroadRange';

  rangePanel.appendChild(broadRangeLabel);

  rangePanel.appendChild(document.createElement('br'));

  rangePanel.appendChild(document.createTextNode('Narrow range(3/4 octets):'));

  var narrowRangeLabel = document.createElement('span');
  narrowRangeLabel.className = 'labelNarrowRange';

  rangePanel.appendChild(narrowRangeLabel);

  rangePanel.appendChild(document.createElement('br'));

  return rangePanel;

};

sideCatalog.createHistoryLinks = function(cell) {

  var referenceElement = cell.getElementsByClassName('panelBacklinks')[0];

  var historyLink = document.createElement('a');
  historyLink.innerHTML = '[History]';
  historyLink.className = 'linkHistory';

  var fileHistoryLink = document.createElement('a');
  fileHistoryLink.innerHTML = ' [File history]';
  fileHistoryLink.className = 'linkFileHistory';

  var offenseHistoryLink = document.createElement('a');
  offenseHistoryLink.innerHTML = '[Offense record]';
  offenseHistoryLink.className = 'linkOffenseRecord';

  referenceElement.parentNode.insertBefore(historyLink, referenceElement);
  referenceElement.parentNode.insertBefore(document.createTextNode(' '),
      referenceElement);
  referenceElement.parentNode.insertBefore(fileHistoryLink, referenceElement);
  referenceElement.parentNode.insertBefore(document.createTextNode(' '),
      referenceElement);
  referenceElement.parentNode
      .insertBefore(offenseHistoryLink, referenceElement);
  referenceElement.parentNode.insertBefore(document.createTextNode(' '),
      referenceElement);

};

sideCatalog.transitionThread = function(cell, threadData, data) {

  if (sideCatalog.selectedThreadCell) {
    sideCatalog.selectedThreadCell.className = 'sideCatalogCell';
  }

  sideCatalog.selectedThreadCell = cell;

  sideCatalog.selectedThreadCell.className = 'sideCatalogMarkedCell';

  tooltips.knownPosts = {};
  window.history.pushState('', '',
      document.getElementById('divMod') ? '/mod.js?boardUri=' + api.boardUri
          + '&threadId=' + threadData.threadId : '/' + api.boardUri + '/res/'
          + threadData.threadId + '.html');

  document.getElementById('threadIdentifier').value = threadData.threadId;

  if (document.getElementById('divMod')) {

    document.getElementById('controlThreadIdentifier').value = threadData.threadId;

    if (postingMenu.globalRole <= 3) {
      document.getElementById('transferThreadIdentifier').value = threadData.threadId;
    }

    document.getElementById('checkboxLock').checked = threadData.locked;
    document.getElementById('checkboxPin').checked = threadData.pinned;
    document.getElementById('checkboxCyclic').checked = threadData.cyclic;

  }

  document.title = '/' + api.boardUri + '/ - '
      + (threadData.subject || threadData.message);

  var opCell = document.getElementsByClassName('opCell')[0];

  opCell.scrollIntoView();

  document.getElementsByClassName('divPosts')[0].innerHTML = '';

  opCell.id = threadData.threadId;
  opCell.className = 'opCell';

  if (!opCell.getElementsByClassName('labelSubject').length) {

    var newSubjectLabel = document.createElement('span');
    newSubjectLabel.className = 'labelSubject';

    var watchButton = document.getElementsByClassName('watchButton')[0];
    watchButton.parentNode.insertBefore(newSubjectLabel,
        watchButton.nextSibling);
    watchButton.parentNode.insertBefore(document.createTextNode(' '),
        watchButton.nextSibling);

  }

  var divMessage = document.getElementsByClassName('divMessage')[0];

  if (!opCell.getElementsByClassName('labelLastEdit').length) {

    var newBanMessageLabel = document.createElement('div');
    newBanMessageLabel.className = 'labelLastEdit';

    divMessage.parentNode.insertBefore(newBanMessageLabel,
        divMessage.nextSibling);

  }

  if (!opCell.getElementsByClassName('linkHistory')[0]) {
    sideCatalog.createHistoryLinks(opCell);
  }

  var panelIp = opCell.getElementsByClassName('panelIp')[0];

  if (!panelIp) {

    var emptyPanel = document.getElementsByClassName('panelIpContainer')[0];

    panelIp = document.createElement('span');
    panelIp.className = 'panelIp';

    panelIp.appendChild(sideCatalog.getRangePanel());

    panelIp.appendChild(document.createTextNode('Ip: '));

    var newIpLabel = document.createElement('span');
    newIpLabel.className = 'labelIp';
    panelIp.appendChild(newIpLabel);

    emptyPanel.appendChild(panelIp);

  } else if (!opCell.getElementsByClassName('panelRange').length) {
    panelIp.insertBefore(sideCatalog.getRangePanel(), panelIp.childNodes[0]);
  }

  var panelBypassId = opCell.getElementsByClassName('panelBypassId')[0];

  if (!panelBypassId) {

    console.log('inserting bypass id panel');

    panelBypassId = document.createElement('div');
    panelBypassId.className = 'panelBypassId';

    var labelBypassId = document.createElement('span');
    labelBypassId.className = 'labelBypassId';

    panelBypassId.appendChild(document.createTextNode('Bypass Id: '));
    panelBypassId.appendChild(labelBypassId);

    panelIp.parentNode.insertBefore(panelBypassId, panelIp);

  }

  var panelASN = opCell.getElementsByClassName('panelASN')[0];

  if (!panelASN) {

    panelASN = document.createElement('div');
    panelASN.className = 'panelASN';

    var labelASN = document.createElement('span');
    labelASN.className = 'labelASN';

    panelASN.appendChild(document.createTextNode('ASN: '));
    panelASN.appendChild(labelASN);

    panelBypassId.parentNode.insertBefore(panelASN, panelBypassId);

  }

  if (!opCell.getElementsByClassName('imgFlag').length) {

    var newFlagImage = document.createElement('img');
    newFlagImage.className = 'imgFlag';

    var linkName = document.getElementsByClassName('linkName')[0];
    linkName.parentNode.insertBefore(newFlagImage, linkName.nextSibling);
    linkName.parentNode.insertBefore(document.createTextNode(' '),
        linkName.nextSibling);

  }

  if (!opCell.getElementsByClassName('labelRole').length) {

    var newLabelRole = document.createElement('span');
    newLabelRole.className = 'labelRole';

    var flagImage = document.getElementsByClassName('imgFlag')[0];
    flagImage.parentNode.insertBefore(newLabelRole, flagImage.nextSibling);
    flagImage.parentNode.insertBefore(document.createTextNode(' '),
        flagImage.nextSibling);

  }

  if (!opCell.getElementsByClassName('divBanMessage').length) {

    var newBanMessageLabel = document.createElement('div');
    newBanMessageLabel.className = 'divBanMessage';

    divMessage.parentNode.insertBefore(newBanMessageLabel,
        divMessage.nextSibling);

  }

  if (!opCell.getElementsByClassName('spanId').length) {

    var newSpanId = document.createElement('span');
    newSpanId.className = 'spanId';

    newSpanId.innerHTML = 'Id:';

    var newLabelId = document.createElement('span');
    newLabelId.className = 'labelId';
    newSpanId.appendChild(newLabelId);

    var labelCreated = document.getElementsByClassName('labelCreated')[0];
    labelCreated.parentNode.insertBefore(newSpanId, labelCreated.nextSibling);
    labelCreated.parentNode.insertBefore(document.createTextNode(' '),
        labelCreated.nextSibling);

  }

  if (!opCell.getElementsByClassName('opUploadPanel').length) {

    var newOpUploadPanel = document.createElement('div');
    newOpUploadPanel.className = 'panelUploads opUploadPanel';

    var innerOP = opCell.getElementsByClassName('innerOP')[0];
    innerOP.insertBefore(newOpUploadPanel, innerOP.children[0]);

  }

  document.getElementsByClassName('opUploadPanel')[0].innerHTML = '';

  document.getElementsByClassName('opHead')[0]
      .getElementsByClassName('deletionCheckBox')[0].value = api.boardUri + '-'
      + threadData.threadId;

  sideCatalog.removeAllFromClass('extraMenuButton');
  sideCatalog.removeAllFromClass('hideMenu');
  sideCatalog.removeAllFromClass('quoteTooltip');
  sideCatalog.removeAllFromClass('extraMenu');
  sideCatalog.removeAllFromClass('hideButton');
  sideCatalog.removeAllFromClass('watchButton');
  sideCatalog.removeAllFromClass('relativeTime');
  sideCatalog.removeAllFromClass('unhideButton');

  api.resetIndicators(data);

  document.getElementsByClassName('panelBacklinks')[0].innerHTML = '';

  thread.fullRefresh = true;

  thread.initThread();

  gallery.galleryFiles = [];
  gallery.currentIndex = 0;

  posting.setPostInnerElements(api.boardUri, api.threadId, data, opCell);

  watcher.processOP(document.getElementsByClassName('innerOP')[0]);

  if (data.posts && data.posts.length) {

    thread.lastReplyId = data.posts[data.posts.length - 1].postId;

    for (var i = 0; i < data.posts.length; i++) {
      thread.divPosts.appendChild(posting.addPost(data.posts[i], api.boardUri,
          api.threadId));
    }

  }

  hiding.checkFilters();

};

sideCatalog.addSideCatalogThread = function(thread) {

  var cell = document.createElement('a');

  cell.onclick = function() {

    if (sideCatalog.loadingThread || thread.threadId === api.threadId
        || sideCatalog.waitingForRefreshData) {
      return;
    } else if (thread.refreshingThread) {
      sideCatalog.waitingForRefreshData = {
        cell : cell,
        thread : thread
      };

      return;
    }

    sideCatalog.loadThread(cell, thread);

  };

  if (thread.thumb) {

    var img = document.createElement('img');

    img.src = thread.thumb;

    cell.appendChild(img);
  }

  var linkContent = document.createElement('span');
  linkContent.className = 'sideCatalogCellText';
  cell.appendChild(linkContent);

  var upperText = document.createElement('span');
  var lowerText = document.createElement('span');

  linkContent.appendChild(upperText);
  linkContent.appendChild(lowerText);

  upperText.innerHTML = (thread.subject || (thread.message.replace(/[<>'"]/g,
      function(match) {
        return api.htmlReplaceTable[match];
      }).substring(0, 128) || thread.threadId));

  lowerText.innerHTML = 'R: ' + (thread.postCount || 0) + ' / F: '
      + (thread.fileCount || 0);

  sideCatalog.sideCatalogBody.appendChild(cell);

  if (api.threadId === thread.threadId) {
    cell.className = 'sideCatalogMarkedCell';
    cell.scrollIntoView();
    sideCatalog.selectedThreadCell = cell;
  } else {
    cell.className = 'sideCatalogCell';
  }

};

sideCatalog.processCatalogData = function(data) {

  sideCatalog.sideCatalogBody.innerHTML = '';

  var boardData = hiding.storedHidingData[api.boardUri];

  for (var i = 0; i < data.length; i++) {

    var thread = data[i];

    if ((boardData && boardData.threads.indexOf(thread.threadId.toString()) > -1)) {
      continue;
    }

    sideCatalog.addSideCatalogThread(thread);
  }

};

sideCatalog.refreshSideCatalog = function() {

  if (sideCatalog.refreshingSideCatalog) {
    return;
  }

  sideCatalog.refreshingSideCatalog = true;

  api.localRequest('/' + api.boardUri + '/catalog.json', function(error, data) {

    sideCatalog.refreshingSideCatalog = false;

    if (error) {
      return;
    }

    sideCatalog.processCatalogData(JSON.parse(data));

  });

};

if (!api.mobile) {
  sideCatalog.init();
}