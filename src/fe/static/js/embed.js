var embed = {};

embed.init = function() {

  var messageElements = document.getElementsByClassName("divMessage");

  for (var i = 0; i < messageElements.length; ++i) {
    var linkElements = messageElements[i].getElementsByTagName("a");

    for (var j = 0; j < linkElements.length; ++j)
      embed.processLinkForEmbed(linkElements[j]);
  }

};

embed.processLinkForEmbed = function(linkElement) {

  var url = linkElement.href;
  var domain = embed.getDomain(url);

  if (!domain) {
    return;
  }

  var domainSrcFunction = embed.domainFunctionMap[domain];

  if (!domainSrcFunction) {
    return;

  }

  var embedSrc = domainSrcFunction(url);

  if (!embedSrc) {
    return;
  }

  linkElement.parentNode.insertBefore(embed.buildEmbed(650, 350, embedSrc),
      linkElement.nextSibling);

};

embed.buildEmbed = function(width, height, src) {

  var html = '<iframe';
  html += ' width="' + width + '"';
  html += ' height="' + height + '"';
  html += ' src="' + src + '"';
  html += ' frameborder="0"';
  html += ' allowfullscreen';
  html += '></iframe>';

  var wrapperElement = document.createElement('div');
  wrapperElement.style.display = 'inline';

  var divElement = document.createElement('div');
  divElement.style.display = 'none';

  var buttonElement = document.createElement('span');
  buttonElement.innerHTML = '[Embed]';
  buttonElement.className = 'embedButton glowOnHover';

  buttonElement.onclick = function() {
    if (divElement.style.display === 'none') {
      divElement.style.display = 'block';
      divElement.innerHTML = html;
      buttonElement.innerHTML = '[Remove]';
    }

    else {
      divElement.style.display = 'none';
      divElement.innerHTML = null;
      buttonElement.innerHTML = '[Embed]';
    }
  };

  // note: append order
  wrapperElement.appendChild(buttonElement);
  wrapperElement.appendChild(divElement);

  return wrapperElement;

};

// substrings to the first occurrence of an input string if present
embed.getUntil = function(string, input) {

  var inputIndex = string.indexOf(input);

  return inputIndex !== -1 ? string.substring(0, inputIndex) : string;

};

embed.getDomain = function(url) {

  var match = url.match(/\b(?!www.)\b([a-z0-9]+\.)*[a-z0-9]+\.[a-z]+/i);

  if (!match) {
    return;
  }

  return match[0];
};

embed.getSrcYouTubeCommon = function(url, secure, domain) {

  var videoId = url.split('v=')[1];

  if (!videoId) {
    return;
  }

  videoId = embed.getUntil(videoId, '&');

  var embedSrc = secure ? 'https' : 'http';
  embedSrc += '://' + domain + '/embed/' + videoId;

  var startTime = embed.getYouTubeStartTime(url);

  if (startTime) {
    embedSrc += '?start=' + startTime;
  }

  return embedSrc;

};

embed.getSrcYouTube = function(url) {
  return embed.getSrcYouTubeCommon(url, true, 'www.youtube.com');
};

embed.getSrcInvidious = function(url) {
  return embed.getSrcYouTubeCommon(url, true, 'www.invidio.us');
};

embed.getSrcYouTubeShortened = function(url) {

  var videoId = url.split('/')[3];

  if (!videoId) {
    return;
  }

  // trim any params in the url
  videoId = embed.getUntil(videoId, '?');

  var embedSrc = 'https://www.youtube.com/embed/' + videoId;

  var startTime = embed.getYouTubeStartTime(url);

  if (startTime) {
    embedSrc += '?start=' + startTime;
  }

  return embedSrc;

};

embed.getSrcBitChute = function(url) {

  if (!url.includes('/video/')) {
    return;
  }

  var videoId = url.split('/')[4];

  if (!videoId) {
    return;
  }

  return 'https://www.bitchute.com/embed/' + videoId;

};

embed.getSrcLiveLeak = function(url) {

  var videoId = url.split('t=')[1];

  if (!videoId) {
    return;
  }

  return 'https://www.liveleak.com/e/' + embed.getUntil(videoId, '&');

};

// translate ?t=XhXmXs to raw seconds (the only input supported by youtube's
// embed start time)
// todo: recode with loop
embed.getYouTubeStartTime = function(url) {

  var startTime = url.split('t=')[1];

  if (!startTime) {
    return;
  }

  startTime = embed.getUntil(startTime, '&');

  var totalSeconds = 0;

  var hours = startTime.match(/(\d+)(?:h)/);

  if (hours) {
    totalSeconds += parseInt(hours[1]) * 3600;
  }

  var minutes = startTime.match(/(\d+)(?:m)/);

  if (minutes) {
    totalSeconds += parseInt(minutes[1]) * 60;
  }

  var seconds = startTime.match(/(\d+)(?:s)/);

  if (seconds) {
    totalSeconds += parseInt(seconds[1]);
  }

  return totalSeconds;

};

embed.domainFunctionMap = {};

embed.domainFunctionMap['youtube.com'] = embed.getSrcYouTube;
embed.domainFunctionMap['youtu.be'] = embed.getSrcYouTubeShortened;
embed.domainFunctionMap['invidio.us'] = embed.getSrcInvidious;
embed.domainFunctionMap['bitchute.com'] = embed.getSrcBitChute;
embed.domainFunctionMap['liveleak.com'] = embed.getSrcLiveLeak;

embed.init();