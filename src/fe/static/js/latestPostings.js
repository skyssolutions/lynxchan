var latestPostings = {};

api.mod = true;

latestPostings.init = function() {

  latestPostings.postsDiv = document.getElementById('divPostings');

  var moreButton = document.getElementById('buttonLoadMore');
  moreButton.className = '';
  moreButton.onclick = latestPostings.loadMore;

  var parts = document.getElementById('linkNext').href.split('?')[1].split('&');

  var args = {};

  for (var i = 0; i < parts.length; i++) {
    var subParts = parts[i].split('=');

    args[subParts[0]] = subParts[1];
  }

  latestPostings.latestCheck = new Date(+args.date);

};

latestPostings.loadMore = function(event) {

  event.preventDefault();

  api.formApiRequest('latestPostings', {}, function gotData(status, data) {

    if (status !== 'ok') {
      return;
    }

    if (data.length) {
      latestPostings.latestCheck = new Date(data[0].creation);
    }

    for (var i = data.length - 1; i >= 0; i--) {

      var post = data[i];

      var cell = posting.addPost(post, post.boardUri, post.threadId, false,
          true);

      latestPostings.postsDiv.insertBefore(cell,
          latestPostings.postsDiv.childNodes[0]);

    }

  }, true, {
    date : latestPostings.latestCheck.getTime(),
    boards : document.getElementById('fieldBoards').value
  });

};

latestPostings.init();