// game-ball.js - Basketball object and physics

class GameBall {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.position = { x: 0, y: 0.5, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.possessedBy = null;
        this.rotationSpeed = 0;
        this.bounceHeight = 1;
        this.lastBounceTime = 0;
        
        this.createBall();
    }

    createBall() {
        // Create basketball geometry
        const geometry = new THREE.SphereGeometry(0.3, 16, 16);
        
        // Create basketball texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Orange base
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(0, 0, 256, 256);
        
        // Black lines
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(128, 0);
        ctx.lineTo(128, 256);
        ctx.stroke();
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(0, 128);
        ctx.lineTo(256, 128);
        ctx.stroke();
        
        // Curved lines
        ctx.beginPath();
        ctx.arc(64, 128, 64, -Math.PI/2, Math.PI/2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(192, 128, 64, Math.PI/2, -Math.PI/2);
        ctx.stroke();
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create material
        const material = new THREE.MeshPhongMaterial({
            map: texture,
            shininess: 100,
            specular: 0x222222
        });
        
        // Create mesh
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        
        this.scene.add(this.mesh);
    }

    update(deltaTime, players) {
        if (this.possessedBy) {
            // Ball follows player
            const player = players.find(p => p.id === this.possessedBy);
            if (player) {
                // Position ball in front of player at waist height
                const offset = player.sprite.facingDirection * 0.5;
                this.position.x = player.sprite.position.x + offset;
                this.position.y = 0.8;
                this.position.z = player.sprite.position.z;
                
                // Rotate ball while dribbling
                this.mesh.rotation.x += deltaTime * 5;
            } else {
                // Player disconnected, release ball
                this.release();
            }
        } else {
            // Free ball physics
            // Gravity
            this.velocity.y -= 9.8 * deltaTime;
            
            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.position.z += this.velocity.z * deltaTime;
            
            // Bounce off ground
            if (this.position.y <= 0.3) {
                this.position.y = 0.3;
                this.velocity.y = Math.abs(this.velocity.y) * 0.8; // Energy loss
                
                // Add some random horizontal movement on bounce
                if (Date.now() - this.lastBounceTime > 100) {
                    this.velocity.x += (Math.random() - 0.5) * 0.5;
                    this.velocity.z += (Math.random() - 0.5) * 0.5;
                    this.lastBounceTime = Date.now();
                }
            }
            
            // Friction
            this.velocity.x *= 0.98;
            this.velocity.z *= 0.98;
            
            // Keep ball on court
            const courtBounds = {
                x: 9,
                z: 14
            };
            
            if (Math.abs(this.position.x) > courtBounds.x) {
                this.position.x = Math.sign(this.position.x) * courtBounds.x;
                this.velocity.x *= -0.7; // Bounce off walls
            }
            
            if (Math.abs(this.position.z) > courtBounds.z) {
                this.position.z = Math.sign(this.position.z) * courtBounds.z;
                this.velocity.z *= -0.7;
            }
            
            // Rotate ball based on movement
            const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
            this.mesh.rotation.x += speed * deltaTime * 2;
        }
        
        // Update mesh position
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    }

    possess(playerId) {
        this.possessedBy = playerId;
        this.velocity = { x: 0, y: 0, z: 0 };
    }

    release() {
        this.possessedBy = null;
        // Give ball a small upward velocity when released
        this.velocity.y = 2;
    }

    reset(x = 0, z = 0) {
        this.position = { x: x, y: 2, z: z };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.possessedBy = null;
        this.mesh.position.set(x, 2, z);
    }

    setPosition(x, y, z) {
        this.position = { x, y, z };
        this.mesh.position.set(x, y, z);
    }

    getPosition() {
        return { ...this.position };
    }

    isNearPlayer(player, distance = 1) {
        const dx = this.position.x - player.sprite.position.x;
        const dz = this.position.z - player.sprite.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        return dist < distance;
    }

    // Convert game coordinates to world coordinates
    setFromGameCoords(gameX, gameY) {
        const worldX = (gameX - 400) / 40;
        const worldZ = -(gameY - 300) / 20;
        this.setPosition(worldX, this.position.y, worldZ);
    }

    // Get game coordinates from world position
    getGameCoords() {
        return {
            x: this.position.x * 40 + 400,
            y: -this.position.z * 20 + 300
        };
    }

    // Launch ball towards hoop for dunking
    launchTowardsHoop(hoopPosition) {
        const dx = hoopPosition.x - this.position.x;
        const dy = hoopPosition.y - this.position.y;
        const dz = hoopPosition.z - this.position.z;
        
        const distance = Math.sqrt(dx * dx + dz * dz);
        const time = 0.5; // Time to reach hoop
        
        this.velocity.x = dx / time;
        this.velocity.z = dz / time;
        this.velocity.y = (dy + 0.5 * 9.8 * time * time) / time;
    }
}