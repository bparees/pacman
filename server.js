#!/bin/env node
//  OpenShift sample Node application

var express = require('express');
var fs      = require('fs');
var http    = require('http');

//  Local cache for static content [fixed and loaded at startup]
var zcache = { 'index.html': '' };
zcache['index.html'] = fs.readFileSync('./index.html'); //  Cache index.html

// Create "express" app and http server.
var app  = express();
var server = http.createServer(app);


/*  =====================================================================  */
/*  Setup route handlers.  */
/*  =====================================================================  */

// Handler for GET /health
app.get('/health', function(req, res){
    res.send('1');
});

// Handler for GET /
app.get('/', function(req, res){
    res.set('Content-Type', 'text/html');
    res.send(zcache['index.html']);
});

function serveFile(req, res, file, file_type) {
    fs.readFile(file, function(err, data) {
        if (err) {
           throw err;
        }

        console.log('%s: serving static content %s', Date(Date.now() ),
                    file);
        res.set('Content-Type', file_type);
        res.send(data);
    });
}

app.get('/board.png', function(req, res){
    serveFile(req, res, 'images/board.png', 'image/png');
});

app.get('/blinky.gif', function(req, res){
    serveFile(req, res, 'images/blinky.gif', 'image/gif');
});

app.get('/inky.png', function(req, res){
    serveFile(req, res, 'images/inky.png', 'image/png');
});

app.get('/pinky.png', function(req, res){
    serveFile(req, res, 'images/pinky.png', 'image/png');
});

app.get('/clyde.png', function(req, res){
    serveFile(req, res, 'images/clyde.png', 'image/png');
});

app.get('/pacman.png', function(req, res){
    serveFile(req, res, 'images/pacman.png', 'image/png');
});

app.get('/pacman.wav', function(req, res){
    serveFile(req, res, 'media/pacman.wav', 'audio/wav');
});

app.get('/game.js', function(req, res){
    serveFile(req, res, 'game.js', 'text/javascript');
});


//  Get the environment variables we need.
var ipaddr  = process.env.OPENSHIFT_NODEJS_IP ||
              process.env.OPENSHIFT_INTERNAL_IP;
var port    = process.env.OPENSHIFT_NODEJS_PORT   ||
              process.env.OPENSHIFT_INTERNAL_PORT || 8080;

if (typeof ipaddr === "undefined") {
   console.warn('No OPENSHIFT_*_IP environment variable');
}

//  terminator === the termination handler.
function terminator(sig) {
   if (typeof sig === "string") {
      console.log('%s: Received %s - terminating Node server ...',
                  Date(Date.now()), sig);
      process.exit(1);
   }
   console.log('%s: Node server stopped.', Date(Date.now()) );
}

//  Process on exit and signals.
process.on('exit', function() { terminator(); });

['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS',
 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach(function(element, index, array) {
    process.on(element, function() { terminator(element); });
});

//  And start the app on that interface (and port).
var ioserver = server.listen(port, ipaddr, function() {
   console.log('%s: Node server started on %s:%d ...', Date(Date.now() ),
               ipaddr, port);
});

(function() {
   var blinky, counter, ghosts, io, pacman, pinky, mongo, murl, dbconn,
       iosocket, pacmanController, lastUpdateTimestamp;
   pacmanController = false;
   io = require('socket.io');
   mongo = require('mongodb');
   murl = "mongodb://" + process.env.OPENSHIFT_MONGODB_DB_USERNAME +
          ":" + process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" + 
          process.env.OPENSHIFT_MONGODB_DB_HOST + ":" +
          process.env.OPENSHIFT_MONGODB_DB_PORT + "/" +
          process.env.OPENSHIFT_APP_NAME;
   mongo.connect(murl, function(err, conn) {
      conn.on('error', function(err) {
         return console.log('%s: Mongo connect error %s',
                            Date(Date.now() ), err);
      });
      dbconn = conn;
   });
   iosocket = io.listen(ioserver);
   var socket = iosocket.sockets;
   pacman = { type: 'location', x: 450, y: 150, sprite: 'pacman' };
   blinky = { x: 10, y: 60 };
   pinky = { x: 10, y: 30 };
   ghosts = ['clyde', 'inky', 'blinky', 'pinky'];
   counter = 0;
   socket.on('connection', function(client) {
      var getSprite, ghost;
      getSprite = function(name) {
         // console.log('%s: reading location for ghost %s', Date(Date.now() ),name);
         var coldata = dbconn.collection('pacman').find({name: name},
                                                        {limit: 1});
         if (!coldata) coldata = { }
         if (!coldata.data) {
            var offsets = { 'clyde': 0,  'blinky': 30, 'inky': 60,
                            'pinky': 90, 'pacman': 200 };
            coldata.data = { }
            coldata.data.x = 490 - offsets[name];
            coldata.data.y = 220
         }

         msg = { type: 'location', sprite: name, x: coldata.data.x, y:
                 coldata.data.y };
         // console.log(coldata);
         // console.log(msg);
         return client.emit('pacman-message', msg);
      };
      ghost = ghosts.pop();
      if (pacmanController == false) {
         console.log("%s: assigning pacman", Date(Date.now() ));
         client.emit('pacman-message', { type: 'pacman', name: 'pacman' });
         pacmanController = client;
      }
      if (ghost) {
         console.log("%s: assigning ghost %s", Date(Date.now() ), ghost);
         client.emit('pacman-message', { type: 'ghost', name: ghost });
         client.broadcast.emit('pacman-message', { type: 'newghost' });
      }
      else
         client.emit('pacman-message', {type: 'full' });

      var s, sprites = ['pacman', 'clyde', 'inky', 'blinky', 'pinky'];
      while (sprites.length > 0) {
         s = sprites.pop();
         if (typeof s === "undefined") break;
         if (s != ghost) 
            getSprite(s);
      }

      ensurePacmanIsRunning = function() {
         if ((new Date().getTime() - lastUpdateTimestamp) > 10000) {
            if (pacmanController != false)
               pacmanController.emit('pacman-message', { type: 'lose-pacman', name: 'pacman' });

            pacmanController = false;
         }
      }

      setInterval(ensurePacmanIsRunning, 5000);

      client.on('pacman-message', function(message) {
         switch (message.type) {
            case 'location':
               // console.log('%s: inserting %s @ %d,%d', Date(Date.now() ),
               //             message.ghost, message.x, message.y);
               if ('pacman' == message.ghost) {
                  lastUpdateTimestamp = new Date().getTime();
               }
               dbconn.collection('pacman').save({ _id: message.ghost,
                        data : { x: message.x, y: message.y }},
                                 function(err) { });
               if (pacmanController == false) {
                  console.log("%s: assigning pacman", Date(Date.now() ));
                  var pmsg = { type: 'pacman', name: 'pacman' };
                  client.emit('pacman-message', pmsg);
                  pacmanController = client;
               }
               var pmsg = { type: 'location', sprite: message.ghost,
                           x: message.x, y: message.y };
               return client.broadcast.emit('pacman-message', pmsg);
            case 'win':
               console.log('%s: ghost %s won', Date(Date.now() ), ghost);
               var wmsg = { type: 'win', ghost: ghost };
               client.broadcast.emit('pacman-message', wmsg);
               return client.emit('pacman-message', wmsg);
         }
      });
      return client.on('disconnect', function() {
         console.log('%s: client disconnected', Date(Date.now() ));
         if (pacmanController == client) {
            console.log('%s: lost pacman controller', Date(Date.now() ));
            pacmanController = false;
         }
         if (ghost) {
            ghosts.push(ghost);
            console.log('%s: resetting %s', Date(Date.now() ), ghost);
            dbconn.collection('pacman').save({ _id: ghost,
                                              data : { x: -100, y: -100 }},
                                             function(err) { });
            var msg = { type: 'location', sprite: ghost, x: -100, y: -100 };
            return client.broadcast.emit('pacman-message', msg);
         }
         else {
            console.log('%s: resetting viewer - was a full house today',
                        Date(Date.now() ));
         }

      });
   });
}).call(this);


