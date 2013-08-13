var WebSocketServer = require('websocket').server;
var http = require('http');
var util = require('util') ;
var getSession = require('./app.js').getSession;
var killSession = require('./app.js').killSession;
var connections = {};
var connectionIDCounter = 0;
var mastersock;
var lastsock;

var sendClientlist = function(sock) {   //this is ugly and produces massive overhead, if there are 100 clients up and 1 leaves you send 99 redudant information
    if (!sock)                          //would be way better to make individual calls for joining/leaving clients.
        return;
    var cid = [];
    for (var key in connections) {
        cid.push({id : connections[key].id, ip : connections[key].socket.remoteAddress});
    }
    try {
        sock.sendUTF(JSON.stringify({type : "clientlist", clients : cid}));
    } catch(e) {
        console.log('Error sending message ', e);
    }
}


var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(81, function() {
    console.log((new Date()) + ' Server is listening on port 81');
});


wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false,
    closeTimeout : 2000,
    keepaliveInterval : 10000   //max 12 second delay if somebody unexpectedly d/cs
});

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;  //#YOLO
}

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    var connection = request.accept(null, request.origin);  //accept

    //Check for requested path & session set
    getSession(request.httpRequest, function (session) {    //TODO: NEEDS REFACTORING
        console.log(util.inspect(session));
        if (session !== null) {
            connection.session = session;
            if (connection.session.authorized && request.resource == '/master') {
                mastersock = connection;
                console.log('Mastersock Connection accepted.');
            } else {
                connection.close(); 
                console.log((new Date()) + ' Connection unauthed master closed');
                return;                
            }
            console.log('Session: ' + util.inspect(session));  
        } else {
            connection.id = connectionIDCounter ++;
            connections[connection.id] = connection;
            console.log(connection.id + 'Client Connection accepted.');
        }
        sendClientlist(mastersock);
    });    


    connection.on('message', function(message) {
        try{
            if (connection == mastersock) {
                //we got a command from the webpanel
                var cmd = JSON.parse(message.utf8Data);
                lastsock = cmd.id;
                connections[cmd.id].send(cmd.msg);
                if (cmd.msg == 'stopsession') { lastsock = -1;}
                console.log('Send to ' + cmd.id + ': ' + cmd.msg);
            } else {
                //message from a non authed guy, should be a slave.
                if (mastersock) {
                    mastersock.send(JSON.stringify({type : 'cmdreply', msg : message.utf8Data}));
                    console.log('Send to Mastersock: ' + message.utf8Data);
                }
            }
        } catch (e){
            console.log('Error relaying message ', e);
        }
    });

    connection.on('close', function(reasonCode, description) {
        if (connection == mastersock) {
            killSession(request.httpRequest);
            console.log('UNSET MASTERSOCK'); 
            //send stopsession if browser closes
            try {
                connections[lastsock].send('stopsession');
            } catch (e){
                console.log('Error sending close message ', e);
            }
        } else {
            delete connections[connection.id];       
            console.log('UNSET CLIENT ' + connection.id);   
            sendClientlist(mastersock);  
        }

        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });

    connection.on('error', function(e) {
        console.log('ERROR ' + util.inspect(e));        
    });   
});