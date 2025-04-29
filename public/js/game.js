// Canvas setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// Connect to server
const socket = io();

// Game state variables
let players = {};
let basketball = null;
let court = null;
let myPlayerId = null;
let myPlayerName = '';

// Control variables
const keys = {};
let lastJumpTime = 0;
const JUMP_COOLDOWN = 1000; // 1 second cooldown between jumps

// Player animations
const playerAnimations = {
  idle: { frames: 1, currentFrame: 0 },
  run: { frames: 2, currentFrame: 0, frameDelay: 10, frameCounter: 0 },
  jump: { frames: 1, currentFrame: 0 }
};

// Preload images
const images = {
  court: new Image(),
  basketball: new Image(),
  hoop: new Image(),
  playerProfessional: {
    idle: new Image(),
    run1: new Image(),
    run2: new Image(),
    jump: new Image()
  },
  playerStreet: {
    idle: new Image(),
    run1: new Image(),
    run2: new Image(),
    jump: new Image()
  },
  playerRetro: {
    idle: new Image(),
    run1: new Image(),
    run2: new Image(),
    jump: new Image()
  },
  playerColorful: {
    idle: new Image(),
    run1: new Image(),
    run2: new Image(),
    jump: new Image()
  },
  playerTeam: {
    idle: new Image(),
    run1: new Image(),
    run2: new Image(),
    jump: new Image()
  }
};

// Simple placeholder images for now
// In a real game, you'd load actual sprites
images.court.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';
images.basketball.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
images.hoop.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

const outfitTypes = ['professional', 'street', 'retro', 'colorful', 'team'];
outfitTypes.forEach(type => {
  images['player' + type.charAt(0).toUpperCase() + type.slice(1)].idle.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
  images['player' + type.charAt(0).toUpperCase() + type.slice(1)].run1.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
  images['player' + type.charAt(0).toUpperCase() + type.slice(1)].run2.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
  images['player' + type.charAt(0).toUpperCase() + type.slice(1)].jump.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
});

// Initialize event listeners
function initEventListeners() {
  // Keyboard events
  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    
    // Jump/Dunk with Spacebar
    if (e.key === ' ' || e.code === 'Space') {
      attemptJump();
    }
    
    // Get ball with E key
    if (e.key === 'e' || e.key === 'E') {
      socket.emit('getBall');
    }
  });
  
  window.addEventListener('keyup', e => {
    keys[e.key] = false;
  });
}

// Initial socket event handlers
function initSocketEvents() {
  // Initial game state
  socket.on('gameState', (gameState) => {
    players = gameState.players;
    basketball = gameState.basketball;
    court = gameState.court;
    myPlayerId = socket.id;
    myPlayerName = players[myPlayerId].name;
    
    // Update UI with player name
    document.getElementById('player-name').textContent = myPlayerName;
    
    // Update scoreboard
    updateScoreboard();
  });
  
  // Player joined the game
  socket.on('playerJoined', (player) => {
    players[player.id] = player;
    updateScoreboard();
  });
  
  // Player moved
  socket.on('playerMoved', (player) => {
    players[player.id] = player;
  });
  
  // Player jumped
  socket.on('playerJumped', (data) => {
    if (players[data.playerId]) {
      players[data.playerId].isJumping = true;
    }
  });
  
  // Player landed
  socket.on('playerLanded', (data) => {
    if (players[data.playerId]) {
      players[data.playerId].isJumping = false;
    }
  });
  
  // Ball possession changed
  socket.on('ballPossession', (data) => {
    if (players[data.playerId]) {
      basketball = data.basketball;
      players[data.playerId].hasBall = true;
      
      // Update all other players to not have the ball
      Object.keys(players).forEach(id => {
        if (id !== data.playerId) {
          players[id].hasBall = false;
        }
      });
    }
  });
  
  // Basketball moved
  socket.on('basketballMoved', (updatedBasketball) => {
    basketball = updatedBasketball;
  });
  
  // Player dunked
  socket.on('playerDunked', (data) => {
    if (players[data.playerId]) {
      players[data.playerId].score = data.playerScore;
      
      // Update UI if it's the current player
      if (data.playerId === myPlayerId) {
        document.getElementById('player-score').textContent = data.playerScore;
      }
      
      // Show dunk animation/effect
      showDunkEffect();
      
      // Update scoreboard
      updateScoreboard();
    }
  });
  
  // Player disconnected
  socket.on('playerDisconnected', (playerId) => {
    delete players[playerId];
    updateScoreboard();
  });
}

// Update player position based on key presses
function updatePlayerPosition() {
  if (!players[myPlayerId] || players[myPlayerId].isJumping) return;
  
  let moved = false;
  const speed = 5;
  const player = players[myPlayerId];
  
  // Store original position
  const originalX = player.x;
  const originalY = player.y;
  
  // Handle movement
  if ((keys['ArrowUp'] || keys['w'] || keys['W']) && player.y > 0) {
    player.y -= speed;
    moved = true;
  }
  if ((keys['ArrowDown'] || keys['s'] || keys['S']) && player.y < court.height) {
    player.y += speed;
    moved = true;
  }
  if ((keys['ArrowLeft'] || keys['a'] || keys['A']) && player.x > 0) {
    player.x -= speed;
    moved = true;
  }
  if ((keys['ArrowRight'] || keys['d'] || keys['D']) && player.x < court.width) {
    player.x += speed;
    moved = true;
  }
  
  // If player moved, send update to server
  if (moved) {
    socket.emit('playerMovement', {
      x: player.x,
      y: player.y
    });
  }
}

// Attempt to jump/dunk
function attemptJump() {
  const now = Date.now();
  if (now - lastJumpTime < JUMP_COOLDOWN) return;
  
  lastJumpTime = now;
  socket.emit('playerJump');
}

// Show dunk effect/animation
function showDunkEffect() {
  // In a full implementation, this would show a visual effect when a player dunks
  console.log('Dunk effect!');
}

// Update the scoreboard
function updateScoreboard() {
  const scoreboardElement = document.getElementById('player-scores');
  scoreboardElement.innerHTML = '';
  
  // Sort players by score (highest first)
  const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
  
  // Create elements for each player
  sortedPlayers.forEach(player => {
    const playerEntry = document.createElement('div');
    playerEntry.className = 'player-score-entry';
    
    // Highlight current player
    if (player.id === myPlayerId) {
      playerEntry.style.fontWeight = 'bold';
      playerEntry.style.backgroundColor = 'rgba(255, 153, 0, 0.3)';
    }
    
    playerEntry.innerHTML = `
      <span>${player.name}</span>
      <span>${player.score}</span>
    `;
    
    scoreboardElement.appendChild(playerEntry);
  });
}

// Draw functions
function drawCourt() {
  // Draw basketball court
  ctx.fillStyle = '#804000'; // Wooden floor color
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw court markings
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  
  // Court outline
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  
  // Center circle
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
  ctx.stroke();
  
  // Center line
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  
  // Draw hoop
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(court.hoopX - 45, court.hoopY - 5, 90, 5);
  
  // Draw backboard
  ctx.fillStyle = '#fff';
  ctx.fillRect(court.hoopX - 30, court.hoopY - 40, 60, 35);
  
  // Draw rim
  ctx.beginPath();
  ctx.arc(court.hoopX, court.hoopY, 15, 0, Math.PI, false);
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawBasketball() {
  if (!basketball) return;
  
  ctx.beginPath();
  ctx.arc(basketball.x, basketball.y, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#ff6600';
  ctx.fill();
  
  // Draw basketball lines
  ctx.beginPath();
  ctx.arc(basketball.x, basketball.y, 10, 0, Math.PI * 2);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(basketball.x - 10, basketball.y);
  ctx.lineTo(basketball.x + 10, basketball.y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.arc(basketball.x, basketball.y, 10, Math.PI / 2, 3 * Math.PI / 2);
  ctx.stroke();
}

function drawPlayers() {
  Object.values(players).forEach(player => {
    drawPlayer(player);
  });
}

function drawPlayer(player) {
  // Determine player state (idle, running, jumping)
  let state = 'idle';
  
  if (player.isJumping) {
    state = 'jump';
  } else {
    const prevX = player.prevX || player.x;
    const prevY = player.prevY || player.y;
    
    if (prevX !== player.x || prevY !== player.y) {
      state = 'run';
      
      // Update animation frame for running
      if (state === 'run') {
        playerAnimations.run.frameCounter++;
        if (playerAnimations.run.frameCounter >= playerAnimations.run.frameDelay) {
          playerAnimations.run.frameCounter = 0;
          playerAnimations.run.currentFrame = (playerAnimations.run.currentFrame + 1) % playerAnimations.run.frames;
        }
      }
    }
  }
  
  // Store current position for next frame comparison
  player.prevX = player.x;
  player.prevY = player.y;
  
  // Determine the correct sprite based on outfit type
  const outfitKey = 'player' + player.outfit.type.charAt(0).toUpperCase() + player.outfit.type.slice(1);
  
  // Draw player body
  ctx.fillStyle = player.outfit.primaryColor;
  
  if (state === 'jump') {
    // Jumping player (slightly taller)
    ctx.fillRect(player.x - 15, player.y - 30, 30, 50);
  } else if (state === 'run') {
    // Running player
    if (playerAnimations.run.currentFrame === 0) {
      ctx.fillRect(player.x - 15, player.y - 25, 30, 45);
    } else {
      ctx.fillRect(player.x - 15, player.y - 25, 30, 45);
    }
  } else {
    // Idle player
    ctx.fillRect(player.x - 15, player.y - 25, 30, 45);
  }
  
  // Draw player head
  ctx.beginPath();
  ctx.arc(player.x, player.y - 35, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd0a0';
  ctx.fill();
  
  // Draw player jersey number
  ctx.fillStyle = player.outfit.secondaryColor;
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(player.id.slice(0, 2), player.x, player.y - 5);
  
  // Draw player name
  ctx.fillStyle = '#fff';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(player.name, player.x, player.y - 45);
  
  // Draw a ball if player has it
  if (player.hasBall) {
    ctx.beginPath();
    ctx.arc(player.x + 15, player.y - 15, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6600';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  // Draw jump animation
  if (player.isJumping) {
    // Add shadow below player
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 20, 15, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
  }
}

// Game loop
function gameLoop() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Update player position
  if (players[myPlayerId]) {
    updatePlayerPosition();
  }
  
  // Draw game elements
  drawCourt();
  drawPlayers();
  drawBasketball();
  
  // Request next frame
  requestAnimationFrame(gameLoop);
}

// Initialize the game
function init() {
  initEventListeners();
  initSocketEvents();
  gameLoop();
}

// Start the game when the page loads
window.onload = init;
