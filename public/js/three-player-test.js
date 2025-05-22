// three-player-test.js - Test and demonstrate the player models

import * as THREE from 'three';
import ThreeJSManager from './three/three-core.js';
import Player from './three/three-player.js';

// Team colors for testing
const TEAM_COLORS = {
    0: { // Red team
        primary: 0xcc3333,
        secondary: 0x882222,
        name: 'Rockets'
    },
    1: { // Blue team
        primary: 0x3344cc,
        secondary: 0x222288,
        name: 'Mavericks'
    },
    2: { // Green team
        primary: 0x33cc33,
        secondary: 0x228822,
        name: 'Celtics'
    },
    3: { // Yellow team
        primary: 0xcccc33,
        secondary: 0x888822,
        name: 'Lakers'
    }
};

// Skin tones for diversity
const SKIN_TONES = [
    0xeed6c0, // Light
    0xd2a789, // Medium
    0xa67358, // Medium-dark
    0x784a3a, // Dark
    0x5a3828  // Very dark
];

// Test player names
const PLAYER_NAMES = [
    'Jordan', 'Curry', 'James', 'Bryant', 'Durant',
    'Bird', 'Johnson', 'O\'Neal', 'Iverson', 'Carter',
    'Wade', 'Nowitzki', 'Duncan', 'Harden', 'Antetokounmpo'
];

class PlayerTestApp {
    constructor() {
        this.players = [];
        this.selectedPlayer = null;
        this.keyStates = {};
        this.mousePosition = new THREE.Vector2();
        
        // Bind methods
        this.init = this.init.bind(this);
        this.createTestPlayers = this.createTestPlayers.bind(this);
        this.update = this.update.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.createDebugUI = this.createDebugUI.bind(this);
    }
    
    /**
     * Initialize the test app
     */
    init() {
        // Initialize Three.js
        ThreeJSManager.init({
            container: document.getElementById('game-container') || document.body,
            enableControls: true
        });
        
        // Create floor plane
        this.createFloor();
        
        // Create test players
        this.createTestPlayers();
        
        // Add event listeners
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('click', this.handleClick);
        
        // Create debug UI
        this.createDebugUI();
        
        // Select the first player
        if (this.players.length > 0) {
            this.selectPlayer(this.players[0]);
        }
        
        // Add our update function to the ThreeJSManager
        const originalUpdate = ThreeJSManager.updateGameObjects;
        ThreeJSManager.updateGameObjects = (delta) => {
            originalUpdate(delta);
            this.update(delta);
        };
        
        console.log('Player test initialized with ' + this.players.length + ' players');
    }
    
    /**
     * Create floor plane
     */
    createFloor() {
        const geometry = new THREE.PlaneGeometry(50, 50);
        const material = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const floor = new THREE.Mesh(geometry, material);
        floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        floor.receiveShadow = true;
        floor.name = 'floor';
        
        ThreeJSManager.scene.add(floor);
    }
    
    /**
     * Create test players
     */
    createTestPlayers() {
        // Clear existing players
        this.players.forEach(player => player.dispose());
        this.players = [];
        
        // Create players in a circle
        const playerCount = 8;
        const radius = 8;
        
        for (let i = 0; i < playerCount; i++) {
            // Calculate position in circle
            const angle = (i / playerCount) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Create player with random properties
            const teamId = i % Object.keys(TEAM_COLORS).length;
            const skinTone = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
            const playerName = PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)];
            const jerseyNumber = Math.floor(Math.random() * 99) + 1;
            
            // Randomize height slightly
            const heightVariation = Math.random() * 0.3 - 0.15; // -0.15 to +0.15
            
            const player = new Player(i, {
                name: playerName,
                teamId: teamId,
                jerseyColor: TEAM_COLORS[teamId].primary,
                shortsColor: TEAM_COLORS[teamId].secondary,
                skinTone: skinTone,
                jerseyNumber: jerseyNumber,
                jerseyName: playerName.toUpperCase(),
                height: 1.9 + heightVariation // Base height 1.9m + variation
            });
            
            player.init();
            player.setPosition(new THREE.Vector3(x, 0, z));
            
            // Make player face center
            player.object.lookAt(0, 0, 0);
            
            // Enable debug features for visualization
            player.debug.showColliders = true;
            
            this.players.push(player);
        }
    }
    
    /**
     * Update method called each frame
     * @param {number} delta - Time since last frame
     */
    update(delta) {
        // Update all players
        this.players.forEach(player => player.update(delta));
        
        // Handle input for selected player
        if (this.selectedPlayer) {
            // Movement direction
            const moveDirection = new THREE.Vector3(0, 0, 0);
            
            if (this.keyStates['w'] || this.keyStates['ArrowUp']) {
                moveDirection.z -= 1;
            }
            
            if (this.keyStates['s'] || this.keyStates['ArrowDown']) {
                moveDirection.z += 1;
            }
            
            if (this.keyStates['a'] || this.keyStates['ArrowLeft']) {
                moveDirection.x -= 1;
            }
            
            if (this.keyStates['d'] || this.keyStates['ArrowRight']) {
                moveDirection.x += 1;
            }
            
            // Apply movement if any direction is pressed
            if (moveDirection.length() > 0) {
                moveDirection.normalize();
                this.selectedPlayer.move(moveDirection);
            }
            
            // Jump
            if (this.keyStates[' '] && this.selectedPlayer.isOnGround) {
                this.selectedPlayer.jump();
            }
            
            // Dunk
            if (this.keyStates['Shift'] && this.selectedPlayer.isOnGround) {
                this.selectedPlayer.dunk();
            }
            
            // Celebrate
            if (this.keyStates['c']) {
                this.selectedPlayer.celebrate();
            }
        }
    }
    
    /**
     * Handle key down event
     * @param {KeyboardEvent} event - Key event
     */
    handleKeyDown(event) {
        this.keyStates[event.key] = true;
        
        // Player selection with number keys
        if (!isNaN(parseInt(event.key)) && parseInt(event.key) >= 0 && parseInt(event.key) < this.players.length) {
            this.selectPlayer(this.players[parseInt(event.key)]);
        }
    }
    
    /**
     * Handle key up event
     * @param {KeyboardEvent} event - Key event
     */
    handleKeyUp(event) {
        this.keyStates[event.key] = false;
    }
    
    /**
     * Handle mouse move event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        // Calculate normalized mouse position (-1 to 1)
        this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    
    /**
     * Handle mouse click event
     * @param {MouseEvent} event - Mouse event
     */
    handleClick(event) {
        // Implement player selection via raycasting
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.mousePosition, ThreeJSManager.camera);
        
        // Get all potential intersections with players
        const intersects = [];
        
        this.players.forEach(player => {
            player.object.traverse(object => {
                if (object.isMesh) {
                    const intersection = raycaster.intersectObject(object);
                    if (intersection.length > 0) {
                        intersects.push({ player, distance: intersection[0].distance });
                    }
                }
            });
        });
        
        // Select closest player if any
        if (intersects.length > 0) {
            // Sort by distance
            intersects.sort((a, b) => a.distance - b.distance);
            this.selectPlayer(intersects[0].player);
        }
    }
    
    /**
     * Select a player
     * @param {Player} player - Player to select
     */
    selectPlayer(player) {
        // Deselect current player if any
        if (this.selectedPlayer) {
            // Reset any visual indication of selection
            if (this.selectedHighlight) {
                this.selectedHighlight.parent.remove(this.selectedHighlight);
                this.selectedHighlight.geometry.dispose();
                this.selectedHighlight.material.dispose();
                this.selectedHighlight = null;
            }
        }
        
        // Set new selected player
        this.selectedPlayer = player;
        
        // Add visual indication of selection
        const geometry = new THREE.RingGeometry(1.2, 1.4, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            side: THREE.DoubleSide
        });
        
        this.selectedHighlight = new THREE.Mesh(geometry, material);
        this.selectedHighlight.rotation.x = -Math.PI / 2; // Lay flat
        this.selectedHighlight.position.y = 0.01; // Slightly above ground
        
        player.object.add(this.selectedHighlight);
        
        // Update debug UI
        this.updateDebugUI();
        
        console.log(`Selected player: ${player.name} (ID: ${player.id})`);
    }
    
    /**
     * Create debug UI for player testing
     */
    createDebugUI() {
        // Create UI container
        const container = document.createElement('div');
        container.id = 'debug-ui';
        container.style.position = 'absolute';
        container.style.top = '10px';
        container.style.left = '10px';
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        container.style.color = 'white';
        container.style.padding = '10px';
        container.style.borderRadius = '5px';
        container.style.fontFamily = 'monospace';
        container.style.fontSize = '14px';
        container.style.zIndex = '1000';
        container.style.maxWidth = '300px';
        
        document.body.appendChild(container);
        
        // Create header
        const header = document.createElement('h2');
        header.textContent = 'NBA Jam-Style Player Test';
        header.style.margin = '0 0 10px 0';
        header.style.fontSize = '16px';
        container.appendChild(header);
        
        // Create content container
        const content = document.createElement('div');
        content.id = 'debug-content';
        container.appendChild(content);
        
        // Create controls help
        const controls = document.createElement('div');
        controls.innerHTML = `
            <h3>Controls:</h3>
            <p>WASD/Arrows: Move player</p>
            <p>Space: Jump</p>
            <p>Shift: Dunk</p>
            <p>C: Celebrate</p>
            <p>0-7: Select player</p>
            <p>Click: Select player</p>
        `;
        controls.style.marginTop = '20px';
        controls.style.fontSize = '12px';
        container.appendChild(controls);
        
        // Save UI elements
        this.debugUI = {
            container,
            content
        };
        
        this.updateDebugUI();
    }
    
    /**
     * Update debug UI with current player info
     */
    updateDebugUI() {
        if (!this.debugUI || !this.selectedPlayer) return;
        
        const player = this.selectedPlayer;
        const team = TEAM_COLORS[player.teamId];
        
        this.debugUI.content.innerHTML = `
            <div>
                <b>Player:</b> ${player.name} #${player.options.jerseyNumber}
            </div>
            <div>
                <b>Team:</b> ${team.name}
            </div>
            <div>
                <b>Height:</b> ${player.options.height.toFixed(2)}m
            </div>
            <div>
                <b>State:</b> ${player.state}
            </div>
            <div>
                <b>Position:</b> ${player.position.x.toFixed(2)}, ${player.position.y.toFixed(2)}, ${player.position.z.toFixed(2)}
            </div>
            <div>
                <b>Velocity:</b> ${player.velocity.length().toFixed(2)}
            </div>
        `;
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        // Remove event listeners
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('click', this.handleClick);
        
        // Dispose of players
        this.players.forEach(player => player.dispose());
        
        // Remove UI
        if (this.debugUI && this.debugUI.container) {
            document.body.removeChild(this.debugUI.container);
        }
    }
}

// Create and initialize test app
const playerTestApp = new PlayerTestApp();

// Initialize test when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', playerTestApp.init);
} else {
    playerTestApp.init();
}

export default playerTestApp;
