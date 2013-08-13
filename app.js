var util = require('util') ;
var path = require('path');
var express = require('express');
var app = express();
var MemoryStore = express.session.MemoryStore;
var     sessionStore = new MemoryStore();
var cookie = require('cookie');



//EXPRESS INIT
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({store: sessionStore, secret: 'carrawaygatsbyfaybuchananbaker'}));
app.use(express.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

//SESSION FUNCTIONS

exports.getSession = function(req, callback) {
    if (!req.headers.cookie) {
        callback(null);
        return;
    }
    var sessionCookie = cookie.parse(req.headers.cookie)['connect.sid'];
    var sessionID = sessionCookie.substr(2, sessionCookie.indexOf('.') - 2); //TODO: fix ugly hack
    if (sessionID) {
        sessionStore.get(sessionID, function(err, session) {
        // session here                                                  v--    we got a login user here, he can send commands
            console.log('Session: ' + console.log(sessionID) + ' - ' + session.authorized);
            callback(session);
            return;
        });
    } else {
        callback(null);
    }
};

exports.killSession = function(req) {
    if (!req.headers.cookie) {
        callback(null);
        return;
    }
    var sessionCookie = cookie.parse(req.headers.cookie)['connect.sid'];
    var sessionID = sessionCookie.substr(2, sessionCookie.indexOf('.') - 2); //TODO: fix, ugly hack
    if (sessionID) {
        sessionStore.destroy(sessionID);
    }
};


//EXPRESS FUNCTIONS
app.get('/', function(req, res){
    if (req.session && req.session.authorized) {
      res.sendfile('index.html')
    }
    else {
      res.sendfile('login.html');
    }
});

app.post('/login', function(req, res){
    if (req.body.pw == 't00r') {
        req.session.authorized = true;
        res.send('success');
    } else {
        res.send('failure');
    }
});

app.listen(80);

var websock = require('./websock.js');