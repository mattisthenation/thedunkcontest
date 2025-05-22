// PlayerHeadGeometry.js - Creates and manages head geometry with LOD

import * as THREE from 'three';

/**
 * PlayerHeadGeometry - Creates head meshes with multiple detail levels
 */
class PlayerHeadGeometry {
    constructor() {
        // Cache for performance
        this.geometryCache = {};
        
        // Bind methods
        this.createHeadGeometry = this.createHeadGeometry.bind(this);
        this.createHighDetailHead = this.createHighDetailHead.bind(this);
        this.createMediumDetailHead = this.createMediumDetailHead.bind(this);
        this.createLowDetailHead = this.createLowDetailHead.bind(this);
    }
    
    /**
     * Initialize the head geometry system
     */
    init() {
        console.log('PlayerHeadGeometry initialized');
        return this;
    }
    
    /**
     * Create head geometry with multiple LOD levels
     * @param {Object} options - Configuration options
     * @returns {THREE.LOD} LOD object containing head meshes
     */
    createHeadGeometry(options = {}) {
        const headLOD = new THREE.LOD();
        
        // Options
        const scale = options.scale || 1.5; // NBA Jam-style exaggerated head
        const skinTone = options.skinTone || 0xd2a789;
        
        // HIGH DETAIL - for close-up views
        const highDetailHead = this.createHighDetailHead(scale, skinTone);
        headLOD.addLevel(highDetailHead, 0);
        
        // MEDIUM DETAIL - for normal gameplay
        const mediumDetailHead = this.createMediumDetailHead(scale, skinTone);
        headLOD.addLevel(mediumDetailHead, 8);
        
        // LOW DETAIL - for distant players
        const lowDetailHead = this.createLowDetailHead(scale, skinTone);
        headLOD.addLevel(lowDetailHead, 25);
        
        return headLOD;
    }
    
    /**
     * Create high detail head mesh
     * @param {number} scale - Head scale factor
     * @param {number} skinTone - Skin tone color
     * @returns {THREE.Group} Head mesh group
     */
    createHighDetailHead(scale, skinTone) {
        const headGroup = new THREE.Group();
        headGroup.name = 'head_high';
        
        // Create base head using subdivided icosahedron for smoother appearance
        const headGeometry = new THREE.IcosahedronGeometry(0.4, 2);
        
        // Slightly elongate the head
        headGeometry.scale(1, 1.1, 0.9);
        
        const headMaterial = new THREE.MeshStandardMaterial({
            color: skinTone,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.name = 'head_base';
        head.castShadow = true;
        
        // Create detailed face features
        this.createDetailedFace(head, skinTone);
        
        // Add ears
        this.createEars(head, skinTone);
        
        // Create hair attachment point
        const hairAttachment = new THREE.Object3D();
        hairAttachment.name = 'hair_attachment';
        hairAttachment.position.set(0, 0.3, 0);
        head.add(hairAttachment);
        
        // Add to group
        headGroup.add(head);
        
        // Scale the head for NBA Jam style
        head.scale.set(scale, scale, scale);
        
        return headGroup;
    }
    
    /**
     * Create detailed face features
     * @param {THREE.Mesh} head - Head mesh
     * @param {number} skinTone - Skin tone color
     */
    createDetailedFace(head, skinTone) {
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.08, 12, 12);
        const eyeWhiteMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0
        });
        
        // Eye whites
        const leftEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
        leftEyeWhite.position.set(0.15, 0.05, 0.35);
        leftEyeWhite.scale.set(0.7, 1, 0.5);
        head.add(leftEyeWhite);
        
        const rightEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
        rightEyeWhite.position.set(-0.15, 0.05, 0.35);
        rightEyeWhite.scale.set(0.7, 1, 0.5);
        head.add(rightEyeWhite);
        
        // Pupils
        const pupilGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        const pupilMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.1,
            metalness: 0
        });
        
        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(0.15, 0.05, 0.39);
        head.add(leftPupil);
        
        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(-0.15, 0.05, 0.39);
        head.add(rightPupil);
        
        // Eyebrows
        const eyebrowGeometry = new THREE.BoxGeometry(0.15, 0.03, 0.05);
        eyebrowGeometry.translate(0, 0, 0.02);
        
        const eyebrowMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.8,
            metalness: 0
        });
        
        const leftEyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial);
        leftEyebrow.position.set(0.15, 0.15, 0.35);
        leftEyebrow.rotation.set(0.2, 0, -0.1);
        head.add(leftEyebrow);
        
        const rightEyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial);
        rightEyebrow.position.set(-0.15, 0.15, 0.35);
        rightEyebrow.rotation.set(0.2, 0, 0.1);
        head.add(rightEyebrow);
        
        // Nose
        const noseGeometry = new THREE.ConeGeometry(0.06, 0.15, 4);
        noseGeometry.rotateX(-Math.PI/2);
        
        const noseMaterial = new THREE.MeshStandardMaterial({
            color: skinTone,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const nose = new THREE.Mesh(noseGeometry, noseMaterial);
        nose.position.set(0, 0, 0.4);
        head.add(nose);
        
        // Mouth (simple curve)
        const mouthGeometry = new THREE.TorusGeometry(0.1, 0.02, 8, 8, Math.PI);
        const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, -0.1, 0.35);
        mouth.rotation.set(Math.PI/2, 0, 0);
        head.add(mouth);
    }
    
    /**
     * Create ears for the head
     * @param {THREE.Mesh} head - Head mesh
     * @param {number} skinTone - Skin tone color
     */
    createEars(head, skinTone) {
        const earGeometry = new THREE.BoxGeometry(0.05, 0.15, 0.05);
        
        const earMaterial = new THREE.MeshStandardMaterial({
            color: skinTone,
            roughness: 0.7,
            metalness: 0.1
        });
        
        // Left ear
        const leftEar = new THREE.Mesh(earGeometry, earMaterial);
        leftEar.position.set(0.4, 0, 0);
        leftEar.rotation.set(0, 0, 0);
        head.add(leftEar);
        
        // Right ear
        const rightEar = new THREE.Mesh(earGeometry, earMaterial);
        rightEar.position.set(-0.4, 0, 0);
        rightEar.rotation.set(0, 0, 0);
        head.add(rightEar);
    }
    
    /**
     * Create medium detail head mesh
     * @param {number} scale - Head scale factor
     * @param {number} skinTone - Skin tone color
     * @returns {THREE.Group} Head mesh group
     */
    createMediumDetailHead(scale, skinTone) {
        const headGroup = new THREE.Group();
        headGroup.name = 'head_medium';
        
        // Create a simplified head using a lower poly sphere
        const headGeometry = new THREE.SphereGeometry(0.4, 12, 8);
        
        // Slightly elongate the head
        headGeometry.scale(1, 1.1, 0.9);
        
        const headMaterial = new THREE.MeshStandardMaterial({
            color: skinTone,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.name = 'head_base';
        head.castShadow = true;
        
        // Add simplified face features
        this.createSimpleFace(head, skinTone);
        
        // Create hair attachment point
        const hairAttachment = new THREE.Object3D();
        hairAttachment.name = 'hair_attachment';
        hairAttachment.position.set(0, 0.3, 0);
        head.add(hairAttachment);
        
        // Add to group
        headGroup.add(head);
        
        // Scale the head for NBA Jam style
        head.scale.set(scale, scale, scale);
        
        return headGroup;
    }
    
    /**
     * Create simplified face features for medium detail
     * @param {THREE.Mesh} head - Head mesh
     * @param {number} skinTone - Skin tone color
     */
    createSimpleFace(head, skinTone) {
        // Eyes (simplified)
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(0.15, 0.05, 0.35);
        leftEye.scale.set(0.5, 0.7, 0.3);
        head.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(-0.15, 0.05, 0.35);
        rightEye.scale.set(0.5, 0.7, 0.3);
        head.add(rightEye);
        
        // Mouth (simple line)
        const mouthGeometry = new THREE.BoxGeometry(0.2, 0.03, 0.05);
        const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, -0.15, 0.35);
        head.add(mouth);
    }
    
    /**
     * Create low detail head mesh
     * @param {number} scale - Head scale factor
     * @param {number} skinTone - Skin tone color
     * @returns {THREE.Group} Head mesh group
     */
    createLowDetailHead(scale, skinTone) {
        const headGroup = new THREE.Group();
        headGroup.name = 'head_low';
        
        // Create a very simplified head using a low poly sphere
        const headGeometry = new THREE.SphereGeometry(0.4, 8, 6);
        
        // Slightly elongate the head
        headGeometry.scale(1, 1.1, 0.9);
        
        const headMaterial = new THREE.MeshStandardMaterial({
            color: skinTone,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.name = 'head_base';
        head.castShadow = true;
        
        // Very minimal face - just a texture or a single feature
        const faceGeometry = new THREE.PlaneGeometry(0.4, 0.4);
        const faceMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.7
        });
        
        const face = new THREE.Mesh(faceGeometry, faceMaterial);
        face.position.set(0, 0, 0.38);
        head.add(face);
        
        // Add to group
        headGroup.add(head);
        
        // Scale the head for NBA Jam style
        head.scale.set(scale, scale, scale);
        
        return headGroup;
    }
}

export default PlayerHeadGeometry;
