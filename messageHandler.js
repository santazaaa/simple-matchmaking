var matchmaker = require('./matchmaker');
var UserManager = require('./UserManager');

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

    // Send a nice welcome message and announce
    exports.sendMessage(client, 99, { message: 'connected' });

    console.log(client.name + " is connected" + "\r\n");
}

exports.parseRawData = function(data, client) {
    console.log('[messageHandler::parseRawData] ' + data);
    try {
        var json = JSON.parse(data);
        var payload = json.payload;
        console.log('opCode: ' + json.opCode);
        switch(json.opCode) {
            case 0: // Set Playfab ID
                handleAuthenticateUser(payload, client);
            break;

            case 1: // Find normal match
                handleFindMatch(payload, client);
            break;
        }
    } catch (e){
        console.error('[messageHandler::parseRawData] Failed to parse data = ' + data);
        console.error(e);
    }
}

exports.sendMessage = function(client, opCode, payload) {
    if(client == null) {
        console.error('[messageHandler::sendMessage] client is null, ignore sending message...');
        return;
    }

    var json = JSON.stringify({
        opCode: opCode,
        payload: payload
    });
    
    client.write(json + '\r\n');

    console.log('[messageHandler::sendMessage] sending ' + json + ', to: ' + client.name);
}

function handleAuthenticateUser(payload, client) {
    UserManager.authenticate(
        client, 
        payload.sessionTicket, 
        payload.playFabId, 
        (success) => {
            exports.sendMessage(client, 0, { authenticated: success });
        }
    );
}

function handleFindMatch(payload, client) {
    matchmaker.findMatch(payload);
}

exports.onDisconnected = function(client) {
    console.log('[messageHandler::onDisconnected] ' + client.name);
    matchmaker.cancel(client);
    UserManager.onDisconnected(client);
}