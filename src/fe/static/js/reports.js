var reports = {};

reports.closeReports = function() {

  var reportDiv = document.getElementById('reportDiv');

  var cells = [];

  var params = {
    duration : document.getElementById('fieldBanDuration').value,
    banReason : document.getElementById('fieldBanReason').value,
    banTarget : document.getElementById('banTargetCombo').selectedIndex,
    deleteContent : document.getElementById('deleteContentCheckbox').checked,
    closeAllFromReporter : document
        .getElementById('closeAllFromReporterCheckbox').checked
  };

  for (var i = 0; i < reportDiv.childNodes.length; i++) {

    var checkbox = reportDiv.childNodes[i]
        .getElementsByClassName('closureCheckbox')[0];

    if (checkbox.checked) {
      cells.push(reportDiv.childNodes[i]);
      params[checkbox.name] = true;
    }

  }

  api.formApiRequest('closeReports', params, function requestComplete(status,
      data) {

    if (status === 'ok') {

      for (i = 0; i < cells.length; i++) {
        reportDiv.removeChild(cells[i]);
      }

    } else {
      alert(status + ': ' + JSON.stringify(data));
    }
  });

};

api.convertButton('closeReportsFormButton', reports.closeReports,
    'closeReportsField');