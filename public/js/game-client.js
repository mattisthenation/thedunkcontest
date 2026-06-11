// game-client.js - Main game client logic

class GameClient {
    constructor() {
        // Three.js setup
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Game objects
        this.players = {};
        this.localPlayer = null;
        this.basketball = null;
        this.ballHandler = null;
        this.shotSystem = null;
        this.dunkAnimationSystem = null;
        this.court = null;
        
        // Sprite generators
        this.spriteGenerator = new SpritePlayerGenerator();
        
        // Input handling
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Network
        this.networkManager = null;
        
        // Initialize
        this.init();
    }
    
    init() {
        // Setup Three.js
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        
        // Create game world
        this.createCourt();
        this.createBasketball();
        
        // Initialize ball handler
        this.ballHandler = new BallHandler(this.scene, this.basketball);
        
        // Initialize shot system
        this.shotSystem = new ShotSystem(this.scene, this.ballHandler);
        
        // Initialize dunk animation system
        this.dunkAnimationSystem = new DunkAnimationSystem();
        
        // Setup input
        this.setupInputHandlers();
        
        // Initialize network
        this.networkManager = new NetworkManager(this);
        
        // Start game loop
        this.animate();
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2C5F8F);
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 10, 15);
        this.camera.lookAt(0, 2, 0);
    }
    
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupLights() {
        // Bright ambient light for good sprite visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        // Directional light for shadows
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
    
    createCourt() {
        // Main court floor (from sprite-demo)
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
        
        // Three-point lines
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
        
        // Add hoops
        this.createHoop(0, 3, -13);
        this.createHoop(0, 3, 13);
    }
    
    createHoop(x, y, z) {
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
        
        // Net
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
        const geometry = new THREE.SphereGeometry(0.3, 16, 16);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xFF6600,
            shininess: 100
        });
        this.basketball = new THREE.Mesh(geometry, material);
        this.basketball.position.set(0, 1, 0);
        this.basketball.castShadow = true;
        this.scene.add(this.basketball);
    }
    
    // Initialize from server data
    initializeFromServer(data) {
        const { playerId, gameState } = data;
        
        // Add all existing players
        for (const id in gameState.players) {
            this.addPlayer(gameState.players[id]);
        }
        
        // Set local player
        this.localPlayer = this.players[playerId];
        
        // Update ball position
        if (this.basketball) {
            this.basketball.position.set(
                gameState.ball.position.x,
                gameState.ball.position.y,
                gameState.ball.position.z
            );
        }
        
        // Update scores
        this.updateScoreboard(gameState.scores);
    }
    
    // Add a new player to the game
    addPlayer(playerData) {
        // Generate sprite for player
        const spriteData = this.spriteGenerator.generatePlayer({
            teamColors: playerData.teamColors,
            jerseyNumber: playerData.jerseyNumber
        });
        
        // Create sprite player
        const spritePlayer = new SpritePlayer(this.scene, spriteData);
        spritePlayer.moveTo(playerData.position.x, playerData.position.y, playerData.position.z);
        
        // Store player data
        this.players[playerData.id] = {
            id: playerData.id,
            name: playerData.name,
            sprite: spritePlayer,
            position: playerData.position,
            velocity: playerData.velocity,
            hasBall: playerData.hasBall
        };
        
        // Add name label
        this.addPlayerNameLabel(playerData.id);
    }
    
    // Remove player from game
    removePlayer(playerId) {
        const player = this.players[playerId];
        if (player) {
            player.sprite.dispose();
            delete this.players[playerId];
        }
    }
    
    // Update player position from network
    updatePlayerPosition(data) {
        const player = this.players[data.playerId];
        if (player && player !== this.localPlayer) {
            player.position = data.position;
            player.velocity = data.velocity;
            player.sprite.moveTo(data.position.x, data.position.y, data.position.z);
            player.sprite.setAnimation(data.animation);
            player.sprite.facingDirection = data.facingDirection;
        }
    }
    
    // Handle ball pickup
    handleBallPickup(data) {
        const player = this.players[data.playerId];
        if (player) {
            player.hasBall = true;
            player.sprite.setHasBall(true); // Update sprite animation
            // Set the ball carrier in the handler
            this.ballHandler.carrier = player;
            this.ballHandler.isBeingCarried = true;
            this.showAnnouncement(`${player.name} has the ball!`);
        }
    }
    
    // Handle ball drop
    handleBallDrop(data) {
        if (this.basketball) {
            this.basketball.position.set(data.position.x, data.position.y, data.position.z);
        }
        
        // Clear hasBall for all players
        for (const id in this.players) {
            this.players[id].hasBall = false;
            this.players[id].sprite.setHasBall(false); // Update sprite animation
        }
        
        // Release ball in handler
        this.ballHandler.release();
    }
    
    // Handle dunk scored
    handleDunkScored(data) {
        console.log('Dunk scored!', data);
        this.showAnnouncement(`${data.playerName} SCORES with a ${data.dunkType || 'slam'} dunk!`);
        
        // Update score for the player who dunked
        if (this.players[data.playerId]) {
            this.players[data.playerId].score = data.score;
        }
        
        // Update scoreboard with new score
        this.updateScoreboard({ [data.playerId]: data.score });
        
        // Drop ball at random position
        this.ballHandler.dropAtRandomPosition();
        
        // Clear ball possession for all players
        for (const id in this.players) {
            this.players[id].hasBall = false;
            if (this.players[id].sprite) {
                this.players[id].sprite.setHasBall(false);
            }
        }
        
        // Clear ball handler state
        this.ballHandler.carrier = null;
        this.ballHandler.isBeingCarried = false;
    }
    
    // Handle shot released
    handleShotReleased(data) {
        const player = this.players[data.playerId];
        if (player) {
            player.hasBall = false;
            player.sprite.setHasBall(false);
            player.sprite.setAnimation('shoot');
            
            // Release ball with velocity if local player didn't shoot
            if (data.playerId !== this.networkManager.playerId) {
                this.ballHandler.release(new THREE.Vector3(
                    data.velocity.x,
                    data.velocity.y,
                    data.velocity.z
                ));
            }
            
            this.showAnnouncement(`${data.playerName} shoots!`);
        }
    }
    
    // Handle shot scored
    handleShotScored(data) {
        this.showAnnouncement(`${data.playerName} SCORES!`);
        // Update scores
        this.updateScoreboard({ [data.playerId]: data.score });
    }
    
    // Handle shot missed
    handleShotMissed(data) {
        this.showAnnouncement(`${data.playerName} missed!`);
    }
    
    // Update ball position during flight
    updateBallPosition(data) {
        if (this.basketball) {
            this.basketball.position.set(
                data.position.x,
                data.position.y,
                data.position.z
            );
            
            // Update ball handler velocity for rotation
            if (this.ballHandler) {
                this.ballHandler.ballVelocity.set(
                    data.velocity.x,
                    data.velocity.y,
                    data.velocity.z
                );
            }
        }
    }
    
    // Add player name label (simplified for now)
    addPlayerNameLabel(playerId) {
        // This would add a floating name above the player
        // For now, we'll skip the implementation
    }
    
    // Update scoreboard
    updateScoreboard(scores) {
        const scoreList = document.getElementById('scoreList');
        if (!scoreList) return;
        
        // Update existing scores or add new ones
        for (const playerId in scores) {
            const player = this.players[playerId];
            if (player) {
                let entry = document.getElementById(`score-${playerId}`);
                if (!entry) {
                    entry = document.createElement('div');
                    entry.id = `score-${playerId}`;
                    entry.className = 'scoreEntry';
                    scoreList.appendChild(entry);
                }
                entry.innerHTML = `
                    <span>${player.name}</span>
                    <span>${scores[playerId]}</span>
                `;
            }
        }
    }
    
    // Show announcement
    showAnnouncement(text) {
        const announcement = document.getElementById('announcement');
        announcement.textContent = text;
        announcement.style.display = 'block';
        
        setTimeout(() => {
            announcement.style.display = 'none';
        }, 2000);
    }
    
    // Setup input handlers
    setupInputHandlers() {
        // Track key press state to prevent repeats
        this.keyPressed = {};
        
        // Keyboard
        document.addEventListener('keydown', (e) => {
            // Prevent key repeat for action keys
            if (e.code === 'KeyE' || e.code === 'Enter') {
                if (this.keyPressed[e.code]) return; // Already pressed
                this.keyPressed[e.code] = true;
            }
            this.keys[e.code] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.keyPressed[e.code] = false;
        });
        
        // Mouse
        document.addEventListener('mousemove', (e) => {
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
        });
    }
    
    // Handle input
    handleInput(deltaTime) {
        if (!this.localPlayer) return;
        
        const speed = 5;
        let vx = 0, vz = 0;
        
        // Movement - Support both WASD and Arrow Keys
        if (this.keys['KeyW'] || this.keys['ArrowUp']) vz = -speed;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) vz = speed;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) vx = -speed;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) vx = speed;
        
        // Update local player
        this.localPlayer.velocity.x = vx;
        this.localPlayer.velocity.z = vz;
        
        // Jump
        if (this.keys['Space'] && this.localPlayer.position.y <= 0.1) {
            this.localPlayer.velocity.y = 8;
        }
        
        // Pickup/Dunk/Shoot - Support both E and Enter
        if (this.keys['KeyE'] || this.keys['Enter']) {
            console.log('E/Enter key pressed');
            console.log('Local player:', this.localPlayer);
            console.log('Has ball:', this.localPlayer?.hasBall);
            
            if (this.localPlayer.hasBall) {
                // Check if already dunking
                if (this.dunkAnimationSystem && this.dunkAnimationSystem.isDunking(this.localPlayer.id)) {
                    console.log('Already dunking, ignoring input');
                    return;
                }
                
                // Determine action based on position
                const actionInfo = this.shotSystem.determineAction(this.localPlayer);
                console.log('Action determined:', actionInfo);
                
                if (actionInfo.action === 'dunk') {
                    console.log(`Attempting ${actionInfo.type} dunk!`);
                    
                    // Start dunk animation locally
                    this.dunkAnimationSystem.startDunk(
                        this.localPlayer,
                        actionInfo.type,
                        actionInfo.hoop
                    );
                    
                    // Send to server with dunk type
                    this.networkManager.attemptDunk(actionInfo.type);
                } else if (actionInfo.action === 'shoot') {
                    console.log(`Shooting from ${actionInfo.zone} range`);
                    
                    // Execute the shot
                    const shotResult = this.shotSystem.executeShot(this.localPlayer, actionInfo);
                    
                    // Play shooting animation
                    this.localPlayer.sprite.setAnimation('shoot');
                    this.localPlayer.sprite.setHasBall(false);
                    this.localPlayer.hasBall = false;
                    
                    // Send to server
                    this.networkManager.attemptShot({
                        velocity: shotResult.trajectory,
                        targetHoop: shotResult.hoop.position,
                        willScore: shotResult.willScore
                    });
                }
            } else {
                console.log('Attempting ball pickup');
                console.log('Ball handler:', this.ballHandler);
                console.log('Ball position:', this.basketball?.position);
                console.log('Player position:', this.localPlayer?.position);
                
                // Try local pickup first
                if (this.ballHandler.attemptPickup(this.localPlayer)) {
                    console.log('Local pickup successful');
                    this.localPlayer.hasBall = true;
                    this.localPlayer.sprite.setHasBall(true); // Update sprite animation
                    this.networkManager.requestBallPickup();
                } else {
                    console.log('Local pickup failed - too far from ball');
                }
            }
            // Prevent repeat
            this.keys['KeyE'] = false;
            this.keys['Enter'] = false;
        }
    }
    
    // Update physics
    updatePhysics(deltaTime) {
        if (!this.localPlayer) return;
        
        // Don't update physics for dunking players
        if (this.dunkAnimationSystem && this.dunkAnimationSystem.isDunking(this.localPlayer.id)) {
            // Just send position updates during dunk
            this.networkManager.sendMovement({
                position: this.localPlayer.position,
                velocity: { x: 0, y: 0, z: 0 },
                animation: this.localPlayer.sprite.currentAnimation,
                facingDirection: this.localPlayer.sprite.facingDirection
            });
            return;
        }
        
        // Apply gravity
        if (this.localPlayer.position.y > 0) {
            this.localPlayer.velocity.y -= 20 * deltaTime;
        }
        
        // Update position
        this.localPlayer.position.x += this.localPlayer.velocity.x * deltaTime;
        this.localPlayer.position.y += this.localPlayer.velocity.y * deltaTime;
        this.localPlayer.position.z += this.localPlayer.velocity.z * deltaTime;
        
        // Ground collision
        if (this.localPlayer.position.y < 0) {
            this.localPlayer.position.y = 0;
            this.localPlayer.velocity.y = 0;
        }
        
        // Court boundaries
        this.localPlayer.position.x = Math.max(-9, Math.min(9, this.localPlayer.position.x));
        this.localPlayer.position.z = Math.max(-14, Math.min(14, this.localPlayer.position.z));
        
        // Apply friction
        this.localPlayer.velocity.x *= 0.9;
        this.localPlayer.velocity.z *= 0.9;
        
        // Update sprite
        this.localPlayer.sprite.moveTo(
            this.localPlayer.position.x,
            this.localPlayer.position.y,
            this.localPlayer.position.z
        );
        
        // Update animation based on state
        const moving = Math.abs(this.localPlayer.velocity.x) > 0.1 || Math.abs(this.localPlayer.velocity.z) > 0.1;
        const jumping = this.localPlayer.position.y > 0.1;
        const shooting = this.localPlayer.sprite.currentAnimation === 'shoot';
        const dunking = this.localPlayer.sprite.currentAnimation && this.localPlayer.sprite.currentAnimation.startsWith('dunk_');
        
        // Don't override shooting or dunking animations
        if (!shooting && !dunking) {
            if (jumping) {
                this.localPlayer.sprite.setAnimation('jump');
            } else if (moving && this.localPlayer.hasBall) {
                this.localPlayer.sprite.setAnimation('dribble');
            } else if (moving) {
                this.localPlayer.sprite.setAnimation('run');
            } else {
                this.localPlayer.sprite.setAnimation('idle');
            }
        }
        
        // Update facing direction
        if (this.localPlayer.velocity.x > 0.1) {
            this.localPlayer.sprite.facingDirection = 1;
        } else if (this.localPlayer.velocity.x < -0.1) {
            this.localPlayer.sprite.facingDirection = -1;
        }
        
        // Send movement to server
        this.networkManager.sendMovement({
            position: this.localPlayer.position,
            velocity: this.localPlayer.velocity,
            animation: this.localPlayer.sprite.currentAnimation,
            facingDirection: this.localPlayer.sprite.facingDirection
        });
        
        // Ball handler updates ball position automatically
        // No need to manually update ball position here
    }
    
    // Update camera
    updateCamera() {
        // Smooth camera follow with mouse look
        const targetX = this.mouseX * 5;
        const targetY = 10 - this.mouseY * 3;
        
        this.camera.position.x += (targetX - this.camera.position.x) * 0.05;
        this.camera.position.y += (targetY - this.camera.position.y) * 0.05;
        
        // Follow local player if exists
        if (this.localPlayer) {
            const targetZ = this.localPlayer.position.z + 15;
            this.camera.position.z += (targetZ - this.camera.position.z) * 0.1;
            this.camera.lookAt(
                this.localPlayer.position.x,
                2,
                this.localPlayer.position.z
            );
        } else {
            this.camera.lookAt(0, 2, 0);
        }
    }
    
    // Window resize
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // Main game loop
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Handle input
        this.handleInput(deltaTime);
        
        // Update physics
        this.updatePhysics(deltaTime);
        
        // Update camera
        this.updateCamera();
        
        // Update all player sprites
        for (const id in this.players) {
            this.players[id].sprite.update(deltaTime);
        }
        
        // Update ball handler
        if (this.ballHandler) {
            this.ballHandler.update(deltaTime);
        }
        
        // Update dunk animations
        if (this.dunkAnimationSystem) {
            this.dunkAnimationSystem.update(deltaTime, this.ballHandler);
        }
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }
}

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
    const game = new GameClient();
});