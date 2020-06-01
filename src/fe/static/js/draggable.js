var draggable = {};

draggable.setDraggable = function(element, dragElement) {

  var dragglableInfo = {};

  var stopMoving = function() {

    if (!dragglableInfo.shouldMove) {
      return;
    }

    dragglableInfo.shouldMove = false
    draggable.lockedDrag = false

    var body = document.getElementsByTagName('body')[0];

    body.onmouseup = dragglableInfo.originalMouseUp;

  };

  var startMoving = function(evt) {

    if (dragglableInfo.shouldMove || draggable.lockedDrag) {
      return;
    }

    evt.preventDefault();

    draggable.lockedDrag = true;

    var body = document.getElementsByTagName('body')[0];

    dragglableInfo.originalMouseUp = body.onmouseup;

    body.onmouseup = function() {
      stopMoving();
    };

    dragglableInfo.shouldMove = true;

    evt = evt || window.event;

    var rect = element.getBoundingClientRect();

    dragglableInfo.diffX = evt.clientX - rect.left;
    dragglableInfo.diffY = evt.clientY - rect.top;

  };

  var move = function(evt) {

    if (!dragglableInfo.shouldMove) {
      return;
    }

    evt = evt || window.event;

    var newX = evt.clientX - dragglableInfo.diffX;
    var newY = evt.clientY - dragglableInfo.diffY;

    if (newX < 0) {
      newX = 0;
    }

    if (newY < 0) {
      newY = 0;
    }

    var upperXLimit = document.body.clientWidth - element.offsetWidth;

    if (newX > upperXLimit) {
      newX = upperXLimit;
    }

    var upperYLimit = window.innerHeight - element.offsetHeight;

    if (newY > upperYLimit) {
      newY = upperYLimit;
    }

    element.style.left = newX + 'px';
    element.style.top = newY + 'px';

  };

  dragElement.onmousedown = startMoving
  document.getElementsByTagName('body')[0].addEventListener('mousemove', move);

};