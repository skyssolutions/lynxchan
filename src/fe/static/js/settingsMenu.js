var settingsMenu = {};

settingsMenu.init = function() {

  settingsMenu.loadedFilters = JSON.parse(localStorage.filterData || '[]');
  settingsMenu.filterTypes = [ 'Name', 'Tripcode', 'Subject', 'Message', 'Id' ];

  var settingsMenuDiv = document.createElement('div');

  settingsMenu.placeNavBarButton(settingsMenuDiv);

  var settingsMenuHeader = document.createElement('div');
  settingsMenuHeader.className = 'header';
  settingsMenuDiv.appendChild(settingsMenuHeader);

  var settingsMenuLabel = document.createElement('label');
  settingsMenuLabel.innerHTML = 'Settings';
  settingsMenuLabel.className = 'headerLabel';

  settingsMenuHeader.appendChild(settingsMenuLabel);

  settingsMenu.showingSettings = false;

  var closeSettingsMenuButton = document.createElement('span');
  closeSettingsMenuButton.id = 'closeSettingsMenuButton';
  closeSettingsMenuButton.className = 'coloredIcon glowOnHover';
  closeSettingsMenuButton.onclick = function() {

    if (!settingsMenu.showingSettings) {
      return;
    }

    settingsMenu.showingSettings = false;
    settingsMenuDiv.style.display = 'none';

  };

  settingsMenuHeader.appendChild(closeSettingsMenuButton);

  settingsMenuDiv.appendChild(document.createElement('hr'));

  settingsMenuDiv.id = 'settingsMenu';
  settingsMenuDiv.className = 'floatingMenu';
  settingsMenuDiv.style.display = 'none';

  document.body.appendChild(settingsMenuDiv);

  draggable.setDraggable(settingsMenuDiv, settingsMenuHeader);

  settingsMenu.tabsDiv = document.createElement('div');
  settingsMenuDiv.appendChild(settingsMenu.tabsDiv);

  settingsMenu.menuContentPanel = document.createElement('div');
  settingsMenuDiv.appendChild(settingsMenu.menuContentPanel);

  settingsMenu.registerTab('Filters', settingsMenu.getFiltersContent(), true);
  settingsMenu.registerTab('CSS', settingsMenu.getCSSContent());
  settingsMenu.registerTab('JS', settingsMenu.getJSContent());
  settingsMenu.registerTab('Other', settingsMenu.getOtherContent());

};

settingsMenu.selectSettingsPanel = function(tab, panel) {

  if (tab === settingsMenu.currentSettingsTab) {
    return;
  }

  if (settingsMenu.currentSettingsTab) {
    settingsMenu.currentSettingsTab.id = '';
    settingsMenu.currentSettingsPanel.remove();
  }

  settingsMenu.menuContentPanel.appendChild(panel);
  tab.id = 'selectedTab';

  settingsMenu.currentSettingsPanel = panel;
  settingsMenu.currentSettingsTab = tab;

};

settingsMenu.registerTab = function(text, content, select) {

  var newTab = document.createElement('span');
  newTab.innerHTML = text;
  newTab.className = 'settingsTab';
  newTab.onclick = function() {
    settingsMenu.selectSettingsPanel(newTab, content);
  };
  settingsMenu.tabsDiv.appendChild(newTab);

  if (select) {
    newTab.onclick();
  }

};

settingsMenu.placeNavBarButton = function(settingsMenuDiv) {

  var postingLink = document.getElementById('navPosting');
  var referenceNode = postingLink.nextSibling;

  postingLink.parentNode.insertBefore(document.createTextNode(' '),
      referenceNode);

  var divider = document.createElement('span');
  divider.innerHTML = '/';
  postingLink.parentNode.insertBefore(divider, referenceNode);

  postingLink.parentNode.insertBefore(document.createTextNode(' '),
      referenceNode);

  var settingsButton = document.createElement('a');
  settingsButton.id = 'settingsButton';
  settingsButton.className = 'coloredIcon';
  postingLink.parentNode.insertBefore(settingsButton, referenceNode);

  settingsButton.onclick = function() {

    if (settingsMenu.showingSettings) {
      return;
    }

    settingsMenu.showingSettings = true;
    settingsMenuDiv.style.display = 'block';

  }

};

settingsMenu.addFilterDisplay = function(filter) {

  var filterCell = document.createElement('div');

  var cellWrapper = document.createElement('div');
  settingsMenu.existingFiltersDiv.appendChild(cellWrapper);

  var filterTypeLabel = document.createElement('span');
  filterTypeLabel.innerHTML = settingsMenu.filterTypes[filter.type];
  filterTypeLabel.className = 'existingFilterTypeLabel';
  filterCell.appendChild(filterTypeLabel);

  var filterContentLabel = document.createElement('span');
  var contentToDisplay = filter.filter;
  if (filter.regex) {
    contentToDisplay = '/' + contentToDisplay + '/';
  }
  filterContentLabel.innerHTML = contentToDisplay;
  filterContentLabel.className = 'existingFilterContentLabel';
  filterCell.appendChild(filterContentLabel);

  var button = document.createElement('span');
  button.className = 'filterDeleteButton glowOnHover coloredIcon';
  filterCell.appendChild(button);

  button.onclick = function() {

    settingsMenu.loadedFilters.splice(settingsMenu.loadedFilters
        .indexOf(filter), 1);

    localStorage.filterData = JSON.stringify(settingsMenu.loadedFilters);

    hiding.checkFilters();

    cellWrapper.remove();

  };

  cellWrapper.appendChild(document.createElement('hr'));
  cellWrapper.appendChild(filterCell);

};

settingsMenu.createFilter = function(content, regex, type) {

  var newFilterData = {
    filter : content,
    regex : regex,
    type : type
  };

  settingsMenu.addFilterDisplay(newFilterData);

  settingsMenu.loadedFilters.push(newFilterData);

  localStorage
      .setItem('filterData', JSON.stringify(settingsMenu.loadedFilters));

  hiding.checkFilters();

};

settingsMenu.getFiltersContent = function() {

  var filtersPanel = document.createElement('div');

  var newFilterPanel = document.createElement('span');
  newFilterPanel.id = 'newFilterPanel';

  filtersPanel.appendChild(newFilterPanel);

  var newFilterTypeCombo = document.createElement('select');

  for (var i = 0; i < 4; i++) {

    var option = document.createElement('option');
    option.innerHTML = settingsMenu.filterTypes[i];
    newFilterTypeCombo.appendChild(option);
  }

  newFilterPanel.appendChild(newFilterTypeCombo);

  var newFilterField = document.createElement('input');
  newFilterField.type = 'text';
  newFilterField.placeholder = 'filter';
  newFilterPanel.appendChild(newFilterField);

  var regexLabel = document.createElement('label');
  regexLabel.innerHTML = 'Regex';
  regexLabel.className = 'settingsLabel';
  newFilterPanel.appendChild(regexLabel);

  var newFilterRegex = document.createElement('input');
  newFilterRegex.type = 'checkbox';
  newFilterPanel.appendChild(newFilterRegex);

  var newFilterButton = document.createElement('button');
  newFilterButton.innerHTML = 'Add filter';
  newFilterButton.onclick = function() {

    var filterContent = newFilterField.value.trim();

    if (!filterContent) {
      return;
    }

    settingsMenu.createFilter(filterContent, newFilterRegex.checked,
        newFilterTypeCombo.selectedIndex);

  };
  newFilterPanel.appendChild(newFilterButton);

  var existingFiltersLabelsPanel = document.createElement('div');
  filtersPanel.appendChild(existingFiltersLabelsPanel);

  var labelType = document.createElement('label');
  labelType.innerHTML = 'Type';
  labelType.id = 'labelExistingFilfterType';
  existingFiltersLabelsPanel.appendChild(labelType);

  var labelContent = document.createElement('label');
  labelContent.innerHTML = 'Content';
  labelContent.id = 'labelExistingFilfterContent';
  existingFiltersLabelsPanel.appendChild(labelContent);

  settingsMenu.existingFiltersDiv = document.createElement('div');
  settingsMenu.existingFiltersDiv.id = 'existingFiltersPanel';
  filtersPanel.appendChild(settingsMenu.existingFiltersDiv);

  for (var i = 0; i < settingsMenu.loadedFilters.length; i++) {
    settingsMenu.addFilterDisplay(settingsMenu.loadedFilters[i]);
  }

  return filtersPanel;

};

settingsMenu.getCSSContent = function() {

  var savedCSS = localStorage.customCSS;

  var head = document.getElementsByTagName('head')[0];

  var newCSS = document.createElement('style');

  head.appendChild(newCSS);

  if (savedCSS) {
    newCSS.innerHTML = savedCSS;
  }

  var cssPanel = document.createElement('div');

  var cssArea = document.createElement('textarea');
  cssPanel.appendChild(cssArea);
  if (savedCSS) {
    cssArea.value = savedCSS;
  }
  cssArea.id = 'cssInput';

  var bottomDiv = document.createElement('div');
  cssPanel.appendChild(bottomDiv);

  var saveButton = document.createElement('button');
  saveButton.innerHTML = 'Save';
  bottomDiv.appendChild(saveButton);

  saveButton.onclick = function() {
    newCSS.innerHTML = cssArea.value.trim();
    localStorage.customCSS = newCSS.innerHTML;
  };

  return cssPanel;

};

settingsMenu.getOtherContent = function() {

  var otherPanel = document.createElement('div');

  var localDiv = document.createElement('div');
  otherPanel.appendChild(localDiv);

  var localCheckBox = document.createElement('input');
  localCheckBox.type = 'checkbox';
  localDiv.appendChild(localCheckBox);
  localCheckBox.checked = JSON.parse(localStorage.localTime || 'false');

  var localLabel = document.createElement('label');
  localLabel.className = 'small';
  localLabel.innerHTML = 'Local Times';
  localDiv.appendChild(localLabel);

  var relativeDiv = document.createElement('div');
  otherPanel.appendChild(relativeDiv);

  var relativeCheckBox = document.createElement('input');
  relativeCheckBox.type = 'checkbox';
  relativeDiv.appendChild(relativeCheckBox);
  relativeCheckBox.checked = JSON.parse(localStorage.relativeTime || 'false');

  var relativeLabel = document.createElement('label');
  relativeLabel.className = 'small';
  relativeLabel.innerHTML = 'Relative Times';
  relativeDiv.appendChild(relativeLabel);

  var noAutoLoopiv = document.createElement('div');
  otherPanel.appendChild(noAutoLoopiv);

  var noAutoLoopCheckBox = document.createElement('input');
  noAutoLoopCheckBox.type = 'checkbox';
  noAutoLoopiv.appendChild(noAutoLoopCheckBox);
  noAutoLoopCheckBox.checked = JSON.parse(localStorage.noAutoLoop || 'false');

  var noAutoLoopLabel = document.createElement('label');
  noAutoLoopLabel.className = 'small';
  noAutoLoopLabel.innerHTML = 'No Autoloop';
  noAutoLoopiv.appendChild(noAutoLoopLabel);

  var saveButton = document.createElement('button');
  otherPanel.appendChild(saveButton);
  saveButton.innerHTML = 'Save';

  saveButton.onclick = function() {
    localStorage.setItem('localTime', localCheckBox.checked);
    localStorage.setItem('relativeTime', relativeCheckBox.checked);
    localStorage.setItem('noAutoLoop', noAutoLoopCheckBox.checked);
  }

  return otherPanel;

};

settingsMenu.getJSContent = function() {

  var savedJS = localStorage.customJS;

  if (savedJS) {
    var head = document.getElementsByTagName('head')[0];

    var newJS = document.createElement('script');

    head.appendChild(newJS);
    newJS.innerHTML = savedJS;
  }

  var jsPanel = document.createElement('div');

  var jsArea = document.createElement('textarea');
  jsPanel.appendChild(jsArea);
  if (savedJS) {
    jsArea.value = savedJS;
  }
  jsArea.id = 'jsInput';

  var bottomDiv = document.createElement('div');
  jsPanel.appendChild(bottomDiv);

  var saveButton = document.createElement('button');
  saveButton.innerHTML = 'Save';
  bottomDiv.appendChild(saveButton);

  saveButton.onclick = function() {
    localStorage.customJS = jsArea.value.trim();
  };

  return jsPanel;

};

settingsMenu.init();