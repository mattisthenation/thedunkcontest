// three-renderer.js - Handles Three.js rendering pipeline

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import ThreeJSManager from './three-core.js';

/**
 * RenderManager - Handles the rendering pipeline for Three.js
 */
class RenderManager {
  constructor() {
    this.renderer = null;
    this.composer = null;
    this.renderScene = null;
    this.bloomPass = null;
    this.container = null;
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    
    // Post-processing settings
    this.postProcessing = {
      enabled: true,
      bloom: {
        enabled: true,
        strength: 0.5,
        radius: 0.4,
        threshold: 0.85
      }
    };
  }
  
  /**
   * Initialize renderer
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    this.container = options.container || document.getElementById('game-container');
    this.width = options.width || this.container.clientWidth || window.innerWidth;
    this.height = options.height || this.container.clientHeight || window.innerHeight;
    this.pixelRatio = options.pixelRatio || Math.min(window.devicePixelRatio, 2);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    
    // Configure renderer
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Add renderer to DOM
    this.container.appendChild(this.renderer.domElement);
    
    // Set up post-processing if enabled
    if (this.postProcessing.enabled) {
      this.setupPostProcessing();
    }
    
    // Add resize event listener
    window.addEventListener('resize', this.onResize.bind(this));
  }
  
  /**
   * Set up post-processing effects
   */
  setupPostProcessing() {
    // Create effect composer
    this.composer = new EffectComposer(this.renderer);
    
    // Add render pass
    this.renderScene = new RenderPass(ThreeJSManager.scene, ThreeJSManager.camera);
    this.composer.addPass(this.renderScene);
    
    // Add bloom pass
    if (this.postProcessing.bloom.enabled) {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height),
        this.postProcessing.bloom.strength,
        this.postProcessing.bloom.radius,
        this.postProcessing.bloom.threshold
      );
      this.composer.addPass(this.bloomPass);
    }
  }
  
  /**
   * Render the scene
   */
  render() {
    if (this.composer && this.postProcessing.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(ThreeJSManager.scene, ThreeJSManager.camera);
    }
  }
  
  /**
   * Handle window resize
   */
  onResize() {
    // Update dimensions
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;
    
    // Update camera
    ThreeJSManager.camera.aspect = this.width / this.height;
    ThreeJSManager.camera.updateProjectionMatrix();
    
    // Update renderer
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(this.pixelRatio);
    
    // Update composer
    if (this.composer) {
      this.composer.setSize(this.width, this.height);
    }
  }
  
  /**
   * Update bloom strength
   * @param {number} strength - Bloom strength (0-3)
   */
  setBloomStrength(strength) {
    if (this.bloomPass) {
      this.bloomPass.strength = strength;
    }
  }
  
  /**
   * Toggle post-processing on/off
   * @param {boolean} enabled - Whether post-processing is enabled
   */
  togglePostProcessing(enabled) {
    this.postProcessing.enabled = enabled;
  }
  
  /**
   * Clean up renderer resources
   */
  dispose() {
    // Remove event listeners
    window.removeEventListener('resize', this.onResize);
    
    // Dispose of composer
    if (this.composer) {
      this.composer.dispose();
    }
    
    // Dispose of renderer
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

// Export singleton instance
export default new RenderManager();
