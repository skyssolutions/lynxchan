var bottomForms = {};

bottomForms.init = function() {

  var forms = document.getElementById('actionsForm');

  if (!forms) {
    forms = document.getElementById('bottomForms');
  }

  forms.classList.toggle('hidden');

  var showFormsButton = document.createElement('a');
  showFormsButton.innerHTML = 'Show forms';
  showFormsButton.id = 'showFormsButton';

  forms.parentElement.insertBefore(showFormsButton, forms);

  showFormsButton.onclick = function() {
    forms.classList.toggle('hidden');
    showFormsButton.remove();
  };

};

bottomForms.init();