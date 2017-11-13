var playersQueue = [];
var requiredCount = 2;

exports.findMatch = function(client) {
    playersQueue.push(client);

    while(playersQueue.length >= requiredCount) {
        var matchedPlayers = [];
        for(var i = 0; i < requiredCount; i++) {
            matchedPlayers.push(playersQueue[0]);
            playersQueue.pop();
        }

        console.log('Matched!');
        var result = { players: matchedPlayers };

        matchedPlayers.forEach(function(p) {
            p.sendCmd(5, result);
        });
    }

    console.log(client.name + ': finding a match...');
    console.log('count = ' + playersQueue.length);
}

exports.cancel = function(client) {
    var playerIdx = playersQueue.indexOf(client);
    if(playerIdx == -1)
        return;
    playersQueue.slice(playerIdx, 1);
    console.log(client.name + ': cancel finding a match...');
}