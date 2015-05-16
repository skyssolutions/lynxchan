//starting point for deciding what to do with an incoming request.

exports.handle = function(req, res) {

  res.writeHead(200);
  res.end('Locked and loaded\n');
};