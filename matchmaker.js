var playersQueue = [];
var requiredCount = 2;

exports.findMatch = function(client) {
    playersQueue.push(client);

    while(playersQueue.length > requiredCount) {
        var matchedPlayers = [];
        for(var i = 0; i < requiredCount; i++) {
            matchedPlayers.push(playersQueue[0]);
            playersQueue.pop();
        }
        console.log("Matched!");

        matchedPlayers.forEach(function(p) {
            p.write('Matched\r\n');
        });
    }

    console.log(client.name + ': finding a match...');
    console.log('count = ' + playersQueue.length);
}

exports.cancel = function(client) {
    playersQueue.slice(playersQueue.indexOf(client), 1);
    console.log(client.name + ': cancel finding a match...');
}