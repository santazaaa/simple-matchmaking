var async = require('async');
var PlayFabMatchmaker = require("playfab-sdk/Scripts/PlayFab/PlayFabMatchmaker");
var UserManager = require("./UserManager");
var playersQueue = [];
var requiredCount = 2;
var matches = [];

var authUser = function(user, callback) {
    if(user.auth) {
        console.log('Player already authenticated');
        callback(null, true);
        return;
    }

    console.log("auth player: " + user.playFabId);

    PlayFabMatchmaker.AuthUser({
        AuthorizationTicket: user.sessionTicket
    }, function(error, result) {
        if(error != null) {
            console.log('PlayFabMatchmaker.AuthUser error: ' + error);
            callback(error, false);
            return;
        }

        user.auth = true;
        console.log('auth: true');
        callback(null, true);
    });
}

exports.findMatch = function(user) {

    async.waterfall([
        function(next) {
            authUser(user, next);
        },
        function(auth, callback) {
            playersQueue.push(user);
            
            console.log(user.playFabId + ': finding a match... player in queue = ' + playersQueue.length);
            
            if(playersQueue.length < requiredCount) {
                console.log('Waiting for other players..');
                callback('Waiting for players');
                return;
            }

            var matchedPlayers = [];
            while(playersQueue.length >= requiredCount) {
                
                for(var i = 0; i < requiredCount; i++) {
                    matchedPlayers.push(playersQueue[0]);
                    playersQueue.pop();
                }
        
                console.log('Matched!');
                break;
            }

            callback(null, matchedPlayers);
        },
        function(players, callback) {
            console.log('Starting game...');
            PlayFabMatchmaker.StartGame({
                Build: "1.0",
                ExternalMatchmakerEventEndpoint: "localhost/test",
                GameMode: "Test",
                Region: "Singapore"
            }, function(error, result) {
                callback(error, players, result);
            });
        },
        function(players, startGameResponse, callback) {
            console.log('Game started!');
            startGameResponse.players = players;
            players.forEach(function(p) {
                UserManager.getUserSocket(p.id).sendCmd(3, startGameResponse); // Match found
            });
            callback(null);
        }
    ], function(error) {
        if(error)
            console.log('[matchmaker::findMatch] error = ' + JSON.stringify(error));
    });
    
}

exports.cancel = function(client) {

    while(true) {
        var playerIdx = playersQueue.indexOf(client);
        if(playerIdx == -1)
            break;
        playersQueue.slice(playerIdx, 1);
    }
    
    console.log(client.name + ': cancel finding a match...');
}