var themes = {};

themes.init = function() {

  themes.themes = [ {
    label : 'Clear',
    id : 'clear'
  } ];

  var postingLink = document.getElementById('navPosting');

  if (postingLink) {

    var referenceNode = postingLink.nextSibling;

    postingLink.parentNode.insertBefore(document.createTextNode(' '),
        referenceNode);

    var divider = document.createElement('span');
    divider.innerHTML = '/';
    postingLink.parentNode.insertBefore(divider, referenceNode);

    postingLink.parentNode.insertBefore(document.createTextNode(' '),
        referenceNode);

    var themeSelector = document.createElement('select');
    themeSelector.id = 'themeSelector';

    var vanillaOption = document.createElement('option');
    vanillaOption.innerHTML = 'Default';
    themeSelector.appendChild(vanillaOption);

    for (var i = 0; i < themes.themes.length; i++) {

      var theme = themes.themes[i];

      var themeOption = document.createElement('option');
      themeOption.innerHTML = theme.label;

      if (theme.id === localStorage.selectedTheme) {
        themeOption.selected = true;
      }

      themeSelector.appendChild(themeOption);

    }

    themeSelector.onchange = function() {

      if (!themeSelector.selectedIndex) {

        if (localStorage.selectedTheme) {
          delete localStorage.selectedTheme;
          themeLoader.load();
        }

        return;
      }

      var selectedTheme = themes.themes[themeSelector.selectedIndex - 1];

      if (selectedTheme.id === localStorage.selectedTheme) {
        return;
      }

      localStorage.selectedTheme = selectedTheme.id;

      themeLoader.load();

    };

    postingLink.parentNode.insertBefore(themeSelector, referenceNode);

  }

};

themes.init();