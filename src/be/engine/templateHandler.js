'use strict';

// loads, tests and hands html templates

var fs = require('fs');
var cellsLocation = __dirname + '/../defaultCells.json';
exports.cellTests = JSON.parse(fs.readFileSync(cellsLocation, 'utf8'));
var pagesLocation = __dirname + '/../defaultPages.json';
exports.pageTests = JSON.parse(fs.readFileSync(pagesLocation, 'utf8'));
var debug = require('../kernel').debug();
var settingsHandler = require('../settingsHandler');
var verbose;
var JSDOM = require('jsdom').JSDOM;
var defaultTemplates = {};
var alternativeTemplates = {};
var preBuiltDefault = {};
var preBuiltAlternative = {};

var simpleAttributes = [ 'download', 'style', 'value', 'name', 'checked' ];
var simpleProperties = [ 'href', 'title', 'src' ];

require('jsdom').defaultDocumentFeatures = {
  FetchExternalResources : false,
  ProcessExternalResources : false,
  // someone said it might break stuff. If weird bugs, disable.
  MutationEvents : false
};

exports.getAlternativeTemplates = function(language, prebuilt) {

  var toReturn = prebuilt ? preBuiltAlternative[language._id]
      : alternativeTemplates[language._id];

  if (!toReturn) {

    try {
      exports.loadTemplates(language);
      toReturn = prebuilt ? preBuiltAlternative[language._id]
          : alternativeTemplates[language._id];
    } catch (error) {
      if (debug) {
        throw error;
      }
    }

  }

  return toReturn;

};

exports.getTemplates = function(language, preBuilt) {

  var defaultToUse = preBuilt ? preBuiltDefault : defaultTemplates;

  if (language) {

    return exports.getAlternativeTemplates(language, preBuilt) || defaultToUse;

  } else {
    return defaultToUse;
  }

};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();
  verbose = 1;// settings.verbose || settings.verboseMisc;

};

exports.testPagePrebuiltFields = function(dom, page, prebuiltObject) {

  var error = '';

  var document = dom.window.document;

  document.title = '__title__';

  if (page.headChildren) {
    var head = document.getElementsByTagName('head')[0];

    if (!head) {
      error += '\nError, missing head';
    } else {
      head.appendChild(document.createTextNode('__head_children__'));
    }
  }

  if (page.bodyChildren) {

    var body = document.getElementsByTagName('body')[0];

    if (!body) {
      error += '\nError, missing body';
    } else {
      document.getElementsByTagName('body')[0].appendChild(document
          .createTextNode('__body_children__'));
    }

  }

  error += exports.loadPrebuiltFields(dom, document, prebuiltObject, page);

  return error;

};

exports.testPageFields = function(dom, page, prebuiltObject, errors) {

  if (page.prebuiltFields) {
    return exports.testPagePrebuiltFields(dom, page, prebuiltObject);
  } else {

    var error = '';

    var document = dom.window.document;

    for (var j = 0; j < page.fields.length; j++) {

      var field = page.fields[j];

      if (!document.getElementById(field)) {
        error += '\nError, missing element with id ' + field;
      }

    }

    return error;
  }

};

exports.processPage = function(errors, page, fePath, templateSettings,
    templateObject, prebuiltObject) {

  var fullPath = fePath + '/templates/';
  fullPath += templateSettings[page.template];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (error) {
    errors.push('\nError loading ' + page.template + '.');
    errors.push('\n' + error);

    return;
  }

  templateObject[page.template] = template;

  var dom = new JSDOM(template);

  var error = exports.testPageFields(dom, page, prebuiltObject, errors);

  if (error.length) {
    errors.push('\nPage ' + page.template + error);
  }

};

exports.loadPages = function(errors, fePath, templateSettings, templateObject,
    prebuiltObject) {

  for (var i = 0; i < exports.pageTests.length; i++) {

    var page = exports.pageTests[i];

    if (!templateSettings[page.template]) {
      errors.push('\nTemplate ' + page.template + ' is not defined.');

      continue;
    }

    exports.processPage(errors, page, fePath, templateSettings, templateObject,
        prebuiltObject);

  }
};

exports.processFieldUses = function(field, removed, element, document) {

  for (var i = 0; field.uses && i < field.uses.length; i++) {

    if (simpleProperties.indexOf(field.uses[i]) > -1) {

      var value = '__' + field.name + '_' + field.uses[i] + '__';

      element[field.uses[i]] = value;

      continue;
    }

    switch (field.uses[i]) {

    case 'removal': {
      removed.push(field.name);
      break;
    }

    case 'children': {
      var text = '__' + field.name + '_children__';

      element.appendChild(document.createTextNode(text));
      break;
    }

    case 'inner': {
      element.innerHTML = '__' + field.name + '_inner__';
      break;
    }

    }

  }

};

exports.processFieldAttributes = function(element, field) {

  for (var i = 0; field.attributes && i < field.attributes.length; i++) {

    if (simpleAttributes.indexOf(field.attributes[i]) > -1) {

      var value = '__' + field.name + '_' + field.attributes[i] + '__';

      element.setAttribute(field.attributes[i], value);

      continue;
    }

    switch (field.attributes[i]) {

    case 'data-filemime': {
      element.setAttribute('data-filemime', '__' + field.name + '_mime__');
      break;
    }

    case 'data-fileheight': {
      element.setAttribute('data-fileheight', '__' + field.name + '_height__');
      break;
    }

    case 'data-filewidth': {
      element.setAttribute('data-filewidth', '__' + field.name + '_width__');
      break;
    }

    case 'class': {
      element.className += ' __' + field.name + '_class__';
      break;
    }

    }

  }

};

exports.handleRemovableFields = function(removed, cell, document, base) {

  var removable = {};

  for (var i = 0; i < removed.length; i++) {

    var element = cell ? base.getElementsByClassName(removed[i])[0] : document
        .getElementById(removed[i]);

    var textNode = document.createTextNode('__' + removed[i] + '_location__');

    element.parentNode.insertBefore(textNode, element);

    removable[removed[i]] = element.outerHTML;

    element.remove();

  }

  return removable;

};

exports.iteratePrebuiltFields = function(template, base, document, removed,
    cell) {

  var errors = '';

  for (var j = 0; j < template.prebuiltFields.length; j++) {

    var field = template.prebuiltFields[j];

    var element = null;

    if (cell) {
      element = base.getElementsByClassName(field.name)[0];
    } else {
      element = document.getElementById(field.name);
    }

    if (element) {
      exports.processFieldUses(field, removed, element, document);

      exports.processFieldAttributes(element, field);

    } else {
      errors += '\nError, missing element ' + field;
    }

  }

  return errors;

};

exports.loadPrebuiltFields = function(dom, base, object, template, cell) {

  var removed = [];

  var document = dom.window.document;

  var error = exports.iteratePrebuiltFields(template, base, document, removed,
      cell);

  var removable = exports.handleRemovableFields(removed, cell, document, base);

  var toInsert = {
    template : cell ? base.innerHTML : dom.serialize(),
    removable : removable
  };

  object[template.template] = toInsert;

  return error;

};

exports.getCellsErrors = function(cell, cellElement) {

  var error = '';

  for (var j = 0; j < cell.fields.length; j++) {

    var field = cell.fields[j];

    if (!cellElement.getElementsByClassName(field).length) {
      error += '\nError, missing element ' + field;
    } else if (cellElement.getElementsByClassName(field).length > 1) {
      error += '\nWarning, more than one element with class ' + field;
    }

  }

  return error;

};

exports.testCell = function(dom, cell, fePath, templateSettings,
    templateObject, prebuiltObject) {

  var document = dom.window.document;

  var cellElement = document.createElement('div');

  var fullPath = fePath + '/templates/' + templateSettings[cell.template];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (thrownError) {
    return '\nError loading ' + cell.template + '.\n' + thrownError;
  }

  templateObject[cell.template] = template;

  cellElement.innerHTML = template;

  if (cell.prebuiltFields) {
    var error = exports.loadPrebuiltFields(dom, cellElement, prebuiltObject,
        cell, true);
  } else {
    error = exports.getCellsErrors(cell, cellElement);
  }

  cellElement.remove();

  return error;
};

exports.loadCells = function(errors, fePath, templateSettings, templateObject,
    prebuiltObject) {

  var dom = new JSDOM('<html></html>');

  for (var i = 0; i < exports.cellTests.length; i++) {

    var cell = exports.cellTests[i];

    if (!templateSettings[cell.template]) {
      errors.push('\nTemplate ' + cell.template + ' is not defined.');

      continue;
    }

    var error = exports.testCell(dom, cell, fePath, templateSettings,
        templateObject, prebuiltObject);

    if (error.length) {
      errors.push('\nCell ' + cell.template + error);
    }
  }
};

exports.handleLoadingErrors = function(errors) {

  if (!errors.length) {
    return;
  }

  console.log('Were found issues with templates.');

  if (verbose) {

    for (var i = 0; i < errors.length; i++) {

      var error = errors[i];

      console.log(error);

    }
  } else {
    console.log('Enable verbose mode to output them.');
  }

  if (debug) {
    throw 'Fix the issues on the templates or run without debug mode';
  }

};

exports.runTemplateLoading = function(fePath, templateSettings, templateObject,
    prebuiltTemplateObject) {

  var errors = [];

  exports.loadCells(errors, fePath, templateSettings, templateObject,
      prebuiltTemplateObject);
  exports.loadPages(errors, fePath, templateSettings, templateObject,
      prebuiltTemplateObject);

  exports.handleLoadingErrors(errors);

};

exports.loadTemplates = function(language) {

  if (!language) {
    var fePath = settingsHandler.getGeneralSettings().fePath;
    var templateSettings = settingsHandler.getTemplateSettings();
    var templateObject = defaultTemplates;
    var prebuiltTemplateObject = preBuiltDefault;
  } else {

    if (verbose) {
      console.log('Loading alternative front-end: ' + language.headerValues);
    }

    fePath = language.frontEnd;
    templateObject = {};
    prebuiltTemplateObject = {};

    var finalPath = fePath + '/templateSettings.json';
    templateSettings = JSON.parse(fs.readFileSync(finalPath));

    alternativeTemplates[language._id] = templateObject;
    preBuiltAlternative[language._id] = prebuiltTemplateObject;

  }

  exports.runTemplateLoading(fePath, templateSettings, templateObject,
      prebuiltTemplateObject);

};

exports.dropAlternativeTemplates = function() {
  alternativeTemplates = {};
  preBuiltAlternative = {};
};