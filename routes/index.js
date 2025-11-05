/*
 * Connect all of your endpoints together here.
 */

module.exports = function (app) {
    const express = require('express');
    app.use('/api', require('./home.js')(express.Router()));
    app.use('/api/users', require('./users.js')(express.Router()));
    app.use('/api/tasks', require('./tasks.js')(express.Router()));
};


//module.exports = function (app, router) {
    //app.use('/api', require('./home.js')(router));
    //app.use('/api/users', require('./users.js')(router));   // 
   //app.use('/api/tasks', require('./tasks.js')(router));   // 
//};
