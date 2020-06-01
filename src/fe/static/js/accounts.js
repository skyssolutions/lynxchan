var accounts = {};

accounts.init = function() {

  accounts.divAccounts = document.getElementById('divAccounts');

  api.convertButton('addAccountFormButton', accounts.addAccount,
      'addAccountField');

};

accounts.addAccount = function() {

  var typedLogin = document.getElementById('fieldLogin').value.trim();
  var typedPassword = document.getElementById('fieldPassword').value;
  var typedEmail = document.getElementById('fieldEmail').value;

  if (!typedLogin.length || !typedPassword.length) {
    alert('Both login and password are mandatory.');
  } else if (typedLogin.length > 16) {
    alert('Login too long, keep it under 16 characters.');
  } else if (/\W/.test(typedLogin)) {
    alert('Invalid login.');
  } else {

    api.formApiRequest('addAccount', {
      login : typedLogin,
      password : typedPassword,
      email : typedEmail
    }, function requestComplete(status, data) {

      if (status === 'ok') {

        var newLink = document.createElement('a');
        newLink.innerHTML = typedLogin;
        newLink.href = '/accountManagement.js?account=' + typedLogin;
        accounts.divAccounts.appendChild(newLink);

        document.getElementById('fieldLogin').value = '';
        document.getElementById('fieldPassword').value = '';
        document.getElementById('fieldEmail').value = '';

      } else {
        alert(status + ': ' + JSON.stringify(data));
      }
    });

  }

};

accounts.init();