// game-network.js - Socket.io client handling

class GameNetwork {
    constructor(onConnected, onGameStateUpdate) {
        this.socket = null;
        this.connected = false;
        this.onConnected = onConnected;
        this.onGameStateUpdate = onGameStateUpdate;
        this.localPlayerId = null;
        
        this.eventHandlers = new Map();
    }

    connect() {
        this.socket = io();
        
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.connected = true;
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
            this.localPlayerId = null;
            this.updateConnectionStatus(false);
        });

        // Game state events
        this.socket.on('gameState', (data) => {
            console.log('Received game state:', data);
            this.localPlayerId = this.socket.id;
            
            if (this.onConnected) {
                this.onConnected(this.localPlayerId, data);
            }
            
            // Hide loading screen
            const loading = document.getElementById('loading');
            if (loading) loading.style.display = 'none';
            
            // Show game UI
            const gameUI = document.getElementById('gameUI');
            if (gameUI) gameUI.style.display = 'block';
            
            const controls = document.getElementById('controls');
            if (controls) controls.style.display = 'block';
        });

        // Player events
        this.socket.on('playerJoined', (playerData) => {
            console.log('Player joined:', playerData);
            this.emit('playerJoined', playerData);
        });

        this.socket.on('playerMoved', (playerData) => {
            this.emit('playerMoved', playerData);
        });

        this.socket.on('playerJumped', (data) => {
            this.emit('playerJumped', data);
        });

        this.socket.on('playerLanded', (data) => {
            this.emit('playerLanded', data);
        });

        this.socket.on('playerDisconnected', (playerId) => {
            console.log('Player disconnected:', playerId);
            this.emit('playerDisconnected', playerId);
        });

        // Ball events
        this.socket.on('ballPossession', (data) => {
            this.emit('ballPossession', data);
        });

        this.socket.on('basketballMoved', (basketballData) => {
            this.emit('basketballMoved', basketballData);
        });

        // Score events
        this.socket.on('playerDunked', (data) => {
            console.log('Player dunked!', data);
            this.emit('playerDunked', data);
        });
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('connectionStatus');
        if (status) {
            status.textContent = connected ? 'Connected' : 'Disconnected';
            status.className = connected ? '' : 'disconnected';
        }
    }

    sendMovement(x, y) {
        if (this.connected) {
            this.socket.emit('playerMovement', { x, y });
        }
    }

    sendJump() {
        if (this.connected) {
            this.socket.emit('playerJump');
        }
    }

    sendGetBall() {
        if (this.connected) {
            this.socket.emit('getBall');
        }
    }

    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }

    getLocalPlayerId() {
        return this.localPlayerId;
    }

    isConnected() {
        return this.connected;
    }
}