// three-camera.js - Camera management for Three.js

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * CameraManager - Manages the camera system in the game
 */
class CameraManager {
  constructor() {
    // Main camera
    this.camera = null;
    
    // Additional cameras for different perspectives
    this.cameras = {
      main: null,     // Main gameplay camera
      orbit: null,    // Debug/free camera with controls
      follow: null,   // Player follow camera
      cinematic: null // Special camera for dunks and replays
    };
    
    // Camera controls
    this.controls = null;
    
    // Current active camera
    this.activeCamera = 'main';
    
    // Camera animation
    this.animation = {
      active: false,
      startPosition: null,
      startTarget: null,
      endPosition: null,
      endTarget: null,
      duration: 1.0,
      elapsed: 0,
      onComplete: null
    };
    
    // Camera shake effect
    this.shake = {
      active: false,
      intensity: 0,
      decay: 0.9,
      duration: 0,
      elapsed: 0
    };
  }
  
  /**
   * Initialize camera system
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    const container = options.container || document.getElementById('game-container');
    const width = options.width || container.clientWidth || window.innerWidth;
    const height = options.height || container.clientHeight || window.innerHeight;
    
    // Create main gameplay camera
    this.cameras.main = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.cameras.main.position.set(0, 10, 20);
    this.cameras.main.lookAt(0, 0, 0);
    
    // Create orbit camera (for debugging)
    this.cameras.orbit = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.cameras.orbit.position.set(15, 15, 15);
    this.cameras.orbit.lookAt(0, 0, 0);
    
    // Create follow camera
    this.cameras.follow = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.cameras.follow.position.set(0, 2, 5);
    this.cameras.follow.lookAt(0, 1, 0);
    
    // Create cinematic camera
    this.cameras.cinematic = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    this.cameras.cinematic.position.set(5, 3, 10);
    this.cameras.cinematic.lookAt(0, 2, 0);
    
    // Set the default active camera
    this.setActiveCamera(options.activeCamera || 'main');
    
    // Create orbit controls for debug camera
    if (options.enableControls) {
      this.controls = new OrbitControls(this.cameras.orbit, options.renderer?.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.minDistance = 5;
      this.controls.maxDistance = 50;
    }
  }
  
  /**
   * Set the active camera
   * @param {string} cameraName - Name of camera to activate
   */
  setActiveCamera(cameraName) {
    if (this.cameras[cameraName]) {
      this.activeCamera = cameraName;
      this.camera = this.cameras[cameraName];
      
      // Disable controls for non-orbit cameras
      if (this.controls) {
        this.controls.enabled = (cameraName === 'orbit');
      }
      
      return true;
    }
    return false;
  }
  
  /**
   * Update follow camera to track a target
   * @param {THREE.Object3D} target - Target to follow
   * @param {number} distance - Distance behind target
   * @param {number} height - Height above target
   */
  updateFollowCamera(target, distance = 5, height = 2) {
    if (!target) return;
    
    // Get target position and orientation
    const targetPosition = target.position.clone();
    let targetDirection = new THREE.Vector3(0, 0, -1);
    
    // If target has rotation, use it to determine direction
    if (target.rotation) {
      targetDirection = new THREE.Vector3(0, 0, -1);
      targetDirection.applyEuler(target.rotation);
    }
    
    // Calculate camera position behind target
    const cameraPosition = targetPosition.clone().sub(
      targetDirection.clone().multiplyScalar(distance)
    );
    
    // Add height offset
    cameraPosition.y += height;
    
    // Update camera position
    this.cameras.follow.position.copy(cameraPosition);
    
    // Look at target (with slight height offset)
    const lookTarget = targetPosition.clone();
    lookTarget.y += height * 0.5;
    this.cameras.follow.lookAt(lookTarget);
  }
  
  /**
   * Start a camera animation
   * @param {Object} options - Animation options
   */
  startCameraAnimation(options = {}) {
    // Set up animation parameters
    this.animation.active = true;
    this.animation.startPosition = this.camera.position.clone();
    
    // Get current look target
    const startTarget = new THREE.Vector3(0, 0, -1);
    startTarget.applyQuaternion(this.camera.quaternion);
    startTarget.add(this.camera.position);
    this.animation.startTarget = startTarget;
    
    // Set end position and target
    this.animation.endPosition = options.position || this.camera.position.clone();
    this.animation.endTarget = options.target || startTarget.clone();
    
    // Set duration and reset elapsed time
    this.animation.duration = options.duration || 1.0;
    this.animation.elapsed = 0;
    
    // Set completion callback
    this.animation.onComplete = options.onComplete || null;
  }
  
  /**
   * Add camera shake effect
   * @param {number} intensity - Shake intensity
   * @param {number} duration - Shake duration in seconds
   */
  addCameraShake(intensity = 0.5, duration = 0.5) {
    this.shake.active = true;
    this.shake.intensity = intensity;
    this.shake.duration = duration;
    this.shake.elapsed = 0;
  }
  
  /**
   * Update camera system
   * @param {number} delta - Time since last frame in seconds
   */
  update(delta) {
    // Update controls if enabled
    if (this.controls && this.controls.enabled) {
      this.controls.update();
    }
    
    // Update camera animation if active
    if (this.animation.active) {
      this.updateCameraAnimation(delta);
    }
    
    // Update camera shake if active
    if (this.shake.active) {
      this.updateCameraShake(delta);
    }
  }
  
  /**
   * Update camera animation
   * @param {number} delta - Time since last frame in seconds
   */
  updateCameraAnimation(delta) {
    // Update elapsed time
    this.animation.elapsed += delta;
    
    // Calculate progress (0 to 1)
    const progress = Math.min(1, this.animation.elapsed / this.animation.duration);
    
    // Use easing function for smoother animation (easeInOutCubic)
    const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    // Interpolate position
    const newPosition = new THREE.Vector3().lerpVectors(
      this.animation.startPosition,
      this.animation.endPosition,
      t
    );
    
    // Interpolate target
    const newTarget = new THREE.Vector3().lerpVectors(
      this.animation.startTarget,
      this.animation.endTarget,
      t
    );
    
    // Update camera position
    this.camera.position.copy(newPosition);
    
    // Update camera look direction
    this.camera.lookAt(newTarget);
    
    // Check if animation is complete
    if (progress >= 1) {
      this.animation.active = false;
      
      // Call completion callback if defined
      if (this.animation.onComplete) {
        this.animation.onComplete();
      }
    }
  }
  
  /**
   * Update camera shake effect
   * @param {number} delta - Time since last frame in seconds
   */
  updateCameraShake(delta) {
    // Update elapsed time
    this.shake.elapsed += delta;
    
    // Check if shake should continue
    if (this.shake.elapsed < this.shake.duration) {
      // Calculate shake amount based on remaining time
      const remainingFactor = 1 - (this.shake.elapsed / this.shake.duration);
      const shakeAmount = this.shake.intensity * remainingFactor;
      
      // Apply random offset to camera
      this.camera.position.x += (Math.random() - 0.5) * shakeAmount;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmount;
      this.camera.position.z += (Math.random() - 0.5) * shakeAmount;
    } else {
      // Shake effect is complete
      this.shake.active = false;
    }
  }
  
  /**
   * Handle window resize
   * @param {number} width - New width
   * @param {number} height - New height
   */
  onResize(width, height) {
    // Update all cameras
    Object.values(this.cameras).forEach(camera => {
      if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
  }
}

// Export singleton instance
export default new CameraManager();
