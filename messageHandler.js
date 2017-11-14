var matchmaker = require('./matchmaker');
var UserManager = require('./UserManager');

var OpCode = function() {
    this.Test = 0;
};

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

    // Add to user list
    UserManager.addUser(client.name, client);

    // Send a nice welcome message and announce
    client.write(client.name + " is connected" + "\r\n");
}

exports.parseRawData = function(data, client) {
    console.log('[messageHandler::parseRawData] ' + data);
    try {
        var json = JSON.parse(data);
        var payload = json.payload;
        console.log('opCode: ' + json.opCode);
        switch(json.opCode) {
            case 0: // Set Playfab ID
                setPlayFabIdToUser(payload, client);
            break;
        }
    } catch (e){
        console.error('[messageHandler::parseRawData] Failed to parse data = ' + data);
        console.error(e);
    }
}

var setPlayFabIdToUser = function(payload, client) {
    var user = UserManager.getUser(client.name);
    user.playFabId = payload.playFabId;
    console.log('Set PlayFab id to user: ' + JSON.stringify(user));
}

exports.onDisconnected = function(client) {
    console.log('[messageHandler::onDisconnected] ' + client.name);
    matchmaker.cancel(client);
    UserManager.removeUser(client.name);
}