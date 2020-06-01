var mediaManagement = {};

mediaManagement.init = function() {

  api.convertButton('deleteFormButton', mediaManagement.deleteMedia);

  document.getElementById('selectAllButton').className = '';

};

mediaManagement.selectAll = function() {

  var checkBoxes = document.getElementsByClassName('identifierCheckbox');

  for (var i = 0; i < checkBoxes.length; i++) {
    checkBoxes[i].checked = true;
  }

}

mediaManagement.deleteMedia = function() {

  var checkBoxes = document.getElementsByClassName('identifierCheckbox');

  var params = {
    reason : (document.getElementById('reasonField') || {}).value,
    ban : (document.getElementById('banCheckbox') || {}).checked,
    text : document.getElementById('massTextField').value
  };

  for (var i = 0; i < checkBoxes.length; i++) {
    if (checkBoxes[i].checked) {
      params[checkBoxes[i].name] = true;
    }
  }

  api.formApiRequest('deleteMedia', params,
      function deletedMedia(status, data) {

        if (status === 'ok') {

          if (params.text) {
            return location.reload(true);
          }

          for (var i = checkBoxes.length - 1; i > -1; i--) {
            if (checkBoxes[i].checked) {
              checkBoxes[i].parentNode.parentNode.remove();
            }
          }

        } else {
          alert(status + ': ' + JSON.stringify(data));
        }

      });

};

mediaManagement.init();