var uuidv4 = require('uuid').v4;
var WebSocketServer = require('ws').Server;
var http = require('http');
var express = require('express');
var app = express();
var port = process.env.PORT || 8080;

app.use(express.static(__dirname + '/public/'));

var server = http.createServer(app);
server.listen(port);

console.log('http server listening on %d', port);

// var wss = new WebSocketServer({server: server});
// console.log('websocket server created');

// wss.on('connection', function(ws) {
//   var id = setInterval(function() {
//     ws.send(JSON.stringify(new Date()), function() {  });
//   }, 1000);

//   console.log('websocket connection open');

//   ws.on('close', function() {
//     console.log('websocket connection close');
//     clearInterval(id)
//   });
// });

var connections = {}
var onlineUsers = function() {
  var users = [];
  for (var token in connections) {
    users.push(token);
  }
  return users;
};

const io = require('socket.io')(server, {
  path: '/file-share',
  serveClient: false,
  // below are engine.IO options
  pingInterval: 10000,
  pingTimeout: 5000,
  cookie: false
});

io.on('connection', (socket) => {
  console.log('Client connected', socket.handshake.query.token);
  // const token = uuidv4();
  const { token, role = 'downloader'} = socket.handshake.query;

  if (connections[token]) {
    connections[token][role] = socket;
  } else {
    connections[token] = { token };
    connections[token][role] = socket;
  }

  const timeInterval = setInterval(() => io.emit('time', new Date().toTimeString()), 1000);
  // io.emit('token', token);
  // socket.emit('connection', token);
  io.emit('onlineUsers', onlineUsers());

  switch (role) {
    case 'provider':
      break;

    case 'downloader':
      io.emit('status', {
        hasProvider: !!connections[token].provider
      });
      break;
  }

  socket.on('action', payload => {
    // console.log('action', payload);
    const { type, role, data } = payload;

    switch (type) {
      case 'getSharingFile':
        if (role === 'downloader') {
          connections[token]['provider'].emit('getSharingFile');
        }
        break;

      case 'sendSharingFile':
        if (role === 'provider') {
          connections[token]['downloader'].emit('sendSharingFile', data);
        }
        break;
    }
    // socket.emit('recevieDownload', 'ttttt');
    // io.emit('recevieDownload', 'bbbb');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (connections[token]) {
      connections[token][role] = null;
    }
    if (!connections[token].provider && !connections[token].downloader) {
      delete connections[token];
    }
    clearInterval(timeInterval);
    io.emit('onlineUsers', onlineUsers());
  });
});
