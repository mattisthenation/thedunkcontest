// Three.js integration setup - 3D only mode
let threeIntegration = null;
const canvas = document.getElementById('game-canvas');

// Dunk animation and visual effects
const dunkAnimations = {
  active: false,
  player: null,
  startTime: 0,
  duration: 900, // Slightly longer duration for more dramatic effect
  startPosition: { x: 0, y: 0 },
  endPosition: { x: 0, y: 0 },
  arcHeight: 220, // Increased height for more impressive long-distance dunks
  callback: null
};



// Camera shake variables
let cameraShake = {
  active: false,
  duration: 0,
  intensity: 0,
  startTime: 0
};

// Add camera shake effect
function addCameraShake(duration = 500, intensity = 10) {
  cameraShake.active = true;
  cameraShake.duration = duration;
  cameraShake.intensity = intensity;
  cameraShake.startTime = Date.now();
}

// Start a dynamic dunk animation
function startDunkAnimation(player, startPos, endPos, callback) {
  dunkAnimations.active = true;
  dunkAnimations.player = player;
  dunkAnimations.startTime = Date.now();
  dunkAnimations.startPosition = startPos;
  dunkAnimations.endPosition = endPos;
  dunkAnimations.callback = callback;
  
  // Save original player position to restore later
  player.originalPosition = { x: player.x, y: player.y };
  
  // Add special "dunking" flag for animation
  player.isDunking = true;
}

// Update dunk animation each frame
function updateDunkAnimation() {
  if (!dunkAnimations.active) return;
  
  const elapsed = Date.now() - dunkAnimations.startTime;
  const progress = Math.min(1, elapsed / dunkAnimations.duration);
  const player = dunkAnimations.player;
  
  if (!player) {
    dunkAnimations.active = false;
    return;
  }
  
  // Calculate position along arc path
  // Use easeInOutQuad for smoother animation
  let t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
  
  // Linear interpolation from start to end position
  player.x = dunkAnimations.startPosition.x + (dunkAnimations.endPosition.x - dunkAnimations.startPosition.x) * t;
  player.y = dunkAnimations.startPosition.y + (dunkAnimations.endPosition.y - dunkAnimations.startPosition.y) * t;
  
  // Add vertical arc (parabola) for jumping effect
  // Sin curve for arc, peaking at the middle of the animation
  const verticalOffset = Math.sin(progress * Math.PI) * dunkAnimations.arcHeight;
  player.y -= verticalOffset;
  
  // Animation complete
  if (progress === 1) {
    dunkAnimations.active = false;
    player.isDunking = false;
    
    // Execute callback if provided
    if (dunkAnimations.callback) {
      dunkAnimations.callback();
    }
  }
}

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

// Particles system handled in particles.js

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
    console.log('Received initial game state:', gameState);
    
    players = gameState.players;
    basketball = gameState.basketball;
    court = gameState.court;
    myPlayerId = socket.id;
    
    if (!players[myPlayerId]) {
      console.error('Player data not found for ID:', myPlayerId);
      alert('Error initializing player data. Please refresh the page.');
      return;
    }
    
    myPlayerName = players[myPlayerId].name;
    console.log('My player initialized:', players[myPlayerId]);
    
    // Create sprite players for all existing players
    if (threeIntegration) {
      Object.values(players).forEach(player => {
        threeIntegration.createSpritePlayer(player.id, player);
      });
      
      // Update basketball position
      if (basketball) {
        threeIntegration.updateBasketball(basketball);
      }
    }
    
    // Update UI with player name
    document.getElementById('player-name').textContent = myPlayerName;
    
    // Update scoreboard
    updateScoreboard();
  });
  
  // Player joined the game
  socket.on('playerJoined', (player) => {
    players[player.id] = player;
    
    // Create sprite player
    if (threeIntegration) {
      threeIntegration.createSpritePlayer(player.id, player);
    }
    
    updateScoreboard();
  });
  
  // Player moved
  socket.on('playerMoved', (player) => {
    players[player.id] = player;
    
    // Update sprite player
    if (threeIntegration) {
      threeIntegration.updateSpritePlayer(player.id, player);
    }
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
    // Play ball bounce sound
    if (window.SoundManager && basketball) {
      // Only play sound if significant movement happened
      const distanceMoved = Math.sqrt(
        Math.pow(basketball.x - updatedBasketball.x, 2) + 
        Math.pow(basketball.y - updatedBasketball.y, 2)
      );
      
      if (distanceMoved > 50) { // Threshold for playing sound
        window.SoundManager.play('bounce', { volume: 0.3 });
      }
    }
    
    basketball = updatedBasketball;
    
    // Update 3D basketball position
    if (threeIntegration) {
      threeIntegration.updateBasketball(basketball);
    }
    
    // Ensure all players' hasBall property is updated when ball moves
    // This fixes the issue where ball icon stays on player after dunking
    if (!updatedBasketball.possessedBy) {
      Object.keys(players).forEach(id => {
        players[id].hasBall = false;
      });
    }
  });
  
  // Player dunked
  socket.on('playerDunked', (data) => {
    if (players[data.playerId]) {
      players[data.playerId].score = data.playerScore;
      
      // Make sure to update the ball possession state
      players[data.playerId].hasBall = false;
      
      // Update UI if it's the current player
      if (data.playerId === myPlayerId) {
        document.getElementById('player-score').textContent = data.playerScore;
      }
      
      // Show NBA Jam style dunk animation with path from start to rim
      showDunkEffect(
        players[data.playerId], 
        data.startPosition, 
        data.dunkPosition, 
        court.hoopX, 
        court.hoopY
      );
      
      // Start 3D dunk animation
      if (threeIntegration) {
        threeIntegration.startDunkAnimation(
          data.playerId,
          data.startPosition,
          data.dunkPosition,
          () => {
            console.log('3D dunk animation completed');
          }
        );
        
        // Add camera shake for dramatic effect
        threeIntegration.addCameraShake(300, 0.5);
      }
      
      // Force update all players to not have the ball after a dunk
      Object.keys(players).forEach(id => {
        players[id].hasBall = false;
      });
      
      // Update scoreboard
      updateScoreboard();
    }
  });
  
  // Player disconnected
  socket.on('playerDisconnected', (playerId) => {
    // Remove sprite player
    if (threeIntegration) {
      threeIntegration.removeSpritePlayer(playerId);
    }
    
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
    
    // Also update 3D sprite player
    if (threeIntegration) {
      threeIntegration.updateSpritePlayer(myPlayerId, player);
    }
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
function showDunkEffect(player, startPosition, dunkPosition, hoopX, hoopY) {
  // Start dynamic dunk animation
  startDunkAnimation(player, startPosition, dunkPosition, () => {
    // This will run when the animation completes
    console.log('Dunk animation completed');
  });
  
  // Create visual effects using the particle system
  if (window.particleEffects) {
    // Create dunk celebration effect at the hoop position
    window.particleEffects.createDunkEffect(hoopX, hoopY, player.outfit.primaryColor);
    
    // Create rim shake effect
    window.particleEffects.createRimShakeEffect(hoopX, hoopY);
    
    // Create net movement effect
    window.particleEffects.createNetMovementEffect(hoopX, hoopY);
    
    // Add camera shake effect
    addCameraShake(300, 15); // Shorter but more intense shake
    
    // Play dunk sound effects
    if (window.SoundManager) {
      window.SoundManager.playDunkEffect();
    }
    
    // Add special trail effect behind the player
    const trailColor = player.outfit.primaryColor;
    const trailCount = 15;
    for (let i = 0; i < trailCount; i++) {
      setTimeout(() => {
        if (window.particleEffects && player) {
          // Create trail particles at player's current position during the dunk
          window.particleEffects.createTrailEffect(player.x, player.y, trailColor);
        }
      }, i * (dunkAnimations.duration / trailCount));
    }
  } else {
    console.log('Dunk effect!'); // Fallback if particle system not available
  }
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

// All 2D drawing functions removed - using 3D only now

// Game loop
function gameLoop() {
  if (!threeIntegration) {
    // Show loading message if 3D not ready yet
    requestAnimationFrame(gameLoop);
    return;
  }
  
  // Update player position (only if not in dunk animation)
  if (players[myPlayerId] && !dunkAnimations.active && !threeIntegration.dunkAnimations.active) {
    updatePlayerPosition();
  }
  
  // Render 3D scene
  threeIntegration.render();
  
  // Debug: Log game state occasionally
  if (Math.random() < 0.01) { // Log roughly every 100 frames
    console.log('Game state:', {
      playerCount: Object.keys(players).length,
      myPlayer: players[myPlayerId],
      basketball: basketball,
      court: court,
      mode: '3D'
    });
  }
  
  // Request next frame
  requestAnimationFrame(gameLoop);
}

// Initialize the game
function init() {
  console.log('Game initializing in 3D mode...');
  
  try {
    // Initialize 3D integration
    threeIntegration = new ThreeGameIntegration();
    console.log('3D integration successful');
    
    // Initialize game components
    initEventListeners();
    initSocketEvents();
    
    // Start the game loop
    console.log('Starting 3D game loop');
    gameLoop();
  } catch (error) {
    console.error('Failed to initialize 3D mode:', error);
    // Show error message on canvas
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Failed to initialize 3D mode. Please refresh.', canvas.width/2, canvas.height/2);
  }
}

// Start the game when the page loads
window.onload = init;
