var bannerManagement = {};

bannerManagement.init = function() {

  if (document.getElementById('boardIdentifier')) {
    api.boardUri = document.getElementById('boardIdentifier').value;
  }

  api.convertButton('addFormButton', bannerManagement.addBanner);

  var bannersDiv = document.getElementById('bannersDiv');

  for (var j = 0; j < bannersDiv.childNodes.length; j++) {
    bannerManagement.processBannerCell(bannersDiv.childNodes[j]);
  }

  bannerManagement.bannersDiv = bannersDiv;

};

bannerManagement.processBannerCell = function(cell) {

  var button = cell.getElementsByClassName('deleteFormButton')[0];

  api.convertButton(button, function() {
    bannerManagement.removeBanner(cell);
  });

};

bannerManagement.showNewBanner = function(data) {

  var form = document.createElement('form');
  form.className = 'bannerCell';
  form.action = '/deleteBanner.js';
  form.method = 'post';
  form.enctype = 'multipart/form-data';

  var img = document.createElement('img');
  img.className = 'bannerImage';
  img.src = data.path;
  form.appendChild(img);

  form.appendChild(document.createElement('br'));

  var identifier = document.createElement('input');
  identifier.name = 'bannerId';
  identifier.className = 'bannerIdentifier';
  identifier.value = data.id;
  identifier.type = 'hidden';
  form.appendChild(identifier);

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'deleteFormButton';
  button.innerHTML = 'Delete banner';
  form.appendChild(button);

  form.appendChild(document.createElement('hr'));

  bannerManagement.bannersDiv.appendChild(form);

  bannerManagement.processBannerCell(form);

};

bannerManagement.addBanner = function() {

  var filePicker = document.getElementById('files');

  var files = [];

  for (var i = 0; i < filePicker.files.length; i++) {
    files.push({
      content : filePicker.files[i]
    });
  }

  if (!files.length) {
    alert('You must select a file');
    return;
  }

  api.formApiRequest('createBanners', {
    files : files,
    boardUri : api.boardUri,
  }, function requestComplete(status, data) {

    if (status === 'ok') {

      filePicker.type = 'text';
      filePicker.type = 'file';

      for (var i = 0; i < data.length; i++) {
        bannerManagement.showNewBanner(data[i]);
      }

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

bannerManagement.removeBanner = function(cell) {

  api.formApiRequest('deleteBanner', {
    bannerId : cell.getElementsByClassName('bannerIdentifier')[0].value,
  }, function requestComplete(status, data) {

    if (status === 'ok') {
      cell.remove();
    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

bannerManagement.init();