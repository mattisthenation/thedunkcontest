// network-manager.js - Handles Socket.io communication

class NetworkManager {
    constructor(gameClient) {
        this.gameClient = gameClient;
        this.socket = io();
        this.playerId = null;
        this.connected = false;
        
        this.setupSocketListeners();
    }
    
    setupSocketListeners() {
        // Connection established
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.connected = true;
            this.updateConnectionStatus('Connected', true);
        });
        
        // Initialize game with server data
        this.socket.on('initialize', (data) => {
            console.log('Initializing game', data);
            this.playerId = data.playerId;
            this.gameClient.initializeFromServer(data);
        });
        
        // New player joined
        this.socket.on('playerJoined', (playerData) => {
            console.log('Player joined:', playerData.name);
            this.gameClient.addPlayer(playerData);
        });
        
        // Player moved
        this.socket.on('playerMoved', (data) => {
            this.gameClient.updatePlayerPosition(data);
        });
        
        // Player left
        this.socket.on('playerLeft', (playerId) => {
            console.log('Player left:', playerId);
            this.gameClient.removePlayer(playerId);
        });
        
        // Ball picked up
        this.socket.on('ballPickedUp', (data) => {
            this.gameClient.handleBallPickup(data);
        });
        
        // Ball dropped
        this.socket.on('ballDropped', (data) => {
            this.gameClient.handleBallDrop(data);
        });
        
        // Dunk scored
        this.socket.on('dunkScored', (data) => {
            this.gameClient.handleDunkScored(data);
        });
        
        // Shot released
        this.socket.on('shotReleased', (data) => {
            this.gameClient.handleShotReleased(data);
        });
        
        // Ball update during flight
        this.socket.on('ballUpdate', (data) => {
            this.gameClient.updateBallPosition(data);
        });
        
        // Shot scored
        this.socket.on('shotScored', (data) => {
            this.gameClient.handleShotScored(data);
        });
        
        // Shot missed
        this.socket.on('shotMissed', (data) => {
            this.gameClient.handleShotMissed(data);
        });
        
        // Disconnected
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
            this.updateConnectionStatus('Disconnected', false);
        });
    }
    
    // Send player movement to server
    sendMovement(movementData) {
        if (this.connected) {
            this.socket.emit('move', movementData);
        }
    }
    
    // Request to pick up ball
    requestBallPickup() {
        if (this.connected) {
            this.socket.emit('pickupBall');
        }
    }
    
    // Attempt dunk
    attemptDunk(dunkType) {
        if (this.connected) {
            console.log('Sending dunk attempt to server:', dunkType);
            this.socket.emit('attemptDunk', { dunkType: dunkType || 'basic' });
        } else {
            console.log('Not connected, cannot send dunk attempt');
        }
    }
    
    // Attempt shot
    attemptShot(shotData) {
        if (this.connected) {
            this.socket.emit('attemptShot', shotData);
        }
    }
    
    // Update connection status UI
    updateConnectionStatus(text, connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = text;
            statusElement.className = connected ? '' : 'disconnected';
        }
    }
}