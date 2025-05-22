// PlayerShoesGeometry.js - Creates and manages shoes geometry with LOD

import * as THREE from 'three';

/**
 * PlayerShoesGeometry - Creates shoes meshes with multiple detail levels
 */
class PlayerShoesGeometry {
    constructor() {
        // Cache for performance
        this.geometryCache = {};
        
        // Bind methods
        this.createShoeGeometry = this.createShoeGeometry.bind(this);
        this.createHighDetailShoe = this.createHighDetailShoe.bind(this);
        this.createMediumDetailShoe = this.createMediumDetailShoe.bind(this);
        this.createLowDetailShoe = this.createLowDetailShoe.bind(this);
    }
    
    /**
     * Initialize the shoes geometry system
     */
    init() {
        console.log('PlayerShoesGeometry initialized');
        return this;
    }
    
    /**
     * Create shoe geometry with multiple LOD levels
     * @param {Object} options - Configuration options
     * @returns {THREE.LOD} LOD object containing shoe meshes
     */
    createShoeGeometry(options = {}) {
        const shoeLOD = new THREE.LOD();
        
        // Parameters
        const side = options.side || 'left'; // 'left' or 'right'
        const color = options.color || 0x222222;
        const accentColor = options.accentColor || 0xFFFFFF;
        
        // HIGH DETAIL - for close-up views
        const highDetailShoe = this.createHighDetailShoe(side, color, accentColor);
        shoeLOD.addLevel(highDetailShoe, 0);
        
        // MEDIUM DETAIL - for normal gameplay
        const mediumDetailShoe = this.createMediumDetailShoe(side, color, accentColor);
        shoeLOD.addLevel(mediumDetailShoe, 10);
        
        // LOW DETAIL - for distant players
        const lowDetailShoe = this.createLowDetailShoe(side, color);
        shoeLOD.addLevel(lowDetailShoe, 50);
        
        return shoeLOD;
    }
    
    /**
     * Create high detail shoe mesh
     * @param {string} side - 'left' or 'right'
     * @param {number} color - Shoe color
     * @param {number} accentColor - Accent color for details
     * @returns {THREE.Group} Shoe mesh group
     */
    createHighDetailShoe(side, color, accentColor) {
        const shoeGroup = new THREE.Group();
        shoeGroup.name = `shoe_high_${side}`;
        
        const flipFactor = side === 'left' ? 1 : -1;
        
        // Create shoe base (basketball shoe style)
        // Parameters for exaggerated basketball shoe
        const shoeLength = 0.3;
        const shoeWidth = 0.12;
        const shoeHeight = 0.08;
        const ankleHeight = 0.15; // High-top basketball shoe
        
        // Create shoe upper using extruded shape
        const shoeShape = new THREE.Shape();
        
        // Start from heel
        shoeShape.moveTo(-shoeLength * 0.3, 0);
        
        // Bottom of shoe
        shoeShape.lineTo(shoeLength * 0.7, 0);
        
        // Front toe (rounded)
        shoeShape.bezierCurveTo(
            shoeLength * 0.8, 0,
            shoeLength * 0.8, shoeHeight * 0.8,
            shoeLength * 0.7, shoeHeight
        );
        
        // Top of foot
        shoeShape.lineTo(0, shoeHeight);
        
        // Ankle portion (high-top)
        shoeShape.bezierCurveTo(
            -shoeLength * 0.1, shoeHeight,
            -shoeLength * 0.2, ankleHeight,
            -shoeLength * 0.3, ankleHeight
        );
        
        // Back of ankle/heel
        shoeShape.lineTo(-shoeLength * 0.3, 0);
        
        // Extrude to create 3D shoe
        const extrudeSettings = {
            steps: 1,
            depth: shoeWidth,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelSegments: 3
        };
        
        const geometry = new THREE.ExtrudeGeometry(shoeShape, extrudeSettings);
        
        // Flip for right foot if needed
        if (side === 'right') {
            geometry.scale(-1, 1, 1);
        }
        
        // Center the shoe geometry
        geometry.translate(0, 0, -shoeWidth/2);
        
        // Create shoe material
        const shoeMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 30, // Higher shininess for leather/synthetic look
            specular: new THREE.Color(0x333333)
        });
        
        const shoe = new THREE.Mesh(geometry, shoeMaterial);
        shoe.name = `shoe_upper_${side}`;
        shoe.castShadow = true;
        shoe.receiveShadow = true;
        
        // Create sole
        this.createSole(shoeGroup, side, shoeLength, shoeWidth, accentColor);
        
        // Create details (laces, logo, etc)
        this.createShoeDetails(shoeGroup, side, shoeLength, shoeWidth, shoeHeight, accentColor);
        
        shoeGroup.add(shoe);
        
        return shoeGroup;
    }
    
    /**
     * Create shoe sole
     * @param {THREE.Group} parent - Parent group
     * @param {string} side - 'left' or 'right'
     * @param {number} shoeLength - Length of shoe
     * @param {number} shoeWidth - Width of shoe
     * @param {number} accentColor - Accent color for sole
     */
    createSole(parent, side, shoeLength, shoeWidth, accentColor) {
        const soleShape = new THREE.Shape();
        
        // Create wider sole shape
        soleShape.moveTo(-shoeLength * 0.35, 0);
        soleShape.lineTo(shoeLength * 0.75, 0);
        soleShape.bezierCurveTo(
            shoeLength * 0.85, 0,
            shoeLength * 0.85, 0.02,
            shoeLength * 0.75, 0.02
        );
        soleShape.lineTo(-shoeLength * 0.35, 0.02);
        soleShape.lineTo(-shoeLength * 0.35, 0);
        
        // Create extrusion
        const extrudeSettings = {
            steps: 1,
            depth: shoeWidth * 1.1, // Slightly wider than shoe
            bevelEnabled: false
        };
        
        const geometry = new THREE.ExtrudeGeometry(soleShape, extrudeSettings);
        
        // Flip for right foot if needed
        if (side === 'right') {
            geometry.scale(-1, 1, 1);
        }
        
        // Center the sole geometry
        geometry.translate(0, -0.02, -shoeWidth * 1.1 / 2);
        
        // Create sole material
        const soleMaterial = new THREE.MeshPhongMaterial({
            color: accentColor,
            shininess: 10,
            specular: new THREE.Color(0x111111)
        });
        
        const sole = new THREE.Mesh(geometry, soleMaterial);
        sole.name = `shoe_sole_${side}`;
        sole.castShadow = true;
        sole.receiveShadow = true;
        
        parent.add(sole);
    }
    
    /**
     * Create detailed shoe elements (laces, logo, etc)
     * @param {THREE.Group} parent - Parent group
     * @param {string} side - 'left' or 'right'
     * @param {number} shoeLength - Length of shoe
     * @param {number} shoeWidth - Width of shoe
     * @param {number} shoeHeight - Height of shoe
     * @param {number} accentColor - Accent color for details
     */
    createShoeDetails(parent, side, shoeLength, shoeWidth, shoeHeight, accentColor) {
        const flipFactor = side === 'left' ? 1 : -1;
        
        // Create laces
        const lacesMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF, // White laces
            side: THREE.DoubleSide
        });
        
        // Add several lace segments
        for (let i = 1; i <= 3; i++) {
            const laceGeometry = new THREE.PlaneGeometry(shoeWidth * 0.7, 0.01);
            const lace = new THREE.Mesh(laceGeometry, lacesMaterial);
            lace.position.set(shoeLength * (0.2 + i * 0.1), shoeHeight * 0.7, 0);
            lace.rotation.set(0, flipFactor * Math.PI/2, 0);
            parent.add(lace);
        }
        
        // Create a shoe logo on the side
        const logoGeometry = new THREE.CircleGeometry(0.025, 16);
        const logoMaterial = new THREE.MeshBasicMaterial({
            color: accentColor,
            side: THREE.DoubleSide
        });
        
        const logo = new THREE.Mesh(logoGeometry, logoMaterial);
        logo.position.set(shoeLength * 0.1, shoeHeight * 0.6, flipFactor * (shoeWidth/2 + 0.001));
        logo.rotation.set(0, flipFactor * Math.PI/2, 0);
        parent.add(logo);
    }
    
    /**
     * Create medium detail shoe mesh
     * @param {string} side - 'left' or 'right'
     * @param {number} color - Shoe color
     * @param {number} accentColor - Accent color for details
     * @returns {THREE.Group} Shoe mesh group
     */
    createMediumDetailShoe(side, color, accentColor) {
        const shoeGroup = new THREE.Group();
        shoeGroup.name = `shoe_medium_${side}`;
        
        const flipFactor = side === 'left' ? 1 : -1;
        
        // Simplified shoe parameters
        const shoeLength = 0.3;
        const shoeWidth = 0.12;
        const shoeHeight = 0.08;
        
        // Create simplified shoe using a box
        const upperGeometry = new THREE.BoxGeometry(shoeLength, shoeHeight, shoeWidth);
        upperGeometry.translate(shoeLength * 0.2, shoeHeight/2, 0);
        
        // Create shoe material
        const shoeMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 20,
            specular: new THREE.Color(0x222222)
        });
        
        const shoe = new THREE.Mesh(upperGeometry, shoeMaterial);
        shoe.name = `shoe_upper_${side}`;
        shoe.castShadow = true;
        
        // Create simple sole
        const soleGeometry = new THREE.BoxGeometry(shoeLength * 1.1, 0.02, shoeWidth * 1.1);
        soleGeometry.translate(shoeLength * 0.2, -0.01, 0);
        
        const soleMaterial = new THREE.MeshPhongMaterial({
            color: accentColor,
            shininess: 10,
            specular: new THREE.Color(0x111111)
        });
        
        const sole = new THREE.Mesh(soleGeometry, soleMaterial);
        sole.name = `shoe_sole_${side}`;
        sole.castShadow = true;
        
        shoeGroup.add(shoe);
        shoeGroup.add(sole);
        
        return shoeGroup;
    }
    
    /**
     * Create low detail shoe mesh
     * @param {string} side - 'left' or 'right'
     * @param {number} color - Shoe color
     * @returns {THREE.Group} Shoe mesh group
     */
    createLowDetailShoe(side, color) {
        const shoeGroup = new THREE.Group();
        shoeGroup.name = `shoe_low_${side}`;
        
        // Very simple shoe - just a box
        const shoeLength = 0.3;
        const shoeWidth = 0.12;
        const shoeHeight = 0.08;
        
        const geometry = new THREE.BoxGeometry(shoeLength, shoeHeight, shoeWidth);
        geometry.translate(shoeLength * 0.2, shoeHeight/2, 0);
        
        // Create shoe material
        const shoeMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 0,
            specular: new THREE.Color(0x000000)
        });
        
        const shoe = new THREE.Mesh(geometry, shoeMaterial);
        shoe.name = `shoe_${side}`;
        shoe.castShadow = true;
        
        shoeGroup.add(shoe);
        
        return shoeGroup;
    }
}

export default PlayerShoesGeometry;
