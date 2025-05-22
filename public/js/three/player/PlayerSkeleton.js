// PlayerSkeleton.js - Defines the player skeleton structure for animation and IK
// Provides a bone structure that all player components can use

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/**
 * Simple function to clone a skeleton - fallback if SkeletonUtils.clone is not available
 * @param {THREE.Object3D} source - The source object to clone
 * @returns {THREE.Object3D} Cloned object
 */
function cloneSkeleton(source) {
    const clone = source.clone();
    
    // Clone all children recursively
    source.children.forEach((child, i) => {
        clone.children[i] = cloneSkeleton(child);
        clone.children[i].parent = clone;
    });
    
    return clone;
}

/**
 * PlayerSkeleton - Creates and manages player skeletons
 */
class PlayerSkeleton {
    constructor() {
        // Template skeleton that will be cloned for each player
        this.skeletonTemplate = null;
        
        // Bind methods
        this.createSkeletonTemplate = this.createSkeletonTemplate.bind(this);
        this.createPlayerSkeleton = this.createPlayerSkeleton.bind(this);
        this.createSkeletonHelper = this.createSkeletonHelper.bind(this);
    }
    
    /**
     * Initialize the skeleton system
     */
    init() {
        // Create the template skeleton that will be cloned for each player
        this.createSkeletonTemplate();
        
        console.log('PlayerSkeleton initialized');
        return this;
    }
    
    /**
     * Create a template skeleton for players
     * This will be cloned for each player
     */
    createSkeletonTemplate() {
        // Create bones
        const bones = [];
        
        // Root bone at bottom of player
        const rootBone = new THREE.Bone();
        rootBone.name = 'root';
        rootBone.position.set(0, 0, 0);
        bones.push(rootBone);
        
        // Spine bone
        const spineBone = new THREE.Bone();
        spineBone.name = 'spine';
        spineBone.position.set(0, 0.5, 0);
        rootBone.add(spineBone);
        bones.push(spineBone);
        
        // Chest bone
        const chestBone = new THREE.Bone();
        chestBone.name = 'chest';
        chestBone.position.set(0, 0.5, 0);
        spineBone.add(chestBone);
        bones.push(chestBone);
        
        // Neck bone
        const neckBone = new THREE.Bone();
        neckBone.name = 'neck';
        neckBone.position.set(0, 0.3, 0);
        chestBone.add(neckBone);
        bones.push(neckBone);
        
        // Head bone
        const headBone = new THREE.Bone();
        headBone.name = 'head';
        headBone.position.set(0, 0.2, 0);
        neckBone.add(headBone);
        bones.push(headBone);
        
        // Left shoulder
        const leftShoulderBone = new THREE.Bone();
        leftShoulderBone.name = 'left_shoulder';
        leftShoulderBone.position.set(0.25, 0.2, 0);
        chestBone.add(leftShoulderBone);
        bones.push(leftShoulderBone);
        
        // Left upper arm
        const leftUpperArmBone = new THREE.Bone();
        leftUpperArmBone.name = 'left_upper_arm';
        leftUpperArmBone.position.set(0.1, 0, 0);
        leftShoulderBone.add(leftUpperArmBone);
        bones.push(leftUpperArmBone);
        
        // Left forearm
        const leftForearmBone = new THREE.Bone();
        leftForearmBone.name = 'left_forearm';
        leftForearmBone.position.set(0.25, 0, 0);
        leftUpperArmBone.add(leftForearmBone);
        bones.push(leftForearmBone);
        
        // Left hand
        const leftHandBone = new THREE.Bone();
        leftHandBone.name = 'left_hand';
        leftHandBone.position.set(0.25, 0, 0);
        leftForearmBone.add(leftHandBone);
        bones.push(leftHandBone);
        
        // Right shoulder
        const rightShoulderBone = new THREE.Bone();
        rightShoulderBone.name = 'right_shoulder';
        rightShoulderBone.position.set(-0.25, 0.2, 0);
        chestBone.add(rightShoulderBone);
        bones.push(rightShoulderBone);
        
        // Right upper arm
        const rightUpperArmBone = new THREE.Bone();
        rightUpperArmBone.name = 'right_upper_arm';
        rightUpperArmBone.position.set(-0.1, 0, 0);
        rightShoulderBone.add(rightUpperArmBone);
        bones.push(rightUpperArmBone);
        
        // Right forearm
        const rightForearmBone = new THREE.Bone();
        rightForearmBone.name = 'right_forearm';
        rightForearmBone.position.set(-0.25, 0, 0);
        rightUpperArmBone.add(rightForearmBone);
        bones.push(rightForearmBone);
        
        // Right hand
        const rightHandBone = new THREE.Bone();
        rightHandBone.name = 'right_hand';
        rightHandBone.position.set(-0.25, 0, 0);
        rightForearmBone.add(rightHandBone);
        bones.push(rightHandBone);
        
        // Left hip
        const leftHipBone = new THREE.Bone();
        leftHipBone.name = 'left_hip';
        leftHipBone.position.set(0.1, -0.1, 0);
        rootBone.add(leftHipBone);
        bones.push(leftHipBone);
        
        // Left thigh
        const leftThighBone = new THREE.Bone();
        leftThighBone.name = 'left_thigh';
        leftThighBone.position.set(0, -0.2, 0);
        leftHipBone.add(leftThighBone);
        bones.push(leftThighBone);
        
        // Left calf
        const leftCalfBone = new THREE.Bone();
        leftCalfBone.name = 'left_calf';
        leftCalfBone.position.set(0, -0.4, 0);
        leftThighBone.add(leftCalfBone);
        bones.push(leftCalfBone);
        
        // Left foot
        const leftFootBone = new THREE.Bone();
        leftFootBone.name = 'left_foot';
        leftFootBone.position.set(0, -0.4, 0.1);
        leftCalfBone.add(leftFootBone);
        bones.push(leftFootBone);
        
        // Right hip
        const rightHipBone = new THREE.Bone();
        rightHipBone.name = 'right_hip';
        rightHipBone.position.set(-0.1, -0.1, 0);
        rootBone.add(rightHipBone);
        bones.push(rightHipBone);
        
        // Right thigh
        const rightThighBone = new THREE.Bone();
        rightThighBone.name = 'right_thigh';
        rightThighBone.position.set(0, -0.2, 0);
        rightHipBone.add(rightThighBone);
        bones.push(rightThighBone);
        
        // Right calf
        const rightCalfBone = new THREE.Bone();
        rightCalfBone.name = 'right_calf';
        rightCalfBone.position.set(0, -0.4, 0);
        rightThighBone.add(rightCalfBone);
        bones.push(rightCalfBone);
        
        // Right foot
        const rightFootBone = new THREE.Bone();
        rightFootBone.name = 'right_foot';
        rightFootBone.position.set(0, -0.4, 0.1);
        rightCalfBone.add(rightFootBone);
        bones.push(rightFootBone);
        
        // Create skeleton object
        this.skeletonTemplate = new THREE.Skeleton(bones);
        
        return this.skeletonTemplate;
    }
    
    /**
     * Create a clone of the template skeleton for a player
     * @returns {THREE.Skeleton} Cloned skeleton
     */
    createPlayerSkeleton() {
        if (!this.skeletonTemplate) {
            this.createSkeletonTemplate();
        }
        
        // Clone the skeleton using SkeletonUtils
        // We use SkeletonUtils.clone method directly if available
        const skeletonRoot = SkeletonUtils.clone ? 
            SkeletonUtils.clone(this.skeletonTemplate.bones[0]) : 
            cloneSkeleton(this.skeletonTemplate.bones[0]);
        const bones = [];
        
        // Collect all bones from the cloned hierarchy
        skeletonRoot.traverse((object) => {
            if (object.isBone) {
                bones.push(object);
            }
        });
        
        return new THREE.Skeleton(bones);
    }
    
    /**
     * Create a helper to visualize the skeleton
     * @param {THREE.Skeleton} skeleton - The skeleton to visualize
     * @returns {THREE.SkeletonHelper} Skeleton helper
     */
    createSkeletonHelper(skeleton) {
        return new THREE.SkeletonHelper(skeleton.bones[0]);
    }
    
    /**
     * Find a bone by name in a skeleton
     * @param {THREE.Skeleton} skeleton - The skeleton to search
     * @param {string} boneName - Name of the bone to find
     * @returns {THREE.Bone|null} The bone if found, null otherwise
     */
    getBoneByName(skeleton, boneName) {
        if (!skeleton || !skeleton.bones) return null;
        
        return skeleton.bones.find(bone => bone.name === boneName) || null;
    }
}

export default PlayerSkeleton;
