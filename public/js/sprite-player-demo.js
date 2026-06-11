// sprite-player-demo.js - Demo for sprite-based players

class SpritePlayerDemo {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.teamGenerator = null;
        this.teams = null;
        this.animationId = null;
        this.clock = new THREE.Clock();
        this.keys = {};
        
        this.init();
    }

    init() {
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
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        // Add lights
        this.setupLights();
        
        // Create 3D court
        this.create3DCourt();
        
        // Initialize team generator and create teams
        this.teamGenerator = new SpriteTeamGenerator();
        this.createTeams();
        
        // Add controls
        this.setupControls();
        
        // Add UI
        this.createUI();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Start animation loop
        this.animate();
    }

    setupLights() {
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

    createTeams() {
        // Clear existing teams if any
        if (this.teams) {
            this.teams.team1.players.forEach(p => p.dispose());
            this.teams.team2.players.forEach(p => p.dispose());
        }
        
        // Generate new matchup
        this.teams = this.teamGenerator.generateMatchup(this.scene);
        
        // Position players
        this.teams.team1.players[0].moveTo(-3, 0, -2);
        this.teams.team1.players[1].moveTo(-3, 0, 2);
        
        this.teams.team2.players[0].moveTo(3, 0, -2);
        this.teams.team2.players[1].moveTo(3, 0, 2);
        
        // Make team 2 face the other way
        this.teams.team2.players.forEach(player => {
            player.facingDirection = -1;
        });
    }

    createUI() {
        // Create info display
        const infoDiv = document.createElement('div');
        infoDiv.id = 'info';
        infoDiv.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            color: white;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            background-color: rgba(0, 0, 0, 0.8);
            padding: 15px;
            border-radius: 5px;
            border: 2px solid #FFD700;
            text-shadow: 2px 2px 0px #000;
        `;
        
        this.updateUI();
        document.body.appendChild(infoDiv);
    }

    updateUI() {
        const infoDiv = document.getElementById('info');
        if (!infoDiv || !this.teams) return;
        
        let html = '<h3 style="margin: 0 0 10px 0; color: #FFD700;">NBA JAM STYLE DEMO</h3>';
        
        html += `<div style="margin-bottom: 10px;"><strong style="color: ${this.teams.team1.colors.primary}">${this.teams.team1.name.toUpperCase()} TEAM:</strong><br>`;
        this.teams.team1.players.forEach(player => {
            html += `#${player.playerData.config.jerseyNumber}<br>`;
        });
        html += '</div>';
        
        html += `<div style="margin-bottom: 10px;"><strong style="color: ${this.teams.team2.colors.primary}">${this.teams.team2.name.toUpperCase()} TEAM:</strong><br>`;
        this.teams.team2.players.forEach(player => {
            html += `#${player.playerData.config.jerseyNumber}<br>`;
        });
        html += '</div>';
        
        html += `
            <div style="margin-top: 15px; font-size: 12px; color: #FFD700;">
                CONTROLS:<br>
                SPACE - New Teams<br>
                WASD - Move Player 1<br>
                Q - Player 1 Jump<br>
                Mouse - Camera
            </div>
        `;
        
        infoDiv.innerHTML = html;
    }

    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            if (e.code === 'Space') {
                this.createTeams();
                this.updateUI();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // Mouse controls for camera
        let mouseX = 0;
        let mouseY = 0;
        
        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            mouseY = (event.clientY / window.innerHeight) * 2 - 1;
        });
        
        // Update camera in animation loop
        this.updateCamera = () => {
            const targetX = mouseX * 5;
            const targetY = 8 - mouseY * 3;
            
            this.camera.position.x += (targetX - this.camera.position.x) * 0.1;
            this.camera.position.y += (targetY - this.camera.position.y) * 0.1;
            this.camera.lookAt(0, 2, 0);
        };
    }

    handleInput() {
        if (!this.teams) return;
        
        const player = this.teams.team1.players[0];
        const speed = 5;
        
        let vx = 0, vz = 0;
        
        // Movement
        if (this.keys['KeyW']) vz = -speed;
        if (this.keys['KeyS']) vz = speed;
        if (this.keys['KeyA']) vx = -speed;
        if (this.keys['KeyD']) vx = speed;
        
        player.setVelocity(vx, player.velocity.y, vz);
        
        // Jump
        if (this.keys['KeyQ'] && !player.isJumping) {
            player.jump();
        }
    }

    updatePhysics(deltaTime) {
        if (!this.teams) return;
        
        // Update all players
        const allPlayers = [
            ...this.teams.team1.players,
            ...this.teams.team2.players
        ];
        
        allPlayers.forEach(player => {
            // Apply gravity if jumping
            if (player.isJumping) {
                player.velocity.y -= 20 * deltaTime; // Gravity
                player.position.y += player.velocity.y * deltaTime;
                
                // Check if landed
                if (player.position.y <= 0) {
                    player.position.y = 0;
                    player.land();
                }
            }
            
            // Apply velocity
            player.position.x += player.velocity.x * deltaTime;
            player.position.z += player.velocity.z * deltaTime;
            
            // Apply friction
            player.velocity.x *= 0.9;
            player.velocity.z *= 0.9;
            
            // Keep players on court
            player.position.x = Math.max(-9, Math.min(9, player.position.x));
            player.position.z = Math.max(-14, Math.min(14, player.position.z));
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Handle input
        this.handleInput();
        
        // Update physics
        this.updatePhysics(deltaTime);
        
        // Update camera
        if (this.updateCamera) {
            this.updateCamera();
        }
        
        // Update all players
        if (this.teams) {
            [...this.teams.team1.players, ...this.teams.team2.players].forEach(player => {
                player.update(deltaTime);
            });
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Clean up
        if (this.teams) {
            this.teams.team1.players.forEach(p => p.dispose());
            this.teams.team2.players.forEach(p => p.dispose());
        }
        
        this.renderer.dispose();
        document.body.removeChild(this.renderer.domElement);
    }
}

// Auto-start demo
if (typeof window !== 'undefined' && !window.spritePlayerDemo) {
    window.addEventListener('DOMContentLoaded', () => {
        window.spritePlayerDemo = new SpritePlayerDemo();
    });
}