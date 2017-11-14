var User = require('./user');

var userMap = [];
var userSocketMap = [];

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
    console.log('[UserManager::getUser] ' + id);
    return userMap[id];
}

exports.getUserSocket = function(id) {
    return userSocketMap[id];
}