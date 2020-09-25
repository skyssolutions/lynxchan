'use strict';

// loads, tests and hands html templates

var fs = require('fs');
var cellsLocation = __dirname + '/../data/defaultCells.json';
exports.cellTests = JSON.parse(fs.readFileSync(cellsLocation, 'utf8'));
var pagesLocation = __dirname + '/../data/defaultPages.json';
exports.pageTests = JSON.parse(fs.readFileSync(pagesLocation, 'utf8'));
var settingsHandler = require('../settingsHandler');
var verbose;
var lang;
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
      if (verbose) {
        console.log(error);
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

exports.loadDependencies = function() {

  lang = require('./langOps').languagePack;

};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;

};

exports.handleLoadingErrors = function(errors) {

  if (!errors.length) {
    return;
  }

  console.log('Issues were found  with the templates.');

  for (var i = 0; i < errors.length; i++) {

    var error = errors[i];

    console.log(error);

  }

};

// Section 1: DOM manipulation {
exports.setInner = function(element, text) {

  if (!element) {
    return;
  }

  var fragment = parser.parseFragment(element, text);

  element.childNodes = fragment.childNodes;

  for (var i = 0; i < element.childNodes; i++) {
    element.childNodes[i].parentNode = element;
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
// } Section 1: DOM manipulation

// Section 2: Tokenizer {
exports.processAttributes = function(element, field, use) {

  if (exports.simpleAttributes[use]) {
    exports.setAttribute(element, use, '__' + field + '_' + use + '__');
  } else if (exports.dataAttributes[use]) {

    var value = '__' + field + '_' + use + '__';
    exports.setAttribute(element, 'data-file' + use, value);

  } else if ('defaultValue' === use) {
    exports.setInner(element, '__' + field + '_defaultValue__');
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
      exports.processFieldUses(field, uses[field], removed, element);
    } else {
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
// } Section 2: Tokenizer

// Section 3: Mapping {
exports.cellMap = function(value, element, map, uses) {

  value.split(' ').map(function(className) {

    className = className.trim();

    if (uses[className] && !map[className]) {
      map[className] = element;
    }
  });

};

exports.mapElements = function(childNodes, map, uses, cell) {

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
      } else if (attr.name === 'id' && uses[attr.value] && !map[attr.value]) {
        map[attr.value] = element;
      }

    }

    exports.mapElements(element.childNodes, map, uses, cell);

  }

};

exports.startMapping = function(optional, childNodes, map, uses, cell) {

  exports.mapElements(childNodes, map, optional, cell);

  for ( var entry in optional) {

    var element = map[entry];

    if (!element) {
      continue;
    }

    exports.setInner(element, optional[entry]);

  }

  exports.mapElements(childNodes, map, uses, cell);

};
// } Section 3: Mapping

// Section 4: Cells {
exports.processCell = function(cell, fePath, templateSettings, prebuiltObj) {

  var fullPath = fePath + '/templates/' + templateSettings[cell.template];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (error) {
    return '\nError loading ' + cell.template + '.\n' + error;
  }

  var dom = parser.parse(template.toString('utf8'));

  for (var i = 0; i < dom.childNodes[0].childNodes.length; i++) {
    var child = dom.childNodes[0].childNodes[i];

    if (child.tagName === 'body') {
      dom = child;
      break;
    }

  }

  var map = {};
  exports.startMapping(templateSettings.optionalContent, dom.childNodes, map,
      cell.prebuiltFields, true);

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

    var error = exports.processCell(cell, fePath, templateSettings,
        prebuiltObject);

    if (error.length) {
      errors.push('\nCell ' + cell.template + error);
    }

  }

};
// } Section 4: Cells

// Section 5: Pages {
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

exports.processPage = function(page, fePath, templateSettings, prebuiltObject) {

  var fullPath = fePath + '/templates/' + templateSettings[page.template];

  try {
    var template = fs.readFileSync(fullPath);
  } catch (error) {
    return '\nError loading ' + page.template + '.\n' + error;
  }

  var map = {};

  var document = parser.parse(template.toString('utf8'));

  page.prebuiltFields = page.prebuiltFields || {};

  exports.startMapping(templateSettings.optionalContent, document.childNodes,
      map, page.prebuiltFields);

  exports.setTitleToken(map, page);

  var error = exports.checkMainChildren(page, document, map);

  error += exports.loadPrebuiltFields(document, prebuiltObject, page, map);

  return error;

};

exports.loadPages = function(errors, fePath, templateSettings, prebuiltObject) {

  for (var i = 0; i < exports.pageTests.length; i++) {

    var page = exports.pageTests[i];

    if (!templateSettings[page.template]) {
      errors.push('\nTemplate ' + page.template + ' is not defined.');

      continue;
    }

    var error = exports.processPage(page, fePath, templateSettings,
        prebuiltObject);

    if (error.length) {
      errors.push('\nPage ' + page.template + error);
    }

  }

};
// } Section 5: Pages

exports.loadTemplated = function(fePath, templateSettings, prebuilt, language) {

  prebuilt.templated = {};

  if (!templateSettings.templated || !require('cluster').isMaster) {
    return;
  }

  var templated = templateSettings.templated;

  for (var i = 0; i < templated.length; i++) {
    var entry = templated[i];

    try {

      var content = fs.readFileSync(fePath + '/static/' + entry, 'utf8');

      var dom = parser.parse(content);
    } catch (error) {
      console.log('Failed to load templated file ' + entry);
      continue;
    }

    if (dom.childNodes.length > 1) {

      exports.startMapping(templateSettings.optionalContent, dom.childNodes,
          {}, {});

      content = parser.serialize(dom);

    }

    prebuilt.templated[entry] = {
      data : Buffer.from(exports.translatePage(language, content), 'utf-8'),
      stats : {
        mtime : new Date()
      }
    };

  }

};

exports.runTemplateLoading = function(fePath, templateSettings, prebuilt,
    language) {

  var errors = [];

  var opt = templateSettings.optional || {};
  var optContent = {};
  templateSettings.optionalContent = optContent;

  for ( var entry in opt) {

    try {
      optContent[entry] = fs.readFileSync(fePath + '/templates/' + opt[entry],
          'utf8');
    } catch (error) {
      errors.push('\nFailed to load ' + entry + '.\n' + error);
    }

  }

  exports.loadTemplated(fePath, templateSettings, prebuilt, language);
  exports.loadCells(errors, fePath, templateSettings, prebuilt);
  exports.loadPages(errors, fePath, templateSettings, prebuilt);

  exports.handleLoadingErrors(errors);

};

exports.translatePage = function(language, content) {

  return content.replace(/\$\w+/g, function(match) {
    return lang(language)[match.substring(1)] || match;
  });

};

exports.translate = function(language, object) {

  for ( var key in object) {

    if (key !== 'templated') {

      object[key].template = exports.translatePage(language,
          object[key].template);

    }

  }

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

  exports.runTemplateLoading(fePath, templateSettings, prebuiltTemplateObject,
      language);

  exports.translate(language, prebuiltTemplateObject);

};

exports.dropAlternativeTemplates = function() {
  preBuiltAlternative = {};
};