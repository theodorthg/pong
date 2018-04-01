var myId=0;
var paddlesList;
var paddle;
var player;
var ready = false;
var cursors;

var eurecaServer;
//this function will handle client communication with the server
var eurecaClientSetup = function () {
    //create an instance of eureca.io client
    var eurecaClient = new Eureca.Client();

    eurecaClient.ready(function (proxy) {
        eurecaServer = proxy;
    });


    //methods defined under "exports" namespace become available in the server side

    eurecaClient.exports.setId = function (id) {
        //create() is moved here to make sure nothing is created before uniq id assignation
        myId = id;
        console.log('Client ready=true...%s', myId);
        create();
        eurecaServer.handshake();
        ready = true;
    }

    eurecaClient.exports.kill = function (id) {
        if (paddlesList[id]) {
            paddlesList[id].kill();
            console.log('killing ', id, paddlesList[id]);
        }
    }

    eurecaClient.exports.spawnPaddle = function (i, x, y) {

        if (i == myId) return; //this is me

        console.log('SPAWN Paddle');
        var pad = new Paddle(i, game, paddle);
        paddlesList[i] = pad;
    }

    eurecaClient.exports.updateState = function (id, state) {
        if (paddlesList[id]) {
            paddlesList[id].cursor = state;
            paddlesList[id].paddle.x = state.x;
            paddlesList[id].paddle.y = state.y;
            paddlesList[id].update();
        }
    }
}


Paddle = function (index, game, player) {
    this.cursor = {
        down: false,
        up: false,
    }

    this.input = {
        down: false,
        up: false,
    }

    var x = 0;
    var y = 0;

    this.game = game;
    this.player = player;
    
    this.paddle = game.add.sprite(x, y, 'paddle');

    this.paddle.id = index;
    console.log('Paddle-index: %s', index);
}

Paddle.prototype.update = function() {
	
	var inputChanged = (
		this.cursor.up != this.input.up ||
		this.cursor.down != this.input.down
	);
		
	if (inputChanged)
	{
		//Handle input change here
		//send new values to the server		
		if (this.paddle.id == myId)
		{
			// send latest valid state to the server
			this.input.x = this.paddle.x;
			this.input.y = this.paddle.y;
						
			eurecaServer.handleKeys(this.input);
			
		}
    }
}

Paddle.prototype.kill = function() {
	this.paddle.kill();
}

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', {
    preload: preload,
    create: eurecaClientSetup,  // statt create
    update: update
});

var paddle1;
var paddle2;
var ball;
//var paddle;

var ball_launched;
var ball_velocity;

var score1_text;
var score2_text;

var score1;
var score2;

var vy;

var bspeedlimit_x;
var bspeedlimit_y;

var scale_a;
var scale_b;

function preload() {
    game.load.image('paddle', 'assets/paddle.png');
    game.load.image('ball', 'assets/ball.png');

    game.load.bitmapFont('font', 'assets/font.png', 'assets/font.xml');

    game.load.audio('hit_1', 'assets/hit_1.wav');
    game.load.audio('hit_2', 'assets/hit_2.wav');


}

function create() {
    
    paddlesList = {};
	
	player = new Paddle(myId, game, paddle);
	paddlesList[myId] = player;
	paddle = player.paddle;
    
    ball_launched = false;
    ball_velocity = 400;

    scale_a = 1 // window.screen.width / 1024;
    scale_b = 1 // window.screen.height / 768;

    paddle1 = create_paddle(0, game.world.centerY);
    paddle2 = create_paddle(game.world.width - 8, game.world.centerY);
    ball = create_ball(game.world.centerX, game.world.centerY);

    game.input.onDown.add(launch_ball, this);

    score1_text = game.add.bitmapText(game.world.width / 4, 128, 'font', '0', 64);
    score2_text = game.add.bitmapText(game.world.width - game.world.width / 4, 128, 'font', '0', 64);

    score1 = 0;
    score2 = 0;

    vy = 1;

    bspeedlimit_x = 3000;
    bspeedlimit_y = 800;

    cursors = game.input.keyboard.createCursorKeys();
}

function update() {

    if (!ready) return;
    
	player.input.down = cursors.down.isDown;
	player.input.up = cursors.up.isDown;

    score1_text.text = score1;
    score2_text.text = score2;

    game.input.pointer1.y = game.input.y


    control_paddle(paddle1, game.input.y);
    control_paddle(paddle1, game.input.pointer1.y);

    game.physics.arcade.collide(paddle1, ball, function () {
        game.sound.play('hit_1');
    });
    game.physics.arcade.collide(paddle2, ball, function () {
        game.sound.play('hit_2');
    });

    if (ball.body.blocked.left) {
        score2 += 1;
    }
    else if (ball.body.blocked.right) {
        score1 += 1;
    }

    paddle2.body.velocity.setTo(ball.body.velocity.y);
    paddle2.body.velocity.x = 0;
    paddle2.body.maxVelocity.y = 250;

    vy += 0.00001;
    ball.body.bounce.setTo(vy, vy);

    if (ball.body.velocity.x < -bspeedlimit_x) {
        ball.body.velocity.x = -bspeedlimit_x;
    }
    else if (ball.body.velocity.x > bspeedlimit_x) {
        ball.body.velocity.x = bspeedlimit_x;
    }

    if (ball.body.velocity.y < -bspeedlimit_y) {
        ball.body.velocity.y = -bspeedlimit_y;
    }
    else if (ball.body.velocity.y > bspeedlimit_y) {
        ball.body.velocity.y = bspeedlimit_y;
    }

}

function create_paddle(x, y) {
    var paddle = game.add.sprite(x, y, 'paddle');
    paddle.anchor.setTo(0.5, 0.5);
    game.physics.arcade.enable(paddle);
    paddle.body.collideWorldBounds = true;
    paddle.body.immovable = true;
    paddle.scale.setTo(scale_a, scale_b);


    return paddle;
}

function control_paddle(paddle, y) {

    this.activePointer = null;
    paddle.y = y;

    if (paddle.y < paddle.height / 2) {
        paddle.y = paddle.height / 2;
    } else if (paddle.y > game.world.height - paddle.height / 2) {
        paddle.y = game.world.height - paddle.height / 2;
    }
}

function create_ball(x, y) {
    var ball = game.add.sprite(x, y, 'ball');
    ball.anchor.setTo(0.5, 0.5);
    game.physics.arcade.enable(ball);
    ball.body.collideWorldBounds = true;
    ball.body.bounce.setTo(1, 1);
    ball.body.maxVelocity = 600;
    ball.scale.setTo(scale_a + scale_a / 4, scale_b + scale_b / 4);

    return ball;
}

function launch_ball() {
    if (ball_launched) {
        ball.x = game.world.centerX;
        ball.y = game.world.centerY;
        ball.body.velocity.setTo(0, 0);
        ball_launched = false;
    } else {
        ball.body.velocity.x = -ball_velocity;
        ball.body.velocity.y = ball_velocity;
        ball_launched = true;
    }

}

