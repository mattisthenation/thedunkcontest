// three-court.js - Basketball court implementation for Three.js

import * as THREE from 'three';
import ThreeJSManager from './three-core.js';

/**
 * BasketballCourt - 3D basketball court representation
 */
export class BasketballCourt {
  constructor(options = {}) {
    this.width = options.width || 28; // Standard court width in meters
    this.length = options.length || 15; // Standard court length in meters
    this.group = new THREE.Group();
    this.group.name = 'BasketballCourt';
    
    // Materials
    this.materials = {
      court: null,
      lines: null,
      edges: null
    };
    
    // References to key locations on the court
    this.locations = {
      center: new THREE.Vector3(0, 0, 0),
      homeHoop: new THREE.Vector3(0, 3.05, -this.length/2 + 1.2), // 10ft high
      awayHoop: new THREE.Vector3(0, 3.05, this.length/2 - 1.2)   // 10ft high
    };
    
    // Initialize court
    this.init();
  }
  
  /**
   * Initialize court geometry and materials
   */
  init() {
    // Create basic court if no model is available
    if (!ThreeJSManager.assetManager.models['basketball_court']) {
      this.createBasicCourt();
    } else {
      this.loadDetailedCourt();
    }
    
    // Add to scene
    ThreeJSManager.scene.add(this.group);
  }
  
  /**
   * Create a basic court geometry
   */
  createBasicCourt() {
    // Create court floor
    const floorGeometry = new THREE.PlaneGeometry(this.width, this.length);
    floorGeometry.rotateX(-Math.PI / 2); // Lay flat
    
    // Create materials based on available textures
    if (ThreeJSManager.assetManager.textures['court_diffuse']) {
      // Create PBR material with textures
      const courtMaterial = new THREE.MeshStandardMaterial({
        map: ThreeJSManager.assetManager.textures['court_diffuse'],
        normalMap: ThreeJSManager.assetManager.textures['court_normal'] || null,
        roughnessMap: ThreeJSManager.assetManager.textures['court_roughness'] || null,
        roughness: 0.8,
        metalness: 0.1
      });
      this.materials.court = courtMaterial;
    } else {
      // Create basic material
      this.materials.court = new THREE.MeshStandardMaterial({
        color: 0xC19A6B, // Wood color
        roughness: 0.8,
        metalness: 0.1
      });
    }
    
    // Create court floor mesh
    const floor = new THREE.Mesh(floorGeometry, this.materials.court);
    floor.name = 'CourtFloor';
    floor.receiveShadow = true;
    this.group.add(floor);
    
    // Create court line material
    this.materials.lines = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    
    // Add court markings (lines)
    this.addCourtLines();
    
    // Add simple walls around the court
    this.addCourtWalls();
  }
  
  /**
   * Add court lines and markings
   */
  addCourtLines() {
    // Line thickness
    const lineWidth = 0.05;
    const lineHeight = 0.005; // Just above the floor
    
    // Perimeter lines
    const perimeterGeometry = new THREE.BoxGeometry(
      this.width - lineWidth, 
      lineHeight, 
      this.length - lineWidth
    );
    const perimeterLine = new THREE.Mesh(perimeterGeometry, this.materials.lines);
    perimeterLine.position.y = 0.01; // Just above the floor
    perimeterLine.position.x = 0;
    perimeterLine.position.z = 0;
    
    // Create the perimeter as line segments, not filled in
    const edgesGeometry = new THREE.EdgesGeometry(perimeterGeometry); 
    const perimeterEdges = new THREE.LineSegments(
      edgesGeometry,
      new THREE.LineBasicMaterial({ color: 0xFFFFFF, linewidth: 2 })
    );
    perimeterEdges.position.y = 0.01;
    this.group.add(perimeterEdges);
    
    // Center line
    const centerLineGeometry = new THREE.BoxGeometry(
      this.width - lineWidth*2, 
      lineHeight, 
      lineWidth
    );
    const centerLine = new THREE.Mesh(centerLineGeometry, this.materials.lines);
    centerLine.position.y = 0.01;
    centerLine.position.z = 0;
    this.group.add(centerLine);
    
    // Center circle
    const centerCircleGeometry = new THREE.RingGeometry(1.8, 1.8 + lineWidth, 32);
    centerCircleGeometry.rotateX(-Math.PI / 2);
    const centerCircle = new THREE.Mesh(centerCircleGeometry, this.materials.lines);
    centerCircle.position.y = 0.01;
    this.group.add(centerCircle);
    
    // Free throw circles (both ends)
    const ftCircleGeometry = new THREE.RingGeometry(1.8, 1.8 + lineWidth, 32);
    ftCircleGeometry.rotateX(-Math.PI / 2);
    
    // Home free throw circle
    const homeFtCircle = new THREE.Mesh(ftCircleGeometry, this.materials.lines);
    homeFtCircle.position.y = 0.01;
    homeFtCircle.position.z = -this.length/2 + 5.8;
    this.group.add(homeFtCircle);
    
    // Away free throw circle
    const awayFtCircle = new THREE.Mesh(ftCircleGeometry, this.materials.lines);
    awayFtCircle.position.y = 0.01;
    awayFtCircle.position.z = this.length/2 - 5.8;
    this.group.add(awayFtCircle);
    
    // Three point lines (both ends)
    // For simplicity, we'll use a combination of arcs and lines
    
    // Home three-point arc
    const homeThreeArcGeometry = new THREE.RingGeometry(6.75, 6.75 + lineWidth, 32, 1, 0, Math.PI);
    homeThreeArcGeometry.rotateX(-Math.PI / 2);
    homeThreeArcGeometry.translate(0, 0, -this.length/2 + 1.25);
    const homeThreeArc = new THREE.Mesh(homeThreeArcGeometry, this.materials.lines);
    homeThreeArc.position.y = 0.01;
    this.group.add(homeThreeArc);
    
    // Away three-point arc
    const awayThreeArcGeometry = new THREE.RingGeometry(6.75, 6.75 + lineWidth, 32, 1, 0, Math.PI);
    awayThreeArcGeometry.rotateX(-Math.PI / 2);
    awayThreeArcGeometry.rotateY(Math.PI);
    awayThreeArcGeometry.translate(0, 0, this.length/2 - 1.25);
    const awayThreeArc = new THREE.Mesh(awayThreeArcGeometry, this.materials.lines);
    awayThreeArc.position.y = 0.01;
    this.group.add(awayThreeArc);
  }
  
  /**
   * Add simple walls around the court
   */
  addCourtWalls() {
    // Wall height
    const wallHeight = 1.2;
    
    // Create wall material
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2
    });
    
    // Create walls as simple boxes
    // Left wall
    const leftWallGeometry = new THREE.BoxGeometry(0.2, wallHeight, this.length);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.set(-this.width/2 - 0.1, wallHeight/2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    this.group.add(leftWall);
    
    // Right wall
    const rightWallGeometry = new THREE.BoxGeometry(0.2, wallHeight, this.length);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.position.set(this.width/2 + 0.1, wallHeight/2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    this.group.add(rightWall);
    
    // Back wall (home)
    const homeWallGeometry = new THREE.BoxGeometry(this.width + 0.4, wallHeight, 0.2);
    const homeWall = new THREE.Mesh(homeWallGeometry, wallMaterial);
    homeWall.position.set(0, wallHeight/2, -this.length/2 - 0.1);
    homeWall.castShadow = true;
    homeWall.receiveShadow = true;
    this.group.add(homeWall);
    
    // Back wall (away)
    const awayWallGeometry = new THREE.BoxGeometry(this.width + 0.4, wallHeight, 0.2);
    const awayWall = new THREE.Mesh(awayWallGeometry, wallMaterial);
    awayWall.position.set(0, wallHeight/2, this.length/2 + 0.1);
    awayWall.castShadow = true;
    awayWall.receiveShadow = true;
    this.group.add(awayWall);
  }
  
  /**
   * Load detailed court model from asset manager
   */
  loadDetailedCourt() {
    const courtModel = ThreeJSManager.assetManager.models['basketball_court'];
    
    if (courtModel && courtModel.scene) {
      // Clone the model to avoid modifying the original
      const court = courtModel.scene.clone();
      
      // Set up shadows for all objects
      court.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      
      // Add to group
      this.group.add(court);
    } else {
      console.warn('Court model not available, falling back to basic court');
      this.createBasicCourt();
    }
  }
  
  /**
   * Update the court (if needed)
   * @param {number} delta - Time since last frame
   */
  update(delta) {
    // If we need any animations or updates
  }
}

// Export the class
export default BasketballCourt;
