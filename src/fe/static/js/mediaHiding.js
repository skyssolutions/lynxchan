var mediaHiding = {};

mediaHiding.init = function() {

  mediaHiding.hiddenMediaRelation = {};

  var shownFiles = document.getElementsByClassName('uploadCell');

  for (var i = 0; i < shownFiles.length; i++) {
    mediaHiding.processFileForHiding(shownFiles[i]);
  }

  var hiddenMedia = mediaHiding.getHiddenMedia();

  for (i = 0; i < hiddenMedia.length; i++) {
    mediaHiding.updateHiddenFiles(hiddenMedia[i], true);
  }

};

mediaHiding.getHiddenMedia = function() {

  var hiddenMedia = localStorage.hiddenMedia;

  if (hiddenMedia) {
    hiddenMedia = JSON.parse(hiddenMedia);
  } else {
    hiddenMedia = [];
  }

  return hiddenMedia;

};

mediaHiding.updateHiddenFiles = function(file, hiding) {

  var mediaObject = mediaHiding.hiddenMediaRelation[file] || [];

  for (var i = 0; i < mediaObject.length; i++) {

    var element = mediaObject[i];

    element.button.classList.toggle('hiddenFile', hiding);

    if (element.element.style.display === 'none' && hiding) {

      var hideLinkList = element.element.parentNode
          .getElementsByClassName('hideLink');

      if (hideLinkList.length) {
        hideLinkList[0].onclick();
      }
    }

    element.element.style.display = hiding ? 'none' : 'inline';
  }

};

mediaHiding.processFileForHiding = function(file) {

  var nameLink = file.getElementsByClassName('nameLink')[0];

  var hidingButton = document.createElement('a');
  hidingButton.className = 'hideFileButton glowOnHover coloredIcon';

  var fileName = nameLink.href.split('/');
  fileName = fileName[fileName.length - 1];

  var mediaObject = mediaHiding.hiddenMediaRelation[fileName] || [];

  mediaObject.push({
    button : hidingButton,
    element : file.getElementsByClassName('imgLink')[0]
  });

  mediaHiding.hiddenMediaRelation[fileName] = mediaObject;

  hidingButton.onclick = function() {

    var hiddenMedia = mediaHiding.getHiddenMedia();

    var alreadyHidden = hiddenMedia.indexOf(fileName) > -1;

    if (alreadyHidden) {
      hiddenMedia.splice(hiddenMedia.indexOf(fileName), 1);
    } else {
      hiddenMedia.push(fileName);
    }

    localStorage.hiddenMedia = JSON.stringify(hiddenMedia);

    mediaHiding.updateHiddenFiles(fileName, !alreadyHidden);

  };

  nameLink.parentNode.insertBefore(hidingButton, nameLink.nextSibling);

};

mediaHiding.init();