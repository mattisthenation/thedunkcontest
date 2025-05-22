// three-player.js - 3D player model and controller for basketball game
// Implements NBA Jam-style exaggerated player models with component system

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import ThreeJSManager from './three-core.js';
import PlayerGeometryManager from './player/PlayerGeometryManager.js';

// Constants for player configuration
const PLAYER_CONFIG = {
    // NBA Jam-style proportions
    HEAD_SCALE: 1.5,            // Exaggerated head size
    BODY_SCALE: 1.2,            // Slightly larger body
    HEIGHT_RANGE: [1.8, 2.1],   // Player height range in meters
    
    // Player component defaults
    DEFAULT_JERSEY_COLOR: 0x3366ff,
    DEFAULT_SKIN_TONE: 0xd2a789,
    
    // Physics settings
    MASS: 80,                   // Player mass in kg
    JUMP_FORCE: 15,             // Force applied when jumping
    MOVE_SPEED: 5,              // Movement speed units per second
    ACCELERATION: 10,           // How quickly player reaches max speed
    DECELERATION: 15,           // How quickly player stops moving
    
    // Player states
    STATES: {
        IDLE: 'idle',
        RUNNING: 'running',
        JUMPING: 'jumping',
        DUNKING: 'dunking',
        CELEBRATING: 'celebrating',
        DEFENDING: 'defending',
        DRIBBLING: 'dribbling'
    },
    
    // Attachment points for components
    ATTACHMENT_POINTS: {
        HEAD: 'head_attachment',
        HAIR: 'hair_attachment',
        LEFT_HAND: 'hand_l_attachment',
        RIGHT_HAND: 'hand_r_attachment',
        LEFT_FOOT: 'foot_l_attachment',
        RIGHT_FOOT: 'foot_r_attachment'
    },
    
    // Collision detection
    COLLIDER_RADIUS: 0.7,       // Player collision radius
    COLLIDER_HEIGHT: 2.0,       // Player collision height
};

// Note: The individual component classes (PlayerComponent, PlayerBody, PlayerHead, etc.) 
// have been replaced by the PlayerGeometryManager implementation from ./player/PlayerGeometryManager.js

/**
 * Player - Main class for basketball player
 */
class Player {
    constructor(id, options = {}) {
        this.id = id;
        this.name = options.name || `Player ${id}`;
        this.teamId = options.teamId || 0;
        
        // Core properties
        this.object = new THREE.Group(); // Main container for all player components
        this.object.name = `player_${id}`;
        this.components = {};
        
        // State management
        this.state = PLAYER_CONFIG.STATES.IDLE;
        this.previousState = null;
        
        // Movement and physics
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.direction = new THREE.Vector3(0, 0, 1);
        this.isOnGround = true;
        this.isJumping = false;
        this.jumpHeight = 0;
        this.maxJumpHeight = 2.5;
        
        // Basketball reference (if holding ball)
        this.hasBall = false;
        this.basketball = null;
        
        // Animation
        this.mixer = null;
        this.animations = {};
        this.currentAnimation = null;
        
        // Physics collider
        this.collider = {
            type: 'capsule',
            radius: PLAYER_CONFIG.COLLIDER_RADIUS,
            height: PLAYER_CONFIG.COLLIDER_HEIGHT
        };
        
        // Customization options
        this.options = Object.assign({
            skinTone: PLAYER_CONFIG.DEFAULT_SKIN_TONE,
            jerseyColor: PLAYER_CONFIG.DEFAULT_JERSEY_COLOR,
            shortsColor: PLAYER_CONFIG.DEFAULT_JERSEY_COLOR,
            jerseyNumber: Math.floor(Math.random() * 99) + 1,
            jerseyName: this.name.toUpperCase(),
            headScale: PLAYER_CONFIG.HEAD_SCALE,
            bodyScale: PLAYER_CONFIG.BODY_SCALE,
            height: PLAYER_CONFIG.HEIGHT_RANGE[0] + Math.random() * (PLAYER_CONFIG.HEIGHT_RANGE[1] - PLAYER_CONFIG.HEIGHT_RANGE[0])
        }, options);
        
        // Debug settings
        this.debug = {
            showColliders: false,
            showSkeleton: false,
            showVelocity: false
        };
        
        // Bind methods
        this.update = this.update.bind(this);
    }
    
    /**
     * Initialize the player
     */
    init() {
        // Create components
        this.initComponents();
        
        // Setup physics collider
        this.initCollider();
        
        // Setup animations
        this.initAnimations();
        
        // Add to scene
        ThreeJSManager.scene.add(this.object);
        
        // Add to game objects
        ThreeJSManager.gameObjects.players[this.id] = this;
        
        return this.object;
    }
    
    /**
     * Initialize player components
     */
    initComponents() {
        // Initialize the PlayerGeometryManager if needed
        if (!PlayerGeometryManager.initialized) {
            PlayerGeometryManager.init();
        }
        
        // Create complete player geometry with all components using the geometry manager
        const playerGeometry = PlayerGeometryManager.createPlayerGeometry({
            height: this.options.height,
            buildFactor: this.options.bodyScale / PLAYER_CONFIG.BODY_SCALE,
            headScale: this.options.headScale,
            skinTone: this.options.skinTone,
            jerseyColor: this.options.jerseyColor,
            shortsColor: this.options.shortsColor,
            jerseyNumber: this.options.jerseyNumber,
            jerseyName: this.options.jerseyName,
            useSkeleton: true,
            debugSkeleton: this.debug.showSkeleton
        });
        
        // Add the complete player geometry to our object
        this.object.add(playerGeometry);
        
        // Store reference to each component from the geometry manager's result
        // This will be used for easier access to components
        this.components.geometry = playerGeometry;
        
        // Find attachment points for basketball and other items
        this.setupAttachmentPoints();
    }
    
    /**
     * Setup attachment points for equipment and interactions
     */
    setupAttachmentPoints() {
        // We'll need to locate the attachment points from the skeleton or mesh
        // For now, let's create simple attachment points
        
        const rightHandAttachment = new THREE.Object3D();
        rightHandAttachment.name = PLAYER_CONFIG.ATTACHMENT_POINTS.RIGHT_HAND;
        rightHandAttachment.position.set(-0.3, this.options.height * 0.6, 0.2);
        this.object.add(rightHandAttachment);
        
        const leftHandAttachment = new THREE.Object3D();
        leftHandAttachment.name = PLAYER_CONFIG.ATTACHMENT_POINTS.LEFT_HAND;
        leftHandAttachment.position.set(0.3, this.options.height * 0.6, 0.2);
        this.object.add(leftHandAttachment);
    }
    
    /**
     * Initialize player collider for physics
     */
    initCollider() {
        // Create visual collider for debugging
        if (this.debug.showColliders) {
            const geometry = new THREE.CapsuleGeometry(
                this.collider.radius,
                this.collider.height,
                4,
                8
            );
            const material = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                wireframe: true,
                transparent: true,
                opacity: 0.5
            });
            
            this.colliderMesh = new THREE.Mesh(geometry, material);
            this.colliderMesh.position.y = this.collider.height / 2;
            this.object.add(this.colliderMesh);
        }
    }
    
    /**
     * Initialize animations
     */
    initAnimations() {
        // Will be implemented when we have proper models with animations
        // For now, we'll just create placeholder methods
        
        this.playAnimation(PLAYER_CONFIG.STATES.IDLE);
    }
    
    /**
     * Play an animation
     * @param {string} animationName - Name of animation to play
     * @param {Object} options - Animation options
     */
    playAnimation(animationName, options = {}) {
        // Placeholder for animation system
        this.state = animationName;
        
        // TODO: Implement actual animation playback when we have models
        console.log(`Player ${this.id} playing animation: ${animationName}`);
    }
    
    /**
     * Update player (called each frame)
     * @param {number} delta - Time since last frame
     */
    update(delta) {
        // Update physics
        this.updatePhysics(delta);
        
        // Update animations
        this.updateAnimations(delta);
        
        // Update basketball position if holding
        this.updateBasketball();
        
        // Update components
        Object.values(this.components).forEach(component => {
            if (component.update) {
                component.update(delta);
            }
        });
    }
    
    /**
     * Update player physics
     * @param {number} delta - Time since last frame
     */
    updatePhysics(delta) {
        // Apply acceleration
        this.velocity.add(this.acceleration.clone().multiplyScalar(delta));
        
        // Apply gravity if jumping
        if (!this.isOnGround) {
            this.velocity.y -= 9.8 * delta; // Simple gravity
        }
        
        // Apply velocity
        const movement = this.velocity.clone().multiplyScalar(delta);
        this.object.position.add(movement);
        
        // Update position helper
        this.position.copy(this.object.position);
        
        // Handle jumping
        if (this.isJumping) {
            if (this.jumpHeight >= this.maxJumpHeight) {
                this.velocity.y = 0; // Start falling
            }
            
            this.jumpHeight += movement.y;
        }
        
        // Check if landed
        if (!this.isOnGround && this.object.position.y <= 0) {
            this.land();
        }
        
        // Apply deceleration on ground
        if (this.isOnGround) {
            this.velocity.x *= 1 - (PLAYER_CONFIG.DECELERATION * delta);
            this.velocity.z *= 1 - (PLAYER_CONFIG.DECELERATION * delta);
            
            // Stop completely if very slow
            if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
            if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
        }
        
        // Reset acceleration for next frame
        this.acceleration.set(0, 0, 0);
        
        // Enforce floor level
        if (this.object.position.y < 0) {
            this.object.position.y = 0;
        }
        
        // Update player direction based on movement
        if (this.velocity.x !== 0 || this.velocity.z !== 0) {
            const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
            if (horizontalVelocity.length() > 0.1) {
                horizontalVelocity.normalize();
                this.direction.copy(horizontalVelocity);
                
                // Rotate player to face movement direction
                const angle = Math.atan2(this.direction.x, this.direction.z);
                this.object.rotation.y = angle;
            }
        }
    }
    
    /**
     * Update player animations
     * @param {number} delta - Time since last frame
     */
    updateAnimations(delta) {
        // Will be implemented when we have proper animation system
        if (this.mixer) {
            this.mixer.update(delta);
        }
        
        // Update animation state based on player state
        let newState = this.state;
        
        // Determine animation state from physics
        if (!this.isOnGround) {
            if (this.hasBall && this.velocity.y > 0) {
                newState = PLAYER_CONFIG.STATES.DUNKING;
            } else {
                newState = PLAYER_CONFIG.STATES.JUMPING;
            }
        } else if (this.velocity.x !== 0 || this.velocity.z !== 0) {
            if (this.hasBall) {
                newState = PLAYER_CONFIG.STATES.DRIBBLING;
            } else {
                newState = PLAYER_CONFIG.STATES.RUNNING;
            }
        } else {
            if (this.hasBall) {
                newState = PLAYER_CONFIG.STATES.IDLE;
            } else {
                newState = PLAYER_CONFIG.STATES.IDLE;
            }
        }
        
        // Play appropriate animation if state changed
        if (newState !== this.state) {
            this.playAnimation(newState);
        }
    }
    
    /**
     * Update basketball position if player is holding it
     */
    updateBasketball() {
        if (this.hasBall && this.basketball) {
            // Position ball in player's hand
            const handAttachment = this.object.getObjectByName(
                PLAYER_CONFIG.ATTACHMENT_POINTS.RIGHT_HAND
            );
            
            if (handAttachment) {
                // Get world position of hand
                const handWorldPos = new THREE.Vector3();
                handAttachment.getWorldPosition(handWorldPos);
                
                // Set basketball position
                this.basketball.object.position.copy(handWorldPos);
            }
        }
    }
    
    /**
     * Apply a movement force to the player
     * @param {THREE.Vector3} force - Direction and magnitude of force
     */
    applyForce(force) {
        this.acceleration.add(force);
    }
    
    /**
     * Move player in a direction
     * @param {THREE.Vector3} direction - Normalized direction vector
     * @param {number} speed - Speed multiplier
     */
    move(direction, speed = 1) {
        const moveSpeed = PLAYER_CONFIG.MOVE_SPEED * speed;
        const force = direction.clone().multiplyScalar(PLAYER_CONFIG.ACCELERATION);
        
        // Only apply horizontal movement
        force.y = 0;
        
        this.applyForce(force);
        
        // Cap maximum velocity
        if (this.velocity.length() > moveSpeed) {
            this.velocity.normalize().multiplyScalar(moveSpeed);
        }
    }
    
    /**
     * Make player jump
     */
    jump() {
        if (this.isOnGround) {
            this.isOnGround = false;
            this.isJumping = true;
            this.jumpHeight = 0;
            this.velocity.y = PLAYER_CONFIG.JUMP_FORCE;
            
            this.playAnimation(PLAYER_CONFIG.STATES.JUMPING);
        }
    }
    
    /**
     * Handle player landing
     */
    land() {
        this.isOnGround = true;
        this.isJumping = false;
        this.jumpHeight = 0;
        this.velocity.y = 0;
        
        // Play landing animation briefly
        this.playAnimation(PLAYER_CONFIG.STATES.IDLE);
    }
    
    /**
     * Make player grab the basketball
     * @param {Object} basketball - Basketball object
     */
    grabBasketball(basketball) {
        this.hasBall = true;
        this.basketball = basketball;
        
        // Update basketball state
        if (basketball) {
            basketball.setHolder(this);
        }
    }
    
    /**
     * Make player release the basketball
     * @param {THREE.Vector3} direction - Direction to throw the ball
     * @param {number} power - Power of throw
     */
    releaseBasketball(direction, power = 1) {
        if (this.hasBall && this.basketball) {
            // Update basketball state
            this.basketball.release(direction, power);
            
            // Update player state
            this.hasBall = false;
            this.basketball = null;
            
            // Play throwing animation
            this.playAnimation(PLAYER_CONFIG.STATES.IDLE);
        }
    }
    
    /**
     * Make player perform a dunk
     */
    dunk() {
        if (this.hasBall) {
            this.jump();
            this.playAnimation(PLAYER_CONFIG.STATES.DUNKING);
            
            // This is a placeholder - full dunking logic will be implemented later
        }
    }
    
    /**
     * Make player celebrate
     */
    celebrate() {
        this.playAnimation(PLAYER_CONFIG.STATES.CELEBRATING);
    }
    
    /**
     * Set player team
     * @param {number} teamId - Team ID
     * @param {Object} teamColors - Team colors
     */
    setTeam(teamId, teamColors) {
        this.teamId = teamId;
        
        // Update jersey and shorts colors
        if (teamColors) {
            this.options.jerseyColor = teamColors.primary || this.options.jerseyColor;
            this.options.shortsColor = teamColors.secondary || this.options.shortsColor;
            
            // Update component colors - find the jersey and shorts meshes in the player geometry
            if (this.components.geometry) {
                // Find and update jersey material
                const jerseyMesh = this.components.geometry.getObjectByName('player_jersey');
                if (jerseyMesh && jerseyMesh.material) {
                    if (Array.isArray(jerseyMesh.material)) {
                        jerseyMesh.material.forEach(mat => {
                            if (mat.color) mat.color.setHex(this.options.jerseyColor);
                        });
                    } else {
                        jerseyMesh.material.color.setHex(this.options.jerseyColor);
                    }
                }
                
                // Find and update shorts material
                const shortsMesh = this.components.geometry.getObjectByName('player_shorts');
                if (shortsMesh && shortsMesh.material) {
                    if (Array.isArray(shortsMesh.material)) {
                        shortsMesh.material.forEach(mat => {
                            if (mat.color) mat.color.setHex(this.options.shortsColor);
                        });
                    } else {
                        shortsMesh.material.color.setHex(this.options.shortsColor);
                    }
                }
            }
        }
    }
    
    /**
     * Position player on court
     * @param {THREE.Vector3} position - Position on court
     */
    setPosition(position) {
        this.object.position.copy(position);
        this.position.copy(position);
    }
    
    /**
     * Clean up player resources
     */
    dispose() {
        // Dispose of component resources
        if (this.components.geometry) {
            // Traverse all child geometries and materials and dispose them
            this.components.geometry.traverse(node => {
                if (node.geometry) {
                    node.geometry.dispose();
                }
                
                if (node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(material => material.dispose());
                    } else {
                        node.material.dispose();
                    }
                }
            });
        }
        
        // Dispose of any traditional components
        Object.values(this.components).forEach(component => {
            if (component !== this.components.geometry && component.dispose) {
                component.dispose();
            }
        });
        
        // Remove from scene and manager
        if (this.object.parent) {
            this.object.parent.remove(this.object);
        }
        
        delete ThreeJSManager.gameObjects.players[this.id];
    }
}

// Export Player class
export default Player;
