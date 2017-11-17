var User = function(id) {
    this.playFabId = id;
    this.sessionTicket = null;
    this.online = true;
};

module.exports = User;