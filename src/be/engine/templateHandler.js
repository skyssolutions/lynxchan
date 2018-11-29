'use strict';

// loads, tests and hands html templates

var fs = require('fs');
var cellsLocation = __dirname + '/../data/defaultCells.json';
exports.cellTests = JSON.parse(fs.readFileSync(cellsLocation, 'utf8'));
var pagesLocation = __dirname + '/../data/defaultPages.json';
exports.pageTests = JSON.parse(fs.readFileSync(pagesLocation, 'utf8'));
var debug = require('../kernel').debug();
var settingsHandler = require('../settingsHandler');
var verbose;
var parser = require('parse5');
var preBuiltDefault = {};
var preBuiltAlternative = {};

exports.simpleAttributes = {
  'download' : true,
  'style' : true,
  'value' : true,
  'name' : true,
  'checked' : true,
  'href' : true,
  'title' : true,
  'src' : true,
  'defaultValue' : true,
  'accept' : true
};

exports.dataAttributes = {
  'mime' : true,
  'height' : true,
  'width' : true
};

exports.mappedTags = {
  'body' : true,
  'head' : true,
  'title' : true
};

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

exports.setInner = function(element, text) {

  if (!element) {
    return;
  }

  var fragment = parser.parseFragment(element, text);

  element.childNodes = [];

  for (var i = 0; i < fragment.childNodes.length; i++) {
    var childElement = fragment.childNodes[i];

    childElement.parentNode = element;

    element.childNodes.push(childElement);

  }

};

exports.setAttribute = function(element, name, value, append) {

  element.attrs = element.attrs || [];

  var foundAttr;

  for (var i = 0; i < element.attrs.length; i++) {

    if (element.attrs[i].name === name) {
      foundAttr = element.attrs[i];
      break;
    }

  }

  if (!foundAttr) {
    foundAttr = {
      name : name
    };
    element.attrs.push(foundAttr);
  }

  if (append && foundAttr.value) {
    foundAttr.value += value;
  } else {
    foundAttr.value = value;
  }

};

exports.processAttributes = function(element, field, use) {

  if (exports.simpleAttributes[use]) {
    exports.setAttribute(element, use, '__' + field + '_' + use + '__');
  } else if (exports.dataAttributes[use]) {

    var value = '__' + field + '_' + use + '__';
    exports.setAttribute(element, 'data-file' + use, value);

  } else {
    console.log('Unknown use ' + use);
  }

};

exports.processFieldUses = function(field, uses, removed, element) {

  if (typeof (uses) === 'string') {
    uses = [ uses ];
  }

  for (var i = 0; i < uses.length; i++) {

    var use = uses[i];

    switch (use) {

    case 'removal': {
      removed.push(field);
      break;
    }

    case 'children': {

      element.childNodes.push({
        nodeName : '#text',
        value : '__' + field + '_children__',
        parentNode : element
      });

      break;
    }

    case 'inner': {
      exports.setInner(element, '__' + field + '_inner__');
      break;
    }

    case 'class': {
      exports.setAttribute(element, 'class', ' __' + field + '_class__', true);
      break;
    }

    default: {
      exports.processAttributes(element, field, use);
    }

    }

  }

};

exports.handleRemovableFields = function(removed, map) {

  var removable = {};

  for (var i = 0; i < removed.length; i++) {

    var element = map[removed[i]];

    if (!element) {
      console.log('Warning: ' + removed[i] + ' could not be removed');
      continue;
    }

    var parent = element.parentNode;
    var index = parent.childNodes.indexOf(element);

    removable[removed[i]] = parser.serialize({
      childNodes : [ element ]
    });

    parent.childNodes.splice(index, 1, {
      nodeName : '#text',
      value : '__' + removed[i] + '_location__',
      parentNode : parent
    });

  }

  return removable;

};

exports.iteratePrebuiltFields = function(uses, removed, map) {

  var errors = '';

  for ( var field in uses) {

    var element = map[field];

    if (element) {
      exports.processFieldUses(field, uses[field].uses, removed, element);
    } else if (!uses[field].optional) {
      errors += '\nError, missing element ' + field;
    }

  }

  return errors;

};

exports.loadPrebuiltFields = function(dom, object, page, map) {

  var removed = [];

  var error = page.prebuiltFields ? exports.iteratePrebuiltFields(
      page.prebuiltFields, removed, map) : '';

  var removable = exports.handleRemovableFields(removed, map);

  var toInsert = {
    template : parser.serialize(dom),
    removable : removable
  };

  object[page.template] = toInsert;

  return error;

};

exports.testCell = function(cell, fePath, templateSettings, prebuiltObj) {

  var fullPath = fePath + '/templates/' + templateSettings[cell.template];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (thrownError) {
    return '\nError loading ' + cell.template + '.\n' + thrownError;
  }

  var dom = parser.parse(template.toString('utf8'));

  var map = {};
  exports.mapElement(dom.childNodes, map, cell.prebuiltFields, true);

  var error = exports.loadPrebuiltFields(dom, prebuiltObj, cell, map);

  return error;
};

exports.loadCells = function(errors, fePath, templateSettings, prebuiltObject) {

  for (var i = 0; i < exports.cellTests.length; i++) {

    var cell = exports.cellTests[i];

    if (!templateSettings[cell.template]) {
      errors.push('\nTemplate ' + cell.template + ' is not defined.');

      continue;
    }

    var error = exports
        .testCell(cell, fePath, templateSettings, prebuiltObject);

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

exports.cellMap = function(value, element, map, uses) {

  value.split(' ').map(function(className) {

    className = className.trim();

    if (uses[className]) {
      map[className] = element;
    }
  });

};

exports.mapElement = function(childNodes, map, uses, cell) {

  if (!childNodes) {
    return;
  }

  for (var i = 0; i < childNodes.length; i++) {

    var element = childNodes[i];

    if (!cell && exports.mappedTags[element.nodeName]) {
      map[element.nodeName] = element;
    }

    var attrs = element.attrs || [];

    for (var j = 0; j < attrs.length; j++) {

      var attr = attrs[j];

      if (cell && attr.name === 'class') {
        exports.cellMap(attr.value, element, map, uses);
      } else if (attr.name === 'id' && uses[attr.value]) {
        map[attr.value] = element;
      }

    }

    exports.mapElement(element.childNodes, map, uses, cell);

  }

};

exports.checkMainChildren = function(page, document, map) {

  var error = '';

  if (page.headChildren) {

    var head = map.head;

    if (!head) {
      error += '\nError, missing head';
    } else {

      map.head.childNodes.push({
        nodeName : '#text',
        value : '__head_children__',
        parentNode : map.head
      });

    }
  }

  if (page.bodyChildren) {

    var body = map.body;

    if (!body) {
      error += '\nError, missing body';
    } else {

      map.body.childNodes.push({
        nodeName : '#text',
        value : '__body_children__',
        parentNode : map.body
      });

    }
  }

  return error;

};

exports.setTitleToken = function(map, page) {

  if (page.noTitle || !map.head) {
    return;
  }

  if (!map.title) {

    var titleElement = {
      nodeName : 'title',
      tagName : 'title',
      attrs : [],
      childNodes : [],
      parentNode : map.head
    };

    map.head.childNodes.push(titleElement);

    map.title = titleElement;

  }

  exports.setInner(map.title, '__title__');

};

exports.testPagePrebuiltFields = function(template, headerContent,
    footerContent, page, prebuiltObject) {

  var map = {};

  var document = parser.parse(template.toString('utf8'));

  page.prebuiltFields = page.prebuiltFields || {};

  page.prebuiltFields.dynamicHeader = {
    optional : true,
    uses : 'inner'
  };

  page.prebuiltFields.dynamicFooter = {
    optional : true,
    uses : 'inner'
  };

  exports.mapElement(document.childNodes, map, page.prebuiltFields);

  exports.setInner(map.dynamicHeader, headerContent);
  exports.setInner(map.dynamicFooter, footerContent);

  exports.setTitleToken(map, page);

  var error = exports.checkMainChildren(page, document, map);

  error += exports.loadPrebuiltFields(document, prebuiltObject, page, map);

  if (prebuiltObject[page.template]) {

    var entry = prebuiltObject[page.template];

    entry.template = entry.template.replace('__dynamicHeader_inner__',
        headerContent).replace('__dynamicFooter_inner__', footerContent);

  }

  return error;

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

  var error = exports.testPagePrebuiltFields(template, headerContent,
      footerContent, page, prebuiltObject);

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