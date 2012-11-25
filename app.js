var express = require('express');
var hbs = require('hbs');
var sharejs = require('share').server;
var colorconverter = require("color-convert")();

var url = require('url');
var fs = require('fs');
var os = require('os');

var path = require('path');
var settings = require('./settings');
var sheetDocHelper = require('./sheetDocHelper.js');

//dictinary with opened docuemnts
var documentDict = {};
// Check for time outs every 5 seconds
setInterval(timeOut, 5000);

//added exception handler so the node doesn't terminate on an exception
process.on('uncaughtException', function(err) {
    console.log(err);
});

/**
* returns a function which creates a different color each time it is called
*/
function getColorGenerator() {
    var hsv = [90, 90, 90];
    var seed = 0;
    return function () {
            hsv[0] = (hsv[0]+60) % 360;

            seed++;

            if (seed % 6 === 0) {
                hsv[0] = (hsv[0]+30) % 360;
                hsv[1] = (hsv[1]+30) % 100;
                hsv[2] = (hsv[2]+20) % 100;
            }

            if (hsv[1] < 45) hsv[1] = 45;
            if (hsv[2] < 50) hsv[2] = 50;

            var rgb = colorconverter.hsv(hsv[0], hsv[1], hsv[2]).rgb();
            return 'rgb('+rgb[0]+','+rgb[1]+','+rgb[2]+')';
        };
}

/**
* remove a document
*
* @param {String} docName name of the document
* @param {Function} [callback] will be called when removal is done
*/
function removeDocument(docName, callback) {
    if (documentDict[docName].state === "open") {
        documentDict[docName].state = "closing";
        server.model.getSnapshot(docName, function(error, data) {
            if (error && callback) {
                    callback(error);
            }
            else {
                server.model.delete(docName, function(error, data) {
                    if (error && callback) {
                        callback(error);
                    }
                    else {
                        var callbackQueue = [];
                        if (documentDict[docName].closedCallback) {
                            callbackQueue.push(documentDict[docName].closedCallback);
                        }
                        if(callback) {
                             callbackQueue.push(callback);
                        }
                        delete documentDict[docName];
                        console.log('deleted document ' + docName);
                        for (var i = callbackQueue.length - 1; i >= 0; i--) {
                            callbackQueue[i]();
                        }
                    }
                });
            }
        });
    }
}

/**
* creates a new document with the given name
*
* @param {String} docName name of the document
* @param {Function} [callback] will be called when creation is done
*/
function createDocument(docName, callback) {
    var content = sheetDocHelper.createShareDoc();
    documentDict[docName] = {users: {}, state: "opening", getNewColor: getColorGenerator()};

    server.model.create(docName, 'json', function (error) {
        server.model.applyOp(docName, {op:[{oi:content, p:[]}], v:0}, function(error) {
            if (error) {
                documentDict[docName].state = "closed";
                callback(error);
            }
            else {
                documentDict[docName].state = "open";
                callback();
            }
        });
    });
}

/**
* add a new user to the lists in the document and on the server
*
* @param {String} docName name of the document
* @param {Object} agent the ShareJS use agent of the new user
* @param {Function} [callback] will be called when the new user is added
*/
function addUser(docName, agent, callback) {
    var userName = agent.name;
    var userObject;
    var userColor;

    if (!callback) {
        callback = function () {};
    }

    //add the user to the list in the documentDict
    documentDict[docName].users[userName] = {
                                                agent: agent,
                                                timeout: settings.PING_TIMEOUT * 60000
                                            };

    userColor = documentDict[docName].getNewColor();

    //add the user to the user list in the document
    server.model.getSnapshot(docName, function(error, data) {
        if (error) {
            callback(error);
        }
        else {
            userObject = data.snapshot.users[userName];
            if (!userObject) {
                userObject = {"name":userName, "color": userColor, "selection":""};
                server.model.applyOp(docName, {op:[{p:['users', userName], oi:userObject}], v:data.v}, function(error) {
                    if (error) {
                        callback(error);
                    }
                    else {
                        callback(null);
                    }
                });
            }
            else {
                callback(null);
            }
        }
    });
}

/**
* remove the user from the lists in the document and on the server and closes the document if all users are disconnected
*
* @param {String} docName name of the document
* @param {String} userName user who will be disconnected
*/
function removeUser(docName, userName) {
    //remove the user from the user list in the document
    server.model.getSnapshot(docName, function(error, data) {
        if (error) {
            console.log(error);
        }
        else {
            var userObject = data.snapshot.users[userName];
            var lock = documentDict[docName].users[userName].lock;
            
            if (userObject) {
                server.model.applyOp(docName, {op:[{p:['users', userName], od:userObject}], v:data.v}, function(error) {
                    if (error) {
                        console.log(error);
                    }
                });
            }

            if (lock) {
                var op = [{p:['sheets', lock.sheet, 'rows', lock.row, 'cells', lock.col, 'lockedBy'], od:userName}];
                server.model.applyOp(docName, {op:op, v:data.v}, function(error) {
                    if (error) {
                        console.log(error);
                    }
                });
            }
            //disconnect the user and remove him from the list in the documentDict
            delete documentDict[docName].users[userName];
        }
    });
}

/**
 * decrease the timers for all users and check if they are 0
 *
 */
function timeOut() {
    for(var docName in documentDict) {
        for(var userName in documentDict[docName].users) {
            documentDict[docName].users[userName].timeout -= 5000;
            if (documentDict[docName].users[userName].timeout <= 0) {
                removeUser(docName, userName);
                console.log('user ' + userName + ' disconnected (timeout)');
            }
        }
    }
}



var server = express();
//server.use(express.logger());
server.engine('html', hbs.__express);
server.set('view engine', 'hbs');
server.set('views', __dirname + '/views');
server.use(express.static(__dirname + '/public'));
server.use(express.cookieParser());
server.use(express.bodyParser());
server.use(server.router);

// Action for getting the document contents
server.get('/doc/get/:docName', function(req, res, next) {
    var docName = req.params.docName;

    server.model.getSnapshot(docName, function(error, data) {
        if (error) {
            res.statusCode = 500;
            res.end(error);
        }
        else {
            res.end(JSON.stringify(data.snapshot));
        }
    });
});

server.get('/spreadsheet/:docName', function(req, res, next) {
    var docName = req.params.docName;
    if (!req.cookies.userName) {
        res.redirect("/");
    }
    res.render('spreadsheet.html', {docName: docName});
    if (!documentDict[docName]) {
        createDocument(docName, function (error) {
            console.log(error ? error : 'created document '+docName);
        });
    }
});

server.get('/', function(req, res, next) {
    res.render('index.html', {documents: Object.keys(documentDict)});
});

var options = {
    browserChannel: {cors:settings.RT_SERVER_HOST},
    rest: null,
    db: {type: 'memory'},
    /**
     * Gets called everytime before a user tries to connect or submit an operation
     * (see https://github.com/josephg/ShareJS/wiki/User-access-control)
     *
     * @param {Object} agent Stores an ID and the name of the client
     * @param {Object} action Stores the type of the action. Must be either accepted or rejected.
     */
    auth: function (agent, action) {
            if (action.name == 'connect') {
                agent.name = agent.authentication ? agent.authentication : 'Unknown';
                action.accept();
            }
            else if (action.name == 'open') {
                //addUser(action.docName, agent);
                if (documentDict[action.docName]) {
                    documentDict[action.docName].state = "open";
                }
                
                addUser(action.docName, agent, function(error) {
                    if (error) {
                        console.log(error);
                    }
                });

                action.accept();
            }
            else if (action.name == 'create') {
                action.accept();
            }
            else if (action.name == 'submit op') {
                if(action.op[0].p[0] == 'users') {
                    if (action.op[0].p[1] !== agent.name ) {
                        //reject modifications from other users on user object
                        console.log('forbidden to modify user data! (' + agent.name + '!=' + action.op[0].p[1]);
                        action.reject();
                    }
                    else {
                        if (action.op[0].p.length == 2 && action.op[0].od !== undefined) {
                            //user removed - disconnect him
                            removeUser(action.docName, agent.name);
                            console.log('user ' + agent.name + 'disconnected');
                        }
                        action.accept();
                    }
                }
                else {
                    var sheet = action.op[0].p[1],
                        row = action.op[0].p[3],
                        col = action.op[0].p[5];

                    if (action.op[0].p[6] == 'lockedBy' && action.op[0].oi !== void 0) {
                        //save position of the lock so it can be removed if the cell
                        //is still locked when the user disconnects
                        documentDict[action.docName].users[agent.name].lock = { sheet: sheet,
                                                                                row: row,
                                                                                col: col
                                                                              };
                    }
                    else if (action.op[0].p[6] == 'lockedBy' && action.op[0].od !== void 0) {
                        documentDict[action.docName].users[agent.name].lock = {};
                    }

                    action.accept();
                }

                documentDict[action.docName].users[agent.name].timeout = settings.PING_TIMEOUT * 1000;
            }
            else {
                action.accept();
            }
            console.log(agent.name+': '+action.name);
        }
    };

// Attach the sharejs REST and Socket.io interfaces to the server
sharejs.attach(server, options);
server.listen(settings.RT_SERVER_PORT);
console.log('Server running at '+ os.hostname() +':'+settings.RT_SERVER_PORT);
