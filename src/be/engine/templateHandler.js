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
var preBuiltDefault = {};
var preBuiltAlternative = {};

exports.simpleAttributes = [ 'download', 'style', 'value', 'name', 'checked' ];
exports.simpleProperties = [ 'href', 'title', 'src', 'defaultValue' ];
exports.dataAttributes = [ 'mime', 'height', 'width' ];

exports.getAlternativeTemplates = function(language) {

  var toReturn = preBuiltAlternative[language._id];

  if (!toReturn) {

    try {
      exports.loadTemplates(language);
      toReturn = preBuiltAlternative[language._id];
    } catch (error) {
      if (debug) {
        throw error;
      }
    }

  }

  return toReturn;

};

exports.getTemplates = function(language) {

  if (language) {
    return exports.getAlternativeTemplates(language) || preBuiltDefault;
  } else {
    return preBuiltDefault;
  }

};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;

};

exports.checkMainChildren = function(page, document) {

  var error = '';

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

  return error;

};

exports.testPagePrebuiltFields = function(dom, page, prebuiltObject) {

  var document = dom.window.document;

  if (!page.noTitle) {
    document.title = '__title__';
  }

  var error = exports.checkMainChildren(page, document);

  error += exports.loadPrebuiltFields(dom, document, prebuiltObject, page);

  return error;

};

exports.getPageDom = function(template, headerContent, footerContent) {

  var dom = new JSDOM(template);

  if (headerContent) {
    var headerElement = dom.window.document.getElementById('dynamicHeader');

    if (headerElement) {
      headerElement.innerHTML = headerContent;
    }
  }

  if (footerContent) {
    var footerElement = dom.window.document.getElementById('dynamicFooter');

    if (footerElement) {
      footerElement.innerHTML = footerContent;
    }
  }

  return dom;

};

exports.processPage = function(errors, page, fePath, templateSettings,
    prebuiltObject, headerContent, footerContent) {

  var fullPath = fePath + '/templates/';
  fullPath += templateSettings[page.template];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (error) {
    errors.push('\nError loading ' + page.template + '.');
    errors.push('\n' + error);

    return;
  }

  var error = exports.testPagePrebuiltFields(exports.getPageDom(template,
      headerContent, footerContent), page, prebuiltObject);

  if (error) {
    errors.push('\nPage ' + page.template + error);
  }

};

exports.loadPages = function(errors, fePath, templateSettings, prebuiltObject) {

  var headerContent;

  try {

    headerContent = fs.readFileSync(
        fePath + '/templates/' + templateSettings.header).toString();
  } catch (error) {
    headerContent = null;
  }

  var footerContent;

  try {

    footerContent = fs.readFileSync(
        fePath + '/templates/' + templateSettings.footer).toString();
  } catch (error) {
    footerContent = null;
  }

  for (var i = 0; i < exports.pageTests.length; i++) {

    var page = exports.pageTests[i];

    if (!templateSettings[page.template]) {
      errors.push('\nTemplate ' + page.template + ' is not defined.');

      continue;
    }

    exports.processPage(errors, page, fePath, templateSettings, prebuiltObject,
        headerContent, footerContent);

  }
};

exports.processComplexUses = function(document, element, field, use, removed) {

  switch (use) {

  case 'removal': {
    removed.push(field);
    break;
  }

  case 'children': {
    var text = '__' + field + '_children__';

    element.appendChild(document.createTextNode(text));
    break;
  }

  case 'inner': {
    element.innerHTML = '__' + field + '_inner__';
    break;
  }

  case 'class': {
    element.className += ' __' + field + '_class__';
    break;
  }

  default: {
    console.log('Unknown use ' + use);
  }

  }

};

exports.processFieldUses = function(field, removed, element, document) {

  if (typeof field.uses === 'string') {
    field.uses = [ field.uses ];
  }

  var name = field.name;

  for (var i = 0; i < field.uses.length; i++) {

    var use = field.uses[i];

    if (exports.simpleProperties.indexOf(use) > -1) {

      var value = '__' + name + '_' + use + '__';

      element[use] = value;

    } else if (exports.simpleAttributes.indexOf(use) > -1) {

      value = '__' + name + '_' + use + '__';

      element.setAttribute(use, value);

    } else if (exports.dataAttributes.indexOf(use) > -1) {

      value = '__' + name + '_' + use + '__';

      element.setAttribute('data-file' + use, value);

    } else {
      exports.processComplexUses(document, element, name, use, removed);
    }

  }

};

exports.handleRemovableFields = function(removed, cell, document, base) {

  var removable = {};

  for (var i = 0; i < removed.length; i++) {

    var element = cell ? base.getElementsByClassName(removed[i])[0] : document
        .getElementById(removed[i]);

    if (!element) {

      console.log('Warning: ' + removed[i] + ' could not be removed');

      continue;

    }

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
    } else {
      errors += '\nError, missing element ' + field.name;
    }

  }

  return errors;

};

exports.loadPrebuiltFields = function(dom, base, object, template, cell) {

  var removed = [];

  var document = dom.window.document;

  var error = template.prebuiltFields ? exports.iteratePrebuiltFields(template,
      base, document, removed, cell) : '';

  var removable = exports.handleRemovableFields(removed, cell, document, base);

  var toInsert = {
    template : cell ? base.innerHTML : dom.serialize(),
    removable : removable
  };

  object[template.template] = toInsert;

  return error;

};

exports.testCell = function(dom, cell, fePath, templateSettings, prebuiltObj) {

  var document = dom.window.document;

  var cellElement = document.createElement('div');

  var fullPath = fePath + '/templates/' + templateSettings[cell.template];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (thrownError) {
    return '\nError loading ' + cell.template + '.\n' + thrownError;
  }

  cellElement.innerHTML = template;

  if (cell.prebuiltFields) {
    var error = exports.loadPrebuiltFields(dom, cellElement, prebuiltObj, cell,
        true);
  }

  cellElement.remove();

  return error;
};

exports.loadCells = function(errors, fePath, templateSettings, prebuiltObject) {

  var dom = new JSDOM('<html></html>');

  for (var i = 0; i < exports.cellTests.length; i++) {

    var cell = exports.cellTests[i];

    if (!templateSettings[cell.template]) {
      errors.push('\nTemplate ' + cell.template + ' is not defined.');

      continue;
    }

    var error = exports.testCell(dom, cell, fePath, templateSettings,
        prebuiltObject);

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

  for (var i = 0; i < errors.length; i++) {

    var error = errors[i];

    console.log(error);

  }

  if (debug) {
    throw 'Fix the issues on the templates or run without debug mode';
  }

};

exports.runTemplateLoading = function(fePath, templateSettings,
    prebuiltTemplateObject) {

  var errors = [];

  exports.loadCells(errors, fePath, templateSettings, prebuiltTemplateObject);
  exports.loadPages(errors, fePath, templateSettings, prebuiltTemplateObject);

  exports.handleLoadingErrors(errors);

};

exports.loadTemplates = function(language) {

  if (!language) {
    var fePath = settingsHandler.getGeneralSettings().fePath;
    var templateSettings = settingsHandler.getTemplateSettings();
    var prebuiltTemplateObject = preBuiltDefault;
  } else {

    if (verbose) {
      console.log('Loading alternative front-end: ' + language.headerValues);
    }

    fePath = language.frontEnd;
    prebuiltTemplateObject = {};

    var finalPath = fePath + '/templateSettings.json';
    templateSettings = JSON.parse(fs.readFileSync(finalPath));

    preBuiltAlternative[language._id] = prebuiltTemplateObject;

  }

  exports.runTemplateLoading(fePath, templateSettings, prebuiltTemplateObject);

};

exports.dropAlternativeTemplates = function() {
  preBuiltAlternative = {};
};