// three-game.js - Main Three.js integration for The Dunk Contest

import * as THREE from 'three';
import ThreeJSManager from './three/three-core.js';
import ThreeRenderer from './three/three-renderer.js';
import ThreeCamera from './three/three-camera.js';
import BasketballCourt from './three/three-court.js';
import Basketball from './three/three-basketball.js';

/**
 * ThreeGame - Main class for integrating Three.js with the existing game
 */
class ThreeGame {
  constructor() {
    // Game objects
    this.court = null;
    this.basketball = null;
    this.hoops = [];
    this.players = {};
    
    // Game state
    this.gameState = {
      initialized: false,
      running: false,
      paused: false
    };
    
    // Canvas and container
    this.canvas = null;
    this.container = null;
    
    // Mapping from 2D to 3D coordinates
    this.scale = {
      x: 0.05, // 20 pixels = 1 meter
      y: 0.05,
      z: 0.05
    };
    
    // Binding methods
    this.init = this.init.bind(this);
    this.update = this.update.bind(this);
    this.convertTo3D = this.convertTo3D.bind(this);
    this.convertTo2D = this.convertTo2D.bind(this);
  }
  
  /**
   * Initialize Three.js game
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    console.log('Initializing Three.js game...');
    
    // Get container and canvas
    this.container = options.container || document.getElementById('game-container');
    this.canvas = options.canvas || document.getElementById('game-canvas');
    
    if (!this.container) {
      console.error('Game container not found!');
      return false;
    }
    
    // Create a new container for Three.js
    const threeContainer = document.createElement('div');
    threeContainer.id = 'three-container';
    threeContainer.style.position = 'absolute';
    threeContainer.style.top = '0';
    threeContainer.style.left = '0';
    threeContainer.style.width = '100%';
    threeContainer.style.height = '100%';
    threeContainer.style.zIndex = '-1'; // Place behind the canvas
    this.container.appendChild(threeContainer);
    
    // Initialize Three.js core
    ThreeJSManager.init({
      container: threeContainer,
      showStats: options.showStats || false
    });
    
    // Initialize renderer
    ThreeRenderer.init({
      container: threeContainer,
      width: this.container.clientWidth,
      height: this.container.clientHeight
    });
    
    // Initialize camera
    ThreeCamera.init({
      renderer: ThreeRenderer.renderer,
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      enableControls: options.debug || false
    });
    
    // Set up scene
    this.setupScene();
    
    // Set up game objects
    this.setupGameObjects(options);
    
    // Make the original canvas semi-transparent during transition
    if (this.canvas) {
      // Preserve canvas for UI elements but make gameplay elements transparent
      this.canvas.style.opacity = '0.3';
    }
    
    // Set game state
    this.gameState.initialized = true;
    this.gameState.running = true;
    
    // Start update loop
    this.update();
    
    console.log('Three.js game initialized successfully!');
    return true;
  }
  
  /**
   * Set up the Three.js scene
   */
  setupScene() {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    ThreeJSManager.scene.add(ambientLight);
    
    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 30, 10);
    directionalLight.castShadow = true;
    
    // Configure shadows
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    
    ThreeJSManager.scene.add(directionalLight);
    
    // Add spotlight for the hoop
    const spotLight = new THREE.SpotLight(0xffffff, 1.5);
    spotLight.position.set(0, 25, 0);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.5;
    spotLight.decay = 1;
    spotLight.distance = 50;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    
    ThreeJSManager.scene.add(spotLight);
    
    // Set camera position
    ThreeCamera.cameras.main.position.set(0, 15, 20);
    ThreeCamera.cameras.main.lookAt(0, 5, 0);
  }
  
  /**
   * Set up game objects
   * @param {Object} options - Configuration options
   */
  setupGameObjects(options) {
    // Create court
    this.court = new BasketballCourt({
      width: 16, // Adjusted for better scale in 3D
      length: 28
    });
    
    // Create basketball
    this.basketball = new Basketball({
      radius: 0.12, // Standard basketball size
      position: new THREE.Vector3(0, 5, 0), // Start above court
      trail: true // Enable trail effect
    });
    
    // TODO: Create hoops and players once we have those implementations
  }
  
  /**
   * Convert 2D coordinates to 3D
   * @param {Object} pos2D - 2D position {x, y}
   * @returns {THREE.Vector3} - 3D position
   */
  convertTo3D(pos2D) {
    // Convert 2D canvas coordinates to 3D scene coordinates
    // In 2D canvas: origin at top-left, x right, y down
    // In 3D scene: origin at center, x right, z forward (into screen), y up
    
    if (!this.canvas || !pos2D) return new THREE.Vector3();
    
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    // Calculate center-relative coordinates
    const x = (pos2D.x - canvasWidth / 2) * this.scale.x;
    const z = (canvasHeight / 2 - pos2D.y) * this.scale.z; // Invert y-axis
    
    // Use default y unless specified
    const y = pos2D.y3D !== undefined ? pos2D.y3D * this.scale.y : 0;
    
    return new THREE.Vector3(x, y, z);
  }
  
  /**
   * Convert 3D coordinates to 2D
   * @param {THREE.Vector3} pos3D - 3D position
   * @returns {Object} - 2D position {x, y}
   */
  convertTo2D(pos3D) {
    if (!this.canvas || !pos3D) return { x: 0, y: 0 };
    
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    // Calculate canvas-relative coordinates
    const x = (pos3D.x / this.scale.x) + canvasWidth / 2;
    const y = canvasHeight / 2 - (pos3D.z / this.scale.z); // Invert z-axis
    
    return { x, y };
  }
  
  /**
   * Sync 3D objects with 2D game state
   * @param {Object} gameState - Current game state from 2D game
   */
  syncGameState(gameState) {
    if (!gameState) return;
    
    // Sync basketball
    if (gameState.basketball && this.basketball) {
      // Convert 2D position to 3D
      const pos3D = this.convertTo3D({
        x: gameState.basketball.x,
        y: gameState.basketball.y,
        y3D: 1 // Height above ground (in meters)
      });
      
      // Update basketball position
      this.basketball.group.position.copy(pos3D);
      
      // Update physics if ball is not possessed
      if (gameState.basketball.possessedBy === null) {
        // Estimate 3D velocity from 2D position changes
        // This would need more sophisticated implementation in a real game
        this.basketball.physics.possessedBy = null;
      } else {
        this.basketball.physics.possessedBy = gameState.basketball.possessedBy;
      }
    }
    
    // Sync players
    if (gameState.players) {
      Object.keys(gameState.players).forEach(playerId => {
        const player2D = gameState.players[playerId];
        
        // Create player if doesn't exist yet
        if (!this.players[playerId]) {
          // TODO: Create player 3D representation
          this.players[playerId] = {
            id: playerId,
            group: new THREE.Group(),
            model: null,
            position: new THREE.Vector3(),
            isJumping: false,
            hasBall: false
          };
          
          ThreeJSManager.scene.add(this.players[playerId].group);
        }
        
        // Update player position
        const player3D = this.players[playerId];
        const pos3D = this.convertTo3D({
          x: player2D.x,
          y: player2D.y,
          y3D: player2D.isJumping ? 1.5 : 1 // Adjust height if jumping
        });
        
        player3D.position.copy(pos3D);
        player3D.group.position.copy(pos3D);
        player3D.isJumping = player2D.isJumping;
        player3D.hasBall = player2D.hasBall;
        
        // TODO: Update player animations based on state
      });
    }
  }
  
  /**
   * Handle dunk events
   * @param {Object} dunkData - Dunk event data
   */
  handleDunk(dunkData) {
    if (!dunkData) return;
    
    // Create special camera animation for dunks
    const startPosition = ThreeCamera.camera.position.clone();
    
    // Calculate dunk position in 3D
    const dunkPos3D = this.convertTo3D({
      x: dunkData.dunkPosition.x,
      y: dunkData.dunkPosition.y,
      y3D: 3 // Height of rim
    });
    
    // Create cinematic camera animation
    ThreeCamera.startCameraAnimation({
      position: new THREE.Vector3(
        dunkPos3D.x + 3, // Offset to side
        dunkPos3D.y + 2, // Slightly above rim
        dunkPos3D.z + 3  // Slightly behind rim
      ),
      target: dunkPos3D,
      duration: 1.0,
      onComplete: () => {
        // Return to original camera after dunk
        ThreeCamera.startCameraAnimation({
          position: startPosition,
          target: new THREE.Vector3(0, 0, 0),
          duration: 0.8
        });
      }
    });
    
    // Add camera shake
    ThreeCamera.addCameraShake(0.2, 0.5);
    
    // TODO: Add particle effects and other visual feedback
  }
  
  /**
   * Update game logic and render
   */
  update() {
    if (!this.gameState.initialized || this.gameState.paused) {
      requestAnimationFrame(this.update);
      return;
    }
    
    // Calculate delta time
    const time = performance.now() * 0.001; // Convert to seconds
    const delta = Math.min(time - (this._lastTime || time), 0.1); // Cap at 0.1s (10fps)
    this._lastTime = time;
    
    // Update Three.js manager
    ThreeJSManager.update(delta);
    
    // Update camera
    ThreeCamera.update(delta);
    
    // Update game objects
    if (this.court) this.court.update(delta);
    if (this.basketball) this.basketball.update(delta);
    
    // Update players
    Object.values(this.players).forEach(player => {
      // TODO: Update player animations
    });
    
    // Update hoops
    this.hoops.forEach(hoop => {
      if (hoop.update) hoop.update(delta);
    });
    
    // Render scene
    ThreeRenderer.render();
    
    // Continue update loop
    requestAnimationFrame(this.update);
  }
  
  /**
   * Resize game to fit container
   */
  resize() {
    if (!this.gameState.initialized) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    // Update renderer
    ThreeRenderer.onResize(width, height);
    
    // Update camera
    ThreeCamera.onResize(width, height);
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    // Stop update loop
    this.gameState.running = false;
    this.gameState.initialized = false;
    
    // Remove Three.js container
    const threeContainer = document.getElementById('three-container');
    if (threeContainer) {
      threeContainer.remove();
    }
    
    // Reset canvas opacity
    if (this.canvas) {
      this.canvas.style.opacity = '1';
    }
    
    // Dispose of Three.js resources
    ThreeJSManager.dispose();
    ThreeRenderer.dispose();
    
    console.log('Three.js game cleaned up successfully!');
  }
}

// Export singleton instance
export default new ThreeGame();
