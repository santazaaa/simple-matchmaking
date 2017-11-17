exports.Config = function() {
    this.gameMode = 0;
    this.requiredTeamCount = 3;
    this.teamSize = 3;
}

exports.Roster = function() {

    this.gameMode = 0;

    this.members = [];
    
    this.startQueueTime = Date.now();

    this.size = function() {
        return this.members.length;
    }

    this.age = function() {
        return (Date.now() - this.startQueueTime) / 1000;
    }
}

exports.Team = function() {

    this.rosters = [];

    this.size = 0;

    this.addRoster = function(roster) {
        this.rosters.push(roster);
        this.size += roster.size();
    }
}

exports.Match = function() {
    this.teams = [];

    this.serverAddress = "localhost"

    this.serverPort = 5000;

    this.id = null;

    this.playersCount = function() {
        return this.teams.reduce(function(count, team) {
            return count + team.size;
        }, 0);
    };

    this.forEachMember = function(func) {
        this.teams.forEach((team) => {
            team.rosters.forEach((roster) => {
                roster.members.forEach((user) => {
                    func(user);
                });
            });
        });
    }

}