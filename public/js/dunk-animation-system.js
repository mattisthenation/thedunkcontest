// dunk-animation-system.js - Handles multiple dunk animation types

class DunkAnimationSystem {
    constructor() {
        // Define dunk animation sequences
        this.dunkAnimations = {
            basic: {
                name: 'Basic Slam',
                frames: [
                    { duration: 0.1, position: { y: 0 }, rotation: 0, ballOffset: { x: 0.5, y: 1.5, z: 0.3 } },
                    { duration: 0.15, position: { y: 1 }, rotation: 0, ballOffset: { x: 0.3, y: 2, z: 0.5 } },
                    { duration: 0.2, position: { y: 2.5 }, rotation: 0, ballOffset: { x: 0, y: 2.8, z: 0.8 } },
                    { duration: 0.15, position: { y: 2.8 }, rotation: 0, ballOffset: { x: 0, y: 2.5, z: 1 }, slam: true },
                    { duration: 0.1, position: { y: 1.5 }, rotation: 0, ballOffset: null },
                    { duration: 0.1, position: { y: 0 }, rotation: 0, ballOffset: null }
                ]
            },
            360: {
                name: '360 Spin',
                frames: [
                    { duration: 0.1, position: { y: 0 }, rotation: 0, ballOffset: { x: 0.5, y: 1.5, z: 0.3 } },
                    { duration: 0.1, position: { y: 1 }, rotation: Math.PI * 0.25, ballOffset: { x: 0.5, y: 2, z: 0.3 } },
                    { duration: 0.1, position: { y: 2 }, rotation: Math.PI * 0.5, ballOffset: { x: 0.5, y: 2.5, z: 0.3 } },
                    { duration: 0.1, position: { y: 2.5 }, rotation: Math.PI * 0.75, ballOffset: { x: 0.3, y: 2.8, z: 0.5 } },
                    { duration: 0.1, position: { y: 2.8 }, rotation: Math.PI, ballOffset: { x: 0, y: 2.8, z: 0.8 } },
                    { duration: 0.1, position: { y: 2.8 }, rotation: Math.PI * 1.5, ballOffset: { x: 0, y: 2.5, z: 1 } },
                    { duration: 0.1, position: { y: 2.5 }, rotation: Math.PI * 2, ballOffset: { x: 0, y: 2.5, z: 1 }, slam: true },
                    { duration: 0.1, position: { y: 1 }, rotation: Math.PI * 2, ballOffset: null },
                    { duration: 0.1, position: { y: 0 }, rotation: Math.PI * 2, ballOffset: null }
                ]
            },
            windmill: {
                name: 'Windmill',
                frames: [
                    { duration: 0.1, position: { y: 0 }, rotation: 0, ballOffset: { x: 0.5, y: 1.5, z: 0.3 }, armRotation: 0 },
                    { duration: 0.15, position: { y: 1.5 }, rotation: 0, ballOffset: { x: 1, y: 1.5, z: 0.3 }, armRotation: Math.PI * 0.25 },
                    { duration: 0.15, position: { y: 2.5 }, rotation: 0, ballOffset: { x: 0.8, y: 0.5, z: 0.3 }, armRotation: Math.PI * 0.75 },
                    { duration: 0.15, position: { y: 2.8 }, rotation: 0, ballOffset: { x: -0.5, y: 1.5, z: 0.5 }, armRotation: Math.PI * 1.25 },
                    { duration: 0.15, position: { y: 2.8 }, rotation: 0, ballOffset: { x: 0, y: 2.5, z: 1 }, armRotation: Math.PI * 2, slam: true },
                    { duration: 0.1, position: { y: 1 }, rotation: 0, ballOffset: null },
                    { duration: 0.1, position: { y: 0 }, rotation: 0, ballOffset: null }
                ]
            },
            reverse: {
                name: 'Reverse Jam',
                frames: [
                    { duration: 0.1, position: { y: 0 }, rotation: 0, ballOffset: { x: 0.5, y: 1.5, z: 0.3 } },
                    { duration: 0.15, position: { y: 1.5 }, rotation: 0, ballOffset: { x: 0.3, y: 2, z: 0.3 } },
                    { duration: 0.15, position: { y: 2.5 }, rotation: Math.PI, ballOffset: { x: -0.3, y: 2.5, z: -0.3 } },
                    { duration: 0.15, position: { y: 2.8 }, rotation: Math.PI, ballOffset: { x: 0, y: 2.5, z: -1 }, slam: true },
                    { duration: 0.1, position: { y: 1 }, rotation: Math.PI, ballOffset: null },
                    { duration: 0.1, position: { y: 0 }, rotation: Math.PI * 2, ballOffset: null }
                ]
            },
            helicopter: {
                name: 'Helicopter',
                frames: [
                    { duration: 0.1, position: { y: 0 }, rotation: 0, ballOffset: { x: 1, y: 1.5, z: 0 } },
                    { duration: 0.1, position: { y: 1 }, rotation: Math.PI * 0.5, ballOffset: { x: 0, y: 2, z: 1 } },
                    { duration: 0.1, position: { y: 2 }, rotation: Math.PI, ballOffset: { x: -1, y: 2.5, z: 0 } },
                    { duration: 0.1, position: { y: 2.5 }, rotation: Math.PI * 1.5, ballOffset: { x: 0, y: 2.8, z: -1 } },
                    { duration: 0.1, position: { y: 2.8 }, rotation: Math.PI * 2, ballOffset: { x: 1, y: 2.8, z: 0 } },
                    { duration: 0.1, position: { y: 2.8 }, rotation: Math.PI * 2.5, ballOffset: { x: 0, y: 2.8, z: 1 } },
                    { duration: 0.1, position: { y: 2.5 }, rotation: Math.PI * 3, ballOffset: { x: 0, y: 2.5, z: 1 }, slam: true },
                    { duration: 0.1, position: { y: 1 }, rotation: Math.PI * 3, ballOffset: null },
                    { duration: 0.1, position: { y: 0 }, rotation: Math.PI * 4, ballOffset: null }
                ]
            }
        };
        
        this.activeDunks = new Map(); // Track active dunk animations
    }
    
    // Start a dunk animation for a player
    startDunk(player, dunkType, targetHoop) {
        // Check if already dunking
        if (this.activeDunks.has(player.id)) {
            console.log('Player already dunking, ignoring new dunk request');
            return;
        }
        
        const animation = this.dunkAnimations[dunkType];
        if (!animation) {
            console.error('Invalid dunk type:', dunkType);
            return;
        }
        
        // Handle both Vector3 and plain objects for position
        let startPosition;
        if (player.position.clone) {
            startPosition = player.position.clone();
        } else {
            startPosition = new THREE.Vector3(
                player.position.x,
                player.position.y,
                player.position.z
            );
        }
        
        const dunkState = {
            player: player,
            animation: animation,
            currentFrame: 0,
            frameTime: 0,
            startPosition: startPosition,
            targetHoop: targetHoop,
            completed: false
        };
        
        this.activeDunks.set(player.id, dunkState);
        
        // Set player animation to the specific dunk type
        player.sprite.setAnimation(`dunk_${dunkType}`);
        
        console.log(`Starting ${animation.name} dunk for ${player.name || 'Player'}!`);
        console.log('Dunk state created:', dunkState);
    }
    
    // Update all active dunk animations
    update(deltaTime, ballHandler) {
        const completedDunks = [];
        
        this.activeDunks.forEach((dunkState, playerId) => {
            if (dunkState.completed) {
                completedDunks.push(playerId);
                return;
            }
            
            const frame = dunkState.animation.frames[dunkState.currentFrame];
            if (!frame) {
                dunkState.completed = true;
                return;
            }
            
            // Update frame time
            dunkState.frameTime += deltaTime;
            
            // Apply position changes
            const lerpFactor = Math.min(dunkState.frameTime / frame.duration, 1);
            
            // Vertical position
            dunkState.player.position.y = frame.position.y;
            
            // Move toward hoop with acceleration
            const toHoop = new THREE.Vector3()
                .subVectors(dunkState.targetHoop.position, dunkState.startPosition);
            toHoop.y = 0; // Only horizontal movement
            
            // Use a curve for more dynamic movement
            const progress = (dunkState.currentFrame + lerpFactor) / dunkState.animation.frames.length;
            const curvedProgress = Math.sin(progress * Math.PI * 0.5); // Ease-out curve
            
            // Scale movement based on distance to hoop
            const distanceToHoop = toHoop.length();
            toHoop.normalize();
            
            // Move more aggressively toward the hoop
            const moveDistance = Math.min(distanceToHoop, distanceToHoop * curvedProgress * 1.2);
            const horizontalOffset = toHoop.multiplyScalar(moveDistance);
            
            dunkState.player.position.x = dunkState.startPosition.x + horizontalOffset.x;
            dunkState.player.position.z = dunkState.startPosition.z + horizontalOffset.z;
            
            // Apply rotation
            if (frame.rotation !== undefined) {
                dunkState.player.sprite.rotation = frame.rotation;
            }
            
            // Update ball position if player has it
            if (frame.ballOffset && ballHandler.playerHasBall(playerId)) {
                // Handle both Vector3 and plain objects
                let ballPos;
                if (dunkState.player.position.clone) {
                    ballPos = dunkState.player.position.clone();
                } else {
                    ballPos = new THREE.Vector3(
                        dunkState.player.position.x,
                        dunkState.player.position.y,
                        dunkState.player.position.z
                    );
                }
                ballPos.x += frame.ballOffset.x;
                ballPos.y += frame.ballOffset.y;
                ballPos.z += frame.ballOffset.z;
                
                if (ballHandler.basketball.position.copy) {
                    ballHandler.basketball.position.copy(ballPos);
                } else {
                    ballHandler.basketball.position.x = ballPos.x;
                    ballHandler.basketball.position.y = ballPos.y;
                    ballHandler.basketball.position.z = ballPos.z;
                }
            }
            
            // Check for slam frame
            if (frame.slam && !dunkState.slammed) {
                dunkState.slammed = true;
                this.onDunkSlam(dunkState);
            }
            
            // Move to next frame
            if (dunkState.frameTime >= frame.duration) {
                dunkState.currentFrame++;
                dunkState.frameTime = 0;
                
                // Check if animation complete
                if (dunkState.currentFrame >= dunkState.animation.frames.length) {
                    dunkState.completed = true;
                    this.onDunkComplete(dunkState);
                }
            }
        });
        
        // Clean up completed dunks
        completedDunks.forEach(playerId => {
            console.log('Cleaning up completed dunk for player:', playerId);
            this.activeDunks.delete(playerId);
        });
    }
    
    // Called when the ball hits the rim
    onDunkSlam(dunkState) {
        console.log(`${dunkState.player.name} slams it home!`);
        // This is where we'd trigger rim shake, particles, etc.
    }
    
    // Called when dunk animation completes
    onDunkComplete(dunkState) {
        console.log(`${dunkState.player.name || 'Player'} completes the dunk!`);
        console.log('Resetting player state from dunk');
        
        // Reset player state
        dunkState.player.position.y = 0;
        if (dunkState.player.sprite) {
            dunkState.player.sprite.rotation = 0;
            dunkState.player.sprite.setAnimation('idle');
        }
        
        // Remove from active dunks
        this.activeDunks.delete(dunkState.player.id);
        console.log('Active dunks remaining:', this.activeDunks.size);
    }
    
    // Check if a player is currently dunking
    isDunking(playerId) {
        return this.activeDunks.has(playerId);
    }
    
    // Get current dunk progress (0-1)
    getDunkProgress(playerId) {
        const dunkState = this.activeDunks.get(playerId);
        if (!dunkState) return 0;
        
        const totalFrames = dunkState.animation.frames.length;
        return (dunkState.currentFrame + (dunkState.frameTime / dunkState.animation.frames[dunkState.currentFrame].duration)) / totalFrames;
    }
}