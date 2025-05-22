// PlayerShortsGeometry.js - Creates and manages shorts geometry with LOD

import * as THREE from 'three';

/**
 * PlayerShortsGeometry - Creates shorts meshes with multiple detail levels
 */
class PlayerShortsGeometry {
    constructor() {
        // Cache for performance
        this.geometryCache = {};
        
        // Bind methods
        this.createShortsGeometry = this.createShortsGeometry.bind(this);
        this.createHighDetailShorts = this.createHighDetailShorts.bind(this);
        this.createMediumDetailShorts = this.createMediumDetailShorts.bind(this);
        this.createLowDetailShorts = this.createLowDetailShorts.bind(this);
    }
    
    /**
     * Initialize the shorts geometry system
     */
    init() {
        console.log('PlayerShortsGeometry initialized');
        return this;
    }
    
    /**
     * Create shorts geometry with multiple LOD levels
     * @param {Object} options - Configuration options
     * @returns {THREE.LOD} LOD object containing shorts meshes
     */
    createShortsGeometry(options = {}) {
        const shortsLOD = new THREE.LOD();
        
        // Parameters
        const height = options.height || 1.8;
        const buildFactor = options.buildFactor || 1;
        const color = options.color || 0x3366ff;
        
        // HIGH DETAIL - for close-up views
        const highDetailShorts = this.createHighDetailShorts(height, buildFactor, color);
        shortsLOD.addLevel(highDetailShorts, 0);
        
        // MEDIUM DETAIL - for normal gameplay
        const mediumDetailShorts = this.createMediumDetailShorts(height, buildFactor, color);
        shortsLOD.addLevel(mediumDetailShorts, 10);
        
        // LOW DETAIL - for distant players
        const lowDetailShorts = this.createLowDetailShorts(height, buildFactor, color);
        shortsLOD.addLevel(lowDetailShorts, 50);
        
        return shortsLOD;
    }
    
    /**
     * Create high detail shorts mesh
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     * @param {number} color - Shorts color
     * @returns {THREE.Group} Shorts mesh group
     */
    createHighDetailShorts(height, buildFactor, color) {
        const shortsGroup = new THREE.Group();
        shortsGroup.name = 'shorts_high';
        
        // Create shorts with detailed shape
        const topWidth = 0.4 * buildFactor;
        const bottomWidth = 0.50 * buildFactor; // Wider at the bottom for loose fit
        const shortsHeight = height * 0.20; // About 20% of player height
        
        // Create shorts shape
        const shape = new THREE.Shape();
        
        // Start from top left
        shape.moveTo(-topWidth/2, shortsHeight);
        
        // Top edge
        shape.lineTo(topWidth/2, shortsHeight);
        
        // Right side down, with slight outward curve for baggy look
        shape.bezierCurveTo(
            topWidth/2, shortsHeight * 0.6,
            bottomWidth/2, shortsHeight * 0.4,
            bottomWidth/2, 0
        );
        
        // Bottom edge
        shape.lineTo(-bottomWidth/2, 0);
        
        // Left side up, with matching curve
        shape.bezierCurveTo(
            -bottomWidth/2, shortsHeight * 0.4,
            -topWidth/2, shortsHeight * 0.6,
            -topWidth/2, shortsHeight
        );
        
        // Extrude the shape to create 3D shorts
        const depth = 0.25 * buildFactor;
        const extrudeSettings = {
            steps: 1,
            depth: depth,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelSegments: 3
        };
        
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.translate(0, 0, -depth/2);
        
        // Create shorts material with slight shininess
        const shortsMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 5,
            specular: new THREE.Color(0x111111)
        });
        
        const shorts = new THREE.Mesh(geometry, shortsMaterial);
        shorts.name = 'shorts_body';
        shorts.castShadow = true;
        shorts.receiveShadow = true;
        
        // Create leg openings
        this.createLegOpenings(shortsGroup, shortsMaterial, bottomWidth, depth);
        
        // Add seam details
        this.createSeamDetails(shortsGroup, shortsMaterial, topWidth, bottomWidth, shortsHeight, depth, color);
        
        shortsGroup.add(shorts);
        
        return shortsGroup;
    }
    
    /**
     * Create leg openings for high detail shorts
     * @param {THREE.Group} parent - Parent group
     * @param {THREE.Material} material - Shorts material
     * @param {number} width - Width of shorts at bottom
     * @param {number} depth - Depth of shorts
     */
    createLegOpenings(parent, material, width, depth) {
        const ringGeometry = new THREE.TorusGeometry(width * 0.25, 0.02, 8, 16, Math.PI);
        
        // Left leg opening
        const leftRing = new THREE.Mesh(ringGeometry, material);
        leftRing.position.set(-width * 0.25, 0, 0);
        leftRing.rotation.set(Math.PI/2, 0, 0);
        parent.add(leftRing);
        
        // Right leg opening
        const rightRing = new THREE.Mesh(ringGeometry, material);
        rightRing.position.set(width * 0.25, 0, 0);
        rightRing.rotation.set(Math.PI/2, 0, 0);
        parent.add(rightRing);
    }
    
    /**
     * Create seam details for high detail shorts
     * @param {THREE.Group} parent - Parent group
     * @param {THREE.Material} material - Shorts material
     * @param {number} topWidth - Width at top of shorts
     * @param {number} bottomWidth - Width at bottom of shorts
     * @param {number} height - Height of shorts
     * @param {number} depth - Depth of shorts
     * @param {number} color - Shorts color
     */
    createSeamDetails(parent, material, topWidth, bottomWidth, height, depth, color) {
        // Create a slightly darker material for seams
        const seamColor = new THREE.Color(color);
        seamColor.multiplyScalar(0.8); // Darken the color
        
        const seamMaterial = new THREE.MeshBasicMaterial({
            color: seamColor,
            depthWrite: false // Prevent z-fighting
        });
        
        // Side seams
        const sideSeamGeometry = new THREE.PlaneGeometry(0.02, height);
        
        // Left seam
        const leftSeam = new THREE.Mesh(sideSeamGeometry, seamMaterial);
        leftSeam.position.set(-topWidth/2, height/2, depth/2 + 0.001);
        parent.add(leftSeam);
        
        // Right seam
        const rightSeam = new THREE.Mesh(sideSeamGeometry, seamMaterial);
        rightSeam.position.set(topWidth/2, height/2, depth/2 + 0.001);
        parent.add(rightSeam);
        
        // Waistband
        const waistbandGeometry = new THREE.TorusGeometry(topWidth * 0.6, 0.03, 8, 24);
        waistbandGeometry.rotateX(Math.PI/2);
        waistbandGeometry.scale(1, 1, 0.5);
        
        const waistband = new THREE.Mesh(waistbandGeometry, seamMaterial);
        waistband.position.set(0, height, 0);
        parent.add(waistband);
    }
    
    /**
     * Create medium detail shorts mesh
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     * @param {number} color - Shorts color
     * @returns {THREE.Group} Shorts mesh group
     */
    createMediumDetailShorts(height, buildFactor, color) {
        const shortsGroup = new THREE.Group();
        shortsGroup.name = 'shorts_medium';
        
        // Create a simplified shorts using a truncated cone
        const topRadius = 0.2 * buildFactor;
        const bottomRadius = 0.25 * buildFactor;
        const shortsHeight = height * 0.20;
        
        const geometry = new THREE.CylinderGeometry(
            topRadius, bottomRadius, shortsHeight, 8, 1, true
        );
        geometry.translate(0, shortsHeight/2, 0);
        
        // Create shorts material
        const shortsMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 5,
            specular: new THREE.Color(0x111111)
        });
        
        const shorts = new THREE.Mesh(geometry, shortsMaterial);
        shorts.name = 'shorts_body';
        shorts.castShadow = true;
        
        // Add a simple waistband
        const waistbandGeometry = new THREE.TorusGeometry(topRadius, 0.02, 8, 16);
        waistbandGeometry.rotateX(Math.PI/2);
        
        const waistbandMaterial = shortsMaterial.clone();
        waistbandMaterial.color.multiplyScalar(0.8); // Darker color
        
        const waistband = new THREE.Mesh(waistbandGeometry, waistbandMaterial);
        waistband.position.set(0, shortsHeight, 0);
        
        shortsGroup.add(shorts);
        shortsGroup.add(waistband);
        
        return shortsGroup;
    }
    
    /**
     * Create low detail shorts mesh
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     * @param {number} color - Shorts color
     * @returns {THREE.Group} Shorts mesh group
     */
    createLowDetailShorts(height, buildFactor, color) {
        const shortsGroup = new THREE.Group();
        shortsGroup.name = 'shorts_low';
        
        // Very simple shorts - just a box
        const width = 0.4 * buildFactor;
        const depth = 0.2 * buildFactor;
        const shortsHeight = height * 0.20;
        
        const geometry = new THREE.BoxGeometry(width, shortsHeight, depth);
        geometry.translate(0, shortsHeight/2, 0);
        
        // Create shorts material
        const shortsMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 0,
            specular: new THREE.Color(0x000000)
        });
        
        const shorts = new THREE.Mesh(geometry, shortsMaterial);
        shorts.name = 'shorts_body';
        shorts.castShadow = true;
        
        shortsGroup.add(shorts);
        
        return shortsGroup;
    }
}

export default PlayerShortsGeometry;
