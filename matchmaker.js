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

    this.members = [];
    
    this.startQueueTime = Date.now();

    this.size = function() {
        return this.members.length;
    }

    this.age = function() {
        return (Date.now() - this.startQueueTime) / 1000;
    }
}

var Team = function() {

    this.rosters = [];

    this.size = 0;

    this.addRoster = function(roster) {
        this.rosters.push(roster);
        this.size += roster.size();
    }
}

var Match = function() {
    this.teams = [];

    this.serverAddress = "localhost"

    this.serverPort = 5000;

    this.playersCount = function() {
        return this.teams.reduce(function(count, team) {
            return count + team.size;
        }, 0);
    };
}

exports.test = function() {
    let testConfig = {
        requiredTeamCount: 3,
        teamSize: 3
    };

    var totalRosters = 10;
    var minRosterSize = 1;
    var maxRosterSize = 3;

    setInterval(function randomAddRosters() {
        for(var i = 0; i < totalRosters; i++) {
            var roster = new Roster();
            var size = Math.floor(Math.random() * (maxRosterSize - minRosterSize + 1)) + minRosterSize;
            for(var j = 0; j < size; j++) {
                roster.members.push({
                    name: "Roster " + i + ", No. " + j
                });
            }
            addRosterToQueue(roster);
        }
        console.log('Added rosters to queue: ' + totalRosters + ', total = ' + currentQueue.length);        
    }, 2000);

    processMatchmaking(testConfig);
}

var currentQueue = [];
var currentMatches = [];

function addRosterToQueue(roster) {
    roster.startQueueTime = Date.now();
    currentQueue.push(roster);
    // console.log('Added roster to queue: ' + JSON.stringify(roster));
    // console.log('Added rosters to queue: ' + roster.size() + ', total = ' + currentQueue.length);
}

function processMatchmaking(config) {
    var processCount = 0;
    setInterval(function() {
        if(currentQueue.length == 0)
            return;
            
        processCount++;
        
        createMatches(currentQueue, config);
        
    }, 10000);
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
    currentMatches.push(match);

    var maxWaitTime = 0;
    var totalRosters = 0;
    match.teams.forEach((team) => {
        team.rosters.forEach((roster) => {
            //console.log('Roster age: ' + roster.age());
            maxWaitTime = Math.max(maxWaitTime, roster.age());
            totalRosters++;
        })
    });
    console.log('Match created: maxWaitTime = ' + maxWaitTime, ', total rosters = ' + totalRosters);
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