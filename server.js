// server.js - Game server for The Dunk Contest

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files
app.use(express.static('public'));

// Game state
const gameState = {
    players: {},
    ball: {
        position: { x: 0, y: 0.3, z: 0 },  // Changed from y: 1 to y: 0.3 (ground level)
        velocity: { x: 0, y: 0, z: 0 },
        carrier: null,
        inFlight: false,
        targetHoop: null,
        willScore: false,
        shooter: null
    },
    scores: {}
};

// Player name generator
const firstNames = ['Thunder', 'Lightning', 'Fire', 'Ice', 'Shadow', 'Phoenix', 'Storm', 'Blaze'];
const lastNames = ['Slam', 'Dunk', 'Jam', 'Break', 'Crash', 'Force', 'Power', 'Strike'];

function generatePlayerName() {
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${first} ${last}`;
}

// Team colors for variety
const teamColors = [
    { primary: '#FF0000', secondary: '#FFFFFF' }, // Red/White
    { primary: '#0080FF', secondary: '#FFFFFF' }, // Blue/White
    { primary: '#00FF00', secondary: '#000000' }, // Green/Black
    { primary: '#FFD700', secondary: '#000080' }, // Gold/Navy
    { primary: '#FF00FF', secondary: '#FFFF00' }, // Magenta/Yellow
    { primary: '#00FFFF', secondary: '#FF00FF' }, // Cyan/Magenta
    { primary: '#FF4500', secondary: '#000000' }, // Orange/Black
    { primary: '#800080', secondary: '#FFD700' }  // Purple/Gold
];

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Create new player
    const player = {
        id: socket.id,
        name: generatePlayerName(),
        position: { 
            x: (Math.random() - 0.5) * 10, 
            y: 0, 
            z: (Math.random() - 0.5) * 10 
        },
        velocity: { x: 0, y: 0, z: 0 },
        animation: 'idle',
        facingDirection: 1,
        teamColors: teamColors[Math.floor(Math.random() * teamColors.length)],
        jerseyNumber: Math.floor(Math.random() * 99) + 1,
        hasBall: false
    };

    // Add player to game state
    gameState.players[socket.id] = player;
    gameState.scores[socket.id] = 0;

    // Send initial data to the new player
    socket.emit('initialize', {
        playerId: socket.id,
        gameState: gameState
    });

    // Notify other players
    socket.broadcast.emit('playerJoined', player);

    // Handle player movement
    socket.on('move', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].position = data.position;
            gameState.players[socket.id].velocity = data.velocity;
            gameState.players[socket.id].animation = data.animation;
            gameState.players[socket.id].facingDirection = data.facingDirection;

            // If player has ball, move ball with player
            if (gameState.ball.carrier === socket.id) {
                gameState.ball.position = {
                    x: data.position.x,
                    y: data.position.y + 2,
                    z: data.position.z
                };
            }

            // Broadcast to other players
            socket.broadcast.emit('playerMoved', {
                playerId: socket.id,
                position: data.position,
                velocity: data.velocity,
                animation: data.animation,
                facingDirection: data.facingDirection
            });
        }
    });

    // Handle ball pickup
    socket.on('pickupBall', () => {
        console.log('Ball pickup attempt by:', socket.id);
        console.log('Ball carrier:', gameState.ball.carrier);
        console.log('Ball position:', gameState.ball.position);
        
        if (!gameState.ball.carrier) {
            const player = gameState.players[socket.id];
            console.log('Player position:', player.position);
            
            const ballPos = gameState.ball.position;
            const distance = Math.sqrt(
                Math.pow(player.position.x - ballPos.x, 2) +
                Math.pow(player.position.z - ballPos.z, 2)
            );
            
            console.log('Distance to ball:', distance);

            // Check if player is close enough to pick up ball (increased to 2.5)
            if (distance < 2.5) {
                console.log('Pickup successful!');
                gameState.ball.carrier = socket.id;
                gameState.players[socket.id].hasBall = true;
                
                io.emit('ballPickedUp', {
                    playerId: socket.id,
                    ballPosition: gameState.ball.position
                });
            } else {
                console.log('Too far from ball! Need to be within 2.5 units');
            }
        } else {
            console.log('Ball already carried by:', gameState.ball.carrier);
        }
    });

    // Handle dunk attempt
    socket.on('attemptDunk', (data) => {
        console.log('Dunk attempt received from:', socket.id);
        console.log('Dunk data:', data);
        
        if (gameState.ball.carrier === socket.id) {
            const player = gameState.players[socket.id];
            console.log('Player position:', player.position);
            
            // Check if near either hoop (hoops at z = -13 and z = 13)
            const nearLeftHoop = Math.abs(player.position.z - (-13)) < 3 && Math.abs(player.position.x) < 3;
            const nearRightHoop = Math.abs(player.position.z - 13) < 3 && Math.abs(player.position.x) < 3;
            
            console.log('Near left hoop:', nearLeftHoop);
            console.log('Near right hoop:', nearRightHoop);
            
            if (nearLeftHoop || nearRightHoop) {
                // Successful dunk!
                gameState.scores[socket.id] += 2;
                console.log('Dunk successful! Score:', gameState.scores[socket.id]);
                
                // Reset ball at random position
                const randomX = (Math.random() - 0.5) * 16;
                const randomZ = (Math.random() - 0.5) * 20;
                gameState.ball.carrier = null;
                gameState.ball.position = { x: randomX, y: 0.3, z: randomZ };
                gameState.players[socket.id].hasBall = false;
                
                io.emit('dunkScored', {
                    playerId: socket.id,
                    playerName: player.name,
                    score: gameState.scores[socket.id],
                    dunkType: data.dunkType || 'basic'
                });
                
                io.emit('ballDropped', {
                    position: gameState.ball.position
                });
            } else {
                console.log('Too far from hoop to dunk');
            }
        } else {
            console.log('Player does not have ball');
        }
    });
    
    // Handle shot attempt
    socket.on('attemptShot', (shotData) => {
        if (gameState.ball.carrier === socket.id) {
            const player = gameState.players[socket.id];
            
            // Release ball with trajectory
            gameState.ball.carrier = null;
            gameState.players[socket.id].hasBall = false;
            
            // Start ball flight
            gameState.ball.inFlight = true;
            gameState.ball.velocity = shotData.velocity;
            gameState.ball.targetHoop = shotData.targetHoop;
            gameState.ball.willScore = shotData.willScore;
            gameState.ball.shooter = socket.id;
            
            io.emit('shotReleased', {
                playerId: socket.id,
                playerName: player.name,
                ballPosition: player.position,
                velocity: shotData.velocity,
                targetHoop: shotData.targetHoop
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // If player had ball, drop it
        if (gameState.ball.carrier === socket.id) {
            gameState.ball.carrier = null;
            gameState.ball.position = gameState.players[socket.id].position;
            io.emit('ballDropped', {
                position: gameState.ball.position
            });
        }
        
        // Remove player
        delete gameState.players[socket.id];
        delete gameState.scores[socket.id];
        
        // Notify other players
        socket.broadcast.emit('playerLeft', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`The Dunk Contest server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play!`);
});

// Ball physics update loop (30 FPS)
setInterval(() => {
    if (gameState.ball.inFlight) {
        updateBallPhysics();
    }
}, 1000 / 30);

// Update ball physics
function updateBallPhysics() {
    const ball = gameState.ball;
    const dt = 1 / 30; // Delta time
    const gravity = -15;
    
    // Apply gravity
    ball.velocity.y += gravity * dt;
    
    // Update position
    ball.position.x += ball.velocity.x * dt;
    ball.position.y += ball.velocity.y * dt;
    ball.position.z += ball.velocity.z * dt;
    
    // Check if ball reached hoop height or ground
    const hoopY = 3;
    const hoopRadius = 0.75;
    
    // Check for score
    if (ball.targetHoop && ball.position.y <= hoopY && ball.position.y > 0) {
        const dx = ball.position.x - ball.targetHoop.x;
        const dz = ball.position.z - ball.targetHoop.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < hoopRadius && ball.willScore) {
            // Score!
            ball.inFlight = false;
            
            if (ball.shooter && gameState.players[ball.shooter]) {
                gameState.scores[ball.shooter] += 2;
                
                io.emit('shotScored', {
                    playerId: ball.shooter,
                    playerName: gameState.players[ball.shooter].name,
                    score: gameState.scores[ball.shooter]
                });
            }
            
            // Drop ball below hoop
            ball.position.y = 0.3;
            ball.velocity = { x: 0, y: 0, z: 0 };
            
            io.emit('ballDropped', {
                position: ball.position
            });
            
            ball.shooter = null;
            ball.targetHoop = null;
        }
    }
    
    // Ground collision
    if (ball.position.y <= 0.3) {
        ball.position.y = 0.3;
        ball.velocity.y *= -0.7; // Bounce
        
        // Stop bouncing if too small
        if (Math.abs(ball.velocity.y) < 0.5) {
            ball.velocity.y = 0;
            ball.inFlight = false;
            
            // Missed shot
            if (ball.shooter) {
                io.emit('shotMissed', {
                    playerId: ball.shooter,
                    playerName: gameState.players[ball.shooter] ? gameState.players[ball.shooter].name : 'Unknown'
                });
            }
            
            io.emit('ballDropped', {
                position: ball.position
            });
            
            ball.shooter = null;
            ball.targetHoop = null;
        }
        
        // Apply friction
        ball.velocity.x *= 0.9;
        ball.velocity.z *= 0.9;
    }
    
    // Broadcast ball position during flight
    if (ball.inFlight) {
        io.emit('ballUpdate', {
            position: ball.position,
            velocity: ball.velocity
        });
    }
}