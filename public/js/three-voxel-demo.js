// three-voxel-demo.js - Demo file to test voxel player generation

class VoxelPlayerDemo {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.generator = null;
        this.players = [];
        this.animationId = null;
        this.clock = new THREE.Clock();
        
        this.init();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 2, 5);
        this.camera.lookAt(0, 1, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        // Add lights
        this.setupLights();
        
        // Create ground
        this.createGround();
        
        // Initialize player generator
        this.generator = new VoxelPlayerGenerator();
        
        // Create demo players
        this.createDemoPlayers();
        
        // Add controls
        this.setupControls();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Start animation loop
        this.animate();
    }

    setupLights() {
        // Ambient light for overall brightness
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light for shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 5);
        directionalLight.castShadow = true;
        
        // Shadow camera setup
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        
        this.scene.add(directionalLight);
        
        // Add rim light for player highlights
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
        rimLight.position.set(-5, 10, -5);
        this.scene.add(rimLight);
    }

    createGround() {
        // Basketball court style ground
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xD2691E, // Wood color
            shininess: 30
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Add court lines
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        const lineGeometry = new THREE.PlaneGeometry(0.1, 10);
        
        // Center line
        const centerLine = new THREE.Mesh(lineGeometry, lineMaterial);
        centerLine.rotation.x = -Math.PI / 2;
        centerLine.position.y = 0.01;
        this.scene.add(centerLine);
        
        // Three-point line (simplified arc)
        const arcGeometry = new THREE.RingGeometry(3, 3.1, 32, 1, 0, Math.PI);
        const arc = new THREE.Mesh(arcGeometry, lineMaterial);
        arc.rotation.x = -Math.PI / 2;
        arc.position.y = 0.01;
        arc.position.z = -3;
        this.scene.add(arc);
    }

    createDemoPlayers() {
        // Generate a random matchup
        const matchup = this.generator.generateRandomMatchup(this.scene);
        
        // Position team 1
        matchup.team1.players[0].setPosition(-2, 0, 0);
        matchup.team1.players[1].setPosition(-2, 0, 2);
        
        // Position team 2
        matchup.team2.players[0].setPosition(2, 0, 0);
        matchup.team2.players[1].setPosition(2, 0, 2);
        
        // Make team 2 face the other direction
        matchup.team2.players.forEach(player => {
            player.setRotation(Math.PI);
        });
        
        // Store players for animation
        this.players = [
            ...matchup.team1.players,
            ...matchup.team2.players
        ];
        
        // Display team info
        this.displayTeamInfo(matchup);
    }

    displayTeamInfo(matchup) {
        // Create info display
        const infoDiv = document.createElement('div');
        infoDiv.style.position = 'absolute';
        infoDiv.style.top = '10px';
        infoDiv.style.left = '10px';
        infoDiv.style.color = 'white';
        infoDiv.style.fontFamily = 'Arial, sans-serif';
        infoDiv.style.fontSize = '14px';
        infoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        infoDiv.style.padding = '10px';
        infoDiv.style.borderRadius = '5px';
        
        let html = '<h3 style="margin: 0 0 10px 0;">VOXEL BASKETBALL DEMO</h3>';
        
        html += `<div style="margin-bottom: 10px;"><strong>${matchup.team1.colors.name} Team:</strong><br>`;
        matchup.team1.players.forEach(player => {
            html += `#${player.dna.jerseyNumber} ${player.dna.name}<br>`;
            html += `Stats - SPD: ${player.dna.stats.speed} DNK: ${player.dna.stats.dunking}<br>`;
        });
        html += '</div>';
        
        html += `<div><strong>${matchup.team2.colors.name} Team:</strong><br>`;
        matchup.team2.players.forEach(player => {
            html += `#${player.dna.jerseyNumber} ${player.dna.name}<br>`;
            html += `Stats - SPD: ${player.dna.stats.speed} DNK: ${player.dna.stats.dunking}<br>`;
        });
        html += '</div>';
        
        html += '<br><small>Press SPACE to regenerate players<br>Press 1-3 for animations</small>';
        
        infoDiv.innerHTML = html;
        document.body.appendChild(infoDiv);
    }

    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            switch(event.code) {
                case 'Space':
                    this.regeneratePlayers();
                    break;
                case 'Digit1':
                    this.setAllAnimations('idle');
                    break;
                case 'Digit2':
                    this.setAllAnimations('run');
                    break;
                case 'Digit3':
                    this.setAllAnimations('jump');
                    break;
            }
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
            this.camera.position.x = mouseX * 3;
            this.camera.position.y = 2 - mouseY * 2;
            this.camera.lookAt(0, 1, 0);
        };
    }

    setAllAnimations(animationName) {
        this.players.forEach(player => {
            player.setAnimation(animationName);
        });
    }

    regeneratePlayers() {
        // Clear existing players
        this.generator.clearAllPlayers();
        
        // Remove info display
        const infoDiv = document.querySelector('div');
        if (infoDiv) infoDiv.remove();
        
        // Create new players
        this.createDemoPlayers();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Update camera based on mouse
        if (this.updateCamera) {
            this.updateCamera();
        }
        
        // Update all players
        this.generator.updateAll(deltaTime);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Clean up Three.js resources
        this.generator.clearAllPlayers();
        this.renderer.dispose();
        
        // Remove DOM elements
        document.body.removeChild(this.renderer.domElement);
    }
}

// Auto-start demo if this script is loaded directly
if (typeof window !== 'undefined' && !window.voxelPlayerDemo) {
    // Wait for Three.js to load
    function startDemo() {
        if (typeof THREE !== 'undefined') {
            window.voxelPlayerDemo = new VoxelPlayerDemo();
        } else {
            setTimeout(startDemo, 100);
        }
    }
    
    // Load required scripts first
    const scripts = [
        'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
        '/js/three-voxel-utils.js',
        '/js/three-voxel-player.js',
        '/js/three-voxel-generator.js'
    ];
    
    let loadedCount = 0;
    scripts.forEach(src => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            loadedCount++;
            if (loadedCount === scripts.length) {
                startDemo();
            }
        };
        document.head.appendChild(script);
    });
}