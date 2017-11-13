var matchmaker = require('./matchmaker');
var UserManager = require('./UserManager');

var OpCode = function() {
    this.Test = 0;
};

var clients = [];

exports.onConnected = function(client) {
    client.sendCmd = function(opCode, data) {
        var json = JSON.stringify({
            opCode: opCode,
            data: data
        });
        console.log('Sending json: ' + json + ', to: ' + client.name);
        client.write(json + '\r\n');
    };

    // Identify this client
    client.name = client.remoteAddress + ":" + client.remotePort;

    // Add to user mgr
    UserManager.addUser(client.name, client);

    // Put this new client in the list
    clients.push(client);

    // Send a nice welcome message and announce
    client.write(client.name + " is connected" + "\r\n");
}

exports.parseRawData = function(data) {
    console.log('[messageHandler::parseRawData] ' + data);
    try {
        var json = JSON.parse(data);
        console.log('opCode: ' + json.opCode);
        switch(json.opCode) {
            case 0:
                console.log('Test!');
            break;
        }
    } catch (e){
        console.error('[messageHandler::parseRawData] Failed to parse data = ' + data);
    }
}

exports.onDisconnected = function(client) {
    console.log('[messageHandler::onDisconnected] ' + client.name);
    matchmaker.cancel(client);
    UserManager.removeUser(client.name);
}