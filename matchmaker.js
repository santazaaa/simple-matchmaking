'use strict';

var async = require('async');
var uuidv1 = require('uuid/v1');
var request = require('request');

var PlayFabMatchmaker = require("playfab-sdk/Scripts/PlayFab/PlayFabMatchmaker");

var UserManager = require("./UserManager");
var messageHandler = require('./messageHandler');

var models = require('./models');
var User = require('./user');
var Roster = models.Roster;
var Team = models.Team;
var Match = models.Match;
var Config = models.Config;

var currentQueue = [];
var currentMatches = [];
var process = null;

var testConfig = new Config();
testConfig.gameMode = 0;
testConfig.requiredTeamCount = 1;
testConfig.teamSize = 1;

exports.start = function() {
    startMatchmaking(testConfig);
}

exports.findMatch = function(rosterInfo) {
    async.waterfall(
        [
            function parseToRoster(callback) {
                if(rosterInfo == null) {
                    callback('rosterInfo is null!');
                    return;
                }
                callback(null, rosterInfo);
            },
            function createRoster(rosterInfo, callback) {
                var roster = new Roster();
                roster.gameMode = rosterInfo.gameMode;
                rosterInfo.userIds.forEach((id) => {
                    var user = UserManager.getUser(id);
                    if(user == null) {
                        callback('user is null!');
                        return;
                    }
                    roster.members.push(user);
                });
                callback(null, roster);
            },
            function addToQueue(roster, callback) {
                addRosterToQueue(roster);
                callback(null, roster);
            }
        ]
    , function(error, result) {
        if(error) {
            console.error('[matchmaker::newFindMatch] error = ' + error);
            return;
        }

        console.log('[matchmaker::newFindMatch] result = ' + JSON.stringify(result));
    });
    
}

exports.test = function() {
    

    let totalRosters = 10;
    let minRosterSize = 1;
    let maxRosterSize = 3;
    let intervalMS = 2000;
    
    let UserManager = require('./UserManager');
    let iteration = 0;

    setInterval(function randomAddRosters() {
        for(var i = 0; i < totalRosters; i++) {
            var roster = new Roster();
            var size = Math.floor(Math.random() * (maxRosterSize - minRosterSize + 1)) + minRosterSize;
            var userIds = [];
            for(var j = 0; j < size; j++) {
                let id = "I" + iteration + "R" + i + "N" + j;
                UserManager.addUser(id, null);
                roster.members.push(UserManager.getUser(id));
                userIds.push(id);
            }

            //addRosterToQueue(roster);

            // Fake payload from client
            var payload = {
                gameMode: 0,
                userIds: userIds,
            }
            exports.findMatch(JSON.stringify(payload));
        }
        iteration++;
        console.log('Added rosters to queue: ' + totalRosters + ', total = ' + currentQueue.length);        
    }, intervalMS);

    startMatchmaking(testConfig);
}

function addRosterToQueue(roster) {
    roster.startQueueTime = Date.now();
    currentQueue.push(roster);
    // console.log('Added roster to queue: ' + JSON.stringify(roster));
    // console.log('Added rosters to queue: ' + roster.size() + ', total = ' + currentQueue.length);
}

function startMatchmaking(config) {
    var processCount = 0;
    process = setInterval(function() {
        if(currentQueue.length == 0)
            return;
            
        processCount++;
        
        createMatches(currentQueue, config);
        
    }, 10000);
}

function stopMatchmaking() {
    clearInterval(process);
}

function createMatches(queue, config) {
    console.log('[matchmaker::createMatches] total rosters = ' + queue.length);
    console.log('####################### START #######################');
    console.time('createMatches');

    let rosters = queue;
    let failed = [];

    while(rosters.length > 0) {
        let roster = rosters.shift();

        if(!tryMakeMatch(roster, queue, config)) {
            failed.push(roster);
            // console.log('tryMakeMatch failed: roster = ' + JSON.stringify(roster));
        }
    }

    Array.prototype.push.apply(queue, failed);

    // console.log('failed rosters: ' + JSON.stringify(failed, null, 2));
    // console.log('remainging rosters: ' + JSON.stringify(queue, null, 2));
    // console.log('current matches: ' + JSON.stringify(currentMatches, null, 2));
    console.log('failed rosters count: ' + failed.length);
    console.log('remaining rosters in queue: ' + queue.length);
    console.log('current matched: ' + currentMatches.length);
    console.log('####################### END #######################');
    console.timeEnd('createMatches');
}

function tryMakeMatch(target, queue, config) {
    // console.log('[matchmaker::tryMakeMatch] target = ' + JSON.stringify(target));

    let potentials = gatherPotentials(target, queue, config);

    let match = new Match();
    match.gameMode = config.gameMode;

    let teams = match.teams;
    let maxPlayers = config.teamSize * config.requiredTeamCount;

    // Initialize teams
    for(var i = 0; i < config.requiredTeamCount; i++) {
        teams.push(new Team(i));
    }

    // Add target roster to 1st team and match
    teams[0].addRoster(target);

    while(match.playersCount() < maxPlayers) {
        
        var bestRoster = null;
        var bestTeamScore = -100000;
        var bestTeamIndex = 0;

        for(var i = 0; i < potentials.length; i++) {
            let roster = potentials[i];
    
            // Calculate score in each team for this roster
            for(var teamIndex = 0; teamIndex < teams.length; teamIndex++) {
                var team = teams[teamIndex];

                if(canJoinTeams(roster, teamIndex, teams, config)) {
                    var score = scoreRoster(roster, team, match, config);
                    if(bestRoster === null || score > bestTeamScore) {
                        bestRoster = roster;
                        bestTeamScore = score;
                        bestTeamIndex = teamIndex;
                        // console.log('bestRoster = ' + JSON.stringify(roster) + ', bestTeamScore = ' + bestTeamScore + ', bestTeamIndex = ' + bestTeamIndex);
                    }
                }
            }

        }

        if(bestRoster == null) {
            // console.log('could not find best roster...');
            return false;
        }

        // console.log('added roster: ' + JSON.stringify(bestRoster) + ', to team: ' + bestTeamIndex);
        teams[bestTeamIndex].addRoster(bestRoster);
        potentials.splice(potentials.indexOf(bestRoster), 1);
        // console.log('match: ' + JSON.stringify(match));
        // console.log('teams: ' + JSON.stringify(teams));
        // console.log('potentails: ' + JSON.stringify(potentials));
    }
    
    // Remove all matched players from queue
    match.teams.forEach((team) => {
        team.rosters.forEach((roster) => {
            var idx = queue.indexOf(roster);
            if(idx < 0)
                return;
            queue.splice(idx, 1); 
        });
    });

    createMatch(match);

    startMatch(match);

    return true;
}

function gatherPotentials(target, queue, config) {

    let potentials = [];

    for(var i = 0; i < queue.length; i++) {
        potentials.push(queue[i]);
    }

    // console.log('[matchmaker::gatherPotentials] target = ' + JSON.stringify(target) + ', potentials = ' + JSON.stringify(potentials));
    return potentials;
}

function canJoinTeams(roster, indexToJoin, teams, config) {
    if((roster.size() + teams[indexToJoin].size) > config.teamSize) {
        // console.log('[matchmaker::canJoinTeams] false');
        return false;
    }
    // console.log('[matchmaker::canJoinTeams] true');
    return true;
}

function scoreRoster(roster, team, match, config) {
    var score = 0;

    // adjust score by time queued
    score += roster.age();

    // console.log('[matchmaker::scoreRoster] score = ' + score);
    return score;
}

function createMatch(match) {
    console.log('[matchmaker::createMatch] match = ' + JSON.stringify(match));

    // Generate a match id
    match.id = uuidv1();

    currentMatches.push(match);

    let maxWaitTime = 0;
    let totalRosters = 0;

    match.teams.forEach((team) => {
        team.rosters.forEach((roster) => {
            //console.log('Roster age: ' + roster.age());
            maxWaitTime = Math.max(maxWaitTime, roster.age());
            totalRosters++;

            roster.members.forEach((user) => {

                // Assign matchId and matchTicket to all players in the match
                user.matchId = match.id;
                user.matchTicket = uuidv1();

                console.log('Assign matchId and ticket to user id = ' + user.playFabId + ', ticket = ' + user.matchTicket);
            });
        });
    });
    console.log('Match created: id = ' + match.id + ', maxWaitTime = ' + maxWaitTime, ', total rosters = ' + totalRosters);
}

function startMatch(match) {
    async.waterfall([
        function(callback) {
            requestGameServer(match, callback);
        },
        function(serverInfo, callback) {
            sendMatchInfo(match, serverInfo);
            callback(null);
        }
    ], function(error) {
        if(error) {
            console.error('[startMatch] ' + JSON.stringify(error));
        }
    });
}

function requestGameServer(match, callback) {
    console.log('[requestGameServer] matchId = ' + match.id + ', gameMode = ' + match.gameMode);

    // // For testing purpose
    // callback(null, {
    //     "code": 200,
    //     "status": "OK",
    //     "data": {
    //       "LobbyID": "4006214",
    //       "ServerHostname": "192.168.0.1",
    //       "ServerIPV6Address": "2600:1f18:70d:5100:8949:a309:976a:e6fa",
    //       "ServerPort": 9000,
    //       "Ticket": "e98yf289f248902f4904f0924f9pj",
    //       "Status": "Waiting"
    //     }
    // });
    // return;

    // This uses my own game server manager
    request.get("http://localhost:9000/app/startgame", function(error, response, body) {
        if(error || response.statusCode != 200) {
            callback(error);
            return;
        }
        console.log('Game instance info: ' + body);
        let result = JSON.parse(body);
        callback(null, result.data);
    });
    return;
    
    PlayFabMatchmaker.StartGame({
        Build: "1.1", // FIXME
        ExternalMatchmakerEventEndpoint: "localhost/test", // FIXME
        GameMode: match.gameMode,
        Region: "Singapore"
    }, function(error, result) {

        if(error) {
            console.error('[requestGameServer] ' + JSON.stringify(error));
            callback(error);
            return;
        }
        
        callback(null, result);
    });
}

function sendMatchInfo(match, serverInfo) {
    let matchInfo = {
        matchId: match.id,
        matchTicket: match.ticket,
        serverInfo: serverInfo
    }
    
    console.log('[sendMatchInfo] sending match info = ' + JSON.stringify(matchInfo));

    match.forEachMember((user) => {
        messageHandler.sendMessage(UserManager.getUserSocket(user.playFabId), 100, matchInfo);
    });
}

exports.cancel = function(client) {

    // Not implemented
    
    console.log(client.name + ': cancel finding a match...');
}