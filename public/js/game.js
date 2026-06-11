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
let court = { width: 800, height: 600, hoopX: 400, hoopY: 150 }; // Default 2D court dimensions
let myPlayerId = null;
let myPlayerName = '';

// Control variables
const keys = {};
let lastJumpTime = 0;
const JUMP_COOLDOWN = 1000; // 1 second cooldown between jumps

// Coordinate conversion functions
function convert2DToServer3D(x2d, y2d) {
  // Convert 2D game coordinates (0-800, 0-600) to server 3D coordinates
  const x3d = ((x2d - 400) / 400) * 10; // Map to -10 to 10
  const z3d = ((y2d - 300) / 300) * 15; // Map to -15 to 15
  return { x: x3d, y: 0, z: z3d };
}

function convertServer3DTo2D(x3d, y3d, z3d) {
  // Convert server 3D coordinates back to 2D game coordinates
  const x2d = (x3d / 10) * 400 + 400;
  const y2d = (z3d / 15) * 300 + 300;
  return { x: x2d, y: y2d };
}

// Initialize event listeners
function initEventListeners() {
  // Keyboard events
  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    
    // Jump/Dunk with Spacebar
    if (e.key === ' ' || e.code === 'Space') {
      attemptJumpOrDunk();
    }
    
    // Get ball with E key
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      console.log('E key pressed - attempting ball pickup');
      
      if (!players[myPlayerId]) {
        console.error('Player not initialized yet');
        return;
      }
      
      if (!basketball) {
        console.error('Basketball not initialized yet');
        return;
      }
      
      // Ensure we have the latest position synced with server
      const player = players[myPlayerId];
      const pos3d = convert2DToServer3D(player.x, player.y);
      
      console.log('My 2D position:', player.x, player.y);
      console.log('My 3D position:', pos3d);
      console.log('Basketball 2D position:', basketball.x, basketball.y);
      
      const ballPos3d = convert2DToServer3D(basketball.x, basketball.y);
      console.log('Basketball 3D position:', ballPos3d);
      
      // Calculate distance locally to verify
      const distance2D = Math.sqrt(
        Math.pow(player.x - basketball.x, 2) + 
        Math.pow(player.y - basketball.y, 2)
      );
      const distance3D = Math.sqrt(
        Math.pow(pos3d.x - ballPos3d.x, 2) + 
        Math.pow(pos3d.z - ballPos3d.z, 2)
      );
      
      console.log('Distance 2D:', distance2D, 'pixels');
      console.log('Distance 3D:', distance3D, 'units (need < 2.5)');
      
      // Force update position before pickup attempt
      socket.emit('move', {
        position: pos3d,
        velocity: { x: 0, y: 0, z: 0 },
        animation: 'idle',
        facingDirection: player.facingDirection || 1
      });
      
      // Small delay to ensure server has updated position
      setTimeout(() => {
        socket.emit('pickupBall');
      }, 50);
    }
  });
  
  window.addEventListener('keyup', e => {
    keys[e.key] = false;
  });
}

// Initial socket event handlers
function initSocketEvents() {
  // Initial game state from server
  socket.on('initialize', (data) => {
    console.log('Received initialization data:', data);
    console.log('Ball initial server position:', data.gameState.ball.position);
    console.log('My initial server position:', data.gameState.players[data.playerId].position);
    
    myPlayerId = data.playerId;
    const gameState = data.gameState;
    
    // Convert server players to client format
    players = {};
    Object.entries(gameState.players).forEach(([id, serverPlayer]) => {
      const pos2d = convertServer3DTo2D(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
      players[id] = {
        id: id,
        name: serverPlayer.name,
        x: pos2d.x,
        y: pos2d.y,
        score: gameState.scores[id] || 0,
        hasBall: serverPlayer.hasBall,
        isJumping: false,
        outfit: {
          type: 'professional',
          primaryColor: serverPlayer.teamColors.primary,
          secondaryColor: serverPlayer.teamColors.secondary
        },
        spriteConfig: {
          jerseyNumber: serverPlayer.jerseyNumber,
          hairStyle: Math.floor(Math.random() * 5),
          bodyType: 'athletic'
        }
      };
    });
    
    // Convert basketball position
    if (gameState.ball) {
      console.log('Converting ball position from server:', gameState.ball.position);
      const ballPos2d = convertServer3DTo2D(gameState.ball.position.x, gameState.ball.position.y, gameState.ball.position.z);
      console.log('Converted ball position to 2D:', ballPos2d);
      basketball = {
        x: ballPos2d.x,
        y: ballPos2d.y,
        possessedBy: gameState.ball.carrier
      };
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
    
    // Update UI
    document.getElementById('player-name').textContent = myPlayerName;
    document.getElementById('player-score').textContent = players[myPlayerId].score;
    updateScoreboard();
  });
  
  // Player joined the game
  socket.on('playerJoined', (serverPlayer) => {
    const pos2d = convertServer3DTo2D(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
    const player = {
      id: serverPlayer.id,
      name: serverPlayer.name,
      x: pos2d.x,
      y: pos2d.y,
      score: 0,
      hasBall: serverPlayer.hasBall,
      isJumping: false,
      outfit: {
        type: 'professional',
        primaryColor: serverPlayer.teamColors.primary,
        secondaryColor: serverPlayer.teamColors.secondary
      },
      spriteConfig: {
        jerseyNumber: serverPlayer.jerseyNumber,
        hairStyle: Math.floor(Math.random() * 5),
        bodyType: 'athletic'
      }
    };
    
    players[serverPlayer.id] = player;
    
    // Create sprite player
    if (threeIntegration) {
      threeIntegration.createSpritePlayer(serverPlayer.id, player);
    }
    
    updateScoreboard();
  });
  
  // Player moved
  socket.on('playerMoved', (data) => {
    if (players[data.playerId]) {
      const pos2d = convertServer3DTo2D(data.position.x, data.position.y, data.position.z);
      players[data.playerId].x = pos2d.x;
      players[data.playerId].y = pos2d.y;
      
      // Update sprite player
      if (threeIntegration) {
        threeIntegration.updateSpritePlayer(data.playerId, players[data.playerId]);
      }
    }
  });
  
  // Ball picked up
  socket.on('ballPickedUp', (data) => {
    console.log('Ball picked up by:', data.playerId);
    
    // Update ball possession
    Object.keys(players).forEach(id => {
      players[id].hasBall = (id === data.playerId);
    });
    
    if (basketball && data.ballPosition) {
      const ballPos2d = convertServer3DTo2D(data.ballPosition.x, data.ballPosition.y, data.ballPosition.z);
      basketball.x = ballPos2d.x;
      basketball.y = ballPos2d.y;
      basketball.possessedBy = data.playerId;
    }
    
    // Update 3D visualization
    if (threeIntegration) {
      threeIntegration.updateSpritePlayer(data.playerId, players[data.playerId]);
      if (basketball) {
        threeIntegration.updateBasketball(basketball);
      }
    }
  });
  
  // Ball dropped
  socket.on('ballDropped', (data) => {
    console.log('Ball dropped at:', data.position);
    
    // Clear all ball possession
    Object.keys(players).forEach(id => {
      players[id].hasBall = false;
    });
    
    if (data.position) {
      const ballPos2d = convertServer3DTo2D(data.position.x, data.position.y, data.position.z);
      basketball = {
        x: ballPos2d.x,
        y: ballPos2d.y,
        possessedBy: null
      };
      
      console.log('Ball dropped at 2D position:', ballPos2d);
      console.log('Ball dropped at 3D position:', data.position);
      
      // Update 3D basketball position
      if (threeIntegration) {
        threeIntegration.updateBasketball(basketball);
      }
    }
  });
  
  // Ball update during flight
  socket.on('ballUpdate', (data) => {
    if (data.position) {
      const ballPos2d = convertServer3DTo2D(data.position.x, data.position.y, data.position.z);
      basketball = {
        x: ballPos2d.x,
        y: ballPos2d.y,
        possessedBy: null
      };
      
      // Update 3D basketball position
      if (threeIntegration) {
        threeIntegration.updateBasketball(basketball);
      }
    }
  });
  
  // Dunk scored
  socket.on('dunkScored', (data) => {
    console.log('Dunk scored by:', data.playerName);
    
    if (players[data.playerId]) {
      players[data.playerId].score = data.score;
      players[data.playerId].hasBall = false;
      
      // Update UI if it's the current player
      if (data.playerId === myPlayerId) {
        document.getElementById('player-score').textContent = data.score;
      }
      
      // Show dunk effect
      const player = players[data.playerId];
      showDunkEffect(player, { x: player.x, y: player.y }, { x: 400, y: 150 }, 400, 150);
      
      // Start 3D dunk animation
      if (threeIntegration) {
        threeIntegration.startDunkAnimation(
          data.playerId,
          { x: player.x, y: player.y },
          { x: 400, y: 150 },
          () => {
            console.log('3D dunk animation completed');
          }
        );
        
        // Add camera shake for dramatic effect
        threeIntegration.addCameraShake(300, 0.5);
      }
      
      updateScoreboard();
    }
  });
  
  // Player disconnected
  socket.on('playerLeft', (playerId) => {
    // Remove sprite player
    if (threeIntegration) {
      threeIntegration.removeSpritePlayer(playerId);
    }
    
    delete players[playerId];
    updateScoreboard();
  });
}

// Track last sent position to avoid spamming server
let lastSentPosition = { x: null, y: null };
let lastSentAnimation = null;

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
  
  // Convert 2D position to 3D for server
  const pos3d = convert2DToServer3D(player.x, player.y);
  
  // Determine animation and facing direction
  const animation = moved ? 'run' : 'idle';
  let facingDirection = player.facingDirection || 1;
  if (player.x < originalX) facingDirection = -1;
  else if (player.x > originalX) facingDirection = 1;
  player.facingDirection = facingDirection;
  
  // Only send update if position or animation actually changed
  const positionChanged = lastSentPosition.x !== player.x || lastSentPosition.y !== player.y;
  const animationChanged = lastSentAnimation !== animation;
  
  if (positionChanged || animationChanged) {
    // Send movement update in server's expected format
    socket.emit('move', {
      position: pos3d,
      velocity: { x: 0, y: 0, z: 0 },
      animation: animation,
      facingDirection: facingDirection
    });
    
    // Update tracking variables
    lastSentPosition.x = player.x;
    lastSentPosition.y = player.y;
    lastSentAnimation = animation;
  }
  
  // Always update 3D sprite player locally for smooth animation
  if (threeIntegration) {
    threeIntegration.updateSpritePlayer(myPlayerId, player);
  }
}

// Attempt to jump or dunk
function attemptJumpOrDunk() {
  const now = Date.now();
  if (now - lastJumpTime < JUMP_COOLDOWN) return;
  
  lastJumpTime = now;
  
  // Check if player has ball and is near hoop
  const player = players[myPlayerId];
  if (player && player.hasBall) {
    // Check distance to hoops (approximate positions)
    const leftHoopDist = Math.sqrt(Math.pow(player.x - 400, 2) + Math.pow(player.y - 50, 2));
    const rightHoopDist = Math.sqrt(Math.pow(player.x - 400, 2) + Math.pow(player.y - 550, 2));
    
    if (leftHoopDist < 100 || rightHoopDist < 100) {
      // Close enough to dunk
      socket.emit('attemptDunk');
      return;
    }
  }
  
  // Otherwise just jump
  // Note: Server doesn't seem to have jump handling, so this might not work
  console.log('Jump attempted');
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
  if (!scoreboardElement) return;
  
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
  
  // Update dunk animation
  updateDunkAnimation();
  
  // Render 3D scene
  threeIntegration.render();
  
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