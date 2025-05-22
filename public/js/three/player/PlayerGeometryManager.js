// PlayerGeometryManager.js - Main class for managing player geometry components
// Coordinates creation of player meshes, LOD, and skeleton

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import PlayerSkeleton from './PlayerSkeleton.js';
import PlayerBodyGeometry from './PlayerBodyGeometry.js';
import PlayerHeadGeometry from './PlayerHeadGeometry.js';
import PlayerJerseyGeometry from './PlayerJerseyGeometry.js';
import PlayerShortsGeometry from './PlayerShortsGeometry.js';
import PlayerShoesGeometry from './PlayerShoesGeometry.js';

/**
 * PlayerGeometryManager - Central manager for player geometry components
 * Responsible for coordinating all player geometry creation
 */
class PlayerGeometryManager {
    constructor() {
        // Initialize component managers
        this.skeleton = new PlayerSkeleton();
        this.bodyGeometry = new PlayerBodyGeometry();
        this.headGeometry = new PlayerHeadGeometry();
        this.jerseyGeometry = new PlayerJerseyGeometry();
        this.shortsGeometry = new PlayerShortsGeometry();
        this.shoesGeometry = new PlayerShoesGeometry();
        
        // Cache for performance
        this.geometryCache = {};
        this.textureCache = {};
        this.materialCache = {};
        
        // Initialization state
        this.initialized = false;
        
        // LOD level constants
        this.LOD_LEVELS = {
            HIGH: 0,   // High detail for close-up views
            MEDIUM: 1, // Medium detail for normal gameplay
            LOW: 2     // Low detail for distant players
        };
        
        // Bind methods
        this.createPlayerGeometry = this.createPlayerGeometry.bind(this);
    }
    
    /**
     * Initialize all geometry components
     */
    init() {
        // Initialize all component managers
        this.skeleton.init();
        this.bodyGeometry.init();
        this.headGeometry.init();
        this.jerseyGeometry.init();
        this.shortsGeometry.init();
        this.shoesGeometry.init();
        
        // Set initialized flag
        this.initialized = true;
        
        console.log('PlayerGeometryManager initialized');
        return this;
    }
    
    /**
     * Create complete player geometry with all components
     * @param {Object} options - Configuration options
     * @returns {THREE.Group} Complete player mesh
     */
    createPlayerGeometry(options = {}) {
        // Create master container for player
        const playerGroup = new THREE.Group();
        playerGroup.name = 'player_geometry';
        
        // Apply default options
        const playerOptions = Object.assign({
            height: 1.9,
            buildFactor: 1.0,
            headScale: 1.5,
            skinTone: 0xd2a789,
            jerseyColor: 0x3366ff,
            shortsColor: 0x3366ff,
            shoeColor: 0x222222,
            jerseyNumber: Math.floor(Math.random() * 99) + 1,
            jerseyName: 'PLAYER',
            useSkeleton: true,
            debugSkeleton: false
        }, options);
        
        // Create skeleton (optional)
        let skeleton = null;
        if (playerOptions.useSkeleton) {
            skeleton = this.skeleton.createPlayerSkeleton();
            
            // Add skeleton helper for debugging
            if (playerOptions.debugSkeleton) {
                const skeletonHelper = this.skeleton.createSkeletonHelper(skeleton);
                skeletonHelper.visible = true;
                playerGroup.add(skeletonHelper);
            }
        }
        
        // Create body with LOD
        const bodyGroup = this.bodyGeometry.createBodyGeometry({
            height: playerOptions.height,
            buildFactor: playerOptions.buildFactor,
            skinTone: playerOptions.skinTone,
            skeleton: skeleton
        });
        playerGroup.add(bodyGroup);
        
        // Create head with LOD
        const headGroup = this.headGeometry.createHeadGeometry({
            scale: playerOptions.headScale,
            skinTone: playerOptions.skinTone,
            skeleton: skeleton
        });
        
        // Attach head at the correct position
        headGroup.position.set(0, playerOptions.height * 0.8, 0);
        playerGroup.add(headGroup);
        
        // Create jersey with LOD
        const jerseyGroup = this.jerseyGeometry.createJerseyGeometry({
            height: playerOptions.height,
            buildFactor: playerOptions.buildFactor,
            color: playerOptions.jerseyColor,
            jerseyNumber: playerOptions.jerseyNumber,
            jerseyName: playerOptions.jerseyName,
            skeleton: skeleton
        });
        playerGroup.add(jerseyGroup);
        
        // Create shorts with LOD
        const shortsGroup = this.shortsGeometry.createShortsGeometry({
            height: playerOptions.height,
            buildFactor: playerOptions.buildFactor,
            color: playerOptions.shortsColor,
            skeleton: skeleton
        });
        playerGroup.add(shortsGroup);
        
        // Create shoes with LOD
        const leftShoeGroup = this.shoesGeometry.createShoeGeometry({
            side: 'left',
            color: playerOptions.shoeColor,
            skeleton: skeleton
        });
        leftShoeGroup.position.set(0.1, 0, 0);
        playerGroup.add(leftShoeGroup);
        
        const rightShoeGroup = this.shoesGeometry.createShoeGeometry({
            side: 'right',
            color: playerOptions.shoeColor,
            skeleton: skeleton
        });
        rightShoeGroup.position.set(-0.1, 0, 0);
        playerGroup.add(rightShoeGroup);
        
        return playerGroup;
    }
    
    /**
     * Get a cached material or create a new one
     * @param {string} key - Cache key
     * @param {Object} options - Material options
     * @returns {THREE.Material} Material
     */
    getMaterial(key, options) {
        if (this.materialCache[key]) {
            return this.materialCache[key];
        }
        
        // Create a new material based on options
        let material;
        
        if (options.type === 'standard') {
            material = new THREE.MeshStandardMaterial({
                color: options.color || 0xffffff,
                roughness: options.roughness !== undefined ? options.roughness : 0.7,
                metalness: options.metalness !== undefined ? options.metalness : 0.1,
                map: options.map || null,
                normalMap: options.normalMap || null,
                aoMap: options.aoMap || null,
                transparent: options.transparent || false,
                opacity: options.opacity !== undefined ? options.opacity : 1.0
            });
        } else if (options.type === 'phong') {
            material = new THREE.MeshPhongMaterial({
                color: options.color || 0xffffff,
                specular: options.specular || 0x111111,
                shininess: options.shininess || 30,
                map: options.map || null,
                normalMap: options.normalMap || null,
                transparent: options.transparent || false,
                opacity: options.opacity !== undefined ? options.opacity : 1.0
            });
        } else if (options.type === 'basic') {
            material = new THREE.MeshBasicMaterial({
                color: options.color || 0xffffff,
                map: options.map || null,
                transparent: options.transparent || false,
                opacity: options.opacity !== undefined ? options.opacity : 1.0,
                wireframe: options.wireframe || false
            });
        }
        
        // Cache the material
        if (material) {
            this.materialCache[key] = material;
        }
        
        return material;
    }
    
    /**
     * Clean up and dispose of all resources
     */
    dispose() {
        // Dispose of all cached materials
        Object.values(this.materialCache).forEach(material => {
            if (material.map) material.map.dispose();
            if (material.normalMap) material.normalMap.dispose();
            if (material.aoMap) material.aoMap.dispose();
            material.dispose();
        });
        
        // Dispose of all cached textures
        Object.values(this.textureCache).forEach(texture => {
            texture.dispose();
        });
        
        // Dispose of all cached geometries
        Object.values(this.geometryCache).forEach(geometry => {
            geometry.dispose();
        });
        
        // Clear caches
        this.materialCache = {};
        this.textureCache = {};
        this.geometryCache = {};
        
        console.log('PlayerGeometryManager disposed');
    }
}

// Export singleton instance
export default new PlayerGeometryManager();
