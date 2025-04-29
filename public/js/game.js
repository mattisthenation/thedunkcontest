// Canvas setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

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

// Particles system for visual effects
let particles = [];

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
  });
  
  // Player dunked
  socket.on('playerDunked', (data) => {
    if (players[data.playerId]) {
      players[data.playerId].score = data.playerScore;
      
      // Update UI if it's the current player
      if (data.playerId === myPlayerId) {
        document.getElementById('player-score').textContent = data.playerScore;
      }
      
      // Show dunk animation/effect with 3D visuals
      showDunkEffect(players[data.playerId], court.hoopX, court.hoopY);
      
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
function showDunkEffect(player, hoopX, hoopY) {
  // Create visual effects using the particle system
  if (window.particleEffects) {
    // Create dunk celebration effect at the hoop position
    window.particleEffects.createDunkEffect(hoopX, hoopY, player.outfit.primaryColor);
    
    // Create rim shake effect
    window.particleEffects.createRimShakeEffect(hoopX, hoopY);
    
    // Create net movement effect
    window.particleEffects.createNetMovementEffect(hoopX, hoopY);
    
    // Add camera shake effect
    addCameraShake();
    
    // Play dunk sound effects
    if (window.SoundManager) {
      window.SoundManager.playDunkEffect();
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

// Draw functions
function drawCourt() {
  // Draw basketball court with proper perspective
  
  // Floor color (wooden)
  ctx.fillStyle = '#804000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Define the court corners with centered perspective
  const courtWidth = canvas.width * 0.8;
  const courtDepth = canvas.height * 0.8;
  const courtX = (canvas.width - courtWidth) / 2;
  const courtY = canvas.height * 0.15; // Position court higher on canvas
  
  // Calculate court corners for proper perspective
  // Top (far) edge is narrower than bottom (near) edge
  const topWidth = courtWidth * 0.6; // Far edge is 60% of near edge width
  
  // Define court corners
  const topLeft = { x: courtX + (courtWidth - topWidth) / 2, y: courtY };
  const topRight = { x: topLeft.x + topWidth, y: courtY };
  const bottomLeft = { x: courtX, y: courtY + courtDepth };
  const bottomRight = { x: courtX + courtWidth, y: courtY + courtDepth };
  
  // Draw court floor with perspective
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y); // Top left (far)
  ctx.lineTo(topRight.x, topRight.y); // Top right (far)
  ctx.lineTo(bottomRight.x, bottomRight.y); // Bottom right (near)
  ctx.lineTo(bottomLeft.x, bottomLeft.y); // Bottom left (near)
  ctx.closePath();
  
  // Create gradient for floor to add depth
  const gradient = ctx.createLinearGradient(courtX, courtY, courtX, courtY + courtDepth);
  gradient.addColorStop(0, '#b07d5a'); // Lighter at top (far)
  gradient.addColorStop(1, '#8b5a2b'); // Darker at bottom (near)
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Draw wood grain texture
  const boardCount = 15; // Number of wooden boards across the court
  const boardWidth = courtWidth / boardCount;
  
  // Draw wood grain boards
  ctx.strokeStyle = 'rgba(100, 60, 30, 0.5)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= boardCount; i++) {
    const startX = courtX + i * (courtWidth / boardCount);
    const startXTop = topLeft.x + i * (topWidth / boardCount);
    
    // Connect bottom to top to create perspective lines
    ctx.beginPath();
    ctx.moveTo(startX, courtY + courtDepth);
    ctx.lineTo(startXTop, courtY);
    ctx.stroke();
    
    // Add subtle wood grain lines within each plank
    const grainCount = 3;
    if (i < boardCount) {
      for (let j = 1; j <= grainCount; j++) {
        const grainOffsetStart = j * (boardWidth / (grainCount + 1));
        const grainOffsetTop = j * ((topWidth / boardCount) / (grainCount + 1));
        
        ctx.beginPath();
        ctx.moveTo(startX + grainOffsetStart, courtY + courtDepth);
        ctx.lineTo(startXTop + grainOffsetTop, courtY);
        ctx.strokeStyle = 'rgba(100, 60, 30, 0.2)';
        ctx.stroke();
      }
    }
  }
  
  // Draw some horizontal grain lines
  const rowCount = 10;
  for (let i = 0; i <= rowCount; i++) {
    const y = courtY + (courtDepth / rowCount) * i;
    const ratio = i / rowCount;
    const startX = courtX + (courtWidth - topWidth) / 2 * ratio;
    const width = courtWidth - (courtWidth - topWidth) * ratio;
    
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + width, y);
    ctx.strokeStyle = 'rgba(100, 60, 30, 0.3)';
    ctx.stroke();
  }
  
  // Draw court outline
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw center circle with perspective (ellipse)
  const centerX = canvas.width / 2;
  const centerY = courtY + courtDepth * 0.5;
  const radiusX = courtWidth * 0.2;
  const radiusY = courtDepth * 0.1; // Flatter for perspective
  
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  // Free throw line - closer to hoop
  const ftLineY = courtY + courtDepth * 0.25;
  const ftLineWidth = topWidth + (courtWidth - topWidth) * 0.25;
  const ftLineX = courtX + (courtWidth - ftLineWidth) / 2;
  
  ctx.beginPath();
  ctx.moveTo(ftLineX, ftLineY);
  ctx.lineTo(ftLineX + ftLineWidth, ftLineY);
  ctx.stroke();
  
  // Center line
  ctx.beginPath();
  ctx.moveTo(bottomLeft.x, centerY);
  ctx.lineTo(bottomRight.x, centerY);
  ctx.stroke();
  
  // Draw 3D hoop at top center
  // Backboard position
  const backboardWidth = topWidth * 0.4;
  const backboardHeight = courtDepth * 0.08;
  const backboardX = centerX - backboardWidth / 2;
  const backboardY = courtY + courtDepth * 0.05; // Just below top edge of court
  
  // Backboard shadow (for depth)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(backboardX + 3, backboardY + 3, backboardWidth, backboardHeight);
  
  // Main backboard
  ctx.fillStyle = '#fff';
  ctx.fillRect(backboardX, backboardY, backboardWidth, backboardHeight);
  
  // Backboard depth (3D effect)
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(backboardX, backboardY);
  ctx.lineTo(backboardX - 5, backboardY - 5);
  ctx.lineTo(backboardX + backboardWidth - 5, backboardY - 5);
  ctx.lineTo(backboardX + backboardWidth, backboardY);
  ctx.closePath();
  ctx.fill();
  
  // Backboard outline
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.strokeRect(backboardX, backboardY, backboardWidth, backboardHeight);
  
  // Add backboard target box
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  const targetSize = backboardHeight * 0.6;
  const targetX = backboardX + (backboardWidth - targetSize) / 2;
  const targetY = backboardY + (backboardHeight - targetSize) / 2;
  ctx.strokeRect(targetX, targetY, targetSize, targetSize);
  
  // Draw the rim with perspective (ellipse)
  const rimX = centerX;
  const rimY = backboardY + backboardHeight + 10;
  const rimRadiusX = 15;
  const rimRadiusY = 5; // Flatter for perspective
  
  // Rim shadow
  ctx.beginPath();
  ctx.ellipse(rimX + 2, rimY + 2, rimRadiusX, rimRadiusY, 0, 0, Math.PI, false);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Actual rim
  ctx.beginPath();
  ctx.ellipse(rimX, rimY, rimRadiusX, rimRadiusY, 0, 0, Math.PI, false);
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Add rim supports
  ctx.beginPath();
  ctx.moveTo(rimX - rimRadiusX, rimY);
  ctx.lineTo(backboardX + backboardWidth * 0.3, backboardY + backboardHeight);
  ctx.moveTo(rimX + rimRadiusX, rimY);
  ctx.lineTo(backboardX + backboardWidth * 0.7, backboardY + backboardHeight);
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw net (simplified)
  ctx.beginPath();
  // Left side of net
  ctx.moveTo(rimX - rimRadiusX, rimY);
  ctx.lineTo(rimX - rimRadiusX * 0.5, rimY + 25);
  // Right side of net
  ctx.moveTo(rimX + rimRadiusX, rimY);
  ctx.lineTo(rimX + rimRadiusX * 0.5, rimY + 25);
  // Bottom of net
  ctx.moveTo(rimX - rimRadiusX * 0.5, rimY + 25);
  ctx.lineTo(rimX + rimRadiusX * 0.5, rimY + 25);
  // Vertical net lines
  const netSegments = 5;
  for (let i = 1; i < netSegments; i++) {
    const segX = rimX - rimRadiusX + (2 * rimRadiusX * i) / netSegments;
    ctx.moveTo(segX, rimY);
    const bottomX = rimX - rimRadiusX * 0.5 + rimRadiusX * i / netSegments;
    ctx.lineTo(bottomX, rimY + 25);
  }
  
  // Horizontal net lines
  for (let i = 1; i < 3; i++) {
    const y = rimY + i * 8;
    const widthRatio = i / 3;
    const leftX = rimX - rimRadiusX + (rimRadiusX * 0.5 * widthRatio);
    const rightX = rimX + rimRadiusX - (rimRadiusX * 0.5 * widthRatio);
    
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
  }
  
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Store the court dimensions for gameplay
  court.width = courtWidth;
  court.height = courtDepth;
  court.x = courtX;
  court.y = courtY;
  court.hoopX = rimX;
  court.hoopY = rimY;
}

function drawBasketball() {
  if (!basketball) return;
  
  const ballX = basketball.x;
  const ballY = basketball.y;
  const ballRadius = 12;
  
  // Calculate shadow position - adjust shadow based on court proximity
  // Shadow gets closer to ball as ball gets closer to court
  const distFromHoop = Math.sqrt(
    Math.pow(ballX - court.hoopX, 2) + 
    Math.pow(ballY - court.hoopY, 2)
  );
  
  // Calculate shadow distance and size based on virtual height
  // Ball appears to be higher when closer to hoop
  const shadowDistance = Math.min(20, 5 + distFromHoop * 0.05);
  const shadowSize = Math.max(0.3, 1 - (distFromHoop * 0.0005));
  
  // Draw shadow (ellipse) beneath the ball
  ctx.beginPath();
  ctx.ellipse(
    ballX, 
    ballY + shadowDistance, 
    ballRadius * shadowSize * 1.2, 
    ballRadius * shadowSize * 0.4, 
    0, 0, Math.PI * 2
  );
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fill();
  
  // Store previous ball position if not set
  basketball.prevX = basketball.prevX || ballX;
  basketball.prevY = basketball.prevY || ballY;
  
  // Calculate ball motion for rotation effect
  const dx = ballX - basketball.prevX;
  const dy = ballY - basketball.prevY;
  const isMoving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
  
  // Ball with 3D lighting effect - light source from top-right
  const gradient = ctx.createRadialGradient(
    ballX - ballRadius * 0.3,
    ballY - ballRadius * 0.3,
    0,
    ballX,
    ballY,
    ballRadius * 1.2
  );
  gradient.addColorStop(0, '#ff9d5c'); // Highlight
  gradient.addColorStop(0.6, '#ff6600'); // Base color
  gradient.addColorStop(1, '#cc5200'); // Shadow edge
  
  // Add motion blur if the ball is moving fast
  if (isMoving) {
    const speed = Math.sqrt(dx*dx + dy*dy);
    if (speed > 3) {
      // Add motion blur ellipse
      ctx.beginPath();
      ctx.ellipse(
        ballX - dx/2, 
        ballY - dy/2, 
        ballRadius * 0.9, 
        ballRadius * 0.7, 
        Math.atan2(dy, dx),
        0, Math.PI * 2
      );
      ctx.fillStyle = 'rgba(255, 102, 0, 0.3)';
      ctx.fill();
    }
  }
  
  // Main ball
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Ball outline
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Basketball lines with perspective (curved)
  // Calculate rotation angle based on movement
  let ballRotation = (Date.now() % 3000) / 3000 * Math.PI * 2;
  
  // Add dynamic rotation based on ball movement
  if (isMoving) {
    const speed = Math.sqrt(dx*dx + dy*dy);
    const moveAngle = Math.atan2(dy, dx);
    // Adjust rotation to make the ball appear to roll in the direction of movement
    ballRotation = moveAngle + Math.PI/2 + (Date.now() % 1000) / 1000 * speed * 0.2;
  }
  
  // Horizontal curved line
  ctx.beginPath();
  ctx.ellipse(
    ballX,
    ballY,
    ballRadius * 0.95,
    ballRadius * 0.3,
    ballRotation,
    0, Math.PI * 2
  );
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Vertical curved line (at right angle to first)
  ctx.beginPath();
  ctx.ellipse(
    ballX,
    ballY,
    ballRadius * 0.95,
    ballRadius * 0.3,
    ballRotation + Math.PI/2,
    0, Math.PI * 2
  );
  ctx.stroke();
  
  // Add a highlight for extra 3D effect
  ctx.beginPath();
  ctx.arc(
    ballX - ballRadius * 0.3,
    ballY - ballRadius * 0.3,
    ballRadius * 0.25,
    0, Math.PI * 2
  );
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fill();
  
  // Add a second smaller highlight
  ctx.beginPath();
  ctx.arc(
    ballX - ballRadius * 0.1,
    ballY - ballRadius * 0.5,
    ballRadius * 0.1,
    0, Math.PI * 2
  );
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fill();
  
  // Store current position for next frame
  basketball.prevX = ballX;
  basketball.prevY = ballY;
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
  
  // Calculate height offset for jumping
  let heightOffset = 0;
  if (player.isJumping) {
    // Simple parabolic jump animation
    const jumpProgress = (Date.now() - lastJumpTime) / JUMP_COOLDOWN;
    heightOffset = -40 * Math.sin(jumpProgress * Math.PI);
  }
  
  // Scale player size based on y-position to enhance perspective
  // Players appear smaller when farther away (smaller y values)
  const distanceFromBottom = canvas.height - player.y;
  const scale = 0.7 + (player.y / canvas.height) * 0.5; // Scale from 0.7 to 1.2 based on y-position
  const basePlayerWidth = 30 * scale;
  const basePlayerHeight = 45 * scale;
  
  // Draw shadow beneath player (ellipse, fainter when jumping)
  const shadowAlpha = player.isJumping ? 0.15 : 0.3;
  const shadowWidth = basePlayerWidth * 0.8;
  const shadowHeight = shadowWidth * 0.3; // Flatter for perspective
  
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 5, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.fill();
  
  // Determine the correct sprite based on outfit type
  const outfitKey = 'player' + player.outfit.type.charAt(0).toUpperCase() + player.outfit.type.slice(1);
  
  // Create 3D body for the player
  // Legs/shorts (adjusted for perspective)
  const legsHeight = basePlayerHeight * 0.35;
  const legsWidth = basePlayerWidth;
  
  ctx.fillStyle = player.outfit.secondaryColor;
  if (state === 'jump') {
    // Jumping player legs - more spread out
    ctx.fillRect(
      player.x - legsWidth/2, 
      player.y - legsHeight + heightOffset, 
      legsWidth, 
      legsHeight
    );
  } else if (state === 'run') {
    // Running player legs - animated
    const legOffset = playerAnimations.run.currentFrame === 0 ? 2 : -2;
    ctx.fillRect(
      player.x - legsWidth/2, 
      player.y - legsHeight, 
      legsWidth, 
      legsHeight
    );
  } else {
    // Idle player legs
    ctx.fillRect(
      player.x - legsWidth/2, 
      player.y - legsHeight, 
      legsWidth, 
      legsHeight
    );
  }
  
  // Upper body/jersey with 3D effect
  const jerseyHeight = basePlayerHeight * 0.35;
  const jerseyWidth = basePlayerWidth;
  const jerseyY = player.y - legsHeight - jerseyHeight + heightOffset;
  
  // Main jersey color
  ctx.fillStyle = player.outfit.primaryColor;
  
  // Front face of jersey
  ctx.fillRect(
    player.x - jerseyWidth/2, 
    jerseyY, 
    jerseyWidth, 
    jerseyHeight
  );
  
  // Top face of jersey (3D effect)
  ctx.fillStyle = adjustColor(player.outfit.primaryColor, 20); // Lighter color for top
  ctx.beginPath();
  ctx.moveTo(player.x - jerseyWidth/2, jerseyY);
  ctx.lineTo(player.x - jerseyWidth/2 - 3, jerseyY - 5); // Top left corner
  ctx.lineTo(player.x + jerseyWidth/2 - 3, jerseyY - 5); // Top right corner
  ctx.lineTo(player.x + jerseyWidth/2, jerseyY);
  ctx.closePath();
  ctx.fill();
  
  // Side face of jersey (3D effect)
  ctx.fillStyle = adjustColor(player.outfit.primaryColor, -20); // Darker color for side
  ctx.beginPath();
  ctx.moveTo(player.x + jerseyWidth/2, jerseyY);
  ctx.lineTo(player.x + jerseyWidth/2 - 3, jerseyY - 5);
  ctx.lineTo(player.x + jerseyWidth/2 - 3, jerseyY + jerseyHeight - 5);
  ctx.lineTo(player.x + jerseyWidth/2, jerseyY + jerseyHeight);
  ctx.closePath();
  ctx.fill();
  
  // Draw player head with 3D effects
  const headSize = basePlayerHeight * 0.2;
  const headY = jerseyY - headSize - 5;
  
  // Head shadow (on neck)
  ctx.beginPath();
  ctx.arc(player.x, headY + 6, headSize * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = '#e8bb9a'; // Darker skin for shadow
  ctx.fill();
  
  // Main head (slightly lighter color and raised)
  ctx.beginPath();
  ctx.arc(player.x, headY, headSize, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd0a0'; // Base skin tone
  ctx.fill();
  
  // Head highlight for 3D effect
  ctx.beginPath();
  ctx.arc(player.x - 3, headY - 3, headSize * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fill();
  
  // Draw player jersey number with 3D effect
  const fontSize = Math.max(10, 14 * scale); // Scale font size with player
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  
  // Add a slight shadow to the number
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillText(player.id.slice(0, 2), player.x + 1, player.y - legsHeight/2 + 1);
  
  // Draw the actual number
  ctx.fillStyle = player.outfit.secondaryColor;
  ctx.fillText(player.id.slice(0, 2), player.x, player.y - legsHeight/2);
  
  // Draw player name with 3D shadow effect
  const nameFontSize = Math.max(8, 10 * scale);
  ctx.font = `${nameFontSize}px Arial`;
  
  // Name shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillText(player.name, player.x + 1, headY - headSize - 5 + 1);
  
  // Actual name
  ctx.fillStyle = '#fff';
  ctx.fillText(player.name, player.x, headY - headSize - 5);
  
  // Draw a ball if player has it
  if (player.hasBall) {
    // Calculate hand position based on player state
    let handX, handY;
    
    if (state === 'jump') {
      // Ball above head when jumping (for dunking)
      handX = player.x;
      handY = headY - headSize * 0.5 + heightOffset;
    } else {
      // Ball on side when running/idle
      handX = player.x + jerseyWidth * 0.6;
      handY = jerseyY + jerseyHeight * 0.5;
    }
    
    // Draw a small basketball in player's hands
    const ballSize = 7 * scale; // Scale ball with player
    
    ctx.beginPath();
    ctx.arc(handX, handY, ballSize, 0, Math.PI * 2);
    
    // Add 3D lighting effect to the ball
    const ballGradient = ctx.createRadialGradient(
      handX - 2, handY - 2, 0,
      handX, handY, ballSize
    );
    ballGradient.addColorStop(0, '#ff8933');
    ballGradient.addColorStop(0.8, '#ff6600');
    ballGradient.addColorStop(1, '#cc5200');
    
    ctx.fillStyle = ballGradient;
    ctx.fill();
    
    // Ball outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  // Draw jump animation
  if (player.isJumping) {
    // Arms raised for jumping/dunking
    const armWidth = scale * 4; // Scale arm width with player
    ctx.strokeStyle = player.outfit.primaryColor;
    ctx.lineWidth = armWidth;
    
    // Left arm
    ctx.beginPath();
    ctx.moveTo(player.x - jerseyWidth * 0.3, jerseyY + jerseyHeight * 0.4);
    ctx.lineTo(player.x - jerseyWidth * 0.5, jerseyY - jerseyHeight * 0.3);
    ctx.stroke();
    
    // Right arm
    ctx.beginPath();
    ctx.moveTo(player.x + jerseyWidth * 0.3, jerseyY + jerseyHeight * 0.4);
    ctx.lineTo(player.x + jerseyWidth * 0.5, jerseyY - jerseyHeight * 0.3);
    ctx.stroke();
  }
}

// Helper function to adjust colors for 3D effect
function adjustColor(color, amount) {
  // Convert hex to RGB
  let r, g, b;
  if (color.startsWith('#')) {
    r = parseInt(color.substr(1, 2), 16);
    g = parseInt(color.substr(3, 2), 16);
    b = parseInt(color.substr(5, 2), 16);
  } else {
    // Handle named colors or non-hex
    const tempElement = document.createElement('div');
    tempElement.style.color = color;
    document.body.appendChild(tempElement);
    const computedColor = getComputedStyle(tempElement).color;
    document.body.removeChild(tempElement);
    
    // Parse RGB format
    const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      r = parseInt(rgbMatch[1]);
      g = parseInt(rgbMatch[2]);
      b = parseInt(rgbMatch[3]);
    } else {
      return color; // Return original if parsing fails
    }
  }
  
  // Adjust color
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  
  // Convert back to hex
  return `rgb(${r}, ${g}, ${b})`;
}

// Game loop
function gameLoop() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Apply camera shake if active
  if (cameraShake.active) {
    const elapsedTime = Date.now() - cameraShake.startTime;
    
    if (elapsedTime < cameraShake.duration) {
      // Calculate shake intensity based on remaining time (gradually decreases)
      const progress = elapsedTime / cameraShake.duration;
      const currentIntensity = cameraShake.intensity * (1 - progress);
      
      // Apply random offset to context
      const offsetX = (Math.random() - 0.5) * currentIntensity * 2;
      const offsetY = (Math.random() - 0.5) * currentIntensity * 2;
      
      ctx.save();
      ctx.translate(offsetX, offsetY);
    } else {
      // Shake is complete
      cameraShake.active = false;
    }
  }
  
  // Update player position
  if (players[myPlayerId]) {
    updatePlayerPosition();
  } else {
    // Debug: We don't have player ID yet
    ctx.fillStyle = '#804000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for player initialization...', canvas.width/2, canvas.height/2);
    requestAnimationFrame(gameLoop);
    return;
  }
  
  // Debug: Log game state occasionally
  if (Math.random() < 0.01) { // Log roughly every 100 frames
    console.log('Game state:', {
      playerCount: Object.keys(players).length,
      myPlayer: players[myPlayerId],
      basketball: basketball,
      court: court
    });
  }
  
  // Draw game elements
  drawCourt();
  drawPlayers();
  drawBasketball();
  
  // Update and draw particles (if available)
  if (window.particleEffects) {
    window.particleEffects.updateParticles();
    window.particleEffects.drawParticles(ctx);
  }
  
  // Restore context if camera shake was applied
  if (cameraShake.active) {
    ctx.restore();
  }
  
  // Request next frame
  requestAnimationFrame(gameLoop);
}

// Initialize the game
function init() {
  console.log('Game initializing...');
  
  // Make sure canvas is properly set up
  canvas.width = 800;
  canvas.height = 600;
  
  // Draw loading message
  ctx.fillStyle = '#804000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = '30px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Connecting to game server...', canvas.width/2, canvas.height/2);
  
  // Initialize game components
  initEventListeners();
  initSocketEvents();
  
  // Start the game loop
  console.log('Starting game loop');
  gameLoop();
}

// Start the game when the page loads
window.onload = init;
