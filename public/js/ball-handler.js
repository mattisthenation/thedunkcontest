// ball-handler.js - Manages ball possession and physics

class BallHandler {
    constructor(scene, basketball) {
        this.scene = scene;
        this.basketball = basketball;
        this.carrier = null; // Current player carrying the ball
        this.isBeingCarried = false;
        
        // Ball physics properties
        this.ballVelocity = new THREE.Vector3(0, 0, 0);
        this.ballRotation = new THREE.Vector3(0, 0, 0);
        this.gravity = -15;
        this.bounceDamping = 0.7;
        this.rollingFriction = 0.98;
        
        // Ball offset positions for different states
        this.offsets = {
            dribbling: { x: 0.6, y: 0.8, z: 0.3 },
            shooting: { x: 0, y: 2.5, z: 0.2 },
            dunking: { x: 0.3, y: 2.8, z: 0.5 },
            carrying: { x: 0.5, y: 1.5, z: 0.3 }
        };
        
        // Visual indicator for ball possession
        this.createPossessionIndicator();
        
        // Visual indicator for pickup radius
        this.createPickupIndicator();
    }
    
    createPossessionIndicator() {
        // Create a glowing ring that appears under the player with the ball
        const geometry = new THREE.RingGeometry(0.8, 1.0, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFFFF00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.possessionIndicator = new THREE.Mesh(geometry, material);
        this.possessionIndicator.rotation.x = -Math.PI / 2;
        this.possessionIndicator.visible = false;
        this.scene.add(this.possessionIndicator);
    }
    
    createPickupIndicator() {
        // Create a ring that shows the pickup radius around the ball
        const geometry = new THREE.RingGeometry(2.3, 2.5, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00FF00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        this.pickupIndicator = new THREE.Mesh(geometry, material);
        this.pickupIndicator.rotation.x = -Math.PI / 2;
        this.pickupIndicator.visible = false;
        this.scene.add(this.pickupIndicator);
    }
    
    // Attempt to pick up the ball
    attemptPickup(player) {
        if (this.isBeingCarried) {
            return false; // Someone already has it
        }
        
        // Calculate distance to ball
        // Handle both plain objects and Vector3
        let distance;
        if (player.position.distanceTo) {
            // Three.js Vector3 object
            distance = player.position.distanceTo(this.basketball.position);
        } else {
            // Plain object with x, y, z
            const dx = player.position.x - this.basketball.position.x;
            const dy = player.position.y - this.basketball.position.y;
            const dz = player.position.z - this.basketball.position.z;
            distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        // Check if player is close enough (increased from 1.5 to 2.5 units)
        if (distance < 2.5) {
            this.carrier = player;
            this.isBeingCarried = true;
            console.log(`${player.name || 'Player'} picked up the ball!`);
            
            // Show possession indicator
            this.possessionIndicator.visible = true;
            
            return true;
        }
        
        return false;
    }
    
    // Release the ball (for shooting or dropping)
    release(velocity = null) {
        if (!this.isBeingCarried) return;
        
        console.log(`${this.carrier.name || 'Player'} released the ball`);
        
        // Set ball velocity if provided (for shooting)
        if (velocity) {
            if (velocity.isVector3) {
                this.ballVelocity.copy(velocity);
            } else {
                // Plain object with x, y, z
                this.ballVelocity.set(velocity.x, velocity.y, velocity.z);
            }
        } else {
            // Just drop it
            this.ballVelocity.set(0, 0, 0);
        }
        
        // Clear carrier
        this.carrier = null;
        this.isBeingCarried = false;
        
        // Hide possession indicator
        this.possessionIndicator.visible = false;
    }
    
    // Force drop (when player disconnects, etc)
    forceDrop() {
        if (this.isBeingCarried && this.carrier) {
            // Position ball at carrier's location
            if (this.carrier.position.copy && this.basketball.position.copy) {
                // Three.js Vector3 objects
                this.basketball.position.copy(this.carrier.position);
                this.basketball.position.y += 1;
            } else {
                // Plain objects
                this.basketball.position.x = this.carrier.position.x;
                this.basketball.position.y = this.carrier.position.y + 1;
                this.basketball.position.z = this.carrier.position.z;
            }
            
            this.release();
        }
    }
    
    // Update ball position and physics
    update(deltaTime) {
        try {
            if (this.isBeingCarried && this.carrier) {
                // Ball follows carrier
                this.updateCarriedBall();
                
                // Update possession indicator position
                this.possessionIndicator.position.x = this.carrier.position.x;
                this.possessionIndicator.position.y = 0.1; // Just above ground
                this.possessionIndicator.position.z = this.carrier.position.z;
                
                // Animate the indicator
                this.possessionIndicator.rotation.z += deltaTime * 2;
                const scale = 1 + Math.sin(Date.now() * 0.003) * 0.1;
                this.possessionIndicator.scale.set(scale, scale, 1);
                
                // Hide pickup indicator when ball is carried
                this.pickupIndicator.visible = false;
            } else {
                // Ball physics when not carried
                this.updateFreeBall(deltaTime);
                
                // Show pickup indicator when ball is on ground and stationary
                const speed = this.ballVelocity.length();
                if (this.basketball.position.y <= 0.5 && speed < 0.5) {
                    this.pickupIndicator.visible = true;
                    this.pickupIndicator.position.x = this.basketball.position.x;
                    this.pickupIndicator.position.y = 0.05;
                    this.pickupIndicator.position.z = this.basketball.position.z;
                    
                    // Pulse animation
                    const pulse = 0.9 + Math.sin(Date.now() * 0.003) * 0.1;
                    this.pickupIndicator.scale.set(pulse, pulse, 1);
                    this.pickupIndicator.material.opacity = 0.2 + Math.sin(Date.now() * 0.002) * 0.1;
                } else {
                    this.pickupIndicator.visible = false;
                }
            }
            
            // Always rotate the ball
            this.basketball.rotation.x += this.ballRotation.x * deltaTime;
            this.basketball.rotation.y += this.ballRotation.y * deltaTime;
            this.basketball.rotation.z += this.ballRotation.z * deltaTime;
        } catch (error) {
            console.error('Error in ball-handler update:', error);
            console.error('Carrier:', this.carrier);
            console.error('Basketball:', this.basketball);
        }
    }
    
    updateCarriedBall() {
        // Get the appropriate offset based on player state
        const offset = this.getOffsetForState();
        
        // Calculate ball position relative to player
        const angle = this.carrier.sprite ? this.carrier.sprite.facingDirection : 1;
        const facingAngle = angle > 0 ? 0 : Math.PI;
        
        this.basketball.position.x = this.carrier.position.x + Math.cos(facingAngle) * offset.x;
        this.basketball.position.y = this.carrier.position.y + offset.y;
        this.basketball.position.z = this.carrier.position.z + Math.sin(facingAngle) * offset.z;
        
        // Gentle rotation while carried
        this.ballRotation.set(2, 3, 1);
    }
    
    updateFreeBall(deltaTime) {
        // Apply gravity
        this.ballVelocity.y += this.gravity * deltaTime;
        
        // Update position
        this.basketball.position.x += this.ballVelocity.x * deltaTime;
        this.basketball.position.y += this.ballVelocity.y * deltaTime;
        this.basketball.position.z += this.ballVelocity.z * deltaTime;
        
        // Ground collision
        if (this.basketball.position.y <= 0.3) {
            this.basketball.position.y = 0.3;
            
            // Bounce
            if (Math.abs(this.ballVelocity.y) > 0.1) {
                this.ballVelocity.y *= -this.bounceDamping;
                
                // Add some random horizontal movement on bounce
                this.ballVelocity.x += (Math.random() - 0.5) * 0.5;
                this.ballVelocity.z += (Math.random() - 0.5) * 0.5;
            } else {
                this.ballVelocity.y = 0;
            }
        }
        
        // Apply rolling friction when on ground
        if (this.basketball.position.y <= 0.31) {
            this.ballVelocity.x *= this.rollingFriction;
            this.ballVelocity.z *= this.rollingFriction;
            
            // Stop tiny movements
            if (Math.abs(this.ballVelocity.x) < 0.01) this.ballVelocity.x = 0;
            if (Math.abs(this.ballVelocity.z) < 0.01) this.ballVelocity.z = 0;
        }
        
        // Court boundaries
        const bound = 14;
        if (Math.abs(this.basketball.position.x) > 9) {
            this.basketball.position.x = Math.sign(this.basketball.position.x) * 9;
            this.ballVelocity.x *= -0.8;
        }
        if (Math.abs(this.basketball.position.z) > bound) {
            this.basketball.position.z = Math.sign(this.basketball.position.z) * bound;
            this.ballVelocity.z *= -0.8;
        }
        
        // Rotation based on velocity
        const speed = this.ballVelocity.length();
        this.ballRotation.set(
            this.ballVelocity.z * 5,
            0,
            -this.ballVelocity.x * 5
        );
    }
    
    getOffsetForState() {
        // This will be expanded when we add animations
        if (!this.carrier) return this.offsets.carrying;
        
        // For now, check if player is moving for dribble
        const moving = this.carrier.velocity && 
            (Math.abs(this.carrier.velocity.x) > 0.1 || 
             Math.abs(this.carrier.velocity.z) > 0.1);
        
        return moving ? this.offsets.dribbling : this.offsets.carrying;
    }
    
    // Drop ball at random court position (after score)
    dropAtRandomPosition() {
        const x = (Math.random() - 0.5) * 16; // -8 to 8
        const z = (Math.random() - 0.5) * 20; // -10 to 10
        
        this.basketball.position.set(x, 3, z); // Drop from height
        this.ballVelocity.set(0, 0, 0);
        
        this.release();
    }
    
    // Check if a specific player has the ball
    playerHasBall(playerId) {
        return this.isBeingCarried && this.carrier && this.carrier.id === playerId;
    }
    
    // Get current ball carrier info
    getCarrier() {
        return this.carrier;
    }
}