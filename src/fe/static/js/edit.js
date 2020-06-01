var edit = {};

edit.init = function() {

  api.convertButton('saveFormButton', edit.save);

  edit.messageLimit = +document.getElementById('labelMessageLength').innerHTML;
  api.boardUri = document.getElementById('boardIdentifier').value;

  var threadElement = document.getElementById('threadIdentifier');

  if (threadElement) {
    api.threadId = threadElement.value;
  } else {
    api.postId = document.getElementById('postIdentifier').value;
  }

};

edit.save = function() {

  var typedMessage = document.getElementById('fieldMessage').value.trim();

  var typedSubject = document.getElementById('fieldSubject').value.trim();

  if (typedSubject.length > 128) {
    alert('Subject too long, keep it under 128 characters.');
  } else if (!typedMessage.length) {
    alert('A message is mandatory.');
  } else if (typedMessage.length > edit.messageLimit) {
    alert('Message too long, keep it under ' + edit.messageLimit
        + ' characters.');
  } else {

    var parameters = {
      boardUri : api.boardUri,
      message : typedMessage,
      subject : typedSubject
    };

    if (api.postId) {
      parameters.postId = api.postId;
    } else {
      parameters.threadId = api.threadId;
    }

    api.formApiRequest('saveEdit', parameters, function requestComplete(status,
        data) {

      if (status === 'ok') {
        alert('Posting edited.');
      } else {
        alert(status + ': ' + JSON.stringify(data));
      }
    });

  }

};

edit.init();