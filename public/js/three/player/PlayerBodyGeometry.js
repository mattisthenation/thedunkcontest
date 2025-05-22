// PlayerBodyGeometry.js - Creates and manages body geometry with LOD

import * as THREE from 'three';

/**
 * PlayerBodyGeometry - Creates body meshes with multiple detail levels
 */
class PlayerBodyGeometry {
    constructor() {
        // Cache for performance
        this.geometryCache = {};
        
        // Bind methods
        this.createBodyGeometry = this.createBodyGeometry.bind(this);
        this.createHighDetailBody = this.createHighDetailBody.bind(this);
        this.createMediumDetailBody = this.createMediumDetailBody.bind(this);
        this.createLowDetailBody = this.createLowDetailBody.bind(this);
    }
    
    /**
     * Initialize the body geometry system
     */
    init() {
        console.log('PlayerBodyGeometry initialized');
        return this;
    }
    
    /**
     * Create body geometry with multiple LOD levels
     * @param {Object} options - Configuration options
     * @returns {THREE.LOD} LOD object containing body meshes
     */
    createBodyGeometry(options = {}) {
        const bodyLOD = new THREE.LOD();
        
        // Parameters
        const height = options.height || 1.8;
        const buildFactor = options.buildFactor || 1; // 1 = normal, <1 = thin, >1 = muscular
        const skinTone = options.skinTone || 0xd2a789;
        
        // HIGH DETAIL - for close-up views
        const highDetailBody = this.createHighDetailBody(height, buildFactor, skinTone);
        bodyLOD.addLevel(highDetailBody, 0);
        
        // MEDIUM DETAIL - for normal gameplay
        const mediumDetailBody = this.createMediumDetailBody(height, buildFactor, skinTone);
        bodyLOD.addLevel(mediumDetailBody, 10);
        
        // LOW DETAIL - for distant players
        const lowDetailBody = this.createLowDetailBody(height, buildFactor, skinTone);
        bodyLOD.addLevel(lowDetailBody, 50);
        
        return bodyLOD;
    }
    
    /**
     * Create high detail body mesh
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     * @param {number} skinTone - Skin tone color
     * @returns {THREE.Group} Body mesh group
     */
    createHighDetailBody(height, buildFactor, skinTone) {
        const bodyGroup = new THREE.Group();
        bodyGroup.name = 'body_high';
        
        // Create torso with improved geometry
        const torsoWidth = 0.4 * buildFactor;
        const torsoDepth = 0.25 * buildFactor;
        const torsoHeight = height * 0.35; // Torso is about 35% of height
        
        // Create torso shape with shoulders
        const torsoShape = new THREE.Shape();
        torsoShape.moveTo(-torsoWidth/2, -torsoHeight/2);
        torsoShape.lineTo(-torsoWidth/2, torsoHeight/2);
        torsoShape.bezierCurveTo(
            -torsoWidth/2, torsoHeight/2 + 0.1,
            -torsoWidth/2 - 0.1, torsoHeight/2 + 0.1,
            -torsoWidth/2 - 0.15, torsoHeight/2
        ); // Left shoulder
        torsoShape.lineTo(torsoWidth/2 + 0.15, torsoHeight/2); // Across shoulders
        torsoShape.bezierCurveTo(
            torsoWidth/2 + 0.1, torsoHeight/2 + 0.1,
            torsoWidth/2, torsoHeight/2 + 0.1,
            torsoWidth/2, torsoHeight/2
        ); // Right shoulder
        torsoShape.lineTo(torsoWidth/2, -torsoHeight/2);
        torsoShape.lineTo(-torsoWidth/2, -torsoHeight/2);
        
        // Extrude the shape to create 3D torso
        const extrudeSettings = {
            steps: 1,
            depth: torsoDepth,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.05,
            bevelSegments: 3
        };
        
        const torsoGeometry = new THREE.ExtrudeGeometry(torsoShape, extrudeSettings);
        torsoGeometry.translate(0, torsoHeight/2, -torsoDepth/2);
        
        const torsoMaterial = new THREE.MeshStandardMaterial({
            color: skinTone,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
        torso.name = 'torso';
        torso.castShadow = true;
        torso.receiveShadow = true;
        
        // Create neck
        const neckGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.1, 8);
        neckGeometry.translate(0, torsoHeight/2 + 0.05, 0);
        const neck = new THREE.Mesh(neckGeometry, torsoMaterial);
        neck.name = 'neck';
        neck.castShadow = true;
        
        // Create arms (left and right)
        this.createArm(bodyGroup, torsoMaterial, 'left', torsoWidth/2 + 0.15, torsoHeight/2, 0, height, buildFactor);
        this.createArm(bodyGroup, torsoMaterial, 'right', -torsoWidth/2 - 0.15, torsoHeight/2, 0, height, buildFactor);
        
        bodyGroup.add(torso);
        bodyGroup.add(neck);
        
        return bodyGroup;
    }
    
    /**
     * Create a detailed arm for the high detail body
     * @param {THREE.Group} parent - Parent group
     * @param {THREE.Material} material - Arm material
     * @param {string} side - 'left' or 'right'
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} z - Z position
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     */
    createArm(parent, material, side, x, y, z, height, buildFactor) {
        const flipFactor = side === 'left' ? 1 : -1;
        const armLength = height * 0.3; // Arm is about 30% of height
        const upperArmLength = armLength * 0.6;
        const forearmLength = armLength * 0.4;
        
        // Upper arm (biceps)
        const upperArmRadius = 0.08 * buildFactor;
        const upperArmGeometry = new THREE.CapsuleGeometry(upperArmRadius, upperArmLength, 4, 8);
        upperArmGeometry.rotateZ(flipFactor * Math.PI/2); // Align along X-axis
        upperArmGeometry.translate(flipFactor * upperArmLength/2, 0, 0); // Center
        
        const upperArm = new THREE.Mesh(upperArmGeometry, material);
        upperArm.name = `${side}_upper_arm`;
        upperArm.position.set(x, y, z);
        upperArm.castShadow = true;
        parent.add(upperArm);
        
        // Forearm
        const forearmRadius = 0.06 * buildFactor;
        const forearmGeometry = new THREE.CapsuleGeometry(forearmRadius, forearmLength, 4, 8);
        forearmGeometry.rotateZ(flipFactor * Math.PI/2); // Align along X-axis
        forearmGeometry.translate(flipFactor * forearmLength/2, 0, 0); // Center
        
        const forearm = new THREE.Mesh(forearmGeometry, material);
        forearm.name = `${side}_forearm`;
        forearm.position.set(x + flipFactor * upperArmLength, y, z);
        forearm.castShadow = true;
        parent.add(forearm);
        
        // Hand
        const handGeometry = new THREE.SphereGeometry(0.07, 8, 8);
        handGeometry.scale(1, 0.8, 0.5);
        
        const hand = new THREE.Mesh(handGeometry, material);
        hand.name = `${side}_hand`;
        hand.position.set(x + flipFactor * (upperArmLength + forearmLength), y, z);
        hand.castShadow = true;
        parent.add(hand);
        
        return { upperArm, forearm, hand };
    }
    
    /**
     * Create medium detail body mesh
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     * @param {number} skinTone - Skin tone color
     * @returns {THREE.Group} Body mesh group
     */
    createMediumDetailBody(height, buildFactor, skinTone) {
        const bodyGroup = new THREE.Group();
        bodyGroup.name = 'body_medium';
        
        // Create a simplified torso using a cylinder
        const torsoRadius = 0.25 * buildFactor;
        const torsoHeight = height * 0.35;
        
        const torsoGeometry = new THREE.CylinderGeometry(
            torsoRadius, torsoRadius * 0.8, torsoHeight, 8
        );
        torsoGeometry.translate(0, torsoHeight/2, 0);
        
        const torsoMaterial = new THREE.MeshStandardMaterial({
            color: skinTone,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
        torso.name = 'torso';
        torso.castShadow = true;
        torso.receiveShadow = true;
        
        // Simplified arms as cylinders
        const leftArm = this.createSimpleArm(torsoMaterial, 'left', torsoRadius, torsoHeight/2, 0, height, buildFactor);
        const rightArm = this.createSimpleArm(torsoMaterial, 'right', -torsoRadius, torsoHeight/2, 0, height, buildFactor);
        
        bodyGroup.add(torso);
        bodyGroup.add(leftArm);
        bodyGroup.add(rightArm);
        
        return bodyGroup;
    }
    
    /**
     * Create a simplified arm for the medium detail body
     * @param {THREE.Material} material - Arm material
     * @param {string} side - 'left' or 'right'
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} z - Z position
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     */
    createSimpleArm(material, side, x, y, z, height, buildFactor) {
        const armGroup = new THREE.Group();
        armGroup.name = `${side}_arm`;
        
        const flipFactor = side === 'left' ? 1 : -1;
        const armLength = height * 0.3;
        const armRadius = 0.06 * buildFactor;
        
        // Create a bent arm as a single piece
        const armShape = new THREE.Shape();
        armShape.moveTo(0, 0);
        armShape.lineTo(0, armRadius);
        armShape.lineTo(armLength * 0.6, armRadius);
        armShape.lineTo(armLength, 0);
        armShape.lineTo(armLength, -armRadius);
        armShape.lineTo(armLength * 0.6, -armRadius);
        armShape.lineTo(0, -armRadius);
        armShape.lineTo(0, 0);
        
        const extrudeSettings = {
            steps: 1,
            depth: armRadius * 2,
            bevelEnabled: false
        };
        
        const armGeometry = new THREE.ExtrudeGeometry(armShape, extrudeSettings);
        armGeometry.translate(0, 0, -armRadius);
        
        if (side === 'right') {
            armGeometry.scale(-1, 1, 1);
        }
        
        const arm = new THREE.Mesh(armGeometry, material);
        arm.position.set(x, y, z);
        arm.castShadow = true;
        
        // Add a simple hand
        const handGeometry = new THREE.SphereGeometry(0.07, 6, 6);
        handGeometry.scale(1, 0.8, 0.5);
        
        const hand = new THREE.Mesh(handGeometry, material);
        hand.position.set(x + flipFactor * armLength, y, z);
        hand.castShadow = true;
        
        armGroup.add(arm);
        armGroup.add(hand);
        
        return armGroup;
    }
    
    /**
     * Create low detail body mesh
     * @param {number} height - Player height
     * @param {number} buildFactor - Body build factor
     * @param {number} skinTone - Skin tone color
     * @returns {THREE.Group} Body mesh group
     */
    createLowDetailBody(height, buildFactor, skinTone) {
        const bodyGroup = new THREE.Group();
        bodyGroup.name = 'body_low';
        
        // Create a very simplified torso using a single box
        const torsoWidth = 0.5 * buildFactor;
        const torsoDepth = 0.25 * buildFactor;
        const torsoHeight = height * 0.35;
        
        const torsoGeometry = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth);
        torsoGeometry.translate(0, torsoHeight/2, 0);
        
        const torsoMaterial = new THREE.MeshStandardMaterial({
            color: skinTone,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
        torso.name = 'torso';
        torso.castShadow = true;
        
        // Very basic arms as boxes
        const armWidth = 0.1 * buildFactor;
        const armHeight = height * 0.3;
        const armGeometry = new THREE.BoxGeometry(armWidth, armHeight, armWidth);
        
        // Left arm
        const leftArm = new THREE.Mesh(armGeometry.clone(), torsoMaterial);
        leftArm.position.set(torsoWidth/2 + armWidth/2, torsoHeight/2 - armHeight/2, 0);
        leftArm.name = 'left_arm';
        leftArm.castShadow = true;
        
        // Right arm
        const rightArm = new THREE.Mesh(armGeometry.clone(), torsoMaterial);
        rightArm.position.set(-torsoWidth/2 - armWidth/2, torsoHeight/2 - armHeight/2, 0);
        rightArm.name = 'right_arm';
        rightArm.castShadow = true;
        
        bodyGroup.add(torso);
        bodyGroup.add(leftArm);
        bodyGroup.add(rightArm);
        
        return bodyGroup;
    }
}

export default PlayerBodyGeometry;
