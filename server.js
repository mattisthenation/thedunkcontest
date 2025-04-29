const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create the Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const players = {};
let basketball = {
  x: 400,
  y: 300,
  possessedBy: null
};

// Court dimensions
const court = {
  width: 800,
  height: 600,
  hoopX: 400, // Center of the court
  hoopY: 50   // Near the top of the court
};

// Name generator for players
function generatePlayerName() {
  const firstNames = [
    "Michael", "LeBron", "Kobe", "Shaquille", "Stephen", "Kevin", "James", 
    "Giannis", "Damian", "Kyrie", "Kawhi", "Anthony", "Luka", "Nikola", 
    "Joel", "Jayson", "Devin", "Donovan", "Zion", "Trae", "Ja", "Zach",
    "Bradley", "Jimmy", "Russell", "Chris", "Paul", "Karl", "Julius"
  ];
  
  const lastNames = [
    "Jordan", "James", "Bryant", "O'Neal", "Curry", "Durant", "Harden",
    "Antetokounmpo", "Lillard", "Irving", "Leonard", "Davis", "Doncic", 
    "Jokic", "Embiid", "Tatum", "Booker", "Mitchell", "Williamson", 
    "Young", "Morant", "LaVine", "Beal", "Butler", "Westbrook", "Paul",
    "George", "Towns", "Randle", "Thompson", "Wade", "Johnson"
  ];
  
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

// Function to generate random outfit
function generateOutfit() {
  const outfitTypes = ["professional", "street", "retro", "colorful", "team"];
  const colors = ["red", "blue", "green", "purple", "orange", "yellow", "black", "white"];
  
  const outfitType = outfitTypes[Math.floor(Math.random() * outfitTypes.length)];
  const primaryColor = colors[Math.floor(Math.random() * colors.length)];
  const secondaryColor = colors[Math.floor(Math.random() * colors.length)];
  
  return {
    type: outfitType,
    primaryColor: primaryColor,
    secondaryColor: secondaryColor
  };
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  // Log active connections
  const connectionCount = io.sockets.sockets.size;
  console.log(`Total active connections: ${connectionCount}`);
  
  // Handle test messages (for debugging)
  socket.on('test', (data) => {
    console.log('Received test message:', data);
    socket.emit('testResponse', { 
      message: 'Test response from server', 
      receivedAt: new Date().toISOString(),
      playerCount: Object.keys(players).length
    });
  });
  
  // Add player to game state
  players[socket.id] = {
    id: socket.id,
    name: generatePlayerName(),
    x: Math.floor(Math.random() * court.width),
    y: Math.floor(Math.random() * court.height),
    outfit: generateOutfit(),
    hasBall: false,
    score: 0,
    isJumping: false
  };
  
  // Send current game state to the new player
  socket.emit('gameState', {
    players: players,
    basketball: basketball,
    court: court
  });
  
  // Notify all players about the new player
  socket.broadcast.emit('playerJoined', players[socket.id]);
  
  // Handle player movement
  socket.on('playerMovement', (movementData) => {
    const player = players[socket.id];
    if (!player) return;
    
    player.x = movementData.x;
    player.y = movementData.y;
    
    // If player has the ball, move the ball with the player
    if (basketball.possessedBy === socket.id) {
      basketball.x = player.x;
      basketball.y = player.y - 10; // Slightly above the player
    }
    
    // Emit player movement to all other players
    socket.broadcast.emit('playerMoved', player);
  });
  
  // Handle player jumping
  socket.on('playerJump', () => {
    const player = players[socket.id];
    if (!player || player.isJumping) return;
    
    player.isJumping = true;
    
    // Check if player can dunk
    if (player.hasBall && Math.abs(player.x - court.hoopX) < 50 && Math.abs(player.y - court.hoopY) < 100) {
      // Player has made a dunk!
      player.score += 2;
      basketball.possessedBy = null;
      player.hasBall = false;
      
      // Reset basketball position
      basketball.x = court.width / 2;
      basketball.y = court.height / 2;
      
      // Broadcast dunk
      io.emit('playerDunked', {
        playerId: socket.id,
        playerName: player.name,
        playerScore: player.score
      });
      
      // Broadcast updated basketball position
      io.emit('basketballMoved', basketball);
    }
    
    // Broadcast jump
    io.emit('playerJumped', {
      playerId: socket.id
    });
    
    // Reset jumping state after a delay
    setTimeout(() => {
      if (players[socket.id]) {
        players[socket.id].isJumping = false;
        io.emit('playerLanded', {
          playerId: socket.id
        });
      }
    }, 1000);
  });
  
  // Handle player attempting to get the ball
  socket.on('getBall', () => {
    const player = players[socket.id];
    if (!player) return;
    
    // Check if ball is not possessed and player is close to the ball
    if (!basketball.possessedBy && 
        Math.abs(player.x - basketball.x) < 30 && 
        Math.abs(player.y - basketball.y) < 30) {
      
      basketball.possessedBy = socket.id;
      player.hasBall = true;
      
      // Move the ball with the player
      basketball.x = player.x;
      basketball.y = player.y - 10;
      
      // Broadcast ball possession
      io.emit('ballPossession', {
        playerId: socket.id,
        basketball: basketball
      });
    }
  });
  
  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // Check if player exists before attempting to handle disconnection
    if (!players[socket.id]) {
      console.log('Warning: Player', socket.id, 'disconnected but not found in players list');
      return;
    }
    
    // If disconnecting player had the ball, reset ball position
    if (basketball.possessedBy === socket.id) {
      basketball.possessedBy = null;
      basketball.x = court.width / 2;
      basketball.y = court.height / 2;
      
      // Broadcast updated basketball position
      io.emit('basketballMoved', basketball);
    }
    
    // Log player info before removal
    console.log('Removing player data:', players[socket.id]);
    
    // Remove player from game state
    delete players[socket.id];
    
    // Log remaining players
    console.log('Remaining player count:', Object.keys(players).length);
    
    // Notify all players about the disconnected player
    io.emit('playerDisconnected', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
