// three-basketball.js - Basketball object with physics for Three.js

import * as THREE from 'three';
import ThreeJSManager from './three-core.js';

/**
 * Basketball - 3D basketball with physics
 */
export class Basketball {
  constructor(options = {}) {
    this.radius = options.radius || 0.12; // Standard basketball radius in meters
    this.group = new THREE.Group();
    this.group.name = 'Basketball';
    
    // Position
    this.position = options.position || new THREE.Vector3(0, this.radius, 0);
    this.group.position.copy(this.position);
    
    // Physics properties
    this.physics = {
      velocity: new THREE.Vector3(0, 0, 0),
      gravity: options.gravity || 9.8,
      mass: options.mass || 0.6, // kg
      restitution: options.restitution || 0.8, // bounciness
      friction: options.friction || 0.5,
      drag: options.drag || 0.03,
      isOnGround: false,
      possessedBy: null
    };
    
    // Visual properties
    this.rotation = new THREE.Euler(0, 0, 0);
    this.rotationSpeed = new THREE.Vector3(0, 0, 0);
    
    // References
    this.ball = null;
    
    // Trail effect
    this.trail = {
      enabled: options.trail || false,
      maxPoints: options.trailLength || 20,
      points: [],
      geometry: null,
      material: null,
      mesh: null
    };
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize basketball
   */
  init() {
    // Check if we have a detailed model
    if (ThreeJSManager.assetManager.models['basketball']) {
      this.loadDetailedBasketball();
    } else {
      this.createBasicBasketball();
    }
    
    // Set up trail effect if enabled
    if (this.trail.enabled) {
      this.setupTrail();
    }
    
    // Add to scene
    ThreeJSManager.scene.add(this.group);
  }
  
  /**
   * Create a basic basketball with simple geometry
   */
  createBasicBasketball() {
    const ballGeometry = new THREE.SphereGeometry(this.radius, 32, 16);
    
    // Create material based on available textures
    let ballMaterial;
    
    if (ThreeJSManager.assetManager.textures['basketball_diffuse']) {
      ballMaterial = new THREE.MeshStandardMaterial({
        map: ThreeJSManager.assetManager.textures['basketball_diffuse'],
        roughness: 0.8,
        metalness: 0.1
      });
    } else {
      // Create procedural basketball texture with lines
      const canvasSize = 512;
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const context = canvas.getContext('2d');
      
      // Base color
      context.fillStyle = '#ff6600';
      context.fillRect(0, 0, canvasSize, canvasSize);
      
      // Add basketball lines
      context.strokeStyle = '#000000';
      context.lineWidth = 8;
      
      // Draw horizontal line
      context.beginPath();
      context.moveTo(0, canvasSize / 2);
      context.lineTo(canvasSize, canvasSize / 2);
      context.stroke();
      
      // Draw vertical lines (curved to mimic 3D)
      for (let i = 0; i < 4; i++) {
        const x = canvasSize * (i + 0.5) / 4;
        context.beginPath();
        context.moveTo(x, 0);
        
        // Create curved line
        for (let y = 0; y <= canvasSize; y += 10) {
          const offset = 20 * Math.sin((y / canvasSize) * Math.PI);
          context.lineTo(x + offset, y);
        }
        
        context.stroke();
      }
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      
      ballMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: 0.1
      });
    }
    
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;
    ball.receiveShadow = true;
    this.ball = ball;
    this.group.add(ball);
  }
  
  /**
   * Load detailed basketball model from asset manager
   */
  loadDetailedBasketball() {
    const basketballModel = ThreeJSManager.assetManager.models['basketball'];
    
    if (basketballModel && basketballModel.scene) {
      // Clone the model to avoid modifying the original
      const basketball = basketballModel.scene.clone();
      
      // Set up shadows and store reference
      basketball.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          this.ball = object;
        }
      });
      
      // Scale if needed
      const modelRadius = 0.12; // Expected model radius
      if (this.radius !== modelRadius) {
        const scale = this.radius / modelRadius;
        basketball.scale.set(scale, scale, scale);
      }
      
      // Add to group
      this.group.add(basketball);
    } else {
      console.warn('Basketball model not available, falling back to basic basketball');
      this.createBasicBasketball();
    }
  }
  
  /**
   * Set up trail effect
   */
  setupTrail() {
    // Initialize points array
    this.trail.points = Array(this.trail.maxPoints).fill().map(() => new THREE.Vector3());
    
    // Create line geometry
    this.trail.geometry = new THREE.BufferGeometry();
    
    // Create material with fading effect
    this.trail.material = new THREE.LineBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    
    // Create line mesh
    this.trail.mesh = new THREE.Line(this.trail.geometry, this.trail.material);
    
    // Add to scene
    ThreeJSManager.scene.add(this.trail.mesh);
  }
  
  /**
   * Update trail effect
   */
  updateTrail() {
    if (!this.trail.enabled || !this.trail.mesh) return;
    
    // Shift all points
    for (let i = this.trail.maxPoints - 1; i > 0; i--) {
      this.trail.points[i].copy(this.trail.points[i - 1]);
    }
    
    // Set first point to current position
    this.trail.points[0].copy(this.group.position);
    
    // Update geometry
    this.trail.geometry.setFromPoints(this.trail.points);
    this.trail.geometry.attributes.position.needsUpdate = true;
  }
  
  /**
   * Apply force to the basketball
   * @param {THREE.Vector3} force - Force vector to apply
   */
  applyForce(force) {
    const forceVector = new THREE.Vector3().copy(force);
    const acceleration = forceVector.divideScalar(this.physics.mass);
    this.physics.velocity.add(acceleration);
  }
  
  /**
   * Set the basketball's velocity directly
   * @param {THREE.Vector3} velocity - New velocity vector
   */
  setVelocity(velocity) {
    this.physics.velocity.copy(velocity);
    
    // Update rotation speed based on velocity for realistic spinning
    this.updateRotationFromVelocity();
  }
  
  /**
   * Update rotation speed based on velocity
   */
  updateRotationFromVelocity() {
    // Calculate rotation axis perpendicular to velocity
    const velocityMagnitude = this.physics.velocity.length();
    
    if (velocityMagnitude > 0.01) {
      // Create rotation axis perpendicular to velocity and up vector
      const normalizedVelocity = this.physics.velocity.clone().normalize();
      const upVector = new THREE.Vector3(0, 1, 0);
      const rotationAxis = new THREE.Vector3().crossVectors(normalizedVelocity, upVector).normalize();
      
      // Set rotation speed proportional to velocity
      this.rotationSpeed.copy(rotationAxis.multiplyScalar(velocityMagnitude * 5));
    }
  }
  
  /**
   * Check collision with the ground
   * @returns {boolean} - Whether the basketball is colliding with the ground
   */
  checkGroundCollision() {
    const groundY = this.radius; // Assuming ground is at y=0
    const ballY = this.group.position.y;
    
    if (ballY <= groundY) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Handle ground collision
   */
  handleGroundCollision() {
    // Set position to ground level
    this.group.position.y = this.radius;
    
    // Bounce with restitution factor (energy loss)
    this.physics.velocity.y = -this.physics.velocity.y * this.physics.restitution;
    
    // Apply friction to horizontal velocity
    this.physics.velocity.x *= (1 - this.physics.friction);
    this.physics.velocity.z *= (1 - this.physics.friction);
    
    // Detect if ball is effectively at rest
    if (Math.abs(this.physics.velocity.y) < 0.1 && 
        this.physics.velocity.length() < 0.2) {
      this.physics.isOnGround = true;
      
      // Dampen rotation
      this.rotationSpeed.multiplyScalar(0.9);
    }
  }
  
  /**
   * Check collision with walls
   * @param {Object} courtDimensions - Dimensions of the court
   */
  checkWallCollisions(courtDimensions) {
    if (!courtDimensions) return;
    
    const halfWidth = courtDimensions.width / 2;
    const halfLength = courtDimensions.length / 2;
    
    // Check x-axis (width) collisions
    if (this.group.position.x + this.radius > halfWidth) {
      this.group.position.x = halfWidth - this.radius;
      this.physics.velocity.x = -this.physics.velocity.x * this.physics.restitution;
    } else if (this.group.position.x - this.radius < -halfWidth) {
      this.group.position.x = -halfWidth + this.radius;
      this.physics.velocity.x = -this.physics.velocity.x * this.physics.restitution;
    }
    
    // Check z-axis (length) collisions
    if (this.group.position.z + this.radius > halfLength) {
      this.group.position.z = halfLength - this.radius;
      this.physics.velocity.z = -this.physics.velocity.z * this.physics.restitution;
    } else if (this.group.position.z - this.radius < -halfLength) {
      this.group.position.z = -halfLength + this.radius;
      this.physics.velocity.z = -this.physics.velocity.z * this.physics.restitution;
    }
  }
  
  /**
   * Check collision with hoop
   * @param {Object} hoop - Basketball hoop object
   * @returns {boolean} - Whether the basketball passed through the hoop
   */
  checkHoopCollision(hoop) {
    if (!hoop) return false;
    
    // Simplified hoop collision detection
    const rimPosition = hoop.group.position.clone();
    rimPosition.y += hoop.parts.rim.position.y;
    
    const rimRadius = 0.45;
    const distanceToRim = new THREE.Vector2(
      this.group.position.x - rimPosition.x,
      this.group.position.z - rimPosition.z
    ).length();
    
    // Check if ball is at rim height
    const isAtRimHeight = Math.abs(this.group.position.y - rimPosition.y) < this.radius;
    
    // Check if ball is within rim diameter
    const isWithinRim = distanceToRim < rimRadius - this.radius * 0.5;
    
    // Check if ball is moving downward
    const isMovingDown = this.physics.velocity.y < 0;
    
    // If ball passes through the rim, it's a basket
    if (isAtRimHeight && isWithinRim && isMovingDown) {
      // Apply subtle force to the rim
      if (hoop.applyForce) {
        hoop.applyForce(-2);
      }
      
      return true;
    }
    
    // Check for rim collision
    const isRimCollision = Math.abs(this.group.position.y - rimPosition.y) < this.radius && 
                           Math.abs(distanceToRim - rimRadius) < this.radius;
    
    if (isRimCollision) {
      // Calculate reflection vector
      const normal = new THREE.Vector3(
        this.group.position.x - rimPosition.x,
        0,
        this.group.position.z - rimPosition.z
      ).normalize();
      
      // Reflect velocity with energy loss
      const reflectionVector = this.physics.velocity.clone().reflect(normal).multiplyScalar(this.physics.restitution);
      this.physics.velocity.copy(reflectionVector);
      
      // Apply force to the rim
      if (hoop.applyForce) {
        const impactForce = this.physics.velocity.length() * this.physics.mass;
        hoop.applyForce(impactForce * 0.5);
      }
      
      // Update rotation based on new velocity
      this.updateRotationFromVelocity();
    }
    
    return false;
  }
  
  /**
   * Update basketball physics
   * @param {number} delta - Time since last frame in seconds
   */
  update(delta) {
    if (this.physics.possessedBy) {
      // Ball is possessed by a player, skip physics
      this.updateTrail();
      return;
    }
    
    // Apply gravity
    this.applyForce(new THREE.Vector3(0, -this.physics.gravity * this.physics.mass, 0).multiplyScalar(delta));
    
    // Apply drag
    if (this.physics.velocity.lengthSq() > 0.01) {
      const drag = this.physics.velocity.clone()
        .normalize()
        .multiplyScalar(-this.physics.velocity.lengthSq() * this.physics.drag)
        .multiplyScalar(delta);
      
      this.applyForce(drag);
    }
    
    // Update position
    const deltaVelocity = this.physics.velocity.clone().multiplyScalar(delta);
    this.group.position.add(deltaVelocity);
    
    // Update rotation
    if (this.rotationSpeed.lengthSq() > 0.01) {
      this.ball.rotation.x += this.rotationSpeed.x * delta;
      this.ball.rotation.y += this.rotationSpeed.y * delta;
      this.ball.rotation.z += this.rotationSpeed.z * delta;
    }
    
    // Check collisions with ground
    if (this.checkGroundCollision()) {
      this.handleGroundCollision();
    } else {
      this.physics.isOnGround = false;
    }
    
    // Update trail effect
    this.updateTrail();
  }
  
  /**
   * Reset the basketball to a position
   * @param {THREE.Vector3} position - Position to reset to
   */
  reset(position) {
    // Reset position
    this.group.position.copy(position || new THREE.Vector3(0, this.radius, 0));
    
    // Reset physics
    this.physics.velocity.set(0, 0, 0);
    this.physics.isOnGround = false;
    this.physics.possessedBy = null;
    
    // Reset rotation
    this.rotationSpeed.set(0, 0, 0);
    if (this.ball) {
      this.ball.rotation.set(0, 0, 0);
    }
    
    // Reset trail
    if (this.trail.enabled) {
      this.trail.points.forEach(point => point.copy(this.group.position));
      this.trail.geometry.setFromPoints(this.trail.points);
      this.trail.geometry.attributes.position.needsUpdate = true;
    }
  }
}

// Export the class
export default Basketball;
