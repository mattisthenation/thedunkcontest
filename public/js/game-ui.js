// game-ui.js - User interface management

class GameUI {
    constructor() {
        this.playerListElement = document.getElementById('playerList');
        this.messageQueue = [];
        this.messageTimeout = null;
    }

    updatePlayerList(players) {
        if (!this.playerListElement) return;
        
        // Clear current list
        this.playerListElement.innerHTML = '';
        
        // Sort players by score
        const sortedPlayers = Array.from(players)
            .sort((a, b) => (b.data.score || 0) - (a.data.score || 0));
        
        // Add each player
        sortedPlayers.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-info';
            playerDiv.style.borderColor = player.data.outfit.primaryColor;
            
            const isLocalPlayer = player.id === player.sprite.scene.userData.localPlayerId;
            
            playerDiv.innerHTML = `
                <strong style="color: ${player.data.outfit.primaryColor}">
                    ${index + 1}. ${player.name} ${isLocalPlayer ? '(YOU)' : ''}
                </strong><br>
                Score: ${player.data.score || 0} points
                ${player.data.hasBall ? '<br>🏀 HAS BALL' : ''}
            `;
            
            this.playerListElement.appendChild(playerDiv);
        });
    }

    showMessage(message, duration = 3000, color = '#FFD700') {
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-family: 'Courier New', monospace;
            font-size: 48px;
            font-weight: bold;
            color: ${color};
            text-shadow: 4px 4px 0px #000;
            text-align: center;
            pointer-events: none;
            z-index: 1000;
            animation: messagePopIn 0.5s ease-out;
        `;
        messageDiv.innerHTML = message;
        
        // Add animation style
        const style = document.createElement('style');
        style.textContent = `
            @keyframes messagePopIn {
                0% { transform: translate(-50%, -50%) scale(0); }
                50% { transform: translate(-50%, -50%) scale(1.2); }
                100% { transform: translate(-50%, -50%) scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(messageDiv);
        
        // Remove after duration
        setTimeout(() => {
            messageDiv.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => {
                messageDiv.remove();
                style.remove();
            }, 500);
        }, duration);
    }

    showDunkMessage(playerName, score) {
        const messages = [
            `${playerName} SLAMS IT HOME!`,
            `${playerName} WITH THE JAM!`,
            `BOOM SHAKA LAKA!`,
            `${playerName} IS ON FIRE!`,
            `MONSTER DUNK BY ${playerName}!`
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.showMessage(`${message}<br><span style="font-size: 24px">Score: ${score}</span>`, 2000, '#FF0000');
    }

    showJoinMessage(playerName) {
        this.showMessage(`${playerName} ENTERS THE GAME!`, 1500, '#00FF00');
    }

    showLeaveMessage(playerName) {
        this.showMessage(`${playerName} LEFT THE GAME`, 1500, '#FF0000');
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('connectionStatus');
        if (status) {
            status.textContent = connected ? 'Connected' : 'Disconnected';
            status.className = connected ? '' : 'disconnected';
        }
    }

    setLoadingVisible(visible) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = visible ? 'block' : 'none';
        }
    }

    setGameUIVisible(visible) {
        const gameUI = document.getElementById('gameUI');
        if (gameUI) {
            gameUI.style.display = visible ? 'block' : 'none';
        }
        
        const controls = document.getElementById('controls');
        if (controls) {
            controls.style.display = visible ? 'block' : 'none';
        }
    }

    // Helper to format time
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}