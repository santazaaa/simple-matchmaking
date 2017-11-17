var User = require('./user');
var PlayFabMatchmaker = require("playfab-sdk/Scripts/PlayFab/PlayFabMatchmaker");

var userMap = [];
var userSocketMap = [];

exports.authenticate = function(client, sessionTicket, playFabId, callback) {

    PlayFabMatchmaker.AuthUser({
        AuthorizationTicket: sessionTicket
    }, function(error, result) {
        if(error != null) {
            console.log('[UserManager::authenticate] error: ' + JSON.stringify(error));
            if(callback)
                callback(false);
            return;
        }

        // Init user and attach to client socket
        let user = new User();
        user.playFabId = playFabId;
        user.sessionTicket = sessionTicket;
        user.online = true;

        client.user = user;
        
        // Add to maps
        userMap[user.playFabId] = user;
        userSocketMap[user.playFabId] = client;

        console.log('[UserManager::authenticate] done => ' + JSON.stringify(user));
        if(callback)
            callback(true);
    });

}

exports.addUser = function(id, socket) {
    userMap[id] = new User(id);
    userSocketMap[id] = socket;
    console.log('[UserManager::addUser] ' + JSON.stringify(userMap[id]));
}

exports.removeUser = function(id) {
    delete userMap[id];
    delete userSocketMap[id];
    console.log('[UserManager::removeUser] ' + id);
}

exports.getUser = function(id) {
    // console.log('[UserManager::getUser] ' + id);
    return userMap[id];
}

exports.getUserSocket = function(id) {
    return userSocketMap[id];
}

exports.onDisconnected = function(client) {
    console.log('[UserManager::onDisconnected] client name = ' + client.name);

    if(client.user) {
        client.user.online = false;
    }
}