// three-core.js - Core Three.js initialization and setup

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ThreeJSManager - Main class for managing Three.js integration
class ThreeJSManager {
  constructor() {
    // Core components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.controls = null;
    this.clock = new THREE.Clock();
    
    // Game state
    this.isInitialized = false;
    this.gameObjects = {
      court: null,
      players: {},
      basketball: null,
      hoop: null,
      scoreboard: null,
      lights: []
    };
    
    // Asset management
    this.assetManager = {
      models: {},
      textures: {},
      materials: {},
      animations: {}
    };
    
    // Debug settings
    this.debug = {
      showStats: false,
      showHelpers: false,
      showWireframe: false
    };
    
    // Binding methods
    this.init = this.init.bind(this);
    this.update = this.update.bind(this);
    this.resize = this.resize.bind(this);
  }
  
  /**
   * Initialize the Three.js environment
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    if (this.isInitialized) {
      console.warn('ThreeJSManager already initialized');
      return;
    }
    
    const container = options.container || document.getElementById('game-container');
    const width = options.width || container.clientWidth || window.innerWidth;
    const height = options.height || container.clientHeight || window.innerHeight;
    
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 10, 100);
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    
    // Add renderer to DOM
    container.appendChild(this.renderer.domElement);
    
    // Set up post-processing
    this.setupPostProcessing();
    
    // Add lights
    this.setupLights();
    
    // Setup controls
    if (options.enableControls) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.minDistance = 5;
      this.controls.maxDistance = 50;
    }
    
    // Setup event listeners
    window.addEventListener('resize', this.resize);
    
    // Initialize asset loading
    this.loadAssets();
    
    this.isInitialized = true;
    console.log('ThreeJSManager initialized');
    
    // Start animation loop
    this.update();
  }
  
  /**
   * Set up lighting for the scene
   */
  setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    this.gameObjects.lights.push(ambientLight);
    
    // Primary directional light (sun-like)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 30, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    this.gameObjects.lights.push(directionalLight);
    
    // Add spotlight for the hoop
    const hoopSpotlight = new THREE.SpotLight(0xffffff, 1.5);
    hoopSpotlight.position.set(0, 25, 0);
    hoopSpotlight.angle = Math.PI / 6;
    hoopSpotlight.penumbra = 0.5;
    hoopSpotlight.decay = 1;
    hoopSpotlight.distance = 50;
    hoopSpotlight.castShadow = true;
    hoopSpotlight.shadow.mapSize.width = 1024;
    hoopSpotlight.shadow.mapSize.height = 1024;
    hoopSpotlight.shadow.camera.near = 1;
    hoopSpotlight.shadow.camera.far = 60;
    this.scene.add(hoopSpotlight);
    this.gameObjects.lights.push(hoopSpotlight);
    
    // Add fill lights for better visibility
    const fillLight1 = new THREE.PointLight(0xffffcc, 0.7);
    fillLight1.position.set(-10, 8, 10);
    this.scene.add(fillLight1);
    this.gameObjects.lights.push(fillLight1);
    
    const fillLight2 = new THREE.PointLight(0xccffff, 0.7);
    fillLight2.position.set(10, 8, -10);
    this.scene.add(fillLight2);
    this.gameObjects.lights.push(fillLight2);
    
    // Debug helpers
    if (this.debug.showHelpers) {
      // Helper for directional light
      const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 5);
      this.scene.add(directionalLightHelper);
      
      // Helper for spotlight
      const spotLightHelper = new THREE.SpotLightHelper(hoopSpotlight);
      this.scene.add(spotLightHelper);
      
      // Camera helper for directional light shadow
      const directionalLightCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
      this.scene.add(directionalLightCameraHelper);
    }
  }
  
  /**
   * Set up post-processing effects
   */
  setupPostProcessing() {
    // Create effect composer
    this.composer = new EffectComposer(this.renderer);
    
    // Add render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    // Add bloom pass for highlights
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5,  // strength
      0.4,  // radius
      0.85   // threshold
    );
    this.composer.addPass(bloomPass);
  }
  
  /**
   * Load all required assets
   */
  loadAssets() {
    // Set up loaders
    const gltfLoader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    
    // Load court textures
    textureLoader.load('/assets/textures/court_diffuse.jpg', (texture) => {
      texture.encoding = THREE.sRGBEncoding;
      this.assetManager.textures['court_diffuse'] = texture;
    });
    
    textureLoader.load('/assets/textures/court_normal.jpg', (texture) => {
      this.assetManager.textures['court_normal'] = texture;
    });
    
    textureLoader.load('/assets/textures/court_roughness.jpg', (texture) => {
      this.assetManager.textures['court_roughness'] = texture;
    });
    
    // Load basketball textures
    textureLoader.load('/assets/textures/basketball_diffuse.jpg', (texture) => {
      texture.encoding = THREE.sRGBEncoding;
      this.assetManager.textures['basketball_diffuse'] = texture;
    });
    
    // Load player models
    const playerTypes = ['professional', 'street', 'retro', 'colorful', 'team'];
    
    playerTypes.forEach(type => {
      gltfLoader.load(`/assets/models/player_${type}.glb`, (gltf) => {
        this.assetManager.models[`player_${type}`] = gltf;
        
        // Extract animations
        if (gltf.animations && gltf.animations.length > 0) {
          this.assetManager.animations[`player_${type}`] = gltf.animations;
        }
      });
    });
    
    // Load court model
    gltfLoader.load('/assets/models/basketball_court.glb', (gltf) => {
      this.assetManager.models['basketball_court'] = gltf;
    });
    
    // Load hoop model
    gltfLoader.load('/assets/models/basketball_hoop.glb', (gltf) => {
      this.assetManager.models['basketball_hoop'] = gltf;
    });
    
    // Load basketball model
    gltfLoader.load('/assets/models/basketball.glb', (gltf) => {
      this.assetManager.models['basketball'] = gltf;
    });
  }
  
  /**
   * Update method called each frame
   */
  update() {
    const delta = this.clock.getDelta();
    
    // Update controls if enabled
    if (this.controls) {
      this.controls.update();
    }
    
    // Update game objects
    this.updateGameObjects(delta);
    
    // Render scene
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    
    // Continue animation loop
    requestAnimationFrame(this.update);
  }
  
  /**
   * Update all game objects
   * @param {number} delta - Time since last frame
   */
  updateGameObjects(delta) {
    // Implementation will be provided by game-specific code
    // This is where we'll update players, basketball, etc.
  }
  
  /**
   * Handle window resize
   */
  resize() {
    const container = this.renderer.domElement.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Update camera
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    // Update renderer
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Update composer
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }
  
  /**
   * Clean up all Three.js resources
   */
  dispose() {
    // Remove event listeners
    window.removeEventListener('resize', this.resize);
    
    // Dispose of controls
    if (this.controls) {
      this.controls.dispose();
    }
    
    // Dispose of composer
    if (this.composer) {
      this.composer.dispose();
    }
    
    // Dispose of renderer
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    // Clean up scene
    this.scene.traverse((object) => {
      if (object.isMesh) {
        object.geometry.dispose();
        
        if (object.material.isMaterial) {
          this.disposeMaterial(object.material);
        } else {
          // Handle array of materials
          for (const material of object.material) {
            this.disposeMaterial(material);
          }
        }
      }
    });
    
    console.log('ThreeJSManager disposed');
  }
  
  /**
   * Helper to dispose of material resources
   * @param {THREE.Material} material - Material to dispose
   */
  disposeMaterial(material) {
    // Dispose textures
    for (const key of Object.keys(material)) {
      const value = material[key];
      if (value && typeof value === 'object' && 'minFilter' in value) {
        value.dispose();
      }
    }
    
    // Dispose material
    material.dispose();
  }
}

// Export the manager
export default new ThreeJSManager();
