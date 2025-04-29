// Particle system for visual effects

// Particle class
class Particle {
  constructor(x, y, color, velocity, gravity = 0.5, size = 4, decay = 0.02, rotationSpeed = 0) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.velocity = velocity;
    this.gravity = gravity;
    this.size = size;
    this.initialSize = size;
    this.decay = decay;
    this.alpha = 1;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = rotationSpeed;
    this.shape = Math.floor(Math.random() * 3); // 0: circle, 1: square, 2: triangle
  }

  update() {
    // Apply velocity
    this.x += this.velocity.x;
    this.y += this.velocity.y;
    
    // Apply gravity
    this.velocity.y += this.gravity;
    
    // Apply decay
    this.alpha -= this.decay;
    this.size = Math.max(0, this.size - this.decay * 10);
    
    // Apply rotation
    this.rotation += this.rotationSpeed;
    
    // Return true if particle is still alive
    return this.alpha > 0;
  }
  
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    // Different shapes for variety
    if (this.shape === 0) {
      // Circle
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    } else if (this.shape === 1) {
      // Square
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
    } else {
      // Triangle
      ctx.beginPath();
      ctx.moveTo(0, -this.size);
      ctx.lineTo(this.size, this.size);
      ctx.lineTo(-this.size, this.size);
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();
    }
    
    ctx.restore();
  }
}

// Create dunk effect - sparks and celebration particles
function createDunkEffect(x, y, playerColor) {
  // Number of particles
  const particleCount = 50;
  
  // Colors - sparks, player team color, and white/gold celebration
  const colors = [
    '#FFF200', // Yellow spark
    '#FF4500', // Orange spark
    '#FFFFFF', // White
    playerColor, // Player team color
    '#FFD700', // Gold
  ];
  
  // Create particles in a circular explosion pattern
  for (let i = 0; i < particleCount; i++) {
    // Random angle and speed
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 6;
    
    // Calculate velocity based on angle and speed
    const velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed - 2 // Initial upward bias
    };
    
    // Random color from our palette
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Randomize gravity, size, and decay
    const gravity = 0.1 + Math.random() * 0.2;
    const size = 2 + Math.random() * 6;
    const decay = 0.005 + Math.random() * 0.01;
    
    // Add some rotation for more dynamic feel
    const rotationSpeed = Math.random() * 0.2 - 0.1;
    
    // Create the particle
    const particle = new Particle(x, y, color, velocity, gravity, size, decay, rotationSpeed);
    
    // Add to the global particles array
    particles.push(particle);
  }
  
  // Add some special star particles
  for (let i = 0; i < 10; i++) {
    createStarParticle(x, y);
  }
}

// Create a special star particle (for extra flair)
function createStarParticle(x, y) {
  // Random angle and medium-high speed
  const angle = Math.random() * Math.PI * 2;
  const speed = 2 + Math.random() * 4;
  
  // Calculate velocity
  const velocity = {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed - 3 // Higher initial upward bias
  };
  
  // Star is always gold or white
  const color = Math.random() > 0.5 ? '#FFD700' : '#FFFFFF';
  
  // Larger size but faster decay
  const size = 5 + Math.random() * 8;
  const decay = 0.01 + Math.random() * 0.02;
  
  // Add more rotation for stars
  const rotationSpeed = (Math.random() * 0.3 - 0.15);
  
  // Create a special star particle (we'll handle drawing differently)
  const particle = new Particle(x, y, color, velocity, 0.15, size, decay, rotationSpeed);
  particle.shape = 'star'; // Special shape flag
  
  // Custom draw method for stars
  particle.draw = function(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    // Draw a 5-point star
    ctx.beginPath();
    
    // Outer radius and inner radius
    const outerRadius = this.size;
    const innerRadius = this.size / 2;
    
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI * i) / 5;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    ctx.fillStyle = this.color;
    ctx.fill();
    
    ctx.restore();
  };
  
  // Add to global particles array
  particles.push(particle);
}

// Create rim shake effect
function createRimShakeEffect(rimX, rimY) {
  // Add metal spark particles along the rim
  for (let i = 0; i < 20; i++) {
    const offset = (Math.random() - 0.5) * 30; // Spread along the rim
    const x = rimX + offset;
    const y = rimY - Math.random() * 2; // Slightly above the rim
    
    // Velocity - sparks fly downward and outward
    const velocity = {
      x: offset * 0.2, // Outward direction based on position
      y: 1 + Math.random() * 2 // Downward
    };
    
    // Metal spark colors
    const colors = ['#FFFFFF', '#FFFFCC', '#FFCC66'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Small, fast-decaying sparks
    const size = 1 + Math.random() * 3;
    const decay = 0.05 + Math.random() * 0.05;
    
    // Create the spark particle
    const particle = new Particle(x, y, color, velocity, 0.3, size, decay, 0);
    particles.push(particle);
  }
}

// Create net movement effect
function createNetMovementEffect(rimX, rimY) {
  // Add white particles to simulate net movement
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI; // Random angle in the lower half
    const distance = 10 + Math.random() * 10; // Distance from rim
    
    const x = rimX + Math.cos(angle) * (10 + Math.random() * 5); // X position along rim
    const y = rimY + distance; // Y position below rim
    
    // Velocity - subtle movement
    const velocity = {
      x: (Math.random() - 0.5) * 0.5,
      y: 0.5 + Math.random() * 1.5
    };
    
    // White/light gray particles
    const brightness = 220 + Math.floor(Math.random() * 35);
    const color = `rgb(${brightness}, ${brightness}, ${brightness})`;
    
    // Very small particles with medium decay
    const size = 1 + Math.random() * 2;
    const decay = 0.03 + Math.random() * 0.02;
    
    // Create the net particle
    const particle = new Particle(x, y, color, velocity, 0.1, size, decay, 0);
    particles.push(particle);
  }
}

// Create trail effect behind dunking player (NBA Jam style)
function createTrailEffect(x, y, playerColor) {
  // Number of particles per trail emission
  const particleCount = 8;
  
  // Create particles in trail pattern
  for (let i = 0; i < particleCount; i++) {
    // Random angle with a bias to create a trailing effect
    const angle = Math.PI + (Math.random() - 0.5) * 1.5; // Mostly backward
    const speed = 0.5 + Math.random() * 2;
    
    // Calculate velocity for trailing effect
    const velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    };
    
    // Create color variants based on player color
    let color;
    if (i % 3 === 0) {
      color = '#FFFFFF'; // White
    } else if (i % 3 === 1) {
      color = playerColor; // Player color
    } else {
      // Create a brighter version of player color
      const r = parseInt(playerColor.slice(1, 3), 16);
      const g = parseInt(playerColor.slice(3, 5), 16);
      const b = parseInt(playerColor.slice(5, 7), 16);
      
      // Brighten color
      const brightenFactor = 0.7;
      const rBright = Math.min(255, Math.floor(r + (255 - r) * brightenFactor));
      const gBright = Math.min(255, Math.floor(g + (255 - g) * brightenFactor));
      const bBright = Math.min(255, Math.floor(b + (255 - b) * brightenFactor));
      
      color = `#${rBright.toString(16).padStart(2, '0')}${gBright.toString(16).padStart(2, '0')}${bBright.toString(16).padStart(2, '0')}`;
    }
    
    // Randomize size and decay
    const size = 2 + Math.random() * 6;
    const decay = 0.03 + Math.random() * 0.05; // Faster decay than normal particles
    
    // Create the particle with minimal gravity
    const particle = new Particle(x, y, color, velocity, 0.05, size, decay, Math.random() * 0.2 - 0.1);
    
    // Add to the global particles array
    particles.push(particle);
  }
}

// Update all particles
function updateParticles() {
  // Keep only active particles
  particles = particles.filter(particle => particle.update());
}

// Draw all particles
function drawParticles(ctx) {
  particles.forEach(particle => particle.draw(ctx));
}

// Export functions
window.particleEffects = {
  createDunkEffect,
  createRimShakeEffect,
  createNetMovementEffect,
  createTrailEffect,
  updateParticles,
  drawParticles
};
