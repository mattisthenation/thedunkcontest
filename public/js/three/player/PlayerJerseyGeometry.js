// PlayerJerseyGeometry.js - Creates and manages jersey geometry with LOD

import * as THREE from 'three';

/**
 * PlayerJerseyGeometry - Creates jersey meshes with multiple detail levels
 */
class PlayerJerseyGeometry {
    constructor() {
        // Cache for performance
        this.geometryCache = {};
        this.textureCache = {};
        
        // Bind methods
        this.createJerseyGeometry = this.createJerseyGeometry.bind(this);
        this.createHighDetailJersey = this.createHighDetailJersey.bind(this);
        this.createMediumDetailJersey = this.createMediumDetailJersey.bind(this);
        this.createLowDetailJersey = this.createLowDetailJersey.bind(this);
        this.createJerseyNumberTexture = this.createJerseyNumberTexture.bind(this);
    }
    
    /**
     * Initialize the jersey geometry system
     */
    init() {
        console.log('PlayerJerseyGeometry initialized');
        return this;
    }
    
    /**
     * Create jersey geometry with multiple LOD levels
     * @param {Object} options - Configuration options
     * @returns {THREE.LOD} LOD object containing jersey meshes
     */
    createJerseyGeometry(options = {}) {
        const jerseyLOD = new THREE.LOD();
        
        // Parameters
        const height = options.height || 1.8;
        const buildFactor = options.buildFactor || 1; 
        const color = options.color || 0x3366ff;
        const jerseyNumber = options.jerseyNumber || Math.floor(Math.random() * 99) + 1;
        const jerseyName = options.jerseyName || 'PLAYER';
        
        // HIGH DETAIL - for close-up views
        const highDetailJersey = this.createHighDetailJersey(height, buildFactor, color, jerseyNumber, jerseyName);
        jerseyLOD.addLevel(highDetailJersey, 0);
        
        // MEDIUM DETAIL - for normal gameplay
        const mediumDetailJersey = this.createMediumDetailJersey(height, buildFactor, color, jerseyNumber, jerseyName);
        jerseyLOD.addLevel(mediumDetailJersey, 10);
        
        // LOW DETAIL - for distant players
        const lowDetailJersey = this.createLowDetailJersey(height, buildFactor, color, jerseyNumber);
        jerseyLOD.addLevel(lowDetailJersey, 50);
        
        return jerseyLOD;
    }
    
    /**
     * Create high detail jersey mesh
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     * @param {number} color - Jersey color
     * @param {number} jerseyNumber - Player's jersey number
     * @param {string} jerseyName - Player's name for the jersey
     * @returns {THREE.Group} Jersey mesh group
     */
    createHighDetailJersey(height, buildFactor, color, jerseyNumber, jerseyName) {
        const jerseyGroup = new THREE.Group();
        jerseyGroup.name = 'jersey_high';
        
        // Create jersey using more detailed geometry
        const topWidth = 0.42 * buildFactor;  // Shoulders
        const bottomWidth = 0.36 * buildFactor; // Waist
        const jerseyHeight = height * 0.25;  // About 25% of player height
        
        // Create torso shape with shoulders
        const frontShape = new THREE.Shape();
        
        // Start from bottom left
        frontShape.moveTo(-bottomWidth/2, 0);
        
        // Bottom edge
        frontShape.lineTo(bottomWidth/2, 0);
        
        // Right side up to armpit
        frontShape.lineTo(bottomWidth/2, jerseyHeight * 0.65);
        
        // Right shoulder with curve
        frontShape.bezierCurveTo(
            bottomWidth/2, jerseyHeight * 0.8,
            topWidth/2, jerseyHeight * 0.85,
            topWidth/2, jerseyHeight
        );
        
        // Across top (neck opening)
        frontShape.lineTo(-topWidth/2, jerseyHeight);
        
        // Left shoulder with curve
        frontShape.bezierCurveTo(
            -topWidth/2, jerseyHeight * 0.85,
            -bottomWidth/2, jerseyHeight * 0.8,
            -bottomWidth/2, jerseyHeight * 0.65
        );
        
        // Close shape
        frontShape.lineTo(-bottomWidth/2, 0);
        
        // Cut out neck hole
        const neckRadius = 0.12 * buildFactor;
        const neckHole = new THREE.Path();
        neckHole.absarc(0, jerseyHeight * 0.9, neckRadius, 0, Math.PI * 2, true);
        frontShape.holes.push(neckHole);
        
        // Extrude to create 3D jersey
        const depth = 0.25 * buildFactor;
        const extrudeSettings = {
            steps: 1,
            depth: depth,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelSegments: 3
        };
        
        const frontGeometry = new THREE.ExtrudeGeometry(frontShape, extrudeSettings);
        frontGeometry.translate(0, 0, -depth/2);
        
        // Create jersey material
        // Use MeshPhongMaterial for better light reflection (like shiny fabric)
        const jerseyMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 10,
            specular: new THREE.Color(0x111111)
        });
        
        const jersey = new THREE.Mesh(frontGeometry, jerseyMaterial);
        jersey.name = 'jersey_front';
        jersey.castShadow = true;
        jersey.receiveShadow = true;
        
        // Create jersey number on the back
        const backMaterial = jerseyMaterial.clone();
        
        // Create number texture
        const numberTexture = this.createJerseyNumberTexture(jerseyNumber, jerseyName);
        if (numberTexture) {
            backMaterial.map = numberTexture;
        }
        
        // Create back plate
        const backPlateGeometry = new THREE.PlaneGeometry(bottomWidth * 0.8, jerseyHeight * 0.8);
        const backPlate = new THREE.Mesh(backPlateGeometry, backMaterial);
        backPlate.position.set(0, jerseyHeight * 0.4, -depth);
        backPlate.rotation.set(0, Math.PI, 0);
        
        // Create sleeves
        this.createSleeves(jerseyGroup, color, buildFactor, jerseyHeight);
        
        jerseyGroup.add(jersey);
        jerseyGroup.add(backPlate);
        
        return jerseyGroup;
    }
    
    /**
     * Create jersey sleeves
     * @param {THREE.Group} parent - Parent group
     * @param {number} color - Jersey color
     * @param {number} buildFactor - Body build factor
     * @param {number} jerseyHeight - Height of the jersey
     */
    createSleeves(parent, color, buildFactor, jerseyHeight) {
        const sleeveLength = 0.15 * buildFactor;
        const sleeveRadius = 0.1 * buildFactor;
        
        // Create sleeve material
        const sleeveMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 5,
            specular: new THREE.Color(0x111111)
        });
        
        // Left sleeve
        const leftSleeveGeometry = new THREE.CylinderGeometry(
            sleeveRadius, sleeveRadius * 0.9, sleeveLength, 8, 1, true
        );
        leftSleeveGeometry.rotateX(Math.PI/2);
        
        const leftSleeve = new THREE.Mesh(leftSleeveGeometry, sleeveMaterial);
        leftSleeve.position.set(0.25 * buildFactor, jerseyHeight * 0.8, 0);
        leftSleeve.castShadow = true;
        parent.add(leftSleeve);
        
        // Right sleeve
        const rightSleeveGeometry = leftSleeveGeometry.clone();
        
        const rightSleeve = new THREE.Mesh(rightSleeveGeometry, sleeveMaterial);
        rightSleeve.position.set(-0.25 * buildFactor, jerseyHeight * 0.8, 0);
        rightSleeve.castShadow = true;
        parent.add(rightSleeve);
    }
    
    /**
     * Create jersey number texture
     * @param {number} number - Player number
     * @param {string} name - Player name
     * @returns {THREE.Texture} Texture with player number and name
     */
    createJerseyNumberTexture(number, name) {
        // Create a canvas to draw the number
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        
        const context = canvas.getContext('2d');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the number
        context.font = 'bold 120px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#000000';
        context.fillText(number.toString(), canvas.width/2, canvas.height/2);
        
        // Draw the name
        context.font = 'bold 36px Arial';
        context.fillText(name, canvas.width/2, 50);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        
        // Cache the texture
        const cacheKey = `jersey_${number}_${name}`;
        this.textureCache[cacheKey] = texture;
        
        return texture;
    }
    
    /**
     * Create medium detail jersey mesh
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     * @param {number} color - Jersey color
     * @param {number} jerseyNumber - Player's jersey number
     * @param {string} jerseyName - Player's name for the jersey
     * @returns {THREE.Group} Jersey mesh group
     */
    createMediumDetailJersey(height, buildFactor, color, jerseyNumber, jerseyName) {
        const jerseyGroup = new THREE.Group();
        jerseyGroup.name = 'jersey_medium';
        
        // Create a simplified jersey
        const topWidth = 0.42 * buildFactor;  // Shoulders
        const bottomWidth = 0.36 * buildFactor; // Waist
        const jerseyHeight = height * 0.25;  // About 25% of player height
        
        // Use a simple trapezoid for the jersey
        const shape = new THREE.Shape();
        shape.moveTo(-bottomWidth/2, 0);
        shape.lineTo(bottomWidth/2, 0);
        shape.lineTo(topWidth/2, jerseyHeight);
        shape.lineTo(-topWidth/2, jerseyHeight);
        shape.lineTo(-bottomWidth/2, 0);
        
        // Add neck hole
        const neckRadius = 0.1 * buildFactor;
        const neckHole = new THREE.Path();
        neckHole.absarc(0, jerseyHeight * 0.9, neckRadius, 0, Math.PI * 2, true);
        shape.holes.push(neckHole);
        
        // Extrude to create 3D jersey
        const depth = 0.2 * buildFactor;
        const extrudeSettings = {
            steps: 1,
            depth: depth,
            bevelEnabled: false
        };
        
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // Create jersey material
        const jerseyMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 5,
            specular: new THREE.Color(0x111111)
        });
        
        const jersey = new THREE.Mesh(geometry, jerseyMaterial);
        jersey.name = 'jersey_body';
        jersey.castShadow = true;
        jersey.receiveShadow = true;
        
        // Add a simplified number on the back
        const numberPlane = new THREE.PlaneGeometry(bottomWidth * 0.6, jerseyHeight * 0.6);
        const numberMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        });
        
        const numberMesh = new THREE.Mesh(numberPlane, numberMaterial);
        numberMesh.position.set(0, jerseyHeight * 0.4, -depth - 0.01);
        numberMesh.rotation.set(0, Math.PI, 0);
        
        jerseyGroup.add(jersey);
        jerseyGroup.add(numberMesh);
        
        return jerseyGroup;
    }
    
    /**
     * Create low detail jersey mesh
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     * @param {number} color - Jersey color
     * @param {number} jerseyNumber - Player's jersey number
     * @returns {THREE.Group} Jersey mesh group
     */
    createLowDetailJersey(height, buildFactor, color, jerseyNumber) {
        const jerseyGroup = new THREE.Group();
        jerseyGroup.name = 'jersey_low';
        
        // Very simple jersey - just a box
        const width = 0.4 * buildFactor;
        const depth = 0.2 * buildFactor;
        const jerseyHeight = height * 0.25;
        
        const geometry = new THREE.BoxGeometry(width, jerseyHeight, depth);
        
        // Create jersey material
        const jerseyMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 0,
            specular: new THREE.Color(0x000000)
        });
        
        const jersey = new THREE.Mesh(geometry, jerseyMaterial);
        jersey.name = 'jersey_body';
        jersey.castShadow = true;
        jersey.position.set(0, jerseyHeight/2, 0);
        
        jerseyGroup.add(jersey);
        
        return jerseyGroup;
    }
}

export default PlayerJerseyGeometry;
