var accountManagement = {};

accountManagement.init = function() {

  api.convertButton('deleteAccountFormButton', accountManagement.deleteAccount,
      'deleteAccountField');

};

accountManagement.deleteAccount = function() {

  var confirmed = document.getElementById('confirmationCheckbox').checked;

  if (!confirmed) {
    alert('You must confirm that you wish to delete this account.');
  } else {

    api.formApiRequest('deleteAccount', {
      confirmation : confirmed,
      account : document.getElementById('userIdentifier').value
    }, function requestComplete(status, data) {

      if (status === 'ok') {
        window.location = '/accounts.js';
      } else {
        alert(status + ': ' + JSON.stringify(data));
      }
    });

  }

};

accountManagement.init();