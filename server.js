var express = require('express')
  , app = express(app)
  , server = require('http').createServer(app);

// serve static files from the current directory
app.use(express.static(__dirname));

//we'll keep clients data here
var clients = {};
  
//get EurecaServer class
var EurecaServer = require('eureca.io').EurecaServer;

//create an instance of EurecaServer
var eurecaServer = new EurecaServer({allow:['setId', 'spawnPaddle', 'updateState', 'kill']});

//attach eureca.io to our http server
eurecaServer.attach(server);
console.log('Attached New Eureca Server');

//eureca.io provides events to detect clients connect/disconnect

//detect client connection
eurecaServer.onConnect(function (conn) {    
    console.log('Server onConnect. New Client id=%s ', conn.id, conn.remoteAddress);
	if (Object.keys(clients).length >= 2) {
		console.log('Server: to many clients: count =', Object.keys(clients).length);
		return;
	}
	//the getClient method provide a proxy allowing us to call remote client functions
    var remote = eurecaServer.getClient(conn.id);    
	
	//register the client
	clients[conn.id] = {id:conn.id, remote:remote, idx:-1}
	console.log('Server: All clients keys=%s ',Object.keys(clients));
	console.log('Server: Number of clients: %s', Object.keys(clients).length);
	var element, index, idx;

	Object.keys(clients).forEach(function (element, index) {
		console.log('Server onConnect element: %s',element); // logs conn.id
		console.log('Server onConnect index: %s',index); // logs 0, 1, 2 ...
		if (element == conn.id) {
			idx = index;
			clients[conn.id].idx = index;
		}
	});
	
	//here we call setId (defined in the client side)
	console.log('Server: calling remote setId: %s, index: %s', conn.id, idx);
	remote.setId(conn.id, idx);	
});

//detect client disconnection
eurecaServer.onDisconnect(function (conn) {    
    console.log('Client disconnected ', conn.id);
	
	var removeId = clients[conn.id].id;
	
	delete clients[conn.id];
	
	for (var c in clients)
	{
		var remote = clients[c].remote;
		
		//here we call kill() method defined in the client side
		remote.kill(conn.id);
	}
	console.log('Number of clients: %s', Object.keys(clients).length);	
});


eurecaServer.exports.handshake = function()
{
	for (var c in clients)
	{
		var remote = clients[c].remote;
		for (var cc in clients)
		{		
			//send latest known position
			var x;
			if (clients[cc].idx == 0) {
				x = 0;
			}
			else {
				x = 800-8;
			}
			// var x = clients[cc].laststate ? clients[cc].laststate.x:  0;
			var y = clients[cc].laststate ? clients[cc].laststate.y:  0;

			console.log('Server handshake calling remote spawnPaddle() id: %s, x: %s, y: %s, idx: %s', clients[cc].id, x, y, clients[cc].idx);
			remote.spawnPaddle(clients[cc].id, x, y, clients[cc].idx);
					
		}
	}
}


//be exposed to client side
eurecaServer.exports.handleKeys = function (keys) {
	var conn = this.connection;
	var updatedClient = clients[conn.id];
	
	for (var c in clients)
	{
		var remote = clients[c].remote;
		remote.updateState(updatedClient.id, keys);
		
		//keep last known state so we can send it to new connected clients
		clients[c].laststate = keys;
	}
}
server.listen(8000);