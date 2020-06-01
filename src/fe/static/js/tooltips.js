var tooltips = {};

tooltips.init = function() {

  tooltips.bottomMargin = 25;
  tooltips.loadingPreviews = {};
  tooltips.loadedContent = {};
  tooltips.quoteReference = {};
  tooltips.knownPosts = {};
  tooltips.knownData = {};

  var posts = document.getElementsByClassName('postCell');

  for (var i = 0; i < posts.length; i++) {
    tooltips.addToKnownPostsForBackLinks(posts[i])
  }

  var threads = document.getElementsByClassName('opCell');

  for (i = 0; i < threads.length; i++) {
    tooltips.addToKnownPostsForBackLinks(threads[i])
  }

  tooltips.cacheExistingHTML('innerOP');
  tooltips.cacheExistingHTML('innerPost');

  var quotes = document.getElementsByClassName('quoteLink');

  for (i = 0; i < quotes.length; i++) {
    tooltips.processQuote(quotes[i]);
  }

};

tooltips.cacheExistingHTML = function(className) {

  var innerContent = document.getElementsByClassName(className);

  for (var i = 0; i < innerContent.length; i++) {

    var inner = innerContent[i];

    var temp = document.createElement('div');
    temp.className = 'innerPost';
    temp.innerHTML = inner.innerHTML;

    var deletionCheckBox = temp.getElementsByClassName('deletionCheckBox')[0];

    if (deletionCheckBox) {
      deletionCheckBox.remove();
    }

    var quoteLink = temp.getElementsByClassName('linkSelf')[0];
    tooltips.loadedContent[quoteLink.href] = temp.outerHTML;
  }

};

tooltips.addToKnownPostsForBackLinks = function(posting) {

  var postBoard = posting.dataset.boarduri;

  var list = tooltips.knownPosts[postBoard] || {};
  tooltips.knownPosts[postBoard] = list;

  list[posting.id] = {
    added : [],
    container : posting.getElementsByClassName('panelBacklinks')[0]
  };

};

tooltips.addBackLink = function(quoteUrl, quote) {

  var matches = quoteUrl.match(/\/(\w+)\/res\/(\d+)\.html\#(\d+)/);

  var board = matches[1];
  var thread = matches[2];
  var post = matches[3];

  var knownBoard = tooltips.knownPosts[board];

  if (knownBoard) {

    var knownBackLink = knownBoard[post];

    if (knownBackLink) {

      var containerPost = quote.parentNode.parentNode;

      while (!containerPost.classList.contains('postCell')
          && !containerPost.classList.contains('opCell')) {
        containerPost = containerPost.parentNode;
      }

      var sourceBoard = containerPost.dataset.boarduri;
      var sourcePost = containerPost.id;

      var sourceId = sourceBoard + '_' + sourcePost;

      if (knownBackLink.added.indexOf(sourceId) > -1) {
        return;
      } else {
        knownBackLink.added.push(sourceId);
      }

      var innerHTML = '>>';

      if (sourceBoard != board) {
        innerHTML += '/' + containerPost.dataset.boarduri + '/';
      }

      innerHTML += sourcePost;

      var backLink = document.createElement('a');
      backLink.innerHTML = innerHTML;

      var backLinkUrl = '/' + sourceBoard + '/res/' + thread + '.html#'
          + sourcePost;

      backLink.href = backLinkUrl;

      knownBackLink.container.appendChild(backLink);

      knownBackLink.container.appendChild(document.createTextNode(' '));

      tooltips.processQuote(backLink, true);

    }

  }

};

tooltips.checkHeight = function(tooltip) {

  var windowHeight = document.documentElement.clientHeight + window.scrollY;

  if (tooltip.offsetHeight + tooltip.offsetTop + tooltips.bottomMargin > windowHeight) {
    tooltip.style.top = (windowHeight - tooltip.offsetHeight - tooltips.bottomMargin)
        + 'px';
  }

}

tooltips.processQuote = function(quote, backLink) {

  var tooltip;

  var quoteUrl = quote.href;

  if (!backLink) {
    tooltips.addBackLink(quoteUrl, quote);
  }

  quote.onmouseenter = function() {

    tooltip = document.createElement('div');
    tooltip.className = 'quoteTooltip';

    document.body.appendChild(tooltip);

    var rect = quote.getBoundingClientRect();

    var previewOrigin = {
      x : rect.right + 10 + window.scrollX,
      y : rect.top + window.scrollY
    };

    tooltip.style.left = previewOrigin.x + 'px';
    tooltip.style.top = previewOrigin.y + 'px';
    tooltip.style.display = 'inline';

    if (tooltips.loadedContent[quoteUrl]) {
      tooltip.innerHTML = tooltips.loadedContent[quoteUrl];

      tooltips.checkHeight(tooltip);

    } else {
      tooltip.innerHTML = 'Loading';
    }

    if (!tooltips.loadedContent[quoteUrl]
        && !tooltips.loadingPreviews[quoteUrl]) {
      tooltips.loadQuote(tooltip, quoteUrl);
    }

    if (!api.isBoard) {
      var matches = quote.href.match(/\#(\d+)/);

      quote.onclick = function() {
        thread.markPost(matches[1]);
      };
    }

  };

  quote.onmouseout = function() {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  };

};

tooltips.generateHTMLFromData = function(postingData, tooltip, quoteUrl) {

  if (!postingData) {
    tooltip.innerHTML = 'Not found';
    return;
  }

  var tempDiv = posting.addPost(postingData, postingData.boardUri,
      postingData.threadId, true).getElementsByClassName('innerPost')[0];

  tempDiv.getElementsByClassName('deletionCheckBox')[0].remove();

  tooltip.innerHTML = tempDiv.outerHTML;

  tooltips.checkHeight(tooltip);

  tooltips.loadedContent[quoteUrl] = tempDiv.outerHTML;

};

tooltips.cacheData = function(threadData) {

  for (var i = 0; i < threadData.posts.length; i++) {
    var postData = threadData.posts[i];
    tooltips.knownData[threadData.boardUri + '/' + postData.postId] = postData;
  }

  tooltips.knownData[threadData.boardUri + '/' + threadData.threadId] = threadData;

};

tooltips.loadQuote = function(tooltip, quoteUrl) {

  var matches = quoteUrl.match(/\/(\w+)\/res\/(\d+)\.html\#(\d+)/);

  var board = matches[1];
  var thread = +matches[2];
  var post = +matches[3];

  var postingData = tooltips.knownData[board + '/' + post];

  if (postingData) {
    tooltips.generateHTMLFromData(postingData, tooltip, quoteUrl);
    return;
  }

  var threadUrl = '/' + board + '/res/' + thread + '.json';

  tooltips.loadingPreviews[quoteUrl] = true;

  api.localRequest(threadUrl, function receivedData(error, data) {

    delete tooltips.loadingPreviews[quoteUrl];

    if (error) {
      tooltip.innerHTML = 'Not found';
      return;
    }

    tooltips.cacheData(JSON.parse(data));

    tooltips.generateHTMLFromData(tooltips.knownData[board + '/' + post],
        tooltip, quoteUrl);

  });

};

tooltips.init();