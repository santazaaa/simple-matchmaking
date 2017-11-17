'use strict';

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

            if(playersQueue.indexOf(user) != -1) {
                callback(user.name + 'is already in queue!');
                return;
            }

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
                    matchedPlayers.push(playersQueue.shift());
                }
        
                console.log('Matched! ' + matchedPlayers[0].playFabId + ' and ' + matchedPlayers[1].playFabId);
                break;
            }

            callback(null, matchedPlayers);
        },
        function(players, callback) {
            console.log('Starting game...');
            PlayFabMatchmaker.StartGame({
                Build: "1.1",
                ExternalMatchmakerEventEndpoint: "localhost/test",
                GameMode: "Normal",
                Region: "Singapore"
            }, function(error, result) {
                callback(error, players, result);
            });
        },
        function(players, startGameResponse, callback) {
            console.log('Game started: ' + JSON.stringify);
            startGameResponse.players = players;
            players.forEach(function(p) {
                UserManager.getUserSocket(p.id).sendCmd(100, startGameResponse); // Match found
            });
            callback(null);
        }
    ], function(error) {
        if(error)
            console.log('[matchmaker::findMatch] error = ' + JSON.stringify(error));
    });
    
}



var Roster = function() {
    prototype.members = [];

    prototype.age = 0;

    prototype.size = function() {
        return members.length;
    }
}

exports.test = function() {
    let testConfig = {
        requiredTeamCount: 2,
        teamSize: 1
    };

    var totalRosters = 3;
    var minRosterSize = 1;
    var maxRosterSize = 2;

    for(var i = 0; i < totalRosters; i++) {
        var roster = [];
        var size = Math.floor(Math.random() * maxRosterSize) + minRosterSize;
        for(var j = 0; j < size; j++) {
            roster.push({
                name: "Roster " + i + ", No. " + j
            });
        }
        addRosterToQueue(roster);
    }

    processMatchmaking(testConfig);
}

var currentQueue = [];

function addRosterToQueue(roster) {
    currentQueue.push(roster);
    console.log('Added roster to queue: ' + JSON.stringify(roster));
}

function processMatchmaking(config) {
    var processCount = 0;
    setInterval(function() {
        if(currentQueue.length == 0)
            return;
            
        processCount++;
        console.log('####################### START ' + processCount);
        createMatches(currentQueue, config);
        console.log('####################### END ' + processCount);
    }, 10000);
}

function createMatches(queue, config) {
    console.log('[matchmaker::createMatches] ' + JSON.stringify(queue));

    let rosters = queue;
    let failed = [];

    while(rosters.length > 0) {
        let roster = rosters.shift();

        if(!tryMakeMatch(roster, queue, config)) {
            failed.push(roster);
            console.log('tryMakeMatch failed: roster = ' + JSON.stringify(roster));
        }
    }

    Array.prototype.push.apply(queue, failed);
    console.log('failed rosters: ' + JSON.stringify(failed));
    console.log('remainging rosters: ' + JSON.stringify(queue));
}

function tryMakeMatch(target, queue, config) {
    console.log('[matchmaker::tryMakeMatch] target = ' + JSON.stringify(target));

    let potentials = gatherPotentials(target, queue, config);

    let teams = [];
    let maxPlayers = config.teamSize * config.requiredTeamCount;

    // Initialize teams
    for(var i = 0; i < config.requiredTeamCount; i++) {
        teams.push([]);
    }

    // Add target roster to 1st team and match
    let match = [];
    teams[0].push(target);
    match.push(target);

    while(countPlayersInMatch(match) < maxPlayers) {
        
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
                    if(bestRoster == null || score > bestTeamScore) {
                        bestRoster = roster;
                        bestTeamScore = score;
                        bestTeamIndex = teamIndex;
                        // console.log('bestRoster = ' + JSON.stringify(roster) + ', bestTeamScore = ' + bestTeamScore + ', bestTeamIndex = ' + bestTeamIndex);
                    }
                }
            }

        }

        if(bestRoster == null) {
            console.log('could not find best roster...');
            return false;
        }

        console.log('added roster: ' + JSON.stringify(bestRoster) + ', to team: ' + bestTeamIndex);
        match.push(bestRoster);
        teams[bestTeamIndex].push(bestRoster);
        potentials.splice(potentials.indexOf(bestRoster), 1);
        // console.log('match: ' + JSON.stringify(match));
        // console.log('teams: ' + JSON.stringify(teams));
        // console.log('potentails: ' + JSON.stringify(potentials));
    }
    
    // Remove all matched players from queue
    match.forEach((roster) => {
        var idx = queue.indexOf(roster);
        if(idx < 0)
            return;
        queue.splice(idx, 1); 
    });

    createMatch(teams, match);

    return true;
}

function countPlayersInMatch(match) {

    var count = 0;
    for(var i = 0; i < match.length; i++) {
        count += match[i].length;
    }

    //console.log('[matchmaker::countPlayersInMatch] match = ' + JSON.stringify(match) + ', count = ' + count);
    
    return count;
}

function countPlayersInTeam(team) {
    
    var count = 0;
    for(var i = 0; i < team.length; i++) {
        count += team[i].length;
    }

    //console.log('[matchmaker::countPlayersInTeam] team = ' + JSON.stringify(team) + ', count = ' + count);
    
    return count;
}

function gatherPotentials(target, queue, config) {

    let potentials = [];

    for(var i = 0; i < queue.length; i++) {
        potentials.push(queue[i]);
    }

    console.log('[matchmaker::gatherPotentials] target = ' + JSON.stringify(target) + ', potentials = ' + JSON.stringify(potentials));
    return potentials;
}

function canJoinTeams(roster, indexToJoin, teams, config) {
    if(roster.length + countPlayersInTeam(teams[indexToJoin]) > config.teamSize) {
        // console.log('[matchmaker::canJoinTeams] false');
        return false;
    }
    // console.log('[matchmaker::canJoinTeams] true');
    return true;
}

function scoreRoster(roster, team, match, config) {
    var score = 0;

    // adjust score by time queued
    score += 1;

    // console.log('[matchmaker::scoreRoster] score = ' + score);
    return score;
}

function createMatch(teams, match) {
    console.log('[matchmaker::createMatch] match = ' + JSON.stringify(match));
}

exports.cancel = function(client) {

    while(true) {
        var playerIdx = playersQueue.indexOf(client);
        if(playerIdx == -1)
            break;
        playersQueue.splice(playerIdx, 1);
    }
    
    console.log(client.name + ': cancel finding a match...');
}