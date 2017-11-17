'use strict';

require('dotenv').config();

// PlayFab setup
var PlayFab = require("playfab-sdk/Scripts/PlayFab/PlayFab");
var PlayFabServer = require("playfab-sdk/Scripts/PlayFab/PlayFabServer");
var PlayFabMatchmaker = require("playfab-sdk/Scripts/PlayFab/PlayFabMatchmaker");
PlayFab.settings.titleId = process.env.PLAYFAB_API_TITLE_ID;
PlayFab.settings.developerSecretKey = process.env.PLAYFAB_SECRET_KEY;
console.log("PlayFab settings: " + JSON.stringify(PlayFab.settings));

// Load the TCP Library
var net = require('net');
var messageHandler = require('./messageHandler');
var matchmaker = require('./matchmaker');

// Start a TCP Server
net.createServer(function (socket) {

  messageHandler.onConnected(socket);
  
  // Handle incoming messages from clients.
  socket.on('data', function (data) {
    messageHandler.parseRawData(data, socket);
  });

  // Remove the client from the list when it leaves
  socket.on('end', function () {
    messageHandler.onDisconnected(socket);
  });

}).listen(5000);

var http = require('http');
http.createServer(function(req, res) {
  console.log(req.url)
  res.end('Hello Node.js Server!')
}).listen(8080);

// Put a friendly message on the terminal of the server.
console.log("Matchmaking Server running at port 5000\n");

matchmaker.test();
// matchmaker.start();