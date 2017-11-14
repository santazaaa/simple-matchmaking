'use strict';

// Load the TCP Library
var net = require('net');
var messageHandler = require('./messageHandler');

// PlayFab setup
var PlayFab = require("playfab-sdk/Scripts/PlayFab/PlayFab");
var PlayFabServer = require("playfab-sdk/Scripts/PlayFab/PlayFabServer");
PlayFab.settings.titleId = process.env.PLAYFAB_API_TITLE;
PlayFab.settings.developerSecretKey = process.env.PLAYFAB_SECRET_KEY;
console.log("PlayFab settings: " + JSON.stringify(PlayFab.settings));

// Start a TCP Server
net.createServer(function (socket) {

  messageHandler.onConnected(socket);
  
  // Handle incoming messages from clients.
  socket.on('data', function (data) {
    messageHandler.parseRawData(data);
  });

  // Remove the client from the list when it leaves
  socket.on('end', function () {
    messageHandler.onDisconnected(socket);
  });

}).listen(5000);

// Put a friendly message on the terminal of the server.
console.log("Matchmaking Server running at port 5000\n");