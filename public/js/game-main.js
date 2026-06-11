// game-main.js - Main game initialization and loop

class DunkContestGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        this.gameScene = new GameScene();
        this.players = null;
        this.ball = null;
        this.network = null;
        this.input = new GameInput();
        this.ui = new GameUI();
        
        this.localPlayer = null;
        this.lastMovementSent = { x: 0, y: 0 };
        this.movementThreshold = 5; // Minimum movement before sending update
        
        this.hoopPositions = [];
        
        this.init();
    }

    init() {
        // Initialize Three.js scene
        const sceneData = this.gameScene.init();
        this.scene = sceneData.scene;
        this.camera = sceneData.camera;
        this.renderer = sceneData.renderer;
        
        // Store local player ID in scene for UI
        this.scene.userData.localPlayerId = null;
        
        // Get hoop positions
        this.hoopPositions = this.gameScene.getHoopPositions();
        
        // Initialize game systems
        this.players = new GamePlayers(this.scene);
        this.ball = new GameBall(this.scene);
        
        // Initialize network
        this.network = new GameNetwork(
            (localPlayerId, gameState) => this.onConnected(localPlayerId, gameState),
            (gameState) => this.onGameStateUpdate(gameState)
        );
        
        // Set up network event handlers
        this.setupNetworkHandlers();
        
        // Connect to server
        this.network.connect();
        
        // Start game loop
        this.animate();
    }

    onConnected(localPlayerId, gameState) {
        console.log('Connected as player:', localPlayerId);
        
        // Store local player ID
        this.scene.userData.localPlayerId = localPlayerId;
        this.players.setLocalPlayer(localPlayerId);
        
        // Create all existing players
        for (const playerId in gameState.players) {
            const playerData = gameState.players[playerId];
            this.players.createPlayer(playerData);
        }
        
        // Set basketball position
        if (gameState.basketball) {
            this.ball.setFromGameCoords(gameState.basketball.x, gameState.basketball.y);
            if (gameState.basketball.possessedBy) {
                this.ball.possess(gameState.basketball.possessedBy);
            }
        }
        
        // Update UI
        this.ui.setLoadingVisible(false);
        this.ui.setGameUIVisible(true);
        this.updateUI();
    }

    setupNetworkHandlers() {
        // Player joined
        this.network.on('playerJoined', (playerData) => {
            this.players.createPlayer(playerData);
            this.ui.showJoinMessage(playerData.name);
            this.updateUI();
        });
        
        // Player moved
        this.network.on('playerMoved', (playerData) => {
            this.players.updatePlayer(playerData.id, playerData);
        });
        
        // Player jumped
        this.network.on('playerJumped', (data) => {
            const player = this.players.players.get(data.playerId);
            if (player) {
                player.data.isJumping = true;
                player.sprite.setAnimation('jump');
            }
        });
        
        // Player landed
        this.network.on('playerLanded', (data) => {
            const player = this.players.players.get(data.playerId);
            if (player) {
                player.data.isJumping = false;
            }
        });
        
        // Player disconnected
        this.network.on('playerDisconnected', (playerId) => {
            const player = this.players.players.get(playerId);
            if (player) {
                this.ui.showLeaveMessage(player.name);
            }
            this.players.removePlayer(playerId);
            this.updateUI();
        });
        
        // Ball possession
        this.network.on('ballPossession', (data) => {
            this.ball.possess(data.playerId);
            
            // Update player data
            this.players.getAllPlayers().forEach(player => {
                player.data.hasBall = player.id === data.playerId;
            });
            
            this.updateUI();
        });
        
        // Basketball moved
        this.network.on('basketballMoved', (basketballData) => {
            this.ball.setFromGameCoords(basketballData.x, basketballData.y);
            this.ball.release();
        });
        
        // Player dunked
        this.network.on('playerDunked', (data) => {
            const player = this.players.players.get(data.playerId);
            if (player) {
                player.data.score = data.playerScore;
                this.ui.showDunkMessage(data.playerName, data.playerScore);
                
                // Trigger dunk animation/effects
                this.triggerDunkEffects(data);
            }
            this.updateUI();
        });
    }

    handleInput(deltaTime) {
        const localPlayer = this.players.getLocalPlayer();
        if (!localPlayer || !this.network.isConnected()) return;
        
        // Get movement input
        const movement = this.input.getMovementVector();
        const speed = 150; // Game units per second
        
        if (movement.x !== 0 || movement.z !== 0) {
            // Calculate new position in game coordinates
            const worldPos = localPlayer.sprite.position;
            const gamePos = this.players.worldToGameCoords(worldPos.x, worldPos.z);
            
            const newX = gamePos.x + movement.x * speed * deltaTime;
            const newY = gamePos.y - movement.z * speed * deltaTime; // Negative because Z is inverted
            
            // Check if movement is significant enough to send
            const dx = Math.abs(newX - this.lastMovementSent.x);
            const dy = Math.abs(newY - this.lastMovementSent.y);
            
            if (dx > this.movementThreshold || dy > this.movementThreshold) {
                this.network.sendMovement(newX, newY);
                this.lastMovementSent = { x: newX, y: newY };
                
                // Update local player immediately for responsiveness
                localPlayer.data.x = newX;
                localPlayer.data.y = newY;
                this.players.updatePlayer(localPlayer.id, localPlayer.data);
            }
        }
        
        // Handle jump
        if (this.input.isJumping() && !localPlayer.data.isJumping) {
            this.network.sendJump();
            localPlayer.data.isJumping = true;
        }
        
        // Handle ball grab
        if (this.input.isGrabbingBall() && !localPlayer.data.hasBall) {
            // Check if player is near ball
            if (this.ball.isNearPlayer(localPlayer)) {
                this.network.sendGetBall();
            }
        }
    }

    triggerDunkEffects(dunkData) {
        // TODO: Add particle effects, camera shake, etc.
        console.log('Dunk effects triggered for:', dunkData);
    }

    updateUI() {
        this.ui.updatePlayerList(this.players.getAllPlayers());
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Handle input
        this.handleInput(deltaTime);
        
        // Update game objects
        this.players.update(deltaTime, this.camera, this.renderer);
        this.ball.update(deltaTime, this.players.getAllPlayers());
        
        // Render
        this.gameScene.render();
    }
}

// Start game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Starting Dunk Contest Game...');
    window.game = new DunkContestGame();
});