// three-game-integration.js - Bridge between 2D multiplayer game and 3D sprite system

// Check if Three.js is available
if (typeof THREE === 'undefined') {
    console.error('Three.js not loaded! Make sure Three.js script is included before this file.');
    throw new Error('Three.js is required');
}

class ThreeGameIntegration {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Player and game state
        this.spritePlayers = {};
        this.spriteGenerator = null;
        this.basketball = null;
        this.court = null;
        
        // Animation and effects
        this.dunkAnimations = {
            active: false,
            player: null,
            startTime: 0,
            duration: 900,
            startPosition: { x: 0, y: 0, z: 0 },
            endPosition: { x: 0, y: 0, z: 0 },
            callback: null
        };
        
        this.cameraShake = {
            active: false,
            duration: 0,
            intensity: 0,
            startTime: 0,
            originalPosition: new THREE.Vector3()
        };
        
        this.init();
    }

    init() {
        console.log('ThreeGameIntegration: Initializing...');
        
        // Create Three.js scene
        this.createScene();
        console.log('ThreeGameIntegration: Scene created');
        
        this.setupLights();
        console.log('ThreeGameIntegration: Lights set up');
        
        this.create3DCourt();
        console.log('ThreeGameIntegration: Court created');
        
        // Initialize sprite generator
        this.spriteGenerator = new SpritePlayerGenerator();
        console.log('ThreeGameIntegration: Sprite generator initialized');
        
        // Create basketball
        this.createBasketball();
        console.log('ThreeGameIntegration: Basketball created');
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Replace the canvas with Three.js renderer
        this.replaceCanvas();
        console.log('ThreeGameIntegration: Initialization complete!');
    }

    createScene() {
        // EXACT COPY from sprite-player-demo.js
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2C5F8F); // Dark blue for contrast
        
        // Create camera - more angled for better sprite viewing
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 2, 0);
        this.cameraShake.originalPosition.copy(this.camera.position);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            canvas: document.getElementById('game-canvas')
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(window.devicePixelRatio);
    }

    setupLights() {
        // EXACT COPY from sprite-player-demo.js
        // Bright ambient for good sprite visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        // Directional light for court shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -15;
        directionalLight.shadow.camera.right = 15;
        directionalLight.shadow.camera.top = 15;
        directionalLight.shadow.camera.bottom = -15;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }

    create3DCourt() {
        // EXACT COPY from sprite-player-demo.js
        // Main court floor
        const courtGeometry = new THREE.PlaneGeometry(20, 30);
        const courtMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xD2691E,
            shininess: 80
        });
        const court = new THREE.Mesh(courtGeometry, courtMaterial);
        court.rotation.x = -Math.PI / 2;
        court.receiveShadow = true;
        this.scene.add(court);
        
        // Court lines
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        
        // Center line
        const centerLineGeometry = new THREE.PlaneGeometry(0.2, 20);
        const centerLine = new THREE.Mesh(centerLineGeometry, lineMaterial);
        centerLine.rotation.x = -Math.PI / 2;
        centerLine.rotation.z = Math.PI / 2;
        centerLine.position.y = 0.01;
        this.scene.add(centerLine);
        
        // Three-point lines (simplified)
        const arcRadius = 6.75;
        const arcGeometry = new THREE.RingGeometry(arcRadius - 0.1, arcRadius + 0.1, 32, 1, 0, Math.PI);
        
        const leftArc = new THREE.Mesh(arcGeometry, lineMaterial);
        leftArc.rotation.x = -Math.PI / 2;
        leftArc.position.set(0, 0.01, -10);
        this.scene.add(leftArc);
        
        const rightArc = new THREE.Mesh(arcGeometry, lineMaterial);
        rightArc.rotation.x = -Math.PI / 2;
        rightArc.rotation.z = Math.PI;
        rightArc.position.set(0, 0.01, 10);
        this.scene.add(rightArc);
        
        // Add hoops (simple 3D representation)
        this.createHoop(0, 3, -13);
        this.createHoop(0, 3, 13);
        
        // Store court info for game mechanics
        this.court = {
            width: 20,
            height: 30,
            hoopX: 0,
            hoopY: 3,
            hoopZ: -13
        };
    }

    createHoop(x, y, z) {
        // EXACT COPY from sprite-player-demo.js
        // Backboard
        const backboardGeometry = new THREE.BoxGeometry(6, 4, 0.2);
        const backboardMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8
        });
        const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
        backboard.position.set(x, y + 1.5, z);
        backboard.castShadow = true;
        this.scene.add(backboard);
        
        // Rim
        const rimGeometry = new THREE.TorusGeometry(0.75, 0.05, 8, 16);
        const rimMaterial = new THREE.MeshPhongMaterial({ color: 0xFF4500 });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(x, y, z > 0 ? z - 1.2 : z + 1.2);
        rim.castShadow = true;
        this.scene.add(rim);
        
        // Net (simplified)
        const netGeometry = new THREE.CylinderGeometry(0.75, 0.5, 0.8, 8, 1, true);
        const netMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const net = new THREE.Mesh(netGeometry, netMaterial);
        net.position.set(x, y - 0.4, z > 0 ? z - 1.2 : z + 1.2);
        this.scene.add(net);
    }

    createBasketball() {
        // Create 3D basketball
        const ballGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const ballMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xff6600,
            shininess: 100
        });
        this.basketball = new THREE.Mesh(ballGeometry, ballMaterial);
        this.basketball.castShadow = true;
        this.basketball.position.set(0, 0.3, 0);
        this.scene.add(this.basketball);
        
        // Add pickup range indicator (optional - for debugging)
        if (true) { // Set to false to hide
            const rangeGeometry = new THREE.RingGeometry(2.4, 2.5, 32);
            const rangeMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x00ff00,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            this.pickupRange = new THREE.Mesh(rangeGeometry, rangeMaterial);
            this.pickupRange.rotation.x = -Math.PI / 2;
            this.pickupRange.position.y = 0.02;
            this.scene.add(this.pickupRange);
        }
    }

    replaceCanvas() {
        // The renderer is already using the existing canvas element
        // Clear any existing 2D context
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            // Remove any existing 2D context
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            
            // Set proper size
            canvas.style.width = '100%';
            canvas.style.height = '100%';
        }
    }

    // Convert 2D coordinates to 3D world space (for 20x30 court like demo)
    convert2DTo3D(x2d, y2d) {
        // Map 2D canvas coordinates (0-800, 0-600) to 3D world coordinates (20x30 court)
        const x3d = ((x2d - 400) / 400) * 10; // Map to -10 to 10 (court width 20)
        const z3d = ((y2d - 300) / 300) * 15; // Map to -15 to 15 (court length 30)
        return { x: x3d, y: 0, z: z3d }; // Remove the negation to fix direction
    }

    // Convert 3D coordinates back to 2D for compatibility
    convert3DTo2D(x3d, y3d, z3d) {
        const x2d = (x3d / 10) * 400 + 400;
        const y2d = (z3d / 15) * 300 + 300; // Remove the negation to match forward conversion
        return { x: x2d, y: y2d };
    }

    // Player management
    createSpritePlayer(playerId, playerData) {
        console.log('Creating sprite player for:', playerId, playerData);
        
        // Use sprite configuration from server if available
        const spriteConfig = playerData.spriteConfig || {};
        
        // Generate sprite for this player using the exact same method as demo
        const spriteData = this.spriteGenerator.generatePlayer({
            teamColors: { 
                primary: playerData.outfit.primaryColor, 
                secondary: playerData.outfit.secondaryColor 
            },
            jerseyNumber: spriteConfig.jerseyNumber || (parseInt(playerId.slice(0, 2), 36) % 99 + 1),
            hairStyle: spriteConfig.hairStyle || Math.floor(Math.random() * 5),
            bodyType: spriteConfig.bodyType || 'athletic',
            skinTone: null // Use random
        });
        
        console.log('Generated sprite data:', spriteData);
        
        // Create sprite player (exactly like demo)
        const spritePlayer = new SpritePlayer(this.scene, spriteData);
        
        // Convert 2D position to 3D (scale to match court size)
        const pos3d = this.convert2DTo3D(playerData.x, playerData.y);
        spritePlayer.moveTo(pos3d.x, 0, pos3d.z); // Y=0 for ground level
        
        // Store additional data (keep spriteData intact for animations)
        spritePlayer.playerId = playerId;
        spritePlayer.gamePlayerData = playerData; // Store game data separately
        spritePlayer.hasBall = playerData.hasBall;
        
        this.spritePlayers[playerId] = spritePlayer;
        console.log('Created sprite player successfully');
        return spritePlayer;
    }

    updateSpritePlayer(playerId, playerData) {
        const spritePlayer = this.spritePlayers[playerId];
        if (!spritePlayer) return;
        
        // Update position (Y=0 for ground level like demo)
        const pos3d = this.convert2DTo3D(playerData.x, playerData.y);
        spritePlayer.moveTo(pos3d.x, 0, pos3d.z);
        
        // Update player state (keep sprite data intact)
        spritePlayer.gamePlayerData = playerData;
        spritePlayer.hasBall = playerData.hasBall;
        
        // Update animation based on state (exactly like demo)
        if (playerData.isJumping) {
            spritePlayer.setAnimation('jump');
        } else {
            // Check if moving
            const prevPos = spritePlayer.prevPosition || pos3d;
            const isMoving = Math.abs(prevPos.x - pos3d.x) > 0.05 || Math.abs(prevPos.z - pos3d.z) > 0.05;
            spritePlayer.setAnimation(isMoving ? 'run' : 'idle');
            
            // Update facing direction based on movement
            if (isMoving) {
                const dx = pos3d.x - prevPos.x;
                if (Math.abs(dx) > 0.05) {
                    spritePlayer.facingDirection = dx > 0 ? 1 : -1;
                }
            }
        }
        
        spritePlayer.prevPosition = { ...pos3d };
    }

    removeSpritePlayer(playerId) {
        const spritePlayer = this.spritePlayers[playerId];
        if (spritePlayer) {
            spritePlayer.dispose();
            delete this.spritePlayers[playerId];
        }
    }

    // Basketball management
    updateBasketball(basketballData) {
        if (!this.basketball) return;
        
        const pos3d = this.convert2DTo3D(basketballData.x, basketballData.y);
        // If someone has the ball, lift it higher
        const yOffset = basketballData.possessedBy ? 2 : 0.3;
        this.basketball.position.set(pos3d.x, yOffset, pos3d.z);
        
        // Update pickup range indicator
        if (this.pickupRange) {
            if (basketballData.possessedBy) {
                this.pickupRange.visible = false;
            } else {
                this.pickupRange.visible = true;
                this.pickupRange.position.x = pos3d.x;
                this.pickupRange.position.z = pos3d.z;
            }
        }
    }

    // Animation and effects
    startDunkAnimation(playerId, startPos, endPos, callback) {
        const spritePlayer = this.spritePlayers[playerId];
        if (!spritePlayer) return;
        
        this.dunkAnimations.active = true;
        this.dunkAnimations.player = spritePlayer;
        this.dunkAnimations.startTime = Date.now();
        this.dunkAnimations.startPosition = this.convert2DTo3D(startPos.x, startPos.y);
        this.dunkAnimations.endPosition = this.convert2DTo3D(endPos.x, endPos.y);
        this.dunkAnimations.callback = callback;
        
        spritePlayer.setAnimation('jump');
    }

    updateDunkAnimation() {
        if (!this.dunkAnimations.active) return;
        
        const elapsed = Date.now() - this.dunkAnimations.startTime;
        const progress = Math.min(1, elapsed / this.dunkAnimations.duration);
        const player = this.dunkAnimations.player;
        
        if (!player) {
            this.dunkAnimations.active = false;
            return;
        }
        
        // Smooth easing
        const t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        
        // Interpolate position
        const startPos = this.dunkAnimations.startPosition;
        const endPos = this.dunkAnimations.endPosition;
        
        const x = startPos.x + (endPos.x - startPos.x) * t;
        const z = startPos.z + (endPos.z - startPos.z) * t;
        const y = Math.sin(progress * Math.PI) * 3; // Arc for jumping
        
        player.moveTo(x, y, z);
        
        if (progress === 1) {
            this.dunkAnimations.active = false;
            player.setAnimation('idle');
            
            if (this.dunkAnimations.callback) {
                this.dunkAnimations.callback();
            }
        }
    }

    addCameraShake(duration = 500, intensity = 0.5) {
        this.cameraShake.active = true;
        this.cameraShake.duration = duration;
        this.cameraShake.intensity = intensity;
        this.cameraShake.startTime = Date.now();
    }

    updateCameraShake() {
        if (!this.cameraShake.active) return;
        
        const elapsed = Date.now() - this.cameraShake.startTime;
        
        if (elapsed < this.cameraShake.duration) {
            const progress = elapsed / this.cameraShake.duration;
            const currentIntensity = this.cameraShake.intensity * (1 - progress);
            
            const offsetX = (Math.random() - 0.5) * currentIntensity;
            const offsetY = (Math.random() - 0.5) * currentIntensity;
            const offsetZ = (Math.random() - 0.5) * currentIntensity;
            
            this.camera.position.copy(this.cameraShake.originalPosition);
            this.camera.position.add(new THREE.Vector3(offsetX, offsetY, offsetZ));
        } else {
            this.cameraShake.active = false;
            this.camera.position.copy(this.cameraShake.originalPosition);
        }
        
        this.camera.lookAt(0, 2, 0);
    }

    // Main update loop
    update() {
        const deltaTime = this.clock.getDelta();
        
        // Update dunk animations
        this.updateDunkAnimation();
        
        // Update camera shake
        this.updateCameraShake();
        
        // Update all sprite players
        Object.values(this.spritePlayers).forEach(player => {
            player.update(deltaTime);
        });
    }

    render() {
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        // Update camera and renderer for full window
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Utility methods for game integration
    getPlayerPosition2D(playerId) {
        const spritePlayer = this.spritePlayers[playerId];
        if (!spritePlayer) return null;
        
        return this.convert3DTo2D(
            spritePlayer.position.x,
            spritePlayer.position.y,
            spritePlayer.position.z
        );
    }

    getBasketballPosition2D() {
        if (!this.basketball) return null;
        
        return this.convert3DTo2D(
            this.basketball.position.x,
            this.basketball.position.y,
            this.basketball.position.z
        );
    }
}

// Export for use in game.js
window.ThreeGameIntegration = ThreeGameIntegration;